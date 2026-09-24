// 채점 미완료 분리: AI 응답 형식 오류는 0점이 아니라 채점 실패이고, 채점 미완료 기록은
// 오늘 완료 문제 수(랭킹)와 단원 완료에 반영하지 않는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');

function compile(file, requireImpl) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, require: requireImpl }, { filename: file });
  return module.exports;
}

function gradingWith(responseText) {
  return compile(path.join(ROOT, 'src/domain/grading.ts'), name => {
    if (name === '../data/db') return { getGeminiApiKey: async () => 'test-key-123456' };
    if (name === './ai_client') {
      return { callUniversalAiCompletion: async () => ({ text: responseText }), parseAiJsonResponse: JSON.parse };
    }
    if (name === './generator_validation') return { normalizeComparableText: text => text };
    throw new Error(`Unexpected dependency ${name}`);
  });
}

const shortAnswer = { questionType: 'short_answer', modelAnswer: '서울' };

test('cancelling the AI data notice fails grading with a notice reason, not a network error', async () => {
  const grading = compile(path.join(ROOT, 'src/domain/grading.ts'), name => {
    if (name === '../data/db') return { getGeminiApiKey: async () => 'test-key-123456' };
    if (name === './ai_client') {
      return {
        callUniversalAiCompletion: async () => { const e = new Error('declined'); e.name = 'GenerationCancelledError'; throw e; },
        parseAiJsonResponse: JSON.parse,
      };
    }
    if (name === './generator_validation') return { normalizeComparableText: text => text };
    throw new Error(`Unexpected dependency ${name}`);
  });
  const result = await grading.gradeSubjectiveAnswer(shortAnswer, '서울');
  assert.equal(result.gradingStatus, 'failed');
  assert.match(result.gradingFailedReason, /전송 안내/);
});
const essay = {
  questionType: 'essay',
  modelAnswer: '원점은 왼쪽 위, Y는 아래로 증가',
  gradingChecklist: [{ id: 'c1', criterion: '원점', points: 50 }, { id: 'c2', criterion: 'Y축 방향', points: 50 }],
};

test('short answer is graded only when correct is a real boolean', async () => {
  for (const text of ['{"correct":"true"}', '{}', '[{"correct":true}]', '{"correct":1}', '{"correct":null}']) {
    const result = await gradingWith(text).gradeSubjectiveAnswer(shortAnswer, '서울');
    assert.equal(result.gradingStatus, 'failed', text);
    assert.equal(result.gradingScore, undefined, text);
    assert.match(result.gradingFailedReason, /응답 형식/);
  }
  assert.deepEqual(
    { ...(await gradingWith('{"correct":true}').gradeSubjectiveAnswer(shortAnswer, '서울')) },
    { gradingStatus: 'graded', gradingScore: 100 }
  );
  assert.equal((await gradingWith('{"correct":false}').gradeSubjectiveAnswer(shortAnswer, '부산')).gradingScore, 0);
});

test('essay checklist must list every item exactly once with a boolean met', async () => {
  const invalid = {
    missing: [{ id: 'c1', met: true }],
    duplicate: [{ id: 'c1', met: true }, { id: 'c1', met: false }],
    stringMet: [{ id: 'c1', met: true }, { id: 'c2', met: 'true' }],
    unknownId: [{ id: 'c1', met: true }, { id: 'c9', met: true }],
    extra: [{ id: 'c1', met: true }, { id: 'c2', met: true }, { id: 'c3', met: false }],
    notArray: { c1: true, c2: true },
  };
  for (const [label, checklistResult] of Object.entries(invalid)) {
    const result = await gradingWith(JSON.stringify({ checklistResult })).gradeSubjectiveAnswer(essay, '답안');
    assert.equal(result.gradingStatus, 'failed', label);
    assert.equal(result.gradingScore, undefined, label);
  }
  const valid = await gradingWith(JSON.stringify({ checklistResult: [{ id: 'c2', met: false }, { id: 'c1', met: true }] }))
    .gradeSubjectiveAnswer(essay, '답안');
  assert.equal(valid.gradingStatus, 'graded');
  assert.equal(valid.gradingScore, 50);
  assert.deepEqual(Array.from(valid.gradingChecklistResult, item => ({ ...item })), [{ id: 'c1', met: true }, { id: 'c2', met: false }]);
});

function loadDomain(file) {
  const cache = new Map();
  const load = target => {
    if (cache.has(target)) return cache.get(target);
    const exports = compile(target, name => load(path.resolve(path.dirname(target), `${name}.ts`)));
    cache.set(target, exports);
    return exports;
  };
  return load(path.join(ROOT, file));
}

test('today completed count excludes grading-incomplete attempts', () => {
  const { countTodayCompletedQuestions } = loadDomain('src/domain/ranking.ts');
  const at = new Date(2026, 8, 25, 12).toISOString();
  const attempts = [
    { submissionKey: 'sub-mc-1', isCorrect: false, submittedAt: at },
    { submissionKey: 'sub-essay-1', isCorrect: false, gradingStatus: 'failed', submittedAt: at },
    { submissionKey: 'sub-short-1', isCorrect: true, gradingStatus: 'graded', submittedAt: at },
    { submissionKey: 'sub-pending-1', isCorrect: false, gradingStatus: 'pending', submittedAt: at },
  ];
  assert.equal(countTodayCompletedQuestions(attempts, '2026-09-25'), 2);
});

// 실제 useExamSession을 가짜 db 위에서 실행해 단원 완료 처리 여부만 본다.
function examHook() {
  const state = [];
  let cursor = 0;
  const completed = [];
  const react = {
    useState(value) { const i = cursor++; if (!(i in state)) state[i] = value; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
    useRef(value) { const i = cursor++; if (!(i in state)) state[i] = { current: value }; return state[i]; },
    useCallback: fn => fn,
  };
  let id = 0;
  const db = {
    getAttempts: async () => [],
    generateUUID: () => `id-${++id}`,
    getCurrentISOTime: () => new Date(2026, 8, 25, 12).toISOString(),
    saveLastStudiedTopicId: async () => {},
    markUnitAsCompleted: async unitId => { completed.push(unitId); },
    saveReviewState: async () => {},
    saveAttempt: async () => {},
  };
  const cache = new Map();
  const load = file => {
    if (cache.has(file)) return cache.get(file);
    const exports = compile(file, name => {
      if (name === 'react') return react;
      if (name === '../data/db') return db;
      if (name === '../utils/alert') return { showAlert() {} };
      if (name === '../domain/ranking_sync') return { syncRankingProgress: async () => {} };
      return load(path.resolve(path.dirname(file), `${name}.ts`));
    });
    cache.set(file, exports);
    return exports;
  };
  const { useExamSession } = load(path.join(ROOT, 'src/hooks/useExamSession.ts'));
  const props = {
    questions: [], reviewStates: [], units: [{ id: 'U' }], topics: [], selectedTopicId: null, selectedUnitId: null,
    setSelectedTopicId() {}, setLastStudiedTopicId() {}, onRefreshData: async () => {},
  };
  let hook;
  const render = () => { cursor = 0; hook = useExamSession(props); return hook; };
  render();
  return { completed, start(questions) { hook.startExam(questions); return render(); } };
}

const q = (id, questionType) => ({
  id, questionId: id, topicId: 'T', unitId: 'U', questionType, difficultyLevel: 10,
  ...(questionType === 'multiple_choice'
    ? { answerOptionId: 'yes', options: ['yes', 'no', 'n2', 'n3'].map(optionId => ({ id: optionId })) }
    : { options: [] }),
});

test('an exam whose every item failed grading does not complete the unit', async () => {
  const s = examHook();
  const list = [q('e1', 'essay'), q('s1', 'short_answer')];
  await s.start(list).handleCompleteExam(list.map(question => ({
    question, selectedOptionId: '', isCorrect: false, gradingStatus: 'failed',
  })));
  assert.deepEqual(s.completed, []);
});

test('an exam with at least one graded item still completes the unit as before', async () => {
  const s = examHook();
  const list = [q('e1', 'essay'), q('m1', 'multiple_choice')];
  await s.start(list).handleCompleteExam([
    { question: list[0], selectedOptionId: '', isCorrect: false, gradingStatus: 'failed' },
    { question: list[1], selectedOptionId: 'no', isCorrect: false },
  ]);
  assert.deepEqual(s.completed, ['U']);
});

// 사용자 정정(원본 보존형)과 채점 미완료 분리: 결과 집계, 오답노트, 복습 일정, 백업, 순차 도전·랭킹 비반영.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const KEYS = {
  attempts: '@cogniquest:attempts',
  reviews: '@cogniquest:review_states',
  corrections: '@celueste:attempt_corrections',
};
const host = value => JSON.parse(JSON.stringify(value));

// 실제 db.ts·useExamSession.ts를 키-값 Map 저장소 위에서 실행한다.
function app(initial = []) {
  const data = new Map(initial);
  const alerts = [];
  const state = [];
  let cursor = 0;
  const react = {
    useState(value) {
      const i = cursor++;
      if (!(i in state)) state[i] = value;
      return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; }];
    },
    useRef(value) {
      const i = cursor++;
      if (!(i in state)) state[i] = { current: value };
      return state[i];
    },
    useCallback: fn => fn,
  };
  const storage = {
    getItem: async k => data.get(k) ?? null,
    setItem: async (k, v) => { data.set(k, v); },
    removeItem: async k => { data.delete(k); },
    multiGet: async keys => keys.map(k => [k, data.get(k) ?? null]),
    multiSet: async entries => { entries.forEach(([k, v]) => data.set(k, v)); },
    multiRemove: async keys => { keys.forEach(k => data.delete(k)); },
    getAllKeys: async () => [...data.keys()],
    clear: async () => { data.clear(); },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
      console, Date, Math, Set, Map, Promise, JSON, Error, Array, Object,
    }, { filename: file })(name => {
      if (name === 'react') return react;
      if (name === 'react-native') return { Platform: { OS: 'web' } };
      if (name === '@react-native-async-storage/async-storage') return storage;
      if (name === './native_storage_migration') return { initializeNativeStorage: async () => { throw new Error('native'); } };
      if (name === '../utils/alert') return { showAlert: (...args) => alerts.push(args) };
      if (name === '../domain/ranking_sync') return { syncRankingProgress: async () => {} };
      if (name.includes('secure_storage')) {
        return { getEncryptedApiKey: async () => null, saveEncryptedApiKey: async () => 'persistent', deleteEncryptedApiKey: async () => {} };
      }
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`));
      throw new Error(`Unexpected dependency ${name}`);
    }, module, module.exports);
    return module.exports;
  }
  const db = load(path.join(ROOT, 'src/data/db.ts'));
  const domain = name => load(path.join(ROOT, `src/domain/${name}.ts`));
  const { useExamSession } = load(path.join(ROOT, 'src/hooks/useExamSession.ts'));
  let refreshed = 0;
  const props = {
    questions: [], reviewStates: [], units: [], topics: [], selectedTopicId: null, selectedUnitId: null,
    setSelectedTopicId() {}, setLastStudiedTopicId() {}, onRefreshData: async () => { refreshed += 1; },
  };
  let hook;
  const render = () => { cursor = 0; hook = useExamSession(props); return hook; };
  render();
  return {
    data, db, domain, alerts, props, render,
    get refreshed() { return refreshed; },
    stored: key => JSON.parse(data.get(key) ?? '[]'),
    start(questions, options) { hook.startExam(questions, options); return render(); },
  };
}

function mc(id, extra = {}) {
  return { id, questionId: id, topicId: 'T', unitId: 'U', questionType: 'multiple_choice', answerOptionId: 'yes',
    options: [{ id: 'yes' }, { id: 'no' }, { id: 'n2' }, { id: 'n3' }], difficultyLevel: 10, ...extra };
}
const essay = id => ({ id, questionId: id, topicId: 'T', unitId: 'U', questionType: 'essay', options: [], difficultyLevel: 10 });

test('attempt outcome separates correct, incorrect, grading failure and user correction', () => {
  const { getAttemptOutcome, correctedSubmissionKeys } = app().domain('attempt_outcome');
  const keys = correctedSubmissionKeys([{ submissionKey: 'k2' }]);
  assert.equal(getAttemptOutcome({ submissionKey: 'k1', isCorrect: true }, keys), 'correct');
  assert.equal(getAttemptOutcome({ submissionKey: 'k2', isCorrect: false }, keys), 'corrected');
  assert.equal(getAttemptOutcome({ submissionKey: 'k3', isCorrect: false, gradingStatus: 'failed' }, keys), 'grading_failed');
  assert.equal(getAttemptOutcome({ submissionKey: 'k4', isCorrect: false, gradingStatus: 'graded' }, keys), 'incorrect');
});

test('incorrect list treats corrections as correct and skips grading failures', () => {
  const { selectIncorrectQuestions } = app().domain('question_history');
  // 기존 규칙상 문제 ID가 submissionKey의 부분 문자열이면 매칭되므로 서로 겹치지 않는 ID를 쓴다.
  const questions = ['qa', 'qb', 'qc', 'qd'].map(id => ({ id }));
  const attempts = [
    { submissionKey: 'sub-qa-1', isCorrect: false },
    { submissionKey: 'sub-qb-1', isCorrect: false },
    { submissionKey: 'sub-qc-1', isCorrect: true },
    { submissionKey: 'sub-qc-2', isCorrect: false, gradingStatus: 'failed' },
    { submissionKey: 'sub-qd-1', isCorrect: false },
    { submissionKey: 'sub-qd-2', isCorrect: false, gradingStatus: 'failed' },
  ];
  const ids = list => Array.from(list, q => q.id);
  assert.deepEqual(ids(selectIncorrectQuestions(questions, attempts)), ['qa', 'qb', 'qd']);
  assert.deepEqual(ids(selectIncorrectQuestions(questions, attempts, [{ submissionKey: 'sub-qb-1' }])), ['qa', 'qd']);
});

test('result summary counts corrections as correct and removes grading failures from wrong count and score', () => {
  const { summarizeExamResults } = app().domain('exam_result_summary');
  const questions = [mc('q1'), mc('q2'), essay('q3'), essay('q4'), mc('q5')];
  const results = [
    {}, {},
    { gradingStatus: 'failed' },
    { gradingStatus: 'graded', gradingScore: 50 },
    {},
  ];
  const summary = summarizeExamResults(questions, { 0: 'yes', 1: 'no', 4: 'no' }, results, { 1: 'ambiguous_question' });
  assert.deepEqual(host(summary.statuses), ['correct', 'corrected', 'grading_failed', 'partial', 'incorrect']);
  assert.equal(summary.correct, 1);
  assert.equal(summary.corrected, 1);
  assert.equal(summary.incorrect, 2);
  assert.equal(summary.gradingFailed, 1);
  assert.equal(summary.graded, 4);
  assert.equal(summary.scorePercent, 50);
});

test('grading failure is saved without changing the review schedule', async () => {
  const s = app();
  const list = [mc('q1'), essay('q2')];
  const hook = s.start(list);
  await hook.handleCompleteExam([
    { question: list[0], selectedOptionId: 'no', isCorrect: false },
    { question: list[1], selectedOptionId: '', isCorrect: false, answerText: '답안', gradingStatus: 'failed', gradingFailedReason: 'offline' },
  ]);
  assert.equal(s.stored(KEYS.attempts).length, 2);
  assert.deepEqual(s.stored(KEYS.reviews).map(r => r.questionRevisionId), ['q1']);
});

test('correction keeps the original attempt, updates review and incorrect list, and can be undone', async () => {
  const before = { ownerId: 'owner-default', questionRevisionId: 'q1', stage: 2, dueDate: '2026-09-20', lastAttemptId: 'old', updatedAt: '2026-09-13T00:00:00.000Z' };
  const s = app([[KEYS.reviews, JSON.stringify([before])]]);
  s.props.reviewStates = [before];
  const list = [mc('q1')];
  let hook = s.start(list);
  await hook.handleCompleteExam([{ question: list[0], selectedOptionId: 'no', isCorrect: false }]);
  s.data.set('@cogniquest:questions', JSON.stringify(list));
  assert.equal(s.stored(KEYS.reviews)[0].stage, 0);
  assert.deepEqual(host((await s.db.getIncorrectQuestions()).map(q => q.id)), ['q1']);

  hook = s.render();
  await hook.correctExamResult(0, 'ambiguous_question');
  hook = s.render();
  const attempt = s.stored(KEYS.attempts)[0];
  assert.equal(attempt.isCorrect, false); // 원래 채점 보존
  const [correction] = s.stored(KEYS.corrections);
  assert.equal(correction.submissionKey, attempt.submissionKey);
  assert.equal(correction.reason, 'ambiguous_question');
  assert.equal(s.stored(KEYS.reviews)[0].stage, 3); // 시험 전 2단계에서 정답으로 계산
  assert.deepEqual(host((await s.db.getIncorrectQuestions()).map(q => q.id)), []);
  assert.equal(hook.examCorrections[0], 'ambiguous_question');

  await hook.undoExamResultCorrection(0);
  hook = s.render();
  assert.deepEqual(s.stored(KEYS.corrections), []);
  assert.equal(s.stored(KEYS.reviews)[0].stage, 0);
  assert.equal(s.stored(KEYS.reviews)[0].lastAttemptId, attempt.id);
  assert.deepEqual(host((await s.db.getIncorrectQuestions()).map(q => q.id)), ['q1']);
  assert.equal(hook.examCorrections[0], undefined);
  assert.ok(s.refreshed >= 2);
});

test('correction never changes a review state written by a later attempt', async () => {
  const s = app();
  const list = [mc('q1')];
  const hook = s.start(list);
  await hook.handleCompleteExam([{ question: list[0], selectedOptionId: 'no', isCorrect: false }]);
  const later = { ...s.stored(KEYS.reviews)[0], stage: 4, lastAttemptId: 'later', updatedAt: '2030-01-01T00:00:00.000Z' };
  s.data.set(KEYS.reviews, JSON.stringify([later]));
  await s.render().correctExamResult(0, 'other');
  assert.equal(s.stored(KEYS.corrections).length, 1);
  assert.deepEqual(s.stored(KEYS.reviews), [later]);
});

test('corrections do not count toward level 31+ challenge clears or ranking', async () => {
  const s = app();
  const list = [1, 2, 3].map(i => mc(`c${i}`, { difficultyLevel: 31 }));
  const hook = s.start(list, { challengeEligible: true });
  await hook.handleCompleteExam(list.map((question, i) => ({
    question, selectedOptionId: i === 0 ? 'yes' : 'no', isCorrect: i === 0,
  })));
  const { getMaxQualifiedKillerLevel } = s.domain('ranking');
  assert.equal(getMaxQualifiedKillerLevel(s.stored(KEYS.attempts)), 0);
  await s.render().correctExamResult(1, 'answer_meets_criteria');
  assert.equal(s.stored(KEYS.corrections).length, 1);
  assert.equal(getMaxQualifiedKillerLevel(s.stored(KEYS.attempts)), 0);
  assert.equal(s.domain('challenge_progress').getUnlockedChallengeLevel(s.stored(KEYS.attempts), 'T'), 31);
});

test('grading failure can be corrected and undone without leaving a review state behind', async () => {
  const s = app();
  const list = [essay('e1')];
  const hook = s.start(list);
  await hook.handleCompleteExam([{ question: list[0], selectedOptionId: '', isCorrect: false, gradingStatus: 'failed' }]);
  assert.deepEqual(s.stored(KEYS.reviews), []);
  await s.render().correctExamResult(0, 'answer_meets_criteria');
  assert.equal(s.stored(KEYS.reviews)[0].stage, 1);
  await s.render().undoExamResultCorrection(0);
  assert.deepEqual(s.stored(KEYS.reviews), []);
});

test('all grading failures show no score instead of 0 / 0', () => {
  const { summarizeExamResults } = app().domain('exam_result_summary');
  const summary = summarizeExamResults([essay('e1'), essay('e2')], {}, [{ gradingStatus: 'failed' }, { gradingStatus: 'failed' }]);
  assert.equal(summary.graded, 0);
  assert.equal(summary.gradingFailed, 2);
  assert.equal(summary.scorePercent, null);
});

const attempt = { id: 'run-0', sessionItemId: 's', submissionKey: 'sub-q1-run', answerOptionId: 'no', isCorrect: false, submittedAt: '2026-09-25T00:00:00.000Z' };
const correction = { id: 'x', attemptId: 'run-0', submissionKey: 'sub-q1-run', questionRevisionId: 'q1', reason: 'other', correctedAt: '2026-09-25T00:00:01.000Z' };

test('full backup carries corrections, question-bank backup does not, and old backups restore none', async () => {
  const s = app([[KEYS.attempts, JSON.stringify([attempt])], [KEYS.corrections, JSON.stringify([correction])]]);
  await s.db.initializeDatabase();
  const full = JSON.parse(await s.db.exportBackupJSON('full'));
  assert.deepEqual(full.attemptCorrections, [correction]);
  assert.equal('attemptCorrections' in JSON.parse(await s.db.exportBackupJSON('question-bank')), false);

  s.data.delete(KEYS.corrections);
  assert.equal((await s.db.restoreBackupJSON(JSON.stringify(full))).success, true);
  assert.deepEqual(s.stored(KEYS.corrections), [correction]);

  delete full.attemptCorrections;
  assert.equal((await s.db.restoreBackupJSON(JSON.stringify(full))).success, true);
  assert.deepEqual(s.stored(KEYS.corrections), []);

  full.attemptCorrections = [{ ...correction, reason: 'hack' }];
  const rejected = await s.db.restoreBackupJSON(JSON.stringify(full));
  assert.equal(rejected.success, false);
});

test('orphan corrections are dropped from backup export and restore', async () => {
  const orphans = [
    { ...correction, id: 'no-attempt', attemptId: 'missing', submissionKey: 'sub-q2-run' },
    { ...correction, id: 'key-mismatch', submissionKey: 'sub-q1-other' },
    { ...correction, id: 'question-mismatch', questionRevisionId: 'q9' },
  ];
  const duplicate = { ...correction, id: 'latest', reason: 'ambiguous_question' };
  const s = app([
    [KEYS.attempts, JSON.stringify([attempt])],
    [KEYS.corrections, JSON.stringify([correction, ...orphans, duplicate])],
  ]);
  await s.db.initializeDatabase();
  const full = JSON.parse(await s.db.exportBackupJSON('full'));
  assert.deepEqual(full.attemptCorrections.map(c => c.id), ['latest']);

  full.attemptCorrections = [...orphans, correction];
  assert.equal((await s.db.restoreBackupJSON(JSON.stringify(full))).success, true);
  assert.deepEqual(s.stored(KEYS.corrections).map(c => c.id), ['x']);
});

test('question ID must match the submission key exactly (q1 vs q1-long)', () => {
  const { filterCorrectionsForAttempts } = app().domain('attempt_outcome');
  const runId = '3f2a9c1e-7b4d-4e0a-9c1f-5d6e7f8a9b0c';
  const longAttempt = { id: `${runId}-0`, submissionKey: `sub-q1-long-${runId}` };
  const base = { id: 'c', attemptId: `${runId}-0`, submissionKey: `sub-q1-long-${runId}`, reason: 'other', correctedAt: 'now' };
  assert.equal(filterCorrectionsForAttempts([{ ...base, questionRevisionId: 'q1' }], [longAttempt]).length, 0);
  assert.equal(filterCorrectionsForAttempts([{ ...base, questionRevisionId: 'q1-long' }], [longAttempt]).length, 1);
  // 다른 풀이의 ID로 시험 ID를 바꿔치기해도 해당 Attempt가 없으면 통과하지 못한다.
  const forged = { ...base, attemptId: `long-${runId}-0`, questionRevisionId: 'q1' };
  assert.equal(filterCorrectionsForAttempts([forged], [longAttempt]).length, 0);
});

test('corrections created by the exam hook survive a full backup round trip', async () => {
  const s = app();
  const list = [mc('q1'), mc('q1-long')];
  const hook = s.start(list);
  await hook.handleCompleteExam(list.map(question => ({ question, selectedOptionId: 'no', isCorrect: false })));
  await s.render().correctExamResult(1, 'ambiguous_question');
  const full = JSON.parse(await s.db.exportBackupJSON('full'));
  assert.deepEqual(full.attemptCorrections.map(c => c.questionRevisionId), ['q1-long']);
  s.data.delete(KEYS.corrections);
  assert.equal((await s.db.restoreBackupJSON(JSON.stringify(full))).success, true);
  assert.deepEqual(s.stored(KEYS.corrections).map(c => c.questionRevisionId), ['q1-long']);
});

// 구형 객관식 보정과 보기 누락 문제: 읽을 때 객관식으로 해석하고, 풀 수 없는 객관식은
// 가짜 보기로 채우지 않고 시험에서 제외한다.
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
  }).outputText, { module, exports: module.exports, require: requireImpl, Math }, { filename: file });
  return module.exports;
}

function loadDomain(file) {
  const cache = new Map();
  const load = target => {
    if (cache.has(target)) return cache.get(target);
    const exports = compile(target, name => {
      if (!name.startsWith('./')) throw new Error(`Unexpected dependency ${name}`);
      return load(path.resolve(path.dirname(target), `${name}.ts`));
    });
    cache.set(target, exports);
    return exports;
  };
  return load(path.join(ROOT, file));
}

const integrity = loadDomain('src/domain/question_integrity.ts');
const { distributeQuestionAnswersRandomly } = loadDomain('src/domain/question_distribution.ts');

const options = ids => ids.map(id => ({ id, text: `보기 ${id}`, isDistractor: id !== 'a' }));
const mc = (id, optionIds, answer = 'a') => ({
  id, questionId: id, topicId: 'T', unitId: 'U', questionType: 'multiple_choice', stem: id,
  options: options(optionIds), answerOptionId: answer,
});

test('legacy question without questionType is read as multiple choice, others untouched', () => {
  const legacy = { id: 'old', stem: 's', options: options(['a', 'b']), answerOptionId: 'a' };
  const normalized = integrity.normalizeStoredQuestion(legacy);
  assert.equal(normalized.questionType, 'multiple_choice');
  assert.equal('questionType' in legacy, false);

  const noOptions = integrity.normalizeStoredQuestion({ id: 'x', stem: 's' });
  assert.equal(noOptions.options.length, 0);
  assert.equal(noOptions.answerOptionId, '');

  const essay = { id: 'e', questionType: 'essay', options: [], answerOptionId: '' };
  assert.equal(integrity.normalizeStoredQuestion(essay), essay);
});

test('multiple choice is valid only with exactly four options including the answer', () => {
  assert.equal(integrity.hasMissingOptions(mc('empty', [])), true);
  assert.equal(integrity.hasMissingOptions(mc('one', ['a'])), true);
  assert.equal(integrity.hasMissingOptions(mc('three', ['a', 'b', 'c'])), true);
  assert.equal(integrity.hasMissingOptions(mc('five', ['a', 'b', 'c', 'd', 'e'])), true);
  assert.equal(integrity.hasMissingOptions(mc('no-answer', ['b', 'c', 'd', 'e'])), true);
  assert.equal(integrity.hasMissingOptions(mc('four', ['a', 'b', 'c', 'd'])), false);
  assert.equal(integrity.hasMissingOptions({ questionType: 'essay', options: [], answerOptionId: '' }), false);
  assert.equal(integrity.hasMissingOptions(integrity.normalizeStoredQuestion({ id: 'old', stem: 's' })), true);
});

test('distribution never fabricates options and leaves invalid multiple choice untouched', () => {
  const answerSlots = new Set();
  for (let round = 0; round < 50; round++) {
    const input = [mc('empty', []), mc('three', ['a', 'b', 'c']), mc('five', ['a', 'b', 'c', 'd', 'e']), mc('four', ['a', 'b', 'c', 'd'])];
    const [empty, three, five, four] = distributeQuestionAnswersRandomly(input);
    assert.equal(empty, input[0]);
    assert.equal(three, input[1]);
    assert.equal(five, input[2]);
    assert.equal(three.options.length, 3);

    assert.equal(four.options.length, 4);
    assert.deepEqual(Array.from(four.options, item => item.id).sort(), ['a', 'b', 'c', 'd']);
    assert.ok(four.options.every(item => !/기타 선지/.test(item.text)));
    assert.equal(four.answerOptionId, 'a');
    assert.equal(four.options.find(item => item.id === 'a').isDistractor, false);
    answerSlots.add(four.options.findIndex(item => item.id === 'a'));
  }
  assert.ok(answerSlots.size > 1, 'answer position is still randomized');
});

// 실제 useExamSession.startExam을 가짜 db 위에서 실행한다.
function examHook() {
  const state = [];
  let cursor = 0;
  const alerts = [];
  const react = {
    useState(value) { const i = cursor++; if (!(i in state)) state[i] = value; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
    useRef(value) { const i = cursor++; if (!(i in state)) state[i] = { current: value }; return state[i]; },
    useCallback: fn => fn,
  };
  let id = 0;
  const db = {
    getAttempts: async () => [],
    generateUUID: () => `id-${++id}`,
    getCurrentISOTime: () => '2026-09-25T00:00:00.000Z',
    saveLastStudiedTopicId: async () => {},
    markUnitAsCompleted: async () => {},
    saveReviewState: async () => {},
    saveAttempt: async () => {},
  };
  const cache = new Map();
  const load = file => {
    if (cache.has(file)) return cache.get(file);
    const exports = compile(file, name => {
      if (name === 'react') return react;
      if (name === '../data/db') return db;
      if (name === '../utils/alert') return { showAlert: (title, message) => alerts.push({ title, message }) };
      if (name === '../domain/ranking_sync') return { syncRankingProgress: async () => {} };
      return load(path.resolve(path.dirname(file), `${name}.ts`));
    });
    cache.set(file, exports);
    return exports;
  };
  const { useExamSession } = load(path.join(ROOT, 'src/hooks/useExamSession.ts'));
  const props = {
    questions: [], reviewStates: [], units: [], topics: [], selectedTopicId: null, selectedUnitId: null,
    setSelectedTopicId() {}, setLastStudiedTopicId() {}, onRefreshData: async () => {},
  };
  let hook;
  const render = () => { cursor = 0; hook = useExamSession(props); return hook; };
  render();
  return { alerts, start(list) { hook.startExam(list); return render(); } };
}

test('exam start blocks when every question has missing options', () => {
  const session = examHook();
  const hook = session.start([mc('empty', []), mc('three', ['a', 'b', 'c']), mc('no-answer', ['b', 'c', 'd', 'e'])]);
  assert.equal(hook.examSessionActive, false);
  assert.equal(session.alerts.length, 1);
  assert.match(session.alerts[0].message, /보기 누락/);
});

test('exam start excludes only questions with missing options', () => {
  const session = examHook();
  const essay = { id: 'e1', questionId: 'e1', topicId: 'T', questionType: 'essay', stem: 'e', options: [], answerOptionId: '' };
  const hook = session.start([mc('empty', []), mc('three', ['a', 'b', 'c']), mc('ok', ['a', 'b', 'c', 'd']), essay]);
  assert.equal(hook.examSessionActive, true);
  assert.equal(session.alerts.length, 0);
  assert.deepEqual(Array.from(hook.examQuestions, item => item.id), ['ok', 'e1']);
});

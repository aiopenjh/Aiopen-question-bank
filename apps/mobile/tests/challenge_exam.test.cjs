const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup() {
  const state = [], attempts = [], reviews = [], alerts = [];
  let cursor = 0, id = 0, tick = 0, failOnce = false;
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in state)) state[i] = initial;
      return [state[i], value => { state[i] = value; }];
    },
    useRef(initial) {
      const i = cursor++;
      if (!(i in state)) state[i] = { current: initial };
      return state[i];
    },
    useCallback: fn => fn,
  };
  const db = {
    getAttempts: async () => attempts,
    generateUUID: () => `id-${++id}`,
    getCurrentISOTime: () => new Date(2026, 8, 22, 12, 0, tick++).toISOString(),
    saveLastStudiedTopicId: async () => {},
    markUnitAsCompleted: async () => {},
    saveReviewState: async review => { reviews.push(review); },
    saveAttempt: async attempt => {
      if (failOnce && attempts.length === 1) { failOnce = false; throw new Error('disk full'); }
      if (!attempts.some(a => a.submissionKey === attempt.submissionKey)) attempts.push(attempt);
    },
  };
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, {
      exports,
      require: name => {
        if (name === 'react') return react;
        if (name === '../data/db') return db;
        if (name === '../domain/generator') return { distributeQuestionAnswersRandomly: questions => questions };
        if (name === '../utils/alert') return { showAlert: (...args) => alerts.push(args) };
        // 랭킹 연동은 네트워크 모듈(process.env 사용)을 불러오므로 이 테스트에서는 대체한다.
        if (name === '../domain/ranking_sync') return { syncRankingProgress: async () => {} };
        return load(path.resolve(path.dirname(file), name + '.ts'));
      },
    });
    return exports;
  }
  const { useExamSession } = load(path.join(__dirname, '../src/hooks/useExamSession.ts'));
  const ranking = load(path.join(__dirname, '../src/domain/ranking.ts'));
  const props = {
    questions: [], reviewStates: [], units: [], topics: [],
    selectedTopicId: null, selectedUnitId: null,
    setSelectedTopicId() {}, setLastStudiedTopicId() {}, onRefreshData: async () => {},
  };
  let hook;
  const render = () => { cursor = 0; hook = useExamSession(props); return hook; };
  render();
  return {
    attempts, reviews, alerts, ranking,
    failNextSave() { failOnce = true; },
    // 새로 출제된 레벨 31+ 도전 시험으로 시작한다(startExam의 challengeEligible 옵션).
    start(questions, options = { challengeEligible: true }) { hook.startExam(questions, options); return render(); },
  };
}

function questions(level = 31, topicId = 'A', count = 3) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${topicId}-${level}-${i}`, questionId: `${topicId}-${level}-${i}`, topicId,
    difficultyLevel: level, answerOptionId: 'yes', options: [],
  }));
}
function answers(list, correct = 2) {
  return list.map((question, i) => ({ question, selectedOptionId: i < correct ? 'yes' : 'no', isCorrect: i < correct }));
}

test('real exam hook saves sequential per-topic progress; repeated completion is idempotent', async () => {
  const s = setup();
  let list = questions(), hook = s.start(list);
  await hook.handleCompleteExam(answers(list));
  await hook.handleCompleteExam(answers(list));
  assert.equal(s.attempts.length, 3);
  assert.equal(s.reviews.length, 3);
  assert.equal(s.ranking.getMaxQualifiedKillerLevel(s.attempts), 31);
  list = questions(32); hook = s.start(list);
  await hook.handleCompleteExam(answers(list));
  assert.equal(s.ranking.getMaxQualifiedKillerLevel(s.attempts), 32);
  list = questions(50, 'B'); hook = s.start(list);
  await hook.handleCompleteExam(answers(list, 3));
  assert.equal(s.ranking.getMaxQualifiedKillerLevel(s.attempts), 32);
  assert.equal(s.alerts.length, 2);
});

test('failed save can retry same exam without duplicate attempts or premature clear', async () => {
  const s = setup(), list = questions(), hook = s.start(list);
  s.failNextSave();
  await assert.rejects(hook.handleCompleteExam(answers(list)), /disk full/);
  assert.equal(s.ranking.getMaxQualifiedKillerLevel(s.attempts), 0);
  await hook.handleCompleteExam(answers(list));
  assert.equal(s.attempts.length, 3);
  assert.equal(s.ranking.getMaxQualifiedKillerLevel(s.attempts), 31);
});

test('ordinary, mixed and five-question exams retain reviews without challenge credit; exit grants none', async () => {
  const s = setup();
  for (const list of [questions(10), questions(31, 'A', 5), [questions()[0], questions()[1], questions(32)[2]]]) {
    await s.start(list).handleCompleteExam(answers(list));
  }
  assert.equal(s.attempts.length, 11);
  assert.equal(s.reviews.length, 11);
  assert.ok(s.attempts.every(a => !a.challenge));
  s.start(questions()).exitExamSession();
  assert.equal(s.attempts.length, 11);
  assert.equal(s.ranking.getMaxQualifiedKillerLevel(s.attempts), 0);
});

test('a delayed result from an exited exam never writes into the next exam run', async () => {
  const s = setup();
  const first = questions(10, 'A');
  const firstHook = s.start(first);
  const firstRunId = firstHook.examSessionRunId;
  firstHook.exitExamSession();

  const second = questions(10, 'B');
  const secondHook = s.start(second);
  const secondRunId = secondHook.examSessionRunId;

  await firstHook.handleCompleteExam(answers(first, 3), firstRunId);
  assert.equal(s.attempts.length, 0);

  await secondHook.handleCompleteExam(answers(second, 3), secondRunId);
  assert.equal(s.attempts.length, 3);
  assert.ok(s.attempts.every(attempt => attempt.submissionKey.includes(secondRunId)));
  assert.ok(s.attempts.every(attempt => !attempt.submissionKey.includes(firstRunId)));
});

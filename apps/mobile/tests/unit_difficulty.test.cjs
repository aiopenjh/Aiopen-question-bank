const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('generation and reopen use each saved unit level; untouched units inherit topic start', async () => {
  let state = [], cursor = 0, props, hook;
  const calls = [];
  const units = [
    { id: 'a', topicId: 't', title: 'A', difficultyLevel: 20 },
    { id: 'b', topicId: 't', title: 'B' },
  ];
  const react = {
    useState: initial => {
      const i = cursor++;
      if (!(i in state)) state[i] = initial;
      return [state[i], value => { state[i] = value; }];
    },
    useRef: initial => {
      const i = cursor++;
      if (!(i in state)) state[i] = { current: initial };
      return state[i];
    },
    useCallback: callback => callback,
  };
  const db = {
    getUnits: async () => units.map(u => ({ ...u })),
    updateUnitDifficulty: async (topic, id, level) => { units.find(u => u.topicId === topic && u.id === id).difficultyLevel = level; },
    getQuestions: async () => [],
    getSourceTextForTopic: async () => '',
    getLinkedSourceForTopic: async () => null,
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
      exports, AbortController, Date, console,
      require: name => {
        if (name === 'react') return react;
        if (name === '../data/db') return db;
        if (name === '../utils/alert') return { showAlert() {} };
        if (name === './quizGenerationContext') return { buildUnitGenerationContext: () => '' };
        if (name === '../domain/generator') return {
          analyzeUserIntent: (_, __, options) => { calls.push(options); return options; },
          generateFactBasedQuestions: async () => ({ status: 'FAILED', message: 'Test network boundary' }),
        };
        return load(path.resolve(path.dirname(file), name + '.ts'));
      },
    });
    return exports;
  }
  const generation = load('src/hooks/useQuizGeneration.ts');
  props = {
    topics: [{ id: 't', name: 'test', learnerLevel: 'beginner', difficultyLevel: 3 }],
    units: units.map(u => ({ ...u })), questions: [], incorrectQuestions: [], apiKey: 'fake-test-key',
    selectedTopicId: 't', selectedUnitId: 'a',
    getDocumentInputForTopic: async () => null,
    setUnits: next => { props.units = next; },
    onOpenSettings() {}, onOpenSourceManager() {}, setQuestions() {}, startExam() {},
  };
  const render = () => { cursor = 0; hook = generation.useQuizGeneration(props); };
  render();
  hook.handlePromptQuizCount('t', 'test', 'a', 'A'); render();
  assert.equal(hook.pendingQuizUnit.initialDifficultyLevel, 20);
  await hook.handleSaveUnitDifficulty(31); render();
  hook.setQuizCountModalVisible(false); render();
  hook.handlePromptQuizCount('t', 'test', 'a', 'A'); render();
  assert.equal(hook.pendingQuizUnit.initialDifficultyLevel, 31);
  state = []; render(); // Fresh hook after application reopen.
  hook.handlePromptQuizCount('t', 'test', 'a', 'A'); render();
  assert.equal(hook.pendingQuizUnit.initialDifficultyLevel, 31);
  await hook.handleQuickGenerateForUnit('t', 'test', 'a', 'A');
  assert.equal(calls.at(-1).difficultyLevel, 31);
  assert.equal(calls.at(-1).learnerLevel, 'master');
  await hook.handleGenerateMoreQuestions();
  assert.equal(calls.at(-1).difficultyLevel, 31);
  hook.handlePromptQuizCount('t', 'test', 'b', 'B'); render();
  assert.equal(hook.pendingQuizUnit.initialDifficultyLevel, 3);
  await hook.handleQuickGenerateForUnit('t', 'test', 'b', 'B');
  assert.equal(calls.at(-1).difficultyLevel, 3);
  assert.equal(props.topics[0].difficultyLevel, 3);
});

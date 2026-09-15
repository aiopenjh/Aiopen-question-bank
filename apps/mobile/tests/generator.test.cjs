const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function harness(fetchImpl, { model = '', fastTimeout = false, key = 'AIza-synthetic-key' } = {}) {
  const saved = [];
  const specs = [];
  let id = 0;
  const cache = {};
  function load(relative) {
    const filename = path.resolve(__dirname, '../src/domain', relative + '.ts');
    if (cache[filename]) return cache[filename].exports;
    const module = { exports: {} };
    cache[filename] = module;
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
    vm.runInNewContext(code, {
      module, exports: module.exports, AbortController,
      setTimeout: fastTimeout ? (fn) => setTimeout(fn, 5) : setTimeout, clearTimeout,
      fetch: fetchImpl,
      require: (name) => name === '../data/db' ? {
        getGeminiApiKey: async () => key, getPreferredAiModel: async () => model,
        generateUUID: () => String(++id), getCurrentISOTime: () => '2026-09-14T00:00:00.000Z',
        addQuestions: async (questions, spec) => { saved.push(...questions); specs.push(spec); },
      } : load(name),
    }, { filename });
    return module.exports;
  }
  return { generator: load('generator'), validation: load('question_validation'), saved, specs };
}
const question = () => ({ stem: '2 + 2 = ?', explanation: '2에 2를 더하면 4입니다.', correctIndex: 1, options: ['3', '4', '5', '6'].map(text => ({ text })) });
const args = (generator) => ({ ownerId: 'synthetic', topicId: 'math', sourceRevisionIds: ['source-1'], intent: generator.analyzeUserIntent('덧셈', undefined, { targetCount: 1 }) });
const response = value => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }) });

test('rejects incomplete, duplicate and invalid AI answers before saving', async () => {
  const variants = [
    q => { q.stem = ''; }, q => { q.explanation = ' '; }, q => { q.options.pop(); },
    q => { q.options.push({ text: '7' }); }, q => { q.options[0].text = ''; },
    q => { q.options[0].text = ' 4 '; }, q => { q.correctIndex = 1.5; },
    q => { q.correctIndex = 4; }, q => { delete q.correctIndex; },
  ];
  for (const mutate of variants) {
    const q = question(); mutate(q);
    const h = harness(async () => response({ questions: [q] }));
    const result = await h.generator.generateFactBasedQuestions(args(h.generator));
    assert.equal(result.status, 'FAILED'); assert.equal(h.saved.length, 0);
  }
});

test('rejects wrong count, duplicate questions, malformed JSON', () => {
  const { validation } = harness();
  assert.throws(() => validation.validateQuestionResponse({ questions: [] }, 1));
  assert.throws(() => validation.validateQuestionResponse({ questions: [question(), question()] }, 2));
  assert.throws(() => validation.parseAiJsonResponse('{broken'));
});

test('valid generation preserves correct option, references, and records structural checks only', async () => {
  const h = harness(async () => response({ questions: [question()] }));
  const result = await h.generator.generateFactBasedQuestions(args(h.generator));
  assert.equal(result.status, 'READY'); assert.equal(h.saved.length, 1);
  const q = result.questions[0];
  assert.equal(q.options.find(o => o.id === q.answerOptionId).text, '4');
  assert.equal(result.spec.sourceRevisionIds[0], 'source-1');
  assert.equal(h.specs[0].sourceRevisionIds[0], 'source-1');
  assert.equal(h.specs[0].id, q.specId);
  assert.equal(result.validations[0].checkType, 'syntax_integrity');
  assert.equal(result.validations[0].reviewerKind, 'rule_engine');
});

test('HTTP errors do not expose provider body or try another model', async () => {
  let calls = 0;
  const h = harness(async (url) => {
    calls++; assert.ok(!url.includes('synthetic-key'));
    return { ok: false, status: 429, text: async () => 'secret-key-user-content' };
  });
  const result = await h.generator.generateFactBasedQuestions(args(h.generator));
  assert.equal(result.status, 'FAILED'); assert.equal(calls, 1);
  assert.ok(!result.message.includes('secret')); assert.equal(h.saved.length, 0);
});

test('timeout covers a stalled body and does not retry', async () => {
  let calls = 0;
  const h = harness(async () => { calls++; return { ok: true, json: () => new Promise(() => {}) }; }, { fastTimeout: true });
  const result = await h.generator.generateFactBasedQuestions(args(h.generator));
  assert.equal(result.status, 'FAILED'); assert.equal(calls, 1);
  assert.match(result.message, /초과/);
});

test('concurrent requests produce one provider call', async () => {
  let resolve;
  let calls = 0;
  const h = harness(() => { calls++; return new Promise(r => { resolve = r; }); });
  const first = h.generator.generateFactBasedQuestions(args(h.generator));
  await new Promise(r => setImmediate(r));
  const second = await h.generator.generateFactBasedQuestions(args(h.generator));
  assert.equal(second.status, 'FAILED'); assert.equal(calls, 1);
  resolve(response({ questions: [question()] }));
  assert.equal((await first).status, 'READY');
});

test('the configured model baseline never falls below 3.5', () => {
  const { generator } = harness();
  assert.equal(generator.selectAiModel('synthetic', '').model, 'gemini-3.5-flash');
  assert.equal(generator.selectAiModel('synthetic', 'gemini-2.5-flash').model, 'gemini-3.5-flash');
  assert.equal(generator.selectAiModel('synthetic', 'gemini-3.7-flash').model, 'gemini-3.7-flash');
  assert.equal(generator.selectAiModel('synthetic', 'gpt-4o-mini').model, 'gemini-3.5-flash');
});

test('answer shuffling rejects broken questions instead of inventing options', () => {
  const { generator } = harness();
  assert.throws(() => generator.distributeQuestionAnswersRandomly([{ options: [], answerOptionId: 'missing' }]));
});

test('one request uses the 3.5 baseline without trying another model', async () => {
  let calls = 0;
  const h = harness(async (url) => {
    calls++;
    assert.match(url, /gemini-3\.5-flash/);
    return response({ questions: [question()] });
  }, { model: 'gemini-2.5-flash' });
  assert.equal((await h.generator.generateFactBasedQuestions(args(h.generator))).status, 'READY');
  assert.equal(calls, 1);
});

test('invalid requested count makes no API call', async () => {
  let calls = 0;
  const h = harness(async () => { calls++; return response({ questions: [] }); });
  const params = args(h.generator); params.intent.targetCount = 0;
  assert.equal((await h.generator.generateFactBasedQuestions(params)).status, 'FAILED');
  assert.equal(calls, 0);
});

test('empty and malformed successful provider responses never become READY', async () => {
  for (const value of [{ questions: [] }, {}, null]) {
    const h = harness(async () => response(value));
    assert.equal((await h.generator.generateFactBasedQuestions(args(h.generator))).status, 'FAILED');
    assert.equal(h.saved.length, 0);
  }
  const h = harness(async () => ({ ok: true, json: async () => ({ candidates: [] }) }));
  assert.equal((await h.generator.generateFactBasedQuestions(args(h.generator))).status, 'FAILED');
  assert.equal(h.saved.length, 0);
});

test('transport and JSON decoder exceptions never reveal raw provider secrets', async () => {
  for (const fetchImpl of [
    async () => { throw new Error('secret-transport-body'); },
    async () => ({ ok: true, json: async () => { throw new Error('secret-decoder-body'); } }),
  ]) {
    const h = harness(fetchImpl);
    const result = await h.generator.generateFactBasedQuestions(args(h.generator));
    assert.equal(result.status, 'FAILED');
    assert.ok(!result.message.includes('secret'));
    assert.equal(h.saved.length, 0);
  }
});

test('validated questions retain optional concept explanations and hints', async () => {
  const item = { ...question(), conceptDefinition: ' 덧셈은 수량을 합칩니다. ', deepReasoningHint: ' 하나씩 세어 보세요. ' };
  const h = harness(async () => response({ questions: [item] }));
  const result = await h.generator.generateFactBasedQuestions(args(h.generator));
  assert.equal(result.status, 'READY');
  assert.equal(h.saved[0].conceptDefinition, '덧셈은 수량을 합칩니다.');
  assert.equal(h.saved[0].deepReasoningHint, '하나씩 세어 보세요.');
});

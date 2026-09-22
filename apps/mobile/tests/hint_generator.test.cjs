const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

function isSupportedGeminiModel(model) {
  const match = String(model).trim().toLowerCase().match(/^gemini-(\d+)(?:\.(\d+))?(?:-|$)/);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2] || 0);
  return major > 3 || (major === 3 && minor >= 5);
}

function harness(fetchImpl = async () => { throw new Error('unexpected provider call'); }, options = {}) {
  const { model = '', key = 'AIza-synthetic-key' } = options;
  const cache = {};

  function load(relative) {
    const filename = path.resolve(__dirname, '../src/domain', `${relative}.ts`);
    if (cache[filename]) return cache[filename].exports;

    const module = { exports: {} };
    cache[filename] = module;
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText;

    vm.runInNewContext(code, {
      module,
      exports: module.exports,
      AbortController,
      clearTimeout,
      console: { error: () => {}, log: () => {}, warn: () => {} },
      fetch: fetchImpl,
      setTimeout,
      require: (name) => name === '../data/db'
        ? {
            DEFAULT_GEMINI_MODEL,
            generateUUID: () => 'synthetic-id',
            getCurrentISOTime: () => '2026-09-22T00:00:00.000Z',
            getGeminiApiKey: async () => key,
            getAttempts: async () => [],
            getPreferredAiModel: async () => model,
            isSupportedGeminiModel,
          }
        : load(name),
    }, { filename });

    return module.exports;
  }

  return load('hint_generator');
}

function makeQuestion(overrides = {}) {
  return {
    id: 'q1',
    stem: '1/2 + 1/3 = ?',
    options: [
      { id: 'o1', text: '5/6' },
      { id: 'o2', text: '2/5' },
      { id: 'o3', text: '3/5' },
      { id: 'o4', text: '1' },
    ],
    answerOptionId: 'o1',
    ...overrides,
  };
}

function response(value) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }],
    }),
  };
}

test('AI 힌트 생성: API 키가 없으면 명확한 오류를 던진다', async () => {
  const mod = harness(undefined, { key: '' });
  await assert.rejects(
    () => mod.generateHintForExistingQuestion(makeQuestion()),
    /API Key/
  );
});

test('AI 힌트 생성: 성공하면 트리밍된 힌트를 반환한다(정답 미노출)', async () => {
  const mod = harness(async () => response({ deepReasoningHint: '  분모를 통일하는 방법을 먼저 떠올려 보세요.  ' }));
  const hint = await mod.generateHintForExistingQuestion(makeQuestion());
  assert.equal(hint, '분모를 통일하는 방법을 먼저 떠올려 보세요.');
});

test('AI 힌트 생성: 정답이 노출된 힌트는 저장하지 않고 거부한다', async () => {
  const mod = harness(async () => response({ deepReasoningHint: '정답은 5/6입니다.' }));
  await assert.rejects(
    () => mod.generateHintForExistingQuestion(makeQuestion()),
    /정답이 노출/
  );
});

test('AI 힌트 생성: 너무 긴 힌트는 거부한다', async () => {
  const mod = harness(async () => response({ deepReasoningHint: 'x'.repeat(201) }));
  await assert.rejects(
    () => mod.generateHintForExistingQuestion(makeQuestion()),
    /너무 깁니다/
  );
});

test('AI 힌트 생성: 힌트 필드가 비어 있으면 거부한다', async () => {
  const mod = harness(async () => response({ deepReasoningHint: '   ' }));
  await assert.rejects(
    () => mod.generateHintForExistingQuestion(makeQuestion()),
    /생성하지 못했습니다/
  );
});

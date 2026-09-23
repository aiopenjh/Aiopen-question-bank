const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function harness(fetchImpl) {
  const filename = path.resolve(__dirname, '../src/domain/ai_client.ts');
  const db = fs.readFileSync(path.resolve(__dirname, '../src/data/db.ts'), 'utf8');
  const defaultModel = db.match(/export const DEFAULT_GEMINI_MODEL = '([^']+)'/)[1];
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  const requests = [];
  let now = Date.now();
  const logs = [];
  vm.runInNewContext(code, {
    module, exports: module.exports, AbortController, setTimeout, clearTimeout,
    Date: class extends Date { static now() { return now; } },
    console: { warn: (message) => logs.push(message) },
    require: () => ({ DEFAULT_GEMINI_MODEL: defaultModel }),
    fetch: async (url, request) => {
      requests.push({ model: url.match(/models\/([^:]+):/)[1], request });
      return fetchImpl(url, request);
    },
  }, { filename });
  return {
    call: module.exports.callUniversalAiCompletion, requests, logs,
    advance: (milliseconds) => { now += milliseconds; },
  };
}

const success = () => ({
  ok: true, status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }),
});
const failure = (status, retryAfter = '30') => ({
  ok: false, status, headers: { get: () => retryAfter },
});

test('3.5 starting model sends JSON and PDF requests using the key header', async () => {
  const h = harness(success);
  const result = await h.call('synthetic-secret', 'prompt', undefined,
    { mimeType: 'application/pdf', base64Data: 'Zml4dHVyZQ==' }, { enableGoogleSearch: true });
  assert.equal(result.text, '{"ok":true}');
  assert.equal(h.requests[0].model, 'gemini-3.5-flash');
  const { request } = h.requests[0];
  assert.equal(request.headers['x-goog-api-key'], 'synthetic-secret');
  const body = JSON.parse(request.body);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.equal(body.contents[0].parts[1].inlineData.mimeType, 'application/pdf');
  assert.deepEqual(body.tools, [{ google_search: {} }]);
});

test('429 falls forward, skips only that model during cooldown, then retries 3.5 after expiry', async () => {
  let limited = true;
  const h = harness((url) => url.includes('3.5-flash:') && limited ? failure(429) : success());
  await h.call('key-a', 'first');
  limited = false;
  await h.call('key-a', 'second');
  h.advance(31000);
  await h.call('key-a', 'third');
  assert.deepEqual(h.requests.map((r) => r.model), [
    'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.5-flash',
  ]);
});

test('all limited models stop after five attempts; a different key is never blocked', async () => {
  const h = harness((_, request) => request.headers['x-goog-api-key'] === 'key-a'
    ? failure(429) : success());
  await assert.rejects(h.call('key-a', 'first'), { name: 'GeminiRateLimitError' });
  assert.deepEqual(h.requests.map((r) => r.model), [
    'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash',
    'gemini-3.7-flash', 'gemini-3.8-flash',
  ]);
  await assert.rejects(h.call('key-a', 'second'), { name: 'GeminiRateLimitError' });
  assert.equal(h.requests.length, 5);
  await h.call('key-b', 'third');
  assert.equal(h.requests.length, 6);
  assert.equal(h.requests[5].model, 'gemini-3.5-flash');
  assert.ok(!h.logs.join('\n').includes('key-a'));
});

test('404 and 503 use bounded text-only candidates; 403 stops immediately', async () => {
  for (const status of [404, 503, 403]) {
    const h = harness(() => failure(status));
    await assert.rejects(h.call('key', 'prompt'));
    assert.equal(h.requests.length, status === 403 ? 1 : 5);
    assert.ok(h.requests.every((r) => /^gemini-3\.[5-8]-flash(?:-lite)?$/.test(r.model)));
  }
});

test('cancelling during a limited request prevents further model attempts', async () => {
  const controller = new AbortController();
  const h = harness(() => { controller.abort(); return failure(429); });
  await assert.rejects(h.call('key', 'prompt', controller.signal), { name: 'GenerationCancelledError' });
  assert.equal(h.requests.length, 1);
});

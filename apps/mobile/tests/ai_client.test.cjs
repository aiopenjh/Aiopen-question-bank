const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadDomain(name) {
  const filename = path.resolve(__dirname, `../src/domain/${name}.ts`);
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText, { module, exports: module.exports, JSON, Math, Date }, { filename });
  return module.exports;
}

function harness(fetchImpl, noticeAccepted = true) {
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
  const usage = loadDomain('ai_usage');
  const mathNotation = loadDomain('math_notation');
  const usageEvents = [];
  usage.setAiRequestListener((event) => { usageEvents.push({ ...event }); });
  vm.runInNewContext(code, {
    module, exports: module.exports, AbortController, setTimeout, clearTimeout,
    Date: class extends Date { static now() { return now; } },
    console: { warn: (message) => logs.push(message) },
    require: name => name === './ai_data_notice'
      ? { ensureAiDataNoticeAccepted: async () => noticeAccepted }
      : name === './ai_usage' ? usage
      : name === './math_notation' ? mathNotation
      : { DEFAULT_GEMINI_MODEL: defaultModel },
    fetch: async (url, request) => {
      requests.push({ url, model: url.match(/models\/([^:]+):/)?.[1], request });
      return fetchImpl(url, request);
    },
  }, { filename });
  return {
    call: module.exports.callUniversalAiCompletion, describe: module.exports.describeAiFailureForUser, parse: module.exports.parseAiJsonResponse, requests, logs, usageEvents,
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

test('3.5 Flash-Lite starting model sends JSON and PDF requests using the key header', async () => {
  const h = harness(success);
  const result = await h.call('synthetic-secret', 'prompt', undefined,
    { mimeType: 'application/pdf', base64Data: 'Zml4dHVyZQ==' }, { enableGoogleSearch: true });
  assert.equal(result.text, '{"ok":true}');
  assert.equal(h.requests[0].model, 'gemini-3.5-flash-lite');
  const { request } = h.requests[0];
  assert.equal(request.headers['x-goog-api-key'], 'synthetic-secret');
  const body = JSON.parse(request.body);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.equal(body.contents[0].parts[1].inlineData.mimeType, 'application/pdf');
  assert.deepEqual(body.tools, [{ google_search: {} }]);
});

test('429 falls forward, skips only that model during cooldown, then retries 3.5 Flash-Lite after expiry', async () => {
  let limited = true;
  const h = harness((url) => url.includes('3.5-flash-lite:') && limited ? failure(429) : success());
  await h.call('key-a', 'first');
  limited = false;
  await h.call('key-a', 'second');
  h.advance(31000);
  await h.call('key-a', 'third');
  assert.deepEqual(h.requests.map((r) => r.model), [
    'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite',
  ]);
});

test('all limited models stop after five attempts; a different key is never blocked', async () => {
  const h = harness((_, request) => request.headers['x-goog-api-key'] === 'key-a'
    ? failure(429) : success());
  await assert.rejects(h.call('key-a', 'first'), { name: 'GeminiRateLimitError' });
  assert.deepEqual(h.requests.map((r) => r.model), [
    'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash',
    'gemini-3.7-flash', 'gemini-3.8-flash',
  ]);
  await assert.rejects(h.call('key-a', 'second'), { name: 'GeminiRateLimitError' });
  assert.equal(h.requests.length, 5);
  await h.call('key-b', 'third');
  assert.equal(h.requests.length, 6);
  assert.equal(h.requests[5].model, 'gemini-3.5-flash-lite');
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

test('declining the AI data notice sends no network request', async () => {
  const h = harness(success, false);
  await assert.rejects(() => h.call('synthetic-secret', 'prompt'), /AI 전송 안내/);
  assert.equal(h.requests.length, 0);
});

const anthropicReply = (content, status = 200) => () => ({
  ok: status < 400, status, json: async () => ({ content }),
});

test('Anthropic key sends one Sonnet 4.6 Messages request with browser access header', async () => {
  const controller = new AbortController();
  const h = harness(anthropicReply([{ type: 'text', text: '{"ok":true}' }]));
  const result = await h.call('  sk-ant-synthetic  ', 'prompt', controller.signal);
  // result comes from the vm realm, so compare fields instead of deepEqual on prototypes.
  assert.deepEqual(Object.keys(result).sort(), ['groundingSources', 'text']);
  assert.equal(result.text, '{"ok":true}');
  assert.ok(Array.isArray(result.groundingSources));
  assert.equal(result.groundingSources.length, 0);
  assert.equal(h.requests.length, 1);
  const { url, request } = h.requests[0];
  assert.equal(url, 'https://api.anthropic.com/v1/messages');
  assert.equal(request.signal, controller.signal);
  assert.equal(request.headers['x-api-key'], 'sk-ant-synthetic');
  assert.equal(request.headers['anthropic-version'], '2023-06-01');
  assert.equal(request.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.ok(!('dangerously-allow-browser' in request.headers));
  const body = JSON.parse(request.body);
  assert.equal(body.model, 'claude-sonnet-4-6');
  assert.deepEqual(body.messages, [{ role: 'user', content: 'prompt' }]);
});

test('Anthropic empty response and HTTP error fail without Gemini fallback', async () => {
  const empty = harness(anthropicReply([]));
  await assert.rejects(empty.call('sk-ant-synthetic', 'prompt'), /Claude로부터 빈 응답/);
  const failed = harness(anthropicReply(undefined, 401));
  await assert.rejects(failed.call('sk-ant-synthetic', 'prompt'), /Claude Sonnet 4\.6 통신 실패 \(401\)/);
  for (const h of [empty, failed]) {
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].url, 'https://api.anthropic.com/v1/messages');
  }
});

test('Anthropic key rejects PDF and current-information requests before any network call', async () => {
  const h = harness(anthropicReply([{ type: 'text', text: '{}' }]));
  await assert.rejects(h.call('sk-ant-synthetic', 'p', undefined,
    { mimeType: 'application/pdf', base64Data: 'Zml4dHVyZQ==' }), /PDF 분석을 지원하는/);
  await assert.rejects(h.call('sk-ant-synthetic', 'p', undefined, undefined, { enableGoogleSearch: true }),
    /최신 정보 확인/);
  assert.equal(h.requests.length, 0);
});

test('successful Gemini responses are counted per model and a daily 429 marks that model as used up', async () => {
  const dailyBody = { error: { code: 429, details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] } };
  const h = harness((url) => url.includes('3.5-flash-lite:')
    ? { ok: false, status: 429, headers: { get: () => '30' }, json: async () => dailyBody }
    : success());
  await h.call('usage-key', 'prompt');
  assert.deepEqual(h.usageEvents, [
    { model: 'gemini-3.5-flash-lite', outcome: 'daily_exhausted' },
    { model: 'gemini-3.5-flash', outcome: 'processed' },
  ]);
});

test('exhausted candidates report whether the daily or per-minute limit was reached, without counting 429s as used requests', async () => {
  const quotaBody = (quotaId) => ({ error: { code: 429, details: [{ violations: [{ quotaId }] }] } });
  const allDaily = harness(() => ({ ok: false, status: 429, headers: { get: () => '30' }, json: async () => quotaBody('GenerateRequestsPerDayPerProjectPerModel-FreeTier') }));
  await assert.rejects(allDaily.call('daily-key', 'prompt'), (error) => error.name === 'GeminiRateLimitError' && error.quotaScope === 'daily');
  assert.ok(allDaily.usageEvents.every((event) => event.outcome === 'daily_exhausted'));

  const mixed = harness((url) => ({
    ok: false, status: 429, headers: { get: () => '30' },
    json: async () => quotaBody(url.includes('3.5-flash-lite:') ? 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' : 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier'),
  }));
  await assert.rejects(mixed.call('mixed-key', 'prompt'), (error) => error.quotaScope === 'minute');

  const noBody = harness(() => failure(429));
  await assert.rejects(noBody.call('plain-key', 'prompt'), (error) => error.quotaScope === 'unknown');
  assert.deepEqual(noBody.usageEvents, []);
});

test('a daily 429 mixed with an unclassified 429 is not reported as a used-up day, and timed-out requests are counted', async () => {
  const dailyBody = { error: { code: 429, details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] } };
  const mixed = harness((url) => url.includes('3.5-flash-lite:')
    ? { ok: false, status: 429, headers: { get: () => '30' }, json: async () => dailyBody }
    : failure(429));
  await assert.rejects(mixed.call('mixed-unknown-key', 'prompt'), (error) => error.quotaScope === 'unknown');

  const timeout = harness((url) => {
    if (url.includes('3.5-flash-lite:')) {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      throw error;
    }
    return success();
  });
  await timeout.call('timeout-key', 'prompt');
  assert.deepEqual(timeout.usageEvents, [
    { model: 'gemini-3.5-flash-lite', outcome: 'processed' },
    { model: 'gemini-3.5-flash', outcome: 'processed' },
  ]);
});

test('user-facing AI failure text never names a model, provider, or error code', async () => {
  const h = harness(() => success());
  const describe = h.describe;
  const cases = [
    new Error('Gemini 모델 [gemini-3.5-flash-lite]로부터 비어있는 응답을 받았습니다.'),
    new Error('Gemini API 통신 실패 (500)'),
    new Error('Google Gemini AI 서버가 현재 일시적인 전 세계 트래픽 폭주(503 High Demand) 상태입니다.'),
    new Error('Claude Sonnet 4.6 통신 실패 (529)'),
    new Error('OpenAI GPT-4o 통신 실패 (500)'),
    new Error('등록된 API 키가 유효하지 않습니다 (Google 400 오류). Google AI Studio(https://aistudio.google.com)에서 확인'),
    Object.assign(new Error('x'), { name: 'GeminiRateLimitError', quotaScope: 'daily' }),
  ];
  for (const error of cases) {
    const text = describe(error);
    assert.ok(!/gemini|google|claude|openai|gpt|sonnet|\d{3}/i.test(text), `노출 금지 문구: ${text}`);
  }
  assert.match(describe(cases[5]), /API 키가 유효하지 않습니다\. 설정에서 API 키를 확인해 주세요/);
  assert.equal(describe(new Error('PDF 분석을 지원하는 AI 연결이 필요합니다.')), 'PDF 분석을 지원하는 AI 연결이 필요합니다.');
});

test('AI JSON with single-backslash LaTeX is repaired without touching real newlines, tabs or escapes', () => {
  const h = harness(() => success());
  const parse = h.parse;
  // JSON 원문: 역슬래시를 한 번만 적은 LaTeX(\sqrt, \le는 해석 실패, \frac, \times는 글자가 몰래 바뀌는 경우)
  const single = String.raw`{"stem":"$\sqrt{2} \le \frac{3}{2} \times 1$","e":"줄1\n줄2\t끝","code":"u = 1\nu = 2","q":"\"인용\"","hex":"é","bad":"\underline{x}"}`;
  const parsed = parse(single);
  assert.equal(parsed.stem, String.raw`$\sqrt{2} \le \frac{3}{2} \times 1$`);
  assert.equal(parsed.e, '줄1\n줄2\t끝');
  assert.equal(parsed.code, 'u = 1\nu = 2', '수식 밖의 \n은 줄바꿈 그대로(\nu로 오인하지 않음)');
  assert.equal(parsed.q, '"인용"');
  assert.equal(parsed.hex, 'é');
  assert.equal(parsed.bad, String.raw`\underline{x}`);
  // 역슬래시를 올바르게 두 번 쓴 JSON은 그대로 해석된다.
  const doubled = String.raw`{"stem":"$\frac{1}{2} + \sqrt{3}$"}`;
  assert.equal(parse(doubled).stem, String.raw`$\frac{1}{2} + \sqrt{3}$`);
  assert.equal(parse('```json\n{"a":1}\n```').a, 1);
});

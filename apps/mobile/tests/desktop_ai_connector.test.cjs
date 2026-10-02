const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');
const { generateKeyPairSync, sign } = require('node:crypto');

const choice = { mode: 'desktop', providerId: 'openai', model: 'account-model', acceptApiUsage: false };
const ndjson = events => new Response(events.map(event => JSON.stringify(event)).join('\n') + '\n', { headers: { 'content-type': 'application/x-ndjson' } });
function harness({ saved = choice, shared = null, remote = false, accepted = true, generation, availableModels = [{ id: 'account-model', name: 'Account model' }] } = {}) {
  const calls = [], cache = new Map();
  let value = typeof saved === 'string' ? saved : saved ? JSON.stringify(saved) : null;
  let sharedValue = typeof shared === 'string' ? shared : shared ? JSON.stringify(shared) : null;
  function load(relative) {
    const filename = path.resolve(__dirname, '../src', relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, {
      module, exports: module.exports, AbortController, TextDecoder, setTimeout, clearTimeout,
      window: { location: { protocol: remote ? 'https:' : 'http:', hostname: remote ? 'example.com' : '127.0.0.1' }, localStorage: {
        getItem: () => sharedValue, setItem: (_key, next) => { sharedValue = next; },
      } },
      fetch: async (url, request) => {
        calls.push({ url, request });
        if (url === '/api/session') return Response.json({ protocol: 'ai-login-connector/1', csrf: 'test-csrf' });
        if (url === '/api/providers') return Response.json({ providers: [{ id: 'openai', canInfer: true }] });
        if (url === '/api/providers/openai/models') return Response.json({ models: availableModels });
        if (url === '/api/providers/openai/generate') return generation ? generation() : ndjson([{ type: 'delta', text: '연결 응답' }, { type: 'completed' }]);
        throw Error('Unexpected request');
      },
      require: name => {
        if (name === 'react-native') return { Platform: { OS: 'web' } };
        if (name === '../data/app_storage') return { getItem: async () => value, setItem: async (_key, next) => { value = next; } };
        if (name === './ai_data_notice') return { ensureAiDataNoticeAccepted: async () => accepted };
        if (name === './ai_usage') return { GEMINI_MODEL_ORDER: [] };
        if (name === './math_notation') return { restoreLatexControlChars: text => text };
        if (name.startsWith('.')) return load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(filename), `${name}.ts`)));
        throw Error(`Unexpected import ${name}`);
      },
    }, { filename });
    return module.exports;
  }
  return { bridge: load('integrations/desktop_ai_connector.ts'), ai: load('domain/ai_client.ts'), calls, savedChoice: () => value ? JSON.parse(value) : null,
    setShared: next => { sharedValue = typeof next === 'string' ? next : JSON.stringify(next); } };
}

test('the connection-screen selection overrides an older app preference for every AI request', async () => {
  const h = harness({ shared: { ...choice, model: 'selected-model' } });
  for (const prompt of ['question and answer explanation', 'hint', 'subjective grading', 'curriculum']) {
    await h.ai.callUniversalAiCompletion('sk-unused-existing-key', prompt);
  }
  const requests = h.calls.filter(call => call.url.endsWith('/generate'));
  assert.equal(requests.length, 4);
  assert.ok(requests.every(call => JSON.parse(call.request.body).model === 'selected-model'));
  assert.ok(!JSON.stringify(h.calls).includes('sk-unused-existing-key'));
});
test('a later model selection is used by the next request without reloading the app', async () => {
  const h = harness({ shared: choice });
  await h.ai.callUniversalAiCompletion('', 'first');
  h.setShared({ ...choice, model: 'another-model' });
  await h.ai.callUniversalAiCompletion('', 'second');
  assert.deepEqual(h.calls.filter(call => call.url.endsWith('/generate')).map(call => JSON.parse(call.request.body).model), ['account-model', 'another-model']);
});
test('corrupt shared preferences reject generation instead of falling back to a key', async () => {
  const h = harness({ shared: '{broken' });
  await assert.rejects(h.ai.callUniversalAiCompletion('sk-existing-key', 'request'), { code: 'CHOICE_INVALID' });
  assert.equal(h.calls.length, 0);
});
test('the public web ignores local-desktop shared selection', async () => {
  const h = harness({ saved: { mode: 'api-key' }, shared: choice, remote: true });
  assert.equal(await h.ai.hasAiConnection('stored-key'), true);
  assert.equal(h.calls.length, 0);
});

test('existing API-key mode makes no local bridge request during readiness checks', async () => {
  const h = harness({ saved: { mode: 'api-key' } });
  assert.equal(await h.ai.hasAiConnection('stored-api-key'), true);
  assert.equal(await h.ai.hasAiConnection(''), false);
  assert.equal(h.calls.length, 0);
});
test('a fresh signed-in account automatically selects a real model before generation', async () => {
  const h = harness({ saved: null });
  assert.equal(await h.ai.hasAiConnection(''), true);
  assert.equal(h.savedChoice().mode, 'desktop'); assert.equal(h.savedChoice().model, 'account-model');
  const response = await h.ai.callUniversalAiCompletion('', 'public test question');
  assert.equal(response.text, '연결 응답');
  assert.equal(JSON.parse(h.calls.at(-1).request.body).model, 'account-model');
});
test('fresh API-key users retain their key route without querying the local account', async () => {
  const h = harness({ saved: null });
  assert.equal(await h.ai.hasAiConnection('stored-api-key'), true);
  assert.equal(h.calls.length, 0); assert.equal(h.savedChoice(), null);
});
test('a login with no available models cannot become an inference connection', async () => {
  const h = harness({ saved: null, availableModels: [] });
  await assert.rejects(h.ai.hasAiConnection(''), { code: 'MODEL_UNAVAILABLE' });
  assert.equal(h.savedChoice(), null); assert.ok(!h.calls.some(call => call.url.endsWith('/generate')));
});
test('a signed-in account is usable without an API key', async () => {
  const h = harness(); assert.equal(await h.ai.hasAiConnection(''), true);
  assert.deepEqual(h.calls.map(call => call.url), ['/api/session', '/api/providers']);
});
test('desktop requests use only the local bridge and never forward the saved key', async () => {
  const h = harness(); const result = await h.ai.callUniversalAiCompletion('sk-private-existing-key', 'learning request');
  assert.equal(result.text, '연결 응답');
  assert.equal(h.calls.length, 2); assert.ok(h.calls.every(call => call.url.startsWith('/api/')));
  const request = h.calls.at(-1).request;
  assert.equal(request.headers['x-connector-csrf'], 'test-csrf');
  assert.equal(JSON.parse(request.body).model, 'account-model');
  assert.ok(!JSON.stringify(h.calls).includes('sk-private-existing-key'));
});
test('partial output is rejected and never falls back to the saved API key', async () => {
  const h = harness({ generation: () => ndjson([{ type: 'delta', text: 'unfinished' }]) });
  await assert.rejects(h.ai.callUniversalAiCompletion('sk-private-existing-key', 'request'), { name: 'DesktopAiConnectionError', code: 'STREAM_INTERRUPTED' });
  assert.ok(h.calls.every(call => call.url.startsWith('/api/')));
});
test('streamed quota errors remain failures after text has started', async () => {
  const h = harness({ generation: () => ndjson([{ type: 'delta', text: 'partial' }, { type: 'error', code: 'USAGE_LIMIT' }]) });
  await assert.rejects(h.ai.callUniversalAiCompletion('stored-key', 'request'), { code: 'USAGE_LIMIT' });
});
test('declined data notice sends no local request or provider request', async () => {
  const h = harness({ accepted: false });
  await assert.rejects(h.ai.callUniversalAiCompletion('', 'request'), { name: 'GenerationCancelledError' });
  assert.equal(h.calls.length, 0);
});
test('unsupported PDF and current-search requests send no data', async () => {
  const h = harness();
  await assert.rejects(h.ai.callUniversalAiCompletion('', 'request', undefined, { mimeType: 'application/pdf', base64Data: 'data' }), /PDF/);
  await assert.rejects(h.ai.callUniversalAiCompletion('', 'request', undefined, undefined, { enableGoogleSearch: true }), /최신 정보/);
  assert.equal(h.calls.length, 0);
});
test('remote origins cannot use a remembered desktop connection', async () => {
  const h = harness({ remote: true });
  assert.equal(await h.ai.hasAiConnection('sk-existing-key'), false);
  await assert.rejects(h.ai.callUniversalAiCompletion('sk-existing-key', 'request'), { code: 'LOCAL_HOST_REQUIRED' });
  assert.equal(h.calls.length, 0);
});
test('corrupt preferences do not silently choose API-key mode', async () => {
  const h = harness({ saved: '{bad json' });
  await assert.rejects(h.ai.callUniversalAiCompletion('sk-existing-key', 'request'), { code: 'CHOICE_INVALID' });
  assert.equal(h.calls.length, 0);
});
test('already cancelled calls do not begin login or inference', async () => {
  const h = harness(), controller = new AbortController(); controller.abort();
  await assert.rejects(h.ai.callUniversalAiCompletion('', 'request', controller.signal), { name: 'GenerationCancelledError' });
  assert.equal(h.calls.length, 0);
});

test('OAuth state is single-use and invalid state never exchanges a code', async () => {
  const source = pathToFileURL(path.resolve(__dirname, '../../../packages/ai-login-connector/src/index.js')).href;
  const { AIConnector, MemoryStore } = await import(source);
  let state, exchanges = 0;
  const provider = {
    id: 'openai', name: 'test', signupUrl: 'https://example.invalid', description: 'test', ready: true, authMode: 'test',
    capabilities: { login: true, inference: false, streaming: false },
    begin: async attempt => { state = attempt.state; return `https://example.invalid/authorize?state=${state}`; },
    exchange: async () => { exchanges++; return { clientId: 'client', issuer: 'issuer', subject: 'subject', accessToken: 'test-only', scopes: [] }; },
  };
  const connector = new AIConnector({ store: new MemoryStore(), providers: [provider] });
  try {
    await connector.connect('openai', { redirectUri: 'http://127.0.0.1:48721/auth/callback' });
    await assert.rejects(connector.completeConnect('http://127.0.0.1:48721/auth/callback?state=wrong&code=test'), { code: 'STATE_INVALID' });
    assert.equal(exchanges, 0);
    const callback = `http://127.0.0.1:48721/auth/callback?state=${state}&code=test`;
    await connector.completeConnect(callback);
    assert.equal((await connector.status())[0].status, 'identity-only');
    await assert.rejects(connector.completeConnect(callback), { code: 'STATE_INVALID' });
    assert.equal(exchanges, 1);
    assert.ok(!JSON.stringify(await connector.status()).includes('test-only'));
  } finally { await connector.close(); }
});

test('Google and GPT connections coexist and requests can switch without disconnecting either', async () => {
  const source = pathToFileURL(path.resolve(__dirname, '../../../packages/ai-login-connector/src/index.js')).href;
  const { AIConnector, MemoryStore } = await import(source);
  const states = new Map(), requests = [];
  const providers = ['google', 'openai'].map(id => ({
    id, ready: true, capabilities: { login: true, inference: true, streaming: false },
    begin: async attempt => { states.set(id, attempt.state); return `https://example.invalid/${id}`; },
    exchange: async () => ({ clientId: id, issuer: 'test-issuer', subject: 'test-subject', accessToken: 'test-only', scopes: [] }),
    models: async () => [{ id: `${id}-model`, name: id }],
    generate: async (account, { model }) => { requests.push(id); return { text: id, model, completed: true }; },
  }));
  const connector = new AIConnector({ store: new MemoryStore(), providers });
  try {
    for (const id of ['google', 'openai']) {
      await connector.connect(id, { redirectUri: 'http://127.0.0.1:48721/auth/callback' });
      await connector.completeConnect(`http://127.0.0.1:48721/auth/callback?state=${states.get(id)}&code=test`);
    }
    assert.ok((await connector.status()).every(provider => provider.canInfer && provider.accounts.length === 1));
    for (const id of ['google', 'openai', 'google']) {
      const result = await connector.generate(id, { model: `${id}-model`, prompt: 'test' });
      assert.equal(result.text, id);
    }
    assert.deepEqual(requests, ['google', 'openai', 'google']);
    assert.ok((await connector.status()).every(provider => provider.canInfer));
  } finally { await connector.close(); }
});

test('OIDC verifies signature, nonce, audience and expiry against a trusted JWKS', async () => {
  const source = pathToFileURL(path.resolve(__dirname, '../../../packages/ai-login-connector/src/oidc.js')).href;
  const { IdentityVerifier } = await import(source);
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
  const verifier = new IdentityVerifier(async () => Response.json({ keys: [jwk] }));
  const now = Math.floor(Date.now() / 1000);
  function token(overrides = {}) {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ iss: 'https://issuer.invalid', aud: 'client', sub: 'account', iat: now, exp: now + 600, nonce: 'nonce', ...overrides })).toString('base64url');
    const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
    return `${header}.${payload}.${signature}`;
  }
  const options = { issuer: 'https://issuer.invalid', audience: 'client', nonce: 'nonce', jwksUri: 'https://issuer.invalid/keys' };
  assert.equal((await verifier.validate(token(), options)).sub, 'account');
  for (const overrides of [{ nonce: 'wrong' }, { aud: 'other' }, { iss: 'https://other.invalid' }, { exp: now - 60 }]) {
    await assert.rejects(verifier.validate(token(overrides), options), { code: 'IDENTITY_INVALID' });
  }
  const valid = token().split('.'); valid[2] = Buffer.alloc(256).toString('base64url');
  await assert.rejects(verifier.validate(valid.join('.'), options), { code: 'IDENTITY_INVALID' });
});

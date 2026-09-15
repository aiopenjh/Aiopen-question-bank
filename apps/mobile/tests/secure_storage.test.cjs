const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const NATIVE = 'celueste.ai_api_key.v2';
const LEGACY = '@cogniquest:gemini_api_key';
const VAULT = '@cogniquest:secure_vault_v1';

function harness(os = 'android', { mismatch = false, initialNative = null, failVerification = false } = {}) {
  const local = new Map([[LEGACY, 'synthetic-legacy'], [VAULT, '{}']]);
  const native = new Map(initialNative ? [[NATIVE, initialNative]] : []);
  const events = [];
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/integrations/secure_storage.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require(name) {
    if (name === 'react-native') return { Platform: { OS: os } };
    if (name === '@react-native-async-storage/async-storage') return {
      getItem: async key => { events.push(['local-read', key]); return local.get(key) ?? null; },
      setItem: async (key, value) => { events.push(['local-write', key, value]); local.set(key, value); },
      multiRemove: async keys => { events.push(['legacy-remove']); keys.forEach(key => local.delete(key)); },
    };
    if (name === 'expo-secure-store') return {
      getItemAsync: async key => {
        events.push(['native-read']);
        const hasWritten = events.some(e => e[0] === 'native-write');
        if (failVerification && hasWritten) throw new Error('synthetic-read-failure');
        return mismatch && hasWritten && native.has(key) ? 'synthetic-mismatch' : native.get(key) ?? null;
      },
      setItemAsync: async (key, value) => { events.push(['native-write', value]); native.set(key, value); },
      deleteItemAsync: async key => { events.push(['native-delete']); native.delete(key); },
    };
    throw new Error('Unexpected import');
  } });
  return { api: module.exports, native, local, events };
}

test('native save reads back successfully before removing legacy storage', async () => {
  const h = harness();
  await h.api.saveEncryptedApiKey('synthetic-new');
  const write = h.events.findIndex(e => e[0] === 'native-write');
  const verify = h.events.findIndex((e, i) => i > write && e[0] === 'native-read');
  const remove = h.events.findIndex(e => e[0] === 'legacy-remove');
  assert.ok(write >= 0 && verify > write && remove > verify);
  assert.equal(await h.api.getEncryptedApiKey(), 'synthetic-new');
  assert.equal(h.local.size, 0);
});

test('native failed verification leaves legacy key available', async () => {
  const h = harness('android', { mismatch: true });
  await assert.rejects(h.api.saveEncryptedApiKey('synthetic-new'));
  assert.equal(h.local.get(LEGACY), 'synthetic-legacy');
  assert.ok(!h.events.some(e => e[0] === 'legacy-remove'));
});

test('native migration verifies before removing legacy and retains on failure', async () => {
  const h = harness();
  assert.equal(await h.api.getEncryptedApiKey(), 'synthetic-legacy');
  assert.equal(h.native.get(NATIVE), 'synthetic-legacy');
  assert.equal(h.local.size, 0);
  const failed = harness('android', { mismatch: true });
  await assert.rejects(failed.api.getEncryptedApiKey());
  assert.equal(failed.local.get(LEGACY), 'synthetic-legacy');
});

test('web key exists in memory only and is absent in a fresh module session', async () => {
  const h = harness('web');
  await h.api.saveEncryptedApiKey('synthetic-web');
  assert.equal(await h.api.getEncryptedApiKey(), 'synthetic-web');
  assert.ok(!h.events.some(e => e[0] === 'local-write' || e[0].startsWith('native')));
  assert.equal(await harness('web').api.getEncryptedApiKey(), null);
  await h.api.deleteEncryptedApiKey();
  assert.equal(await h.api.getEncryptedApiKey(), null);
});

test('queued save then delete clears both native and legacy key stores', async () => {
  const h = harness('android', { initialNative: 'synthetic-old' });
  const save = h.api.saveEncryptedApiKey('synthetic-new');
  const remove = h.api.deleteEncryptedApiKey();
  await Promise.all([save, remove]);
  assert.equal(h.native.size, 0);
  assert.equal(h.local.size, 0);
  assert.equal(await h.api.getEncryptedApiKey(), null);
  assert.ok(h.events.findIndex(e => e[0] === 'native-delete') > h.events.findIndex(e => e[0] === 'native-write'));
});

test('failed native replacement verification restores the previous native key', async () => {
  const h = harness('android', { initialNative: 'synthetic-old', mismatch: true });
  await assert.rejects(h.api.saveEncryptedApiKey('synthetic-new'));
  assert.equal(h.native.get(NATIVE), 'synthetic-old');
  assert.equal(h.local.get(LEGACY), 'synthetic-legacy');
  assert.ok(!h.events.some(e => e[0] === 'legacy-remove'));
});

test('verification read failure restores native key and preserves legacy values', async () => {
  const h = harness('android', { initialNative: 'synthetic-old', failVerification: true });
  await assert.rejects(h.api.saveEncryptedApiKey('synthetic-new'));
  assert.equal(h.native.get(NATIVE), 'synthetic-old');
  assert.equal(h.local.get(LEGACY), 'synthetic-legacy');
  assert.equal(h.local.get(VAULT), '{}');
  assert.ok(!h.events.some(e => e[0] === 'legacy-remove'));
});

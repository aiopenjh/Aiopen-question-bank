const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const ts = require('typescript');

const NATIVE = 'celueste.ai_api_key.v2';
const LEGACY = '@cogniquest:gemini_api_key';
const VAULT = '@cogniquest:secure_vault_v1';

function createWebVault() {
  return { initialized: false, records: new Map() };
}

function createIndexedDB(vault) {
  return {
    open() {
      const request = {};
      queueMicrotask(() => {
        const database = {
          objectStoreNames: { contains: () => vault.initialized },
          createObjectStore: () => { vault.initialized = true; },
          close: () => {},
          transaction: () => {
            const transaction = {
              objectStore: () => ({
                get: id => {
                  const read = {};
                  queueMicrotask(() => {
                    read.result = vault.records.get(id);
                    read.onsuccess?.();
                  });
                  return read;
                },
                put: record => {
                  queueMicrotask(() => {
                    vault.records.set(record.id, record);
                    transaction.oncomplete?.();
                  });
                },
                delete: id => {
                  queueMicrotask(() => {
                    vault.records.delete(id);
                    transaction.oncomplete?.();
                  });
                },
              }),
            };
            return transaction;
          },
        };
        request.result = database;
        if (!vault.initialized) request.onupgradeneeded?.();
        queueMicrotask(() => request.onsuccess?.());
      });
      return request;
    },
  };
}

function harness(os = 'android', {
  mismatch = false,
  initialNative = null,
  nativeAvailable = true,
  webVault = createWebVault(),
  webCryptoAvailable = true,
} = {}) {
  const local = new Map([[LEGACY, 'synthetic-legacy'], [VAULT, '{}']]);
  const native = new Map(initialNative ? [[NATIVE, initialNative]] : []);
  const events = [];
  const module = { exports: {} };
  const code = ts.transpileModule(
    fs.readFileSync(path.resolve(__dirname, '../src/integrations/secure_storage.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }
  ).outputText;

  const context = {
    module,
    exports: module.exports,
    TextEncoder,
    TextDecoder,
    crypto: webCryptoAvailable ? webcrypto : undefined,
    indexedDB: webCryptoAvailable ? createIndexedDB(webVault) : undefined,
    require(name) {
      if (name === 'react-native') return { Platform: { OS: os } };
      if (name === '@react-native-async-storage/async-storage') {
        return {
          getItem: async key => {
            events.push(['local-read', key]);
            return local.get(key) ?? null;
          },
          setItem: async (key, value) => {
            events.push(['local-write', key, value]);
            local.set(key, value);
          },
          multiRemove: async keys => {
            events.push(['legacy-remove', [...keys]]);
            keys.forEach(key => local.delete(key));
          },
        };
      }
      if (name === 'expo-secure-store') {
        return {
          WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when-unlocked-this-device-only',
          isAvailableAsync: async () => {
            events.push(['native-availability']);
            return nativeAvailable;
          },
          getItemAsync: async key => {
            events.push(['native-read']);
            const hasWritten = events.some(event => event[0] === 'native-write');
            return mismatch && hasWritten && native.has(key)
              ? 'synthetic-mismatch'
              : native.get(key) ?? null;
          },
          setItemAsync: async (key, value) => {
            events.push(['native-write', value]);
            native.set(key, value);
          },
          deleteItemAsync: async key => {
            events.push(['native-delete']);
            native.delete(key);
          },
        };
      }
      throw new Error(`Unexpected import: ${name}`);
    },
  };
  vm.runInNewContext(code, context);
  return { api: module.exports, native, local, events, webVault };
}

test('native save verifies the secure record before removing legacy storage', async () => {
  const session = harness();
  assert.equal(await session.api.saveEncryptedApiKey('synthetic-new'), 'persistent');
  const write = session.events.findIndex(event => event[0] === 'native-write');
  const verify = session.events.findIndex((event, index) => index > write && event[0] === 'native-read');
  const remove = session.events.findIndex(event => event[0] === 'legacy-remove');

  assert.ok(write >= 0 && verify > write && remove > verify);
  assert.equal(await session.api.getEncryptedApiKey(), 'synthetic-new');
  assert.equal(session.local.size, 0);
});

test('native failed verification restores the previous key and retains legacy values', async () => {
  const session = harness('android', { initialNative: 'synthetic-old', mismatch: true });
  await assert.rejects(session.api.saveEncryptedApiKey('synthetic-new'));

  assert.equal(session.native.get(NATIVE), 'synthetic-old');
  assert.equal(session.local.get(LEGACY), 'synthetic-legacy');
  assert.equal(session.local.get(VAULT), '{}');
  assert.ok(!session.events.some(event => event[0] === 'legacy-remove'));
});

test('native migration verifies before removing legacy and retains it on failure', async () => {
  const migrated = harness();
  assert.equal(await migrated.api.getEncryptedApiKey(), 'synthetic-legacy');
  assert.equal(migrated.native.get(NATIVE), 'synthetic-legacy');
  assert.equal(migrated.local.size, 0);

  const failed = harness('android', { mismatch: true });
  await assert.rejects(failed.api.getEncryptedApiKey());
  assert.equal(failed.local.get(LEGACY), 'synthetic-legacy');
});

test('unavailable native secure storage rejects save without deleting legacy values', async () => {
  const session = harness('android', { nativeAvailable: false });
  await assert.rejects(session.api.saveEncryptedApiKey('synthetic-new'));

  assert.equal(session.local.get(LEGACY), 'synthetic-legacy');
  assert.equal(session.local.get(VAULT), '{}');
  assert.equal(session.native.size, 0);
});

test('web key persists encrypted in IndexedDB across fresh module sessions', async () => {
  const webVault = createWebVault();
  const first = harness('web', { webVault });
  assert.equal(await first.api.saveEncryptedApiKey('synthetic-web'), 'persistent');
  assert.equal(await first.api.getEncryptedApiKey(), 'synthetic-web');
  assert.equal(first.local.size, 0);

  const stored = webVault.records.get('ai-api-key');
  assert.equal(stored.version, 2);
  assert.equal(JSON.stringify(stored).includes('synthetic-web'), false);

  const restarted = harness('web', { webVault });
  assert.equal(await restarted.api.getEncryptedApiKey(), 'synthetic-web');
  await restarted.api.deleteEncryptedApiKey();
  assert.equal(webVault.records.size, 0);
  assert.equal(await restarted.api.getEncryptedApiKey(), null);
});

test('web save fails closed when encrypted browser storage is unavailable', async () => {
  const session = harness('web', { webCryptoAvailable: false });
  await assert.rejects(session.api.saveEncryptedApiKey('synthetic-web'));

  assert.equal(session.local.get(LEGACY), 'synthetic-legacy');
  assert.equal(session.local.get(VAULT), '{}');
});

test('queued save then delete clears both native and legacy key stores', async () => {
  const session = harness('android', { initialNative: 'synthetic-old' });
  const save = session.api.saveEncryptedApiKey('synthetic-new');
  const remove = session.api.deleteEncryptedApiKey();
  await Promise.all([save, remove]);

  assert.equal(session.native.size, 0);
  assert.equal(session.local.size, 0);
  assert.equal(await session.api.getEncryptedApiKey(), null);
  assert.ok(
    session.events.findIndex(event => event[0] === 'native-delete') >
    session.events.findIndex(event => event[0] === 'native-write')
  );
});

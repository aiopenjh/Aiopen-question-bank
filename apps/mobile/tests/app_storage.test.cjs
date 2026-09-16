const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function createIndexedDB() {
  const state = { initialized: false, records: new Map() };

  return {
    state,
    api: {
      open() {
        const request = {};
        queueMicrotask(() => {
          const database = {
            objectStoreNames: { contains: () => state.initialized },
            createObjectStore: () => { state.initialized = true; },
            close() {},
            transaction() {
              let pending = 0;
              let completionQueued = false;
              const transaction = {
                error: null,
                objectStore() {
                  const execute = operation => {
                    pending += 1;
                    const operationRequest = {};
                    queueMicrotask(() => {
                      try {
                        operationRequest.result = operation();
                        operationRequest.onsuccess?.();
                      } catch (error) {
                        operationRequest.error = error;
                        transaction.error = error;
                        operationRequest.onerror?.();
                        transaction.onerror?.();
                      } finally {
                        pending -= 1;
                        scheduleCompletion();
                      }
                    });
                    return operationRequest;
                  };
                  return {
                    get: key => execute(() => state.records.get(key)),
                    put: (value, key) => execute(() => state.records.set(key, value)),
                    delete: key => execute(() => state.records.delete(key)),
                    clear: () => execute(() => state.records.clear()),
                    getAllKeys: () => execute(() => [...state.records.keys()]),
                  };
                },
              };
              const scheduleCompletion = () => {
                if (pending !== 0 || completionQueued) return;
                completionQueued = true;
                queueMicrotask(() => transaction.oncomplete?.());
              };
              return transaction;
            },
          };
          request.result = database;
          if (!state.initialized) request.onupgradeneeded?.();
          queueMicrotask(() => request.onsuccess?.());
        });
        return request;
      },
    },
  };
}

function harness(initialEntries = []) {
  const local = new Map(initialEntries);
  const indexed = createIndexedDB();
  const nativeStorage = {
    async getItem(key) { return local.get(key) ?? null; },
    async setItem(key, value) { local.set(key, value); },
    async removeItem(key) { local.delete(key); },
    async multiGet(keys) { return keys.map(key => [key, local.get(key) ?? null]); },
    async multiSet(entries) { entries.forEach(([key, value]) => local.set(key, value)); },
    async multiRemove(keys) { keys.forEach(key => local.delete(key)); },
    async getAllKeys() { return [...local.keys()]; },
    async clear() { local.clear(); },
  };
  const module = { exports: {} };
  const source = fs.readFileSync(
    path.resolve(__dirname, '../src/data/app_storage.ts'),
    'utf8'
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
    console,
    Promise,
    Set,
    Error,
    DOMException,
    indexedDB: indexed.api,
    queueMicrotask,
  })((name) => {
    if (name === '@react-native-async-storage/async-storage') return nativeStorage;
    throw new Error(`Unexpected import: ${name}`);
  }, module, module.exports);

  return { api: module.exports.default, initialize: module.exports.initializeAppStorage, local, indexed };
}

test('web storage automatically migrates application data and excludes credentials', async () => {
  const session = harness([
    ['@cogniquest:topics', '[{"id":"topic-1"}]'],
    ['@cogniquest:questions', '[{"id":"question-1"}]'],
    ['@cogniquest:gemini_api_key', 'must-not-migrate'],
    ['unrelated-key', 'leave-alone'],
  ]);

  assert.equal(await session.initialize(), 'indexeddb');
  assert.equal(await session.api.getItem('@cogniquest:topics'), '[{"id":"topic-1"}]');
  assert.equal(session.indexed.state.records.has('@cogniquest:gemini_api_key'), false);
  assert.equal(session.indexed.state.records.has('unrelated-key'), false);

  session.local.set('@cogniquest:topics', 'stale-local-copy');
  assert.equal(await session.api.getItem('@cogniquest:topics'), '[{"id":"topic-1"}]');
});

test('web storage writes, removes, and clears IndexedDB data after migration', async () => {
  const session = harness([['@cogniquest:topics', '[]']]);
  await session.initialize();

  await session.api.multiSet([
    ['@cogniquest:questions', '[{"id":"q1"}]'],
    ['@celueste:alarm_config_v2', '{"morningEnabled":true}'],
  ]);
  assert.equal(
    JSON.stringify(await session.api.multiGet(['@cogniquest:questions', '@celueste:alarm_config_v2'])),
    JSON.stringify([
      ['@cogniquest:questions', '[{"id":"q1"}]'],
      ['@celueste:alarm_config_v2', '{"morningEnabled":true}'],
    ])
  );

  await session.api.multiRemove(['@cogniquest:questions']);
  assert.equal(await session.api.getItem('@cogniquest:questions'), null);

  await session.api.clear();
  assert.equal(session.local.has('@cogniquest:topics'), false);
  assert.equal(session.indexed.state.records.size, 0);
});

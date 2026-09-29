const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const MIGRATION_MARKER_KEY = '__celueste:indexeddb-migration-v1';
const ACTIVE_MARKER_KEY = '__celueste:indexeddb-active';

function createIndexedDB(initialRecords = []) {
  const state = {
    initialized: false,
    records: new Map(initialRecords),
    failOpen: false,
    failGetKeys: new Set(),
    failPutKeys: new Set(),
    corruptGetValues: new Map(),
    failClear: false,
  };

  return {
    state,
    api: {
      open() {
        const request = {};
        queueMicrotask(() => {
          if (state.failOpen) {
            request.error = new Error('open failed');
            request.onerror?.();
            return;
          }
          const database = {
            objectStoreNames: { contains: () => state.initialized },
            createObjectStore: () => { state.initialized = true; },
            close() {},
            transaction(_storeName, mode = 'readonly') {
              let pending = 0;
              let completionQueued = false;
              let failed = false;
              const draft = mode === 'readwrite' ? new Map(state.records) : state.records;
              const transaction = {
                error: null,
                objectStore() {
                  const execute = operation => {
                    pending += 1;
                    const operationRequest = {};
                    queueMicrotask(() => {
                      try {
                        if (failed) return;
                        operationRequest.result = operation();
                        operationRequest.onsuccess?.();
                      } catch (error) {
                        failed = true;
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
                    get: key => execute(() => {
                      if (state.failGetKeys.has(key)) throw new Error(`get failed: ${key}`);
                      if (state.corruptGetValues.has(key)) return state.corruptGetValues.get(key);
                      return draft.get(key);
                    }),
                    put: (value, key) => execute(() => {
                      if (state.failPutKeys.has(key)) throw new Error(`put failed: ${key}`);
                      draft.set(key, value);
                    }),
                    delete: key => execute(() => draft.delete(key)),
                    clear: () => execute(() => {
                      if (state.failClear) throw new Error('clear failed');
                      draft.clear();
                    }),
                    getAllKeys: () => execute(() => [...draft.keys()]),
                  };
                },
              };
              const scheduleCompletion = () => {
                if (pending !== 0 || completionQueued || failed) return;
                completionQueued = true;
                queueMicrotask(() => {
                  if (mode === 'readwrite') {
                    state.records.clear();
                    for (const [key, value] of draft) state.records.set(key, value);
                  }
                  transaction.oncomplete?.();
                });
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

function harness(initialEntries = [], options = {}) {
  const local = options.local ?? new Map(initialEntries);
  const indexed = options.indexed ?? createIndexedDB();
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
    indexedDB: options.disableIndexedDB ? undefined : indexed.api,
    queueMicrotask,
  })((name) => {
    if (name === '@react-native-async-storage/async-storage') return nativeStorage;
    // 이 파일은 웹 경로만 검증한다. 네이티브 SQLite 경로는 native_sqlite_storage.test.cjs.
    if (name === 'react-native') return { Platform: { OS: 'web' } };
    if (name === './native_storage_migration') {
      return {
        async initializeNativeStorage() {
          throw new Error('웹 저장소 경로에서 네이티브 SQLite 초기화가 호출되었습니다.');
        },
      };
    }
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
  assert.equal(session.indexed.state.records.get(MIGRATION_MARKER_KEY), 'complete');
  assert.equal(session.local.get(ACTIVE_MARKER_KEY), 'v1');

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
  assert.equal(session.local.get(ACTIVE_MARKER_KEY), 'v1');
  assert.equal(session.indexed.state.records.size, 1);
  assert.equal(session.indexed.state.records.get(MIGRATION_MARKER_KEY), 'complete');
  assert.deepEqual(await session.api.getAllKeys(), []);

  const restarted = harness([], { local: session.local, indexed: session.indexed });
  assert.equal(await restarted.initialize(), 'indexeddb');
  assert.equal(await restarted.api.getItem('@cogniquest:topics'), null);
});

test('pre-migration IndexedDB failure falls back to the current legacy storage', async () => {
  const session = harness([['@cogniquest:topics', 'legacy-current']]);
  session.indexed.state.failOpen = true;

  assert.equal(await session.initialize(), 'async-storage');
  assert.equal(await session.api.getItem('@cogniquest:topics'), 'legacy-current');
  assert.equal(session.local.has(ACTIVE_MARKER_KEY), false);
});

test('failed data transaction keeps migration incomplete and uses legacy storage', async () => {
  const session = harness([['@cogniquest:topics', 'legacy-current']]);
  session.indexed.state.failPutKeys.add('@cogniquest:topics');

  assert.equal(await session.initialize(), 'async-storage');
  assert.equal(session.indexed.state.records.has(MIGRATION_MARKER_KEY), false);
  assert.equal(session.local.has(ACTIVE_MARKER_KEY), false);
  assert.equal(await session.api.getItem('@cogniquest:topics'), 'legacy-current');
});

test('verification read failure after data commit leaves markers incomplete and retries safely', async () => {
  const session = harness([['@cogniquest:topics', 'legacy-current']]);
  session.indexed.state.failGetKeys.add('@cogniquest:topics');

  assert.equal(await session.initialize(), 'async-storage');
  assert.equal(session.indexed.state.records.get('@cogniquest:topics'), 'legacy-current');
  assert.equal(session.indexed.state.records.has(MIGRATION_MARKER_KEY), false);
  assert.equal(session.local.has(ACTIVE_MARKER_KEY), false);

  session.indexed.state.failGetKeys.clear();
  const restarted = harness([], { local: session.local, indexed: session.indexed });
  assert.equal(await restarted.initialize(), 'indexeddb');
  assert.equal(restarted.local.get(ACTIVE_MARKER_KEY), 'v1');
  assert.equal(await restarted.api.getItem('@cogniquest:topics'), 'legacy-current');
});

test('verification mismatch does not record either completion marker', async () => {
  const session = harness([['@cogniquest:topics', 'legacy-current']]);
  session.indexed.state.corruptGetValues.set('@cogniquest:topics', 'corrupted-read');

  assert.equal(await session.initialize(), 'async-storage');
  assert.equal(session.indexed.state.records.has(MIGRATION_MARKER_KEY), false);
  assert.equal(session.local.has(ACTIVE_MARKER_KEY), false);
  assert.equal(await session.api.getItem('@cogniquest:topics'), 'legacy-current');
});

test('completion marker write failure leaves migration retryable', async () => {
  const session = harness([['@cogniquest:topics', 'legacy-current']]);
  session.indexed.state.failPutKeys.add(MIGRATION_MARKER_KEY);

  assert.equal(await session.initialize(), 'async-storage');
  assert.equal(session.indexed.state.records.get('@cogniquest:topics'), 'legacy-current');
  assert.equal(session.indexed.state.records.has(MIGRATION_MARKER_KEY), false);
  assert.equal(session.local.has(ACTIVE_MARKER_KEY), false);

  session.indexed.state.failPutKeys.clear();
  const restarted = harness([], { local: session.local, indexed: session.indexed });
  assert.equal(await restarted.initialize(), 'indexeddb');
  assert.equal(restarted.indexed.state.records.get(MIGRATION_MARKER_KEY), 'complete');
  assert.equal(restarted.local.get(ACTIVE_MARKER_KEY), 'v1');
});

test('completed migration never falls back to a stale legacy copy after IndexedDB failure', async () => {
  const session = harness([['@cogniquest:topics', 'current-before-migration']]);
  assert.equal(await session.initialize(), 'indexeddb');
  session.local.set('@cogniquest:topics', 'stale-legacy-copy');

  session.indexed.state.failOpen = true;
  const restarted = harness([], { local: session.local, indexed: session.indexed });
  await assert.rejects(restarted.initialize(), /학습 저장소/);
  await assert.rejects(restarted.api.getItem('@cogniquest:topics'), /학습 저장소/);
  assert.equal(restarted.local.get('@cogniquest:topics'), 'stale-legacy-copy');

  restarted.indexed.state.failOpen = false;
  assert.equal(await restarted.initialize(), 'indexeddb');
  assert.equal(await restarted.api.getItem('@cogniquest:topics'), 'current-before-migration');
});

test('existing migrated users receive the external active marker after a successful open', async () => {
  const indexed = createIndexedDB([
    [MIGRATION_MARKER_KEY, 'complete'],
    ['@cogniquest:topics', 'indexed-current'],
  ]);
  indexed.state.initialized = true;
  const local = new Map([['@cogniquest:topics', 'stale-legacy-copy']]);
  const session = harness([], { local, indexed });

  assert.equal(await session.initialize(), 'indexeddb');
  assert.equal(local.get(ACTIVE_MARKER_KEY), 'v1');
  assert.equal(await session.api.getItem('@cogniquest:topics'), 'indexed-current');
});

test('missing IndexedDB is allowed before migration but rejected after activation', async () => {
  const before = harness([['@cogniquest:topics', 'legacy-current']], { disableIndexedDB: true });
  assert.equal(await before.initialize(), 'async-storage');
  assert.equal(await before.api.getItem('@cogniquest:topics'), 'legacy-current');

  const activeLocal = new Map([
    [ACTIVE_MARKER_KEY, 'v1'],
    ['@cogniquest:topics', 'stale-legacy-copy'],
  ]);
  const after = harness([], { local: activeLocal, disableIndexedDB: true });
  await assert.rejects(after.initialize(), /IndexedDB/);
});

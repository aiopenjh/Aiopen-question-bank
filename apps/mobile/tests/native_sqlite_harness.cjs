// Test harness for native_sqlite_storage.test.cjs: expo-sqlite fake on node:sqlite (Node 22.13+),
// AsyncStorage fake and an app-launch loader. Like expo-sqlite, exclusive transactions run on a
// separate connection, so unserialized writes hit "database is locked".
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const tempDirs = [];
const fakes = [];

function createFakeSQLite() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'celueste-sqlite-'));
  tempDirs.push(directory);
  const faults = { failOpen: false, failSql: null, mapRow: null, failAfterCommit: null };
  const connections = new Set();
  const opened = [];
  const connect = file => {
    const db = new DatabaseSync(file);
    connections.add(db);
    return db;
  };
  const release = db => {
    connections.delete(db);
    db.close();
  };

  function wrap(db, kind) {
    const args = params => (params.length === 1 && Array.isArray(params[0]) ? params[0] : params);
    const guard = (sql, params) => {
      if (faults.failSql?.({ sql, params, kind })) throw new Error(`injected SQLite failure: ${sql.split('\n')[0]}`);
    };
    const rows = (sql, list) => list.map(row => ({ ...row })).map(row => faults.mapRow?.(row, sql) ?? row);
    return {
      async execAsync(sql) { guard(sql, []); db.exec(sql); },
      async runAsync(sql, ...params) {
        const values = args(params);
        guard(sql, values);
        const result = db.prepare(sql).run(...values);
        return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
      },
      async getFirstAsync(sql, ...params) {
        const values = args(params);
        guard(sql, values);
        const row = db.prepare(sql).get(...values);
        return row ? rows(sql, [row])[0] : null;
      },
      async getAllAsync(sql, ...params) {
        const values = args(params);
        guard(sql, values);
        return rows(sql, db.prepare(sql).all(...values));
      },
      async closeAsync() { release(db); },
    };
  }

  const fake = {
    faults,
    opened,
    directory,
    module: {
      async openDatabaseAsync(name) {
        if (faults.failOpen) throw new Error('injected open failure');
        opened.push(name);
        const file = path.join(directory, name);
        const database = wrap(connect(file), 'main');
        database.withExclusiveTransactionAsync = async task => {
          const txDb = connect(file);
          let failure = null;
          try {
            const txn = wrap(txDb, 'transaction');
            await txn.execAsync('BEGIN');
            await task(txn);
            await txn.execAsync('COMMIT');
            if (faults.failAfterCommit?.()) throw new Error('injected failure after commit');
          } catch (error) {
            failure = error;
            try { txDb.exec('ROLLBACK'); } catch { /* already committed or rolled back */ }
          } finally {
            release(txDb);
          }
          if (failure) throw failure;
        };
        return database;
      },
    },
    // 앱과 별도 연결로 파일에 실제 커밋된 내용을 읽는다.
    rows(name = 'celueste.db') {
      const file = path.join(directory, name);
      if (!fs.existsSync(file)) return null;
      const db = new DatabaseSync(file);
      try {
        return new Map(db.prepare('SELECT key, value FROM kv ORDER BY key').all().map(r => [r.key, r.value]));
      } finally {
        db.close();
      }
    },
    userRows(name) {
      const all = fake.rows(name);
      return all && new Map([...all].filter(([k]) => !k.startsWith('__celueste:')));
    },
    journalMode() {
      const db = new DatabaseSync(path.join(directory, 'celueste.db'));
      try { return db.prepare('PRAGMA journal_mode').get().journal_mode; } finally { db.close(); }
    },
    seed(name, entries) {
      const db = new DatabaseSync(path.join(directory, name));
      try {
        db.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
        const insert = db.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)');
        for (const [k, v] of entries) insert.run(k, v);
      } finally {
        db.close();
      }
    },
    closeAll() {
      for (const db of connections) db.close();
      connections.clear();
    },
  };
  fakes.push(fake);
  return fake;
}

function createAsyncStorage(entries = []) {
  const map = new Map(entries);
  const faults = { getItem: null, setItem: null, multiGet: null };
  const writes = [];
  const fail = (hook, k) => {
    if (hook?.(k)) throw new Error(`injected AsyncStorage failure: ${k}`);
  };
  return {
    map,
    faults,
    writes,
    api: {
      async getItem(k) { fail(faults.getItem, k); return map.get(k) ?? null; },
      async setItem(k, v) { fail(faults.setItem, k); writes.push(k); map.set(k, v); },
      async removeItem(k) { writes.push(k); map.delete(k); },
      async multiGet(keys) { keys.forEach(k => fail(faults.multiGet, k)); return keys.map(k => [k, map.get(k) ?? null]); },
      async multiSet(list) { list.forEach(([k, v]) => { writes.push(k); map.set(k, v); }); },
      async multiRemove(keys) { keys.forEach(k => { writes.push(k); map.delete(k); }); },
      async getAllKeys() { return [...map.keys()]; },
      async clear() { writes.push('*clear*'); map.clear(); },
    },
  };
}

function environment(entries = []) {
  const secure = new Map();
  return {
    sqlite: createFakeSQLite(),
    async: createAsyncStorage(entries),
    secureStore: {
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when-unlocked-this-device-only',
      isAvailableAsync: async () => true,
      getItemAsync: async k => secure.get(k) ?? null,
      setItemAsync: async (k, v) => { secure.set(k, v); },
      deleteItemAsync: async k => { secure.delete(k); },
    },
  };
}

// One app launch: fresh module instances over the same persisted SQLite files and AsyncStorage.
function launch(env, { platform = 'android' } = {}) {
  const cache = new Map();
  const logs = [];
  const quietConsole = {
    log() {},
    info() {},
    warn: (...args) => logs.push(['warn', String(args[0])]),
    error: (...args) => logs.push(['error', String(args[0])]),
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
      console: quietConsole, Promise, Set, Map, Error, JSON, Date, Math, Intl, AbortController, setTimeout, clearTimeout,
    }, { filename: file })(name => {
      if (name === 'react-native') return { Platform: { OS: platform } };
      if (name === '@react-native-async-storage/async-storage') return env.async.api;
      if (name === 'expo-sqlite') return env.sqlite.module;
      if (name === 'expo-secure-store') return env.secureStore;
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`));
      throw new Error(`Unexpected dependency ${name}`);
    }, module, module.exports);
    return module.exports;
  }
  const storage = load(path.join(ROOT, 'src/data/app_storage.ts'));
  return {
    logs,
    api: storage.default,
    initialize: storage.initializeAppStorage,
    db: () => load(path.join(ROOT, 'src/data/db.ts')),
  };
}

function cleanup() {
  for (const fake of fakes) fake.closeAll();
  for (const dir of tempDirs) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows file locks */ }
  }
}

module.exports = { ROOT, environment, launch, cleanup };

// Native SQLite storage (phase 1): kv backend, AsyncStorage → SQLite migration, fallback policy.
// expo-sqlite is replaced by a file-backed node:sqlite fake (tests/native_sqlite_harness.cjs).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, environment, launch, cleanup } = require('./native_sqlite_harness.cjs');

const STATE_KEY = '__celueste:native-storage-state';
const MARKER_KEY = '__celueste:sqlite-migration-v1';
const SCHEMA_KEY = '__celueste:sqlite-schema';
const key = name => `@cogniquest:${name}`;
const host = value => JSON.parse(JSON.stringify(value));
const isMarkerInsert = ({ kind, sql, params }) => kind === 'transaction' && sql.startsWith('INSERT') && params[0] === MARKER_KEY;

const legacyEntries = () => [
  [key('topics'), JSON.stringify([{ id: 't1', name: '회계원리' }])],
  [key('units'), JSON.stringify([{ id: 'u1', topicId: 't1' }])],
  [key('questions'), JSON.stringify([{ id: 'q1', stem: '차변과 대변' }])],
  ['@celueste:alarm_config_v2', '{"enabled":true}'],
  [key('gemini_api_key'), 'AIza-legacy-plaintext'],
  [key('secure_vault_v1'), 'legacy-vault'],
  ['other-library:cache', 'not-ours'],
];

test.after(cleanup);

test('fresh install opens celueste.db in WAL mode and records completion after verification', async () => {
  const env = environment();
  const app = launch(env);
  assert.equal(await app.initialize(), 'sqlite');
  assert.deepEqual(env.sqlite.opened, ['celueste.db']);
  assert.equal(env.sqlite.journalMode(), 'wal');
  assert.deepEqual([...env.sqlite.rows()], [[MARKER_KEY, 'complete'], [SCHEMA_KEY, '1']]);
  const state = JSON.parse(env.async.map.get(STATE_KEY));
  assert.equal(state.version, 1);
  assert.equal(state.activeDatabase, 'celueste.db');
  assert.deepEqual(state.retainedDatabases, []);
  assert.ok(!Number.isNaN(Date.parse(state.migratedAt)));
  assert.deepEqual(env.async.writes, [STATE_KEY]);
});

test('kv API keeps AsyncStorage semantics and stores values larger than 2MB', async () => {
  const env = environment();
  const { api } = launch(env);
  assert.equal(await api.getItem(key('missing')), null);
  await api.setItem(key('a'), '1');
  await api.setItem(key('a'), '2');
  await api.multiSet([[key('b'), 'B'], [key('c'), 'C'], [key('b'), 'B2']]);
  assert.deepEqual(host(await api.multiGet([key('c'), key('missing'), key('a'), key('c')])),
    [[key('c'), 'C'], [key('missing'), null], [key('a'), '2'], [key('c'), 'C']]);
  assert.equal(await api.getItem(key('b')), 'B2');
  await api.removeItem(key('a'));
  await api.multiRemove([key('b'), key('missing')]);
  await api.multiSet([]);
  await api.multiRemove([]);
  assert.deepEqual(host(await api.getAllKeys()), [key('c')]);
  await assert.rejects(api.setItem(key('bad'), 42), /문자열/);

  const large = '가'.repeat(1_100_000); // UTF-8 약 3.3MB
  await api.setItem(key('source_chunks'), large);
  assert.equal(await launch(env).api.getItem(key('source_chunks')), large);
});

test('reserved keys are hidden from the public API and cannot be modified', async () => {
  const env = environment();
  const { api } = launch(env);
  await api.setItem(key('a'), '1');
  assert.equal(await api.getItem(MARKER_KEY), null);
  assert.deepEqual(host(await api.multiGet([SCHEMA_KEY, key('a')])), [[SCHEMA_KEY, null], [key('a'), '1']]);
  assert.deepEqual(host(await api.getAllKeys()), [key('a')]);
  await assert.rejects(api.setItem(MARKER_KEY, 'x'), /예약된 저장소 키/);
  await assert.rejects(api.removeItem(SCHEMA_KEY), /예약된 저장소 키/);
  await assert.rejects(api.multiSet([[key('b'), '2'], [MARKER_KEY, 'x']]), /예약된 저장소 키/);
  await assert.rejects(api.multiRemove([MARKER_KEY]), /예약된 저장소 키/);
  assert.equal(env.sqlite.rows().get(MARKER_KEY), 'complete');
  assert.equal(env.sqlite.rows().has(key('b')), false);
});

test('multiSet and multiRemove are atomic in one exclusive transaction', async () => {
  const env = environment();
  const { api } = launch(env);
  await api.multiSet([[key('a'), 'old-a'], [key('b'), 'old-b']]);
  env.sqlite.faults.failSql = ({ kind, params }) => kind === 'transaction' && params[0] === key('b');
  await assert.rejects(api.multiSet([[key('a'), 'new-a'], [key('b'), 'new-b'], [key('c'), 'new-c']]), /저장소 오류/);
  await assert.rejects(api.multiRemove([key('a'), key('b')]), /저장소 오류/);
  env.sqlite.faults.failSql = null;
  assert.deepEqual([...env.sqlite.userRows()], [[key('a'), 'old-a'], [key('b'), 'old-b']]);
});

test('operations run in call order through one queue without database is locked', async () => {
  const env = environment();
  const { api, initialize } = launch(env);
  await initialize();
  const results = await Promise.all([
    api.multiSet([[key('a'), '1'], [key('b'), '1']]),
    api.setItem(key('a'), '2'),
    api.getItem(key('a')),
    api.multiRemove([key('b')]),
    api.setItem(MARKER_KEY, 'x').catch(error => error.message),
    api.multiSet([[key('c'), '3'], [key('d'), '4']]),
    api.removeItem(key('d')),
    api.getAllKeys(),
    api.multiGet([key('a'), key('b'), key('c')]),
  ]);
  assert.equal(results[2], '2');
  assert.match(results[4], /예약된 저장소 키/);
  assert.deepEqual(host(results[7]), [key('a'), key('c')]);
  assert.deepEqual(host(results[8]), [[key('a'), '2'], [key('b'), null], [key('c'), '3']]);
});

test('migration copies application keys only and normal use never modifies AsyncStorage originals', async () => {
  const env = environment(legacyEntries());
  const original = new Map(env.async.map);
  const app = launch(env);
  assert.equal(await app.initialize(), 'sqlite');
  const expected = legacyEntries().filter(([k]) => k.startsWith('@') && !/gemini_api_key|secure_vault_v1/.test(k));
  assert.deepEqual([...env.sqlite.userRows()], expected.sort(([l], [r]) => l.localeCompare(r)));
  assert.equal(env.sqlite.rows().get(MARKER_KEY), 'complete');

  await app.api.setItem(key('topics'), '[]');
  await app.api.removeItem(key('units'));
  await app.api.multiSet([[key('questions'), '[]']]);
  assert.deepEqual(env.async.writes, [STATE_KEY]);
  const after = new Map(env.async.map);
  after.delete(STATE_KEY);
  assert.deepEqual([...after], [...original]);
});

test('full reset clears SQLite first, then AsyncStorage app keys, keeping markers, state and unrelated keys', async () => {
  const env = environment(legacyEntries());
  const first = launch(env);
  await first.initialize();
  const original = new Map(env.async.map);

  // SQLite 초기화가 실패하면 이관 원본은 그대로 둔다.
  env.sqlite.faults.failSql = ({ kind, sql }) => kind === 'main' && sql.startsWith('DELETE FROM kv WHERE key NOT GLOB');
  await assert.rejects(first.api.clear(), /초기화 중 저장소 오류/);
  assert.deepEqual([...env.async.map], [...original]);
  assert.equal(env.sqlite.userRows().get(key('topics')), original.get(key('topics')));
  env.sqlite.faults.failSql = null;

  await first.api.clear();
  assert.deepEqual(host(await first.api.getAllKeys()), []);
  assert.deepEqual([...env.sqlite.rows()], [[MARKER_KEY, 'complete'], [SCHEMA_KEY, '1']]);
  assert.deepEqual([...env.async.map.keys()].sort(), ['__celueste:native-storage-state', 'other-library:cache']);
  assert.equal(env.async.map.get('other-library:cache'), 'not-ours');
});

test('after a full reset no later launch brings back pre-reset data', async () => {
  const env = environment(legacyEntries());
  const first = launch(env);
  await first.initialize();
  await first.api.setItem(key('questions'), '["written-before-reset"]');
  await first.api.clear();

  const next = launch(env);
  assert.equal(await next.initialize(), 'sqlite');
  assert.deepEqual(host(await next.api.getAllKeys()), []);
  assert.equal(await next.api.getItem(key('topics')), null);

  // 다음 실행에서 DB를 못 열어도 상태 객체가 있으므로 폴백하지 않고, 되살릴 원본도 남아 있지 않다.
  env.sqlite.faults.failOpen = true;
  await assert.rejects(launch(env).initialize(), /자동 전환하지 않았습니다/);
  assert.deepEqual([...env.async.map.keys()].filter(k => k.startsWith('@')), []);
  env.sqlite.faults.failOpen = false;
  assert.equal(await launch(env).api.getItem(key('questions')), null);
});

test('failure before the copy commit rolls back and keeps AsyncStorage for this launch', async () => {
  const env = environment(legacyEntries());
  env.sqlite.faults.failSql = ({ kind, sql, params }) =>
    kind === 'transaction' && sql.startsWith('INSERT') && params[0] === key('questions');
  const first = launch(env);
  assert.equal(await first.initialize(), 'async-storage');
  assert.deepEqual([...env.sqlite.userRows()], []);
  assert.equal(env.sqlite.rows().has(MARKER_KEY), false);
  assert.equal(env.async.map.has(STATE_KEY), false);
  assert.equal(await first.api.getItem(key('topics')), env.async.map.get(key('topics')));

  env.sqlite.faults.failSql = null;
  const next = launch(env);
  assert.equal(await next.initialize(), 'sqlite');
  assert.equal(await next.api.getItem(key('questions')), env.async.map.get(key('questions')));
});

test('interruption after the copy commit re-migrates from the latest source on the next launch', async () => {
  const env = environment(legacyEntries());
  env.sqlite.faults.failSql = ({ kind, sql }) => kind === 'main' && sql.startsWith('SELECT key, value FROM kv WHERE key NOT GLOB');
  const first = launch(env);
  assert.equal(await first.initialize(), 'async-storage');
  assert.equal(env.sqlite.userRows().get(key('units')), env.async.map.get(key('units')));
  assert.equal(env.sqlite.rows().has(MARKER_KEY), false);
  // 폴백 중 쓰기는 AsyncStorage로 간다. 삭제한 키가 다음 이관에서 되살아나면 안 된다.
  await first.api.setItem(key('topics'), '["fallback"]');
  await first.api.removeItem(key('units'));

  env.sqlite.faults.failSql = null;
  const next = launch(env);
  assert.equal(await next.initialize(), 'sqlite');
  assert.equal(await next.api.getItem(key('topics')), '["fallback"]');
  assert.equal(await next.api.getItem(key('units')), null);
  assert.equal(env.sqlite.userRows().has(key('units')), false);
});

test('verification mismatch and marker write failure record neither marker nor state', async () => {
  for (const inject of [
    fake => { fake.faults.mapRow = (row, sql) => (sql.includes('NOT GLOB') && row.key === key('questions') ? { ...row, value: 'corrupt' } : null); },
    fake => { fake.faults.failSql = isMarkerInsert; },
  ]) {
    const env = environment(legacyEntries());
    inject(env.sqlite);
    assert.equal(await launch(env).initialize(), 'async-storage');
    assert.equal(env.sqlite.rows().has(MARKER_KEY), false);
    assert.equal(env.async.map.has(STATE_KEY), false);
    env.sqlite.faults.mapRow = null;
    env.sqlite.faults.failSql = null;
    assert.equal(await launch(env).initialize(), 'sqlite');
    assert.equal(env.sqlite.rows().get(MARKER_KEY), 'complete');
  }
});

test('marker committed but reported as failed is confirmed instead of falling back', async () => {
  const env = environment(legacyEntries());
  let armed = false;
  env.sqlite.faults.failSql = query => { if (isMarkerInsert(query)) armed = true; return false; };
  env.sqlite.faults.failAfterCommit = () => { const hit = armed; armed = false; return hit; };
  assert.equal(await launch(env).initialize(), 'sqlite');
  assert.ok(env.async.map.has(STATE_KEY));

  // 확인 조회까지 실패하면 완료 여부를 알 수 없으므로 폴백하지 않고 오류를 반환한다.
  const uncertain = environment(legacyEntries());
  let markerWritten = false;
  let afterCommitPending = false;
  uncertain.sqlite.faults.failSql = query => {
    if (isMarkerInsert(query)) { markerWritten = true; afterCommitPending = true; }
    return markerWritten && query.kind === 'main' && query.sql.startsWith('SELECT value FROM kv') && query.params[0] === MARKER_KEY;
  };
  uncertain.sqlite.faults.failAfterCommit = () => { const hit = afterCommitPending; afterCommitPending = false; return hit; };
  const app = launch(uncertain);
  await assert.rejects(app.initialize(), /이관 완료 여부를 확인하지 못했습니다/);
  assert.equal(uncertain.async.map.has(STATE_KEY), false);
  uncertain.sqlite.faults.failSql = null;
  assert.equal(await app.initialize(), 'sqlite'); // 같은 실행에서 재시도 가능
  assert.ok(uncertain.async.map.has(STATE_KEY));
});

test('state object write failure fails initialization, blocks SQLite writes and can be retried', async () => {
  const env = environment(legacyEntries());
  const originalTopics = env.async.map.get(key('topics'));
  env.async.faults.setItem = k => k === STATE_KEY;
  const app = launch(env);
  await assert.rejects(app.initialize(), /상태 정보를 기록하지 못했습니다/);
  await assert.rejects(app.api.setItem(key('topics'), '["blocked"]'), /상태 정보를 기록하지 못했습니다/);
  assert.equal(env.async.map.has(STATE_KEY), false);
  assert.equal(env.sqlite.userRows().get(key('topics')), originalTopics);
  assert.equal(env.async.map.get(key('topics')), originalTopics);

  env.async.faults.setItem = null;
  assert.equal(await app.initialize(), 'sqlite'); // 같은 실행에서 재시도
  assert.equal(JSON.parse(env.async.map.get(STATE_KEY)).activeDatabase, 'celueste.db');
  await app.api.setItem(key('topics'), '["after-state"]');
  assert.equal(env.sqlite.userRows().get(key('topics')), '["after-state"]');
});

test('state write failure followed by an unopenable database never exposes stale values', async () => {
  const env = environment(legacyEntries());
  env.async.faults.setItem = k => k === STATE_KEY;
  await assert.rejects(launch(env).initialize(), /상태 정보를 기록하지 못했습니다/);
  assert.equal(env.sqlite.rows().get(MARKER_KEY), 'complete'); // 마커는 남았지만 상태 객체는 없다
  env.async.faults.setItem = null;

  // 상태 객체가 없으면 SQLite에 사용자 쓰기가 없었으므로 AsyncStorage가 최신이다.
  env.sqlite.faults.failOpen = true;
  const fallback = launch(env);
  assert.equal(await fallback.initialize(), 'async-storage');
  await fallback.api.setItem(key('topics'), '["written-during-fallback"]');
  await fallback.api.removeItem(key('units'));

  // 남아 있던 마커와 이전 복사본을 믿지 않고 최신 원본으로 다시 이관한다.
  env.sqlite.faults.failOpen = false;
  const next = launch(env);
  assert.equal(await next.initialize(), 'sqlite');
  assert.equal(await next.api.getItem(key('topics')), '["written-during-fallback"]');
  assert.equal(await next.api.getItem(key('units')), null);
  assert.ok(env.async.map.has(STATE_KEY));
});

test('re-running an interrupted migration is idempotent and drops stale partial rows', async () => {
  const env = environment(legacyEntries());
  // 상태 객체 없이 남은 마커와 부분 복사본: 원본 기준으로 전부 다시 채운다.
  env.sqlite.seed('celueste.db', [[MARKER_KEY, 'complete'], [key('orphan'), 'partial'], [key('topics'), 'partial']]);
  assert.equal(await launch(env).initialize(), 'sqlite');
  assert.equal(env.sqlite.userRows().has(key('orphan')), false);
  assert.equal(env.sqlite.userRows().get(key('topics')), env.async.map.get(key('topics')));
});

test('after completion an unopenable database is an error and never falls back to AsyncStorage', async () => {
  const env = environment(legacyEntries());
  await launch(env).initialize();
  env.sqlite.faults.failOpen = true;
  const app = launch(env);
  await assert.rejects(app.initialize(), /자동 전환하지 않았습니다/);
  await assert.rejects(app.api.getItem(key('topics')), /자동 전환하지 않았습니다/);
  env.sqlite.faults.failOpen = false;
  assert.equal(await app.api.getItem(key('topics')), env.async.map.get(key('topics')));
});

test('a missing database after completion is an error instead of a stale re-migration', async () => {
  const env = environment(legacyEntries());
  const first = launch(env);
  await first.initialize();
  await first.api.setItem(key('topics'), '["latest"]');
  env.sqlite.closeAll();
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(path.join(env.sqlite.directory, `celueste.db${suffix}`), { force: true });

  const next = launch(env);
  await assert.rejects(next.initialize(), /이관 완료 표시가 없습니다/);
  assert.deepEqual([...env.sqlite.userRows()], []);
});

test('runtime SQLite errors after completion are returned without reading AsyncStorage', async () => {
  const env = environment(legacyEntries());
  const app = launch(env);
  await app.initialize();
  await app.api.setItem(key('topics'), '["sqlite"]');
  env.sqlite.faults.failSql = ({ sql }) => sql.startsWith('SELECT value FROM kv');
  await assert.rejects(app.api.getItem(key('topics')), /학습 데이터 읽기 중 저장소 오류/);
  env.sqlite.faults.failSql = null;
  assert.equal(await app.api.getItem(key('topics')), '["sqlite"]');
});

test('unreadable or invalid state object is an error and does not start a migration', async () => {
  for (const setup of [
    env => { env.async.faults.getItem = k => k === STATE_KEY; },
    env => { env.async.map.set(STATE_KEY, '{broken'); },
    env => { env.async.map.set(STATE_KEY, JSON.stringify({ version: 1, activeDatabase: '../x.db', migratedAt: 'x', retainedDatabases: [] })); },
  ]) {
    const env = environment(legacyEntries());
    setup(env);
    await assert.rejects(launch(env).initialize(), /상태 정보/);
    assert.deepEqual(env.sqlite.opened, []);
  }
});

test('the state object pointer selects the only database that is opened', async () => {
  const env = environment(legacyEntries());
  env.sqlite.seed('celueste-recovery-1.db', [[SCHEMA_KEY, '1'], [MARKER_KEY, 'complete'], [key('topics'), '["recovered"]']]);
  env.async.map.set(STATE_KEY, JSON.stringify({
    version: 1, activeDatabase: 'celueste-recovery-1.db', migratedAt: '2026-10-01T00:00:00.000Z', retainedDatabases: ['celueste.db'],
  }));
  const app = launch(env);
  assert.equal(await app.initialize(), 'sqlite');
  assert.deepEqual(env.sqlite.opened, ['celueste-recovery-1.db']);
  assert.equal(await app.api.getItem(key('topics')), '["recovered"]');
});

test('pre-migration open failure and oversized AsyncStorage reads keep AsyncStorage', async () => {
  const env = environment(legacyEntries());
  env.sqlite.faults.failOpen = true;
  assert.equal(await launch(env).initialize(), 'async-storage');
  env.sqlite.faults.failOpen = false;
  env.async.faults.multiGet = k => k === key('questions'); // Android CursorWindow 2MB 초과 읽기 실패
  assert.equal(await launch(env).initialize(), 'async-storage');
  assert.equal(env.sqlite.rows().has(MARKER_KEY), false);
});

test('web keeps its storage path and never opens SQLite', async () => {
  const env = environment(legacyEntries());
  const app = launch(env, { platform: 'web' });
  assert.equal(await app.initialize(), 'async-storage'); // 이 가짜 환경에는 IndexedDB가 없다
  await app.api.setItem(key('topics'), '[]');
  assert.deepEqual(env.sqlite.opened, []);

  const webStub = fs.readFileSync(path.join(ROOT, 'src/data/native_sqlite_backend.web.ts'), 'utf8');
  assert.doesNotMatch(webStub, /from 'expo-sqlite'|require\('expo-sqlite'\)/);
});

test('db.ts on SQLite: migrated data survives restart, backup restore and reset without resurrection', async () => {
  // 기본 탑재 과목(topic-python-async)은 초기화마다 다시 생성되므로 비교에서 제외한다.
  const userTopics = async db => host((await db.getTopics()).filter(t => t.id !== 'topic-python-async'));
  const env = environment();
  env.sqlite.faults.failOpen = true; // 기존 AsyncStorage 앱 사용자를 재현
  const legacy = launch(env).db();
  await legacy.initializeDatabase();
  const topic = await legacy.createTopic('회계원리');
  env.async.map.set(key('gemini_api_key'), 'AIza-legacy-plaintext');
  const snapshot = new Map(env.async.map);

  env.sqlite.faults.failOpen = false;
  const migrated = launch(env).db();
  await migrated.initializeDatabase();
  assert.deepEqual((await userTopics(migrated)).map(t => t.id), [topic.id]);
  const second = await migrated.createTopic('세법');

  const restarted = launch(env).db();
  await restarted.initializeDatabase();
  assert.deepEqual((await userTopics(restarted)).map(t => t.name), ['회계원리', '세법']);
  const backup = await restarted.exportBackupJSON('full');
  assert.ok(!backup.includes('AIza-legacy-plaintext'));
  // 평상시에는 이관 원본을 그대로 보존한다(상태 객체만 추가).
  const beforeReset = new Map(env.async.map);
  beforeReset.delete(STATE_KEY);
  assert.deepEqual([...beforeReset], [...snapshot]);

  await restarted.clearAllData();
  // 명시적 전체 초기화에서만 AsyncStorage 앱 데이터 키를 지운다.
  assert.deepEqual([...env.async.map.keys()], [STATE_KEY]);
  assert.deepEqual(await userTopics(restarted), []);
  const afterReset = launch(env).db();
  await afterReset.initializeDatabase();
  assert.deepEqual(await userTopics(afterReset), []);
  assert.equal(env.sqlite.rows().get(MARKER_KEY), 'complete');

  const restored = await afterReset.restoreBackupJSON(backup);
  assert.equal(restored.success, true, restored.message);
  assert.deepEqual((await userTopics(afterReset)).map(t => t.id), [topic.id, second.id]);
  assert.deepEqual([...env.async.map.keys()], [STATE_KEY]); // 복원은 SQLite에만 쓴다
});

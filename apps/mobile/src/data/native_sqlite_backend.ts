/**
 * Native (Android/iOS) key-value storage backed by SQLite.
 *
 * Android AsyncStorage는 전체 6MB·항목당 2MB 한계가 있어, 같은 키-값 API를
 * 번들 SQLite(`expo-sqlite`)의 `kv` 테이블로 제공한다.
 * 설계: docs/android/NATIVE_SQLITE_STORAGE_DESIGN.md 6장.
 *
 * - 모든 작업(읽기 포함)은 단일 큐로 호출 순서대로 실행한다. exclusive 트랜잭션은
 *   별도 연결을 쓰므로 그 사이 다른 쓰기가 끼어들면 `database is locked`가 난다.
 *   읽기까지 같은 큐에 넣어 AsyncStorage(Android 직렬 실행기)와 같은 순서를 보장한다.
 * - 다중 쓰기는 `withExclusiveTransactionAsync` 한 번으로 묶어 원자적으로 처리한다.
 * - `__celueste:` 예약 키(스키마·이관 마커)는 공개 API에서 보이지 않고 바뀌지 않는다.
 */

import * as SQLite from 'expo-sqlite';

export const SQLITE_SCHEMA_KEY = '__celueste:sqlite-schema';
export const SQLITE_SCHEMA_VERSION = '1';
export const SQLITE_MIGRATION_MARKER_KEY = '__celueste:sqlite-migration-v1';
export const SQLITE_MIGRATION_MARKER_VALUE = 'complete';

const RESERVED_KEY_PREFIX = '__celueste:';
// LIKE는 '_'를 임의 한 글자로 해석하므로 예약 키는 GLOB(대소문자 구분, '_' 문자 그대로)로 구분한다.
const USER_KEY_CONDITION = "key NOT GLOB '__celueste:*'";
const MAX_KEYS_PER_QUERY = 200;

const SCHEMA_SQL = `PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS kv (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);`;
const UPSERT_SQL =
  'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value';
const SELECT_ONE_SQL = 'SELECT value FROM kv WHERE key = ?';
const DELETE_ONE_SQL = 'DELETE FROM kv WHERE key = ?';

type StorageEntry = [string, string | null];
type WritableStorageEntry = readonly [string, string];
type Connection = Pick<SQLite.SQLiteDatabase, 'runAsync' | 'getFirstAsync' | 'getAllAsync'>;

export interface NativeSqliteStore {
  readonly databaseName: string;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiGet(keys: readonly string[]): Promise<StorageEntry[]>;
  multiSet(entries: readonly WritableStorageEntry[]): Promise<void>;
  multiRemove(keys: readonly string[]): Promise<void>;
  getAllKeys(): Promise<string[]>;
  /** 사용자 데이터만 지운다. 스키마·이관 마커는 남긴다. */
  clear(): Promise<void>;
  /** 이관 전용: 완료 마커 존재 여부 */
  hasCompletedMigration(): Promise<boolean>;
  /** 이관 전용: 기존 사용자 키와 이전 완료 마커를 지우고 entries로 채운다 (단일 트랜잭션, 새 마커 미기록) */
  replaceUserEntries(entries: readonly WritableStorageEntry[]): Promise<void>;
  /** 이관 전용: 검증용 전체 사용자 키 재조회 */
  readUserEntries(): Promise<[string, string][]>;
  /** 이관 전용: 검증이 끝난 뒤 별도 트랜잭션으로 완료 마커 기록 */
  markMigrationComplete(): Promise<void>;
}

function isReservedKey(key: string): boolean {
  return key.startsWith(RESERVED_KEY_PREFIX);
}

function assertWritableKey(key: string): void {
  if (typeof key !== 'string') throw new Error('저장소 키는 문자열이어야 합니다.');
  if (isReservedKey(key)) throw new Error(`예약된 저장소 키는 변경할 수 없습니다: ${key}`);
}

function assertEntries(entries: readonly WritableStorageEntry[]): void {
  for (const [key, value] of entries) {
    assertWritableKey(key);
    if (typeof value !== 'string') throw new Error(`저장소 값은 문자열이어야 합니다: ${key}`);
  }
}

function sqliteError(action: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error ?? '알 수 없는 저장소 오류');
  if (/SQLITE_FULL|database or disk is full/i.test(detail)) {
    return new Error('기기 저장공간이 부족해 학습 데이터를 저장하지 못했습니다. 백업 후 저장공간을 정리해 주세요.');
  }
  return new Error(`${action} 중 저장소 오류가 발생했습니다: ${detail}`);
}

function createSerialQueue() {
  let tail: Promise<void> = Promise.resolve();
  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task);
    // 앞 작업이 실패해도 다음 작업은 계속 실행한다.
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
}

async function selectValues(connection: Connection, keys: readonly string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const uniqueKeys = [...new Set(keys)];
  for (let offset = 0; offset < uniqueKeys.length; offset += MAX_KEYS_PER_QUERY) {
    const chunk = uniqueKeys.slice(offset, offset + MAX_KEYS_PER_QUERY);
    const rows = await connection.getAllAsync<{ key: string; value: string }>(
      `SELECT key, value FROM kv WHERE key IN (${chunk.map(() => '?').join(', ')})`,
      chunk
    );
    for (const row of rows) found.set(row.key, row.value);
  }
  return found;
}

function createStore(database: SQLite.SQLiteDatabase, databaseName: string): NativeSqliteStore {
  const enqueue = createSerialQueue();
  const run = <T>(action: string, task: () => Promise<T>): Promise<T> =>
    enqueue(async () => {
      try {
        return await task();
      } catch (error) {
        throw sqliteError(action, error);
      }
    });
  const inTransaction = (task: (connection: Connection) => Promise<void>) =>
    database.withExclusiveTransactionAsync(task);

  return {
    databaseName,

    async getItem(key) {
      if (isReservedKey(key)) return null;
      return run('학습 데이터 읽기', async () =>
        (await database.getFirstAsync<{ value: string }>(SELECT_ONE_SQL, [key]))?.value ?? null
      );
    },

    async setItem(key, value) {
      assertEntries([[key, value]]);
      await run('학습 데이터 저장', async () => {
        await database.runAsync(UPSERT_SQL, [key, value]);
      });
    },

    async removeItem(key) {
      assertWritableKey(key);
      await run('학습 데이터 삭제', async () => {
        await database.runAsync(DELETE_ONE_SQL, [key]);
      });
    },

    async multiGet(keys) {
      const requested = [...keys];
      const found = await run('학습 데이터 읽기', () =>
        selectValues(database, requested.filter((key) => !isReservedKey(key)))
      );
      return requested.map((key): StorageEntry => [key, isReservedKey(key) ? null : found.get(key) ?? null]);
    },

    async multiSet(entries) {
      const pending = entries.map(([key, value]) => [key, value] as const);
      assertEntries(pending);
      if (pending.length === 0) return;
      await run('학습 데이터 저장', () =>
        inTransaction(async (txn) => {
          for (const [key, value] of pending) await txn.runAsync(UPSERT_SQL, [key, value]);
        })
      );
    },

    async multiRemove(keys) {
      const pending = [...keys];
      pending.forEach(assertWritableKey);
      if (pending.length === 0) return;
      await run('학습 데이터 삭제', () =>
        inTransaction(async (txn) => {
          for (const key of pending) await txn.runAsync(DELETE_ONE_SQL, [key]);
        })
      );
    },

    async getAllKeys() {
      return run('학습 데이터 목록 읽기', async () =>
        (await database.getAllAsync<{ key: string }>(
          `SELECT key FROM kv WHERE ${USER_KEY_CONDITION} ORDER BY key`
        )).map((row) => row.key)
      );
    },

    async clear() {
      await run('전체 학습 데이터 초기화', async () => {
        await database.runAsync(`DELETE FROM kv WHERE ${USER_KEY_CONDITION}`);
      });
    },

    async hasCompletedMigration() {
      return run('저장소 이관 상태 확인', async () =>
        (await database.getFirstAsync<{ value: string }>(SELECT_ONE_SQL, [SQLITE_MIGRATION_MARKER_KEY]))
          ?.value === SQLITE_MIGRATION_MARKER_VALUE
      );
    },

    async replaceUserEntries(entries) {
      const pending = entries.map(([key, value]) => [key, value] as const);
      assertEntries(pending);
      await run('기존 학습 데이터 이관', () =>
        inTransaction(async (txn) => {
          // 이전 시도의 부분 복사본이나 폴백 중 삭제된 키가 되살아나지 않도록 먼저 비운다.
          // 이전 완료 마커도 지워, 마커는 이번 복사본의 검증이 끝난 뒤에만 다시 생기게 한다.
          await txn.runAsync(`DELETE FROM kv WHERE ${USER_KEY_CONDITION} OR key = ?`, [
            SQLITE_MIGRATION_MARKER_KEY,
          ]);
          for (const [key, value] of pending) await txn.runAsync(UPSERT_SQL, [key, value]);
        })
      );
    },

    async readUserEntries() {
      return run('이관 결과 확인', async () =>
        (await database.getAllAsync<{ key: string; value: string }>(
          `SELECT key, value FROM kv WHERE ${USER_KEY_CONDITION} ORDER BY key`
        )).map((row) => [row.key, row.value] as [string, string])
      );
    },

    async markMigrationComplete() {
      await run('저장소 이관 완료 기록', () =>
        inTransaction(async (txn) => {
          await txn.runAsync(UPSERT_SQL, [SQLITE_MIGRATION_MARKER_KEY, SQLITE_MIGRATION_MARKER_VALUE]);
        })
      );
    },
  };
}

/**
 * 지정한 DB 파일을 열고 WAL·kv 스키마를 준비한다. 파일이 없으면 SQLite가 새로 만든다.
 */
export async function openNativeSqliteStore(databaseName: string): Promise<NativeSqliteStore> {
  let database: SQLite.SQLiteDatabase;
  try {
    database = await SQLite.openDatabaseAsync(databaseName);
  } catch (error) {
    throw sqliteError('학습 저장소 열기', error);
  }

  try {
    await database.execAsync(SCHEMA_SQL);
    await database.runAsync('INSERT OR IGNORE INTO kv (key, value) VALUES (?, ?)', [
      SQLITE_SCHEMA_KEY,
      SQLITE_SCHEMA_VERSION,
    ]);
    const schema = await database.getFirstAsync<{ value: string }>(SELECT_ONE_SQL, [SQLITE_SCHEMA_KEY]);
    if (schema?.value !== SQLITE_SCHEMA_VERSION) {
      throw new Error(`지원하지 않는 학습 저장소 형식입니다(${schema?.value ?? '없음'}). 앱을 최신 버전으로 업데이트해 주세요.`);
    }
  } catch (error) {
    await database.closeAsync().catch(() => undefined);
    throw sqliteError('학습 저장소 준비', error);
  }

  return createStore(database, databaseName);
}

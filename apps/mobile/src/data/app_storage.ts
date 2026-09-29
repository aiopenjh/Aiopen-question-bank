/**
 * Application storage boundary.
 *
 * Web data is stored in IndexedDB so the growing question bank is not bound by
 * localStorage's small quota. Existing AsyncStorage/localStorage values are
 * copied automatically on the first launch and retained as a recovery source.
 * Native builds store the same key-value data in SQLite (native_sqlite_backend.ts)
 * after a verified one-time copy from AsyncStorage (native_storage_migration.ts).
 */

import NativeAsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { NativeSqliteStore } from './native_sqlite_backend';
import { initializeNativeStorage } from './native_storage_migration';

const DATABASE_NAME = 'celueste-learning-data';
const DATABASE_VERSION = 1;
const STORE_NAME = 'key-value';
const MIGRATION_MARKER_KEY = '__celueste:indexeddb-migration-v1';
const MIGRATION_MARKER_VALUE = 'complete';
const ACTIVE_BACKEND_MARKER_KEY = '__celueste:indexeddb-active';
const ACTIVE_BACKEND_MARKER_VALUE = 'v1';
const APP_STORAGE_PREFIXES = ['@cogniquest:', '@celueste:'] as const;
const SECRET_STORAGE_KEYS = new Set([
  '@cogniquest:gemini_api_key',
  '@cogniquest:secure_vault_v1',
]);

type StorageEntry = readonly [string, string | null];
type WritableStorageEntry = readonly [string, string];
type StorageBackend = 'indexeddb' | 'async-storage' | 'sqlite';

let initializationPromise: Promise<StorageBackend> | null = null;
let nativeSqliteStore: NativeSqliteStore | null = null;

function canUseIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function isApplicationKey(key: string): boolean {
  return APP_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function shouldMigrateKey(key: string): boolean {
  return isApplicationKey(key) && !SECRET_STORAGE_KEYS.has(key);
}

function storageError(action: string, error: unknown): Error {
  const name = typeof DOMException !== 'undefined' && error instanceof DOMException ? error.name : '';
  if (name === 'QuotaExceededError') {
    return new Error('기기 저장공간이 부족해 학습 데이터를 저장하지 못했습니다. 백업 후 저장공간을 정리해 주세요.');
  }
  const detail = error instanceof Error ? error.message : '알 수 없는 저장소 오류';
  return new Error(`${action} 중 저장소 오류가 발생했습니다: ${detail}`);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB를 열 수 없습니다.'));
    request.onblocked = () => reject(new Error('다른 화면에서 학습 저장소를 사용 중입니다.'));
  });
}

async function withDatabase<T>(operation: (database: IDBDatabase) => Promise<T>): Promise<T> {
  const database = await openDatabase();
  try {
    return await operation(database);
  } finally {
    database.close();
  }
}

function waitForTransaction(transaction: IDBTransaction, action: string): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(storageError(action, transaction.error));
    transaction.onabort = () => reject(storageError(action, transaction.error));
  });
}

function readRequest<T>(request: IDBRequest<T>, action: string): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(storageError(action, request.error));
  });
}

async function readIndexedValue(key: string): Promise<string | null> {
  return withDatabase(async (database) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const completed = waitForTransaction(transaction, '학습 데이터 읽기');
    const request = transaction.objectStore(STORE_NAME).get(key);
    const [value] = await Promise.all([
      readRequest<unknown>(request, '학습 데이터 읽기'),
      completed,
    ]);
    return typeof value === 'string' ? value : null;
  });
}

async function readIndexedEntries(keys: readonly string[]): Promise<StorageEntry[]> {
  if (keys.length === 0) return [];

  return withDatabase(async (database) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const completed = waitForTransaction(transaction, '학습 데이터 읽기');
    const store = transaction.objectStore(STORE_NAME);
    const requests = keys.map((key) => readRequest<unknown>(store.get(key), '학습 데이터 읽기'));
    const [values] = await Promise.all([Promise.all(requests), completed]);
    return keys.map((key, index) => [
      key,
      typeof values[index] === 'string' ? values[index] as string : null,
    ] as const);
  });
}

async function writeIndexedEntries(entries: readonly WritableStorageEntry[]): Promise<void> {
  if (entries.length === 0) return;

  await withDatabase(async (database) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    for (const [key, value] of entries) store.put(value, key);
    await waitForTransaction(transaction, '학습 데이터 저장');
  });
}

async function removeIndexedEntries(keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return;

  await withDatabase(async (database) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    for (const key of keys) store.delete(key);
    await waitForTransaction(transaction, '학습 데이터 삭제');
  });
}

async function listIndexedKeys(): Promise<string[]> {
  return withDatabase(async (database) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const completed = waitForTransaction(transaction, '학습 데이터 목록 읽기');
    const request = transaction.objectStore(STORE_NAME).getAllKeys();
    const [keys] = await Promise.all([
      readRequest<IDBValidKey[]>(request, '학습 데이터 목록 읽기'),
      completed,
    ]);
    return keys.filter((key): key is string => typeof key === 'string' && key !== MIGRATION_MARKER_KEY);
  });
}

async function migrateLegacyWebStorage(): Promise<void> {
  const marker = await readIndexedValue(MIGRATION_MARKER_KEY);
  if (marker === MIGRATION_MARKER_VALUE) return;

  const legacyKeys = (await NativeAsyncStorage.getAllKeys()).filter(shouldMigrateKey);
  const legacyEntries = legacyKeys.length > 0
    ? await NativeAsyncStorage.multiGet(legacyKeys)
    : [];
  const valuesToMigrate = legacyEntries.filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string'
  );

  // 데이터 커밋과 완료 표시는 분리한다. 완료 표시가 있는 데이터는 반드시
  // 아래 재조회 검증까지 통과한 상태여야 한다.
  await writeIndexedEntries(valuesToMigrate);

  const verifiedEntries = await readIndexedEntries(valuesToMigrate.map(([key]) => key));
  const verified = valuesToMigrate.every(
    ([key, value], index) => verifiedEntries[index]?.[0] === key && verifiedEntries[index]?.[1] === value
  );
  if (!verified) {
    throw new Error('기존 학습 데이터의 IndexedDB 이관 결과를 확인할 수 없습니다.');
  }

  await writeIndexedEntries([[MIGRATION_MARKER_KEY, MIGRATION_MARKER_VALUE]]);
}

async function initializeBackend(): Promise<StorageBackend> {
  if (Platform.OS !== 'web') {
    // 네이티브: SQLite kv 저장소. 웹은 아래 IndexedDB 경로를 그대로 사용한다.
    const selection = await initializeNativeStorage(shouldMigrateKey);
    nativeSqliteStore = selection.backend === 'sqlite' ? selection.store : null;
    return selection.backend;
  }

  const activeMarker = await NativeAsyncStorage.getItem(ACTIVE_BACKEND_MARKER_KEY);
  const migrationWasActivated = activeMarker === ACTIVE_BACKEND_MARKER_VALUE;

  if (!canUseIndexedDB()) {
    if (migrationWasActivated) {
      throw new Error('이 기기에서 사용 중이던 IndexedDB 학습 저장소를 열 수 없습니다. 브라우저 설정을 확인한 뒤 다시 시도해 주세요.');
    }
    return 'async-storage';
  }

  try {
    await migrateLegacyWebStorage();
    // 기존 운영 사용자는 IndexedDB 내부 완료 표시만 가지고 있다.
    // IndexedDB를 정상적으로 연 현재 시점에 외부 활성 표시를 보정한다.
    if (!migrationWasActivated) {
      try {
        await NativeAsyncStorage.setItem(
          ACTIVE_BACKEND_MARKER_KEY,
          ACTIVE_BACKEND_MARKER_VALUE
        );
      } catch (markerError) {
        // IndexedDB 자체는 정상이며 다음 실행에서 다시 보정할 수 있으므로
        // 오래된 저장소로 폴백하지 않는다.
        console.warn('IndexedDB 활성 표시를 기록하지 못했습니다.', markerError);
      }
    }
    return 'indexeddb';
  } catch (error) {
    if (migrationWasActivated) {
      throw storageError('학습 저장소 열기', error);
    }
    console.error('IndexedDB 자동 이관 실패. 이관 전 기존 저장소를 유지합니다.', error);
    return 'async-storage';
  }
}

async function getBackend(): Promise<StorageBackend> {
  if (!initializationPromise) {
    initializationPromise = initializeBackend().catch((error) => {
      // 사용자가 "다시 시도"를 누르면 새 연결을 만들 수 있게 한다.
      initializationPromise = null;
      throw error;
    });
  }
  return initializationPromise;
}

function sqliteStore(): NativeSqliteStore {
  if (!nativeSqliteStore) throw new Error('SQLite 학습 저장소가 준비되지 않았습니다.');
  return nativeSqliteStore;
}

async function getItem(key: string): Promise<string | null> {
  const backend = await getBackend();
  if (backend === 'sqlite') return sqliteStore().getItem(key);
  return backend === 'indexeddb'
    ? readIndexedValue(key)
    : NativeAsyncStorage.getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
  const backend = await getBackend();
  if (backend === 'sqlite') return sqliteStore().setItem(key, value);
  if (backend === 'indexeddb') {
    await writeIndexedEntries([[key, value]]);
    return;
  }
  await NativeAsyncStorage.setItem(key, value);
}

async function removeItem(key: string): Promise<void> {
  const backend = await getBackend();
  if (backend === 'sqlite') return sqliteStore().removeItem(key);
  if (backend === 'indexeddb') {
    await removeIndexedEntries([key]);
    return;
  }
  await NativeAsyncStorage.removeItem(key);
}

async function multiGet(keys: readonly string[]): Promise<[string, string | null][]> {
  const backend = await getBackend();
  if (backend === 'sqlite') return sqliteStore().multiGet(keys);
  if (backend === 'indexeddb') {
    return (await readIndexedEntries(keys)).map(([key, value]) => [key, value]);
  }
  const entries = await NativeAsyncStorage.multiGet([...keys]);
  return entries.map(([key, value]) => [key, value]);
}

async function multiSet(entries: readonly WritableStorageEntry[]): Promise<void> {
  const backend = await getBackend();
  if (backend === 'sqlite') return sqliteStore().multiSet(entries);
  if (backend === 'indexeddb') {
    await writeIndexedEntries(entries);
    return;
  }
  await NativeAsyncStorage.multiSet(entries.map(([key, value]) => [key, value]));
}

async function multiRemove(keys: readonly string[]): Promise<void> {
  const backend = await getBackend();
  if (backend === 'sqlite') return sqliteStore().multiRemove(keys);
  if (backend === 'indexeddb') {
    await removeIndexedEntries(keys);
    return;
  }
  await NativeAsyncStorage.multiRemove([...keys]);
}

async function getAllKeys(): Promise<string[]> {
  const backend = await getBackend();
  if (backend === 'sqlite') return sqliteStore().getAllKeys();
  return backend === 'indexeddb'
    ? listIndexedKeys()
    : [...await NativeAsyncStorage.getAllKeys()].filter(
        (key) => key !== ACTIVE_BACKEND_MARKER_KEY
      );
}

async function clear(): Promise<void> {
  const backend = await getBackend();
  if (backend === 'sqlite') {
    // SQLite 사용자 데이터를 먼저 지운다. 스키마·이관 마커는 남긴다.
    await sqliteStore().clear();
    // 평상시에는 이관 원본을 보존하지만, 사용자가 전체 초기화를 실행한 경우에는
    // AsyncStorage의 앱 데이터 키도 지운다. 저장소 상태 객체와 앱과 무관한 키는 남긴다.
    const legacyKeys = (await NativeAsyncStorage.getAllKeys()).filter(isApplicationKey);
    if (legacyKeys.length > 0) await NativeAsyncStorage.multiRemove(legacyKeys);
    return;
  }
  if (backend !== 'indexeddb') {
    const activeMarker = await NativeAsyncStorage.getItem(ACTIVE_BACKEND_MARKER_KEY);
    await NativeAsyncStorage.clear();
    if (activeMarker === ACTIVE_BACKEND_MARKER_VALUE) {
      await NativeAsyncStorage.setItem(
        ACTIVE_BACKEND_MARKER_KEY,
        ACTIVE_BACKEND_MARKER_VALUE
      );
    }
    return;
  }

  await withDatabase(async (database) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    store.put(MIGRATION_MARKER_VALUE, MIGRATION_MARKER_KEY);
    await waitForTransaction(transaction, '전체 학습 데이터 초기화');
  });

  const legacyKeys = (await NativeAsyncStorage.getAllKeys()).filter(isApplicationKey);
  if (legacyKeys.length > 0) await NativeAsyncStorage.multiRemove(legacyKeys);
  await NativeAsyncStorage.setItem(
    ACTIVE_BACKEND_MARKER_KEY,
    ACTIVE_BACKEND_MARKER_VALUE
  );
}

export async function initializeAppStorage(): Promise<StorageBackend> {
  return getBackend();
}

const AppStorage = {
  getItem,
  setItem,
  removeItem,
  multiGet,
  multiSet,
  multiRemove,
  getAllKeys,
  clear,
};

export default AppStorage;

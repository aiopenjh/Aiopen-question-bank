/**
 * Native storage bootstrap: 활성 SQLite DB 결정과 AsyncStorage → SQLite 1회 이관.
 * 설계: docs/android/NATIVE_SQLITE_STORAGE_DESIGN.md 6.3·6.4.
 *
 * 이관 순서: 복사(단일 트랜잭션 커밋) → 전체 재조회 비교 → SQLite 완료 마커(별도 트랜잭션)
 * → AsyncStorage 상태 객체 기록.
 * - 이관 완료 기준은 상태 객체다. 상태 객체가 기록되기 전에는 SQLite에 사용자 쓰기를 허용하지
 *   않으므로, 상태 객체가 없으면 AsyncStorage가 항상 최신이다. 그래서 SQLite 마커가 남아 있어도
 *   상태 객체가 없으면 원본 기준으로 다시 이관한다.
 * - 완료 전 실패: 이번 실행은 AsyncStorage로 동작하고, 다음 실행에서 원본 기준으로 다시 이관한다.
 * - 상태 객체 기록 실패: 초기화를 실패로 끝낸다(SQLite 미사용, 폴백도 하지 않음). 같은 실행에서 재시도할 수 있다.
 * - 완료 후 실패: AsyncStorage로 자동 폴백하지 않고 오류를 반환한다.
 * - 이 모듈은 AsyncStorage 원본을 읽기만 하며 상태 객체 키 하나만 추가한다.
 *   원본 삭제는 사용자가 전체 초기화를 실행한 경우에만 app_storage.clear()에서 한다.
 */

import NativeAsyncStorage from '@react-native-async-storage/async-storage';
import { openNativeSqliteStore, type NativeSqliteStore } from './native_sqlite_backend';

export const NATIVE_STORAGE_STATE_KEY = '__celueste:native-storage-state';
export const DEFAULT_ACTIVE_DATABASE = 'celueste.db';
const STATE_VERSION = 1;
const DATABASE_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.db$/;

export interface NativeStorageState {
  version: 1;
  activeDatabase: string;
  migratedAt: string;
  retainedDatabases: string[];
}

export type NativeStorageSelection =
  | { backend: 'sqlite'; store: NativeSqliteStore }
  | { backend: 'async-storage' };

const MIGRATED_STORAGE_UNAVAILABLE =
  '이관이 끝난 학습 저장소를 열 수 없습니다. 최신 기록을 보호하기 위해 이전 저장소로 자동 전환하지 않았습니다. '
  + '앱을 다시 시작해도 계속되면 백업 파일로 복구해 주세요.';

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? '알 수 없는 오류');
}

function parseState(raw: string): NativeStorageState {
  const value = JSON.parse(raw) as Partial<NativeStorageState> | null;
  if (
    !value || typeof value !== 'object'
    || value.version !== STATE_VERSION
    || typeof value.activeDatabase !== 'string' || !DATABASE_FILE_NAME.test(value.activeDatabase)
    || typeof value.migratedAt !== 'string'
    || !Array.isArray(value.retainedDatabases)
    || !value.retainedDatabases.every((name) => typeof name === 'string')
  ) {
    throw new Error('저장소 상태 정보 형식이 올바르지 않습니다.');
  }
  return value as NativeStorageState;
}

/** 상태 객체가 없으면 null. 읽기 실패·형식 오류는 활성 DB를 알 수 없으므로 오류로 처리한다. */
async function readState(): Promise<NativeStorageState | null> {
  try {
    const raw = await NativeAsyncStorage.getItem(NATIVE_STORAGE_STATE_KEY);
    return raw === null ? null : parseState(raw);
  } catch (error) {
    throw new Error(`학습 저장소 상태 정보를 확인할 수 없습니다: ${describe(error)}`);
  }
}

/** 이관 완료 기록. 실패하면 초기화를 실패로 끝내 SQLite 쓰기를 막는다. */
async function recordState(activeDatabase: string): Promise<void> {
  const state: NativeStorageState = {
    version: STATE_VERSION,
    activeDatabase,
    migratedAt: new Date().toISOString(),
    retainedDatabases: [],
  };
  try {
    await NativeAsyncStorage.setItem(NATIVE_STORAGE_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    throw new Error(`학습 저장소 이관 상태 정보를 기록하지 못했습니다. 다시 시도해 주세요. (${describe(error)})`);
  }
}

/** 이관 완료 후: 상태 객체가 가리키는 DB만 연다. 실패하면 오류(폴백 금지). */
async function openMigratedStore(databaseName: string): Promise<NativeSqliteStore> {
  let store: NativeSqliteStore;
  let completed: boolean;
  try {
    store = await openNativeSqliteStore(databaseName);
    completed = await store.hasCompletedMigration();
  } catch (error) {
    throw new Error(`${MIGRATED_STORAGE_UNAVAILABLE} (${describe(error)})`);
  }
  if (!completed) {
    // 파일 손실·교체 등. 이관 당시의 오래된 원본으로 자동 재이관하지 않는다.
    throw new Error(`${MIGRATED_STORAGE_UNAVAILABLE} (${databaseName}에 이관 완료 표시가 없습니다)`);
  }
  return store;
}

async function copyAndVerify(store: NativeSqliteStore, shouldMigrateKey: (key: string) => boolean): Promise<void> {
  const legacyKeys = (await NativeAsyncStorage.getAllKeys()).filter(shouldMigrateKey);
  const legacyEntries = legacyKeys.length > 0 ? await NativeAsyncStorage.multiGet(legacyKeys) : [];
  const source = new Map<string, string>();
  for (const [key, value] of legacyEntries) {
    if (typeof value === 'string') source.set(key, value);
  }

  // 복사: 단일 exclusive 트랜잭션으로 커밋한다. 완료 마커는 여기서 쓰지 않는다.
  await store.replaceUserEntries([...source]);

  // 커밋 후 전체 사용자 키를 다시 읽어 원본과 1:1로 비교한다.
  const copied = await store.readUserEntries();
  const verified = copied.length === source.size
    && copied.every(([key, value]) => source.get(key) === value);
  if (!verified) {
    throw new Error('기존 학습 데이터의 SQLite 이관 결과가 원본과 일치하지 않습니다.');
  }
}

/** 마커 기록이 실패로 끝났을 때 실제 커밋 여부. 확인조차 실패하면 null. */
async function confirmMarker(store: NativeSqliteStore): Promise<boolean | null> {
  try {
    return await store.hasCompletedMigration();
  } catch {
    return null;
  }
}

async function openOrMigrate(shouldMigrateKey: (key: string) => boolean): Promise<NativeStorageSelection> {
  let store: NativeSqliteStore;
  try {
    // 마커가 이미 있어도(상태 객체 기록 실패 후 재실행) 원본 기준으로 다시 이관한다.
    store = await openNativeSqliteStore(DEFAULT_ACTIVE_DATABASE);
  } catch (error) {
    console.error('SQLite 학습 저장소를 열지 못했습니다. 이관 전이므로 기존 저장소를 유지합니다.', error);
    return { backend: 'async-storage' };
  }

  try {
    await copyAndVerify(store, shouldMigrateKey);
  } catch (error) {
    console.error('SQLite 자동 이관 실패. 기존 저장소를 유지하고 다음 실행에서 다시 시도합니다.', error);
    return { backend: 'async-storage' };
  }

  try {
    await store.markMigrationComplete();
  } catch (error) {
    // 커밋 뒤 연결 정리 단계에서 실패했을 수 있다. 마커가 실제로 있으면 완료로 본다.
    const committed = await confirmMarker(store);
    if (committed === false) {
      console.error('SQLite 이관 완료 기록 실패. 기존 저장소를 유지하고 다음 실행에서 다시 시도합니다.', error);
      return { backend: 'async-storage' };
    }
    if (committed === null) {
      // 완료됐을 수도 있으므로 폴백하지 않는다. 폴백 중 쓰기가 다음 실행에서 사라지는 것을 막는다.
      throw new Error(`학습 저장소 이관 완료 여부를 확인하지 못했습니다. 앱을 다시 시작해 주세요. (${describe(error)})`);
    }
  }

  // 실패하면 여기서 예외가 올라가 초기화가 실패한다. store를 돌려주지 않으므로 SQLite 쓰기도 없다.
  await recordState(DEFAULT_ACTIVE_DATABASE);
  return { backend: 'sqlite', store };
}

/**
 * 네이티브 학습 저장소를 준비한다.
 * - 상태 객체 있음: 이관 완료. 그 DB만 열고, 실패하면 오류를 던진다.
 * - 상태 객체 없음: 원본 기준으로 이관한다. 복사·검증·마커 단계 실패만 AsyncStorage 폴백.
 */
export async function initializeNativeStorage(
  shouldMigrateKey: (key: string) => boolean
): Promise<NativeStorageSelection> {
  const state = await readState();
  if (state) {
    return { backend: 'sqlite', store: await openMigratedStore(state.activeDatabase) };
  }
  return openOrMigrate(shouldMigrateKey);
}

import type { NativeSqliteStore } from './native_sqlite_backend';

/**
 * 웹 번들용 대체 모듈. 웹은 app_storage.ts의 IndexedDB 경로를 그대로 사용하며,
 * expo-sqlite(웹 지원 alpha, COOP/COEP 헤더 필요)를 웹 번들에 포함하지 않기 위해 둔다.
 * 웹에서 이 함수가 호출되면 구현 오류다.
 */
export async function openNativeSqliteStore(_databaseName: string): Promise<NativeSqliteStore> {
  throw new Error('웹에서는 SQLite 학습 저장소를 사용하지 않습니다.');
}

/**
 * Ranking Local Repository (참여 자격, 대기 요청 큐)
 * Reference: docs/ranking/RANKING_FEATURE_PLAN.md, RANKING_API_SPEC.md §7
 */

import AsyncStorage from '../app_storage';
import { RankingProfile, RankingRecoverySeed, RankingSyncQueueItem } from '../../contracts/types';
import { STORAGE_KEYS, getCurrentISOTime } from '../storage_keys';

export async function getRankingProfile(): Promise<RankingProfile | null> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.RANKING_PROFILE);
  return data ? JSON.parse(data) : null;
}

export async function saveRankingProfile(profile: RankingProfile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.RANKING_PROFILE, JSON.stringify(profile));
}

/** 로컬 랭킹 참여 자격 삭제. 서버 탈퇴 요청과는 별개 (그건 API 호출로 처리). */
export async function clearRankingProfile(): Promise<void> {
  await AsyncStorage.multiRemove([STORAGE_KEYS.RANKING_PROFILE, STORAGE_KEYS.RANKING_SYNC_QUEUE]);
}

/**
 * 실패한 연동 요청 대기열. 계획서 §6: 기기에 한 건만 대기시킨다.
 * 새 요청은 기존 대기 항목을 덮어쓴다(누적하지 않음).
 */
export async function getPendingSyncRequest(): Promise<RankingSyncQueueItem | null> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.RANKING_SYNC_QUEUE);
  return data ? JSON.parse(data) : null;
}

export async function setPendingSyncRequest(localDate: string, solvedCount: number): Promise<void> {
  const item: RankingSyncQueueItem = { localDate, solvedCount, queuedAt: getCurrentISOTime() };
  await AsyncStorage.setItem(STORAGE_KEYS.RANKING_SYNC_QUEUE, JSON.stringify(item));
}

export async function clearPendingSyncRequest(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.RANKING_SYNC_QUEUE);
}

/**
 * 백업 복원 직후의 랭킹 복구 재료. 탈퇴하지 않았다면 서버 계정은 살아있으므로
 * 랭킹 창에서 이 값으로 POST /participants/recover를 호출해 RankingProfile을 완성한다.
 */
export async function getRankingRecoverySeed(): Promise<RankingRecoverySeed | null> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.RANKING_RECOVERY_SEED);
  return data ? JSON.parse(data) : null;
}

export async function saveRankingRecoverySeed(seed: RankingRecoverySeed): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.RANKING_RECOVERY_SEED, JSON.stringify(seed));
}

export async function clearRankingRecoverySeed(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.RANKING_RECOVERY_SEED);
}

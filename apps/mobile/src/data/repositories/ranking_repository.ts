/**
 * Ranking Local Repository (참여 자격, 대기 요청 큐)
 * Reference: docs/ranking/RANKING_FEATURE_PLAN.md, RANKING_API_SPEC.md §7
 */

import AsyncStorage from '../app_storage';
import { RankingProfile, RankingSyncQueueItem } from '../../contracts/types';
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

export async function updateLastSynced(localDate: string, solvedCount: number): Promise<void> {
  const profile = await getRankingProfile();
  if (!profile) return;
  await saveRankingProfile({
    ...profile,
    lastSyncedDate: localDate,
    lastSyncedSolvedCount: solvedCount,
  });
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

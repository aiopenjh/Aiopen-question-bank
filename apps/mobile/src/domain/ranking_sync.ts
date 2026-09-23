import { RankingProfile } from '../contracts/types';
import {
  clearPendingSyncRequest,
  getAttempts,
  getRankingProfile,
  saveRankingProfile,
  setPendingSyncRequest,
} from '../data/db';
import { countTodayCompletedQuestions, getMaxQualifiedKillerLevel } from './ranking';
import { RankingApiRequestError, syncToday } from './ranking_client';
import { getLocalDateString } from './routine';

/** 등록된 사용자만 최신 누적값을 서버에 보낸다. 문제 내용은 전송하지 않는다. */
export async function syncRankingProgress(profileOverride?: RankingProfile) {
  const profile = profileOverride ?? await getRankingProfile();
  if (!profile) return null;

  const localDate = getLocalDateString();
  const attempts = await getAttempts();
  const solvedCount = countTodayCompletedQuestions(attempts, localDate);
  const maxKillerLevel = getMaxQualifiedKillerLevel(attempts);

  try {
    const result = await syncToday(profile, localDate, solvedCount, maxKillerLevel);
    const syncedProfile: RankingProfile = {
      ...profile,
      lastSyncedDate: localDate,
      lastSyncedSolvedCount: solvedCount,
    };
    await Promise.all([saveRankingProfile(syncedProfile), clearPendingSyncRequest()]);
    return { result, profile: syncedProfile, solvedCount, maxKillerLevel };
  } catch (error) {
    if (
      error instanceof RankingApiRequestError &&
      (error.status === 0 || error.status === 429 || error.status >= 500)
    ) {
      await setPendingSyncRequest(localDate, solvedCount);
    }
    throw error;
  }
}

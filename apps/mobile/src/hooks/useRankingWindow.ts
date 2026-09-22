/**
 * 랭킹 창 전용 데이터 훅.
 * Reference: docs/ranking/RANKING_FEATURE_PLAN.md §3.2, §3.3, §6
 *
 * 별도 브라우저 창에서도 단독으로 동작해야 하므로 useAppController에 기대지 않고
 * 기기 저장소에서 직접 읽는다. 저장소는 첫 접근 시 알아서 초기화되므로
 * 시드 생성/마이그레이션을 수행하는 initializeDatabase()는 호출하지 않는다.
 */

import { useCallback, useEffect, useState } from 'react';
import { RankingProfile, RankingRecoverySeed, RankingSyncQueueItem } from '../contracts/types';
import {
  getAttempts,
  getRankingProfile,
  saveRankingProfile,
  clearRankingProfile,
  getPendingSyncRequest,
  setPendingSyncRequest,
  clearPendingSyncRequest,
  getRankingRecoverySeed,
  clearRankingRecoverySeed,
} from '../data/db';
import { countTodayCompletedQuestions, getMaxQualifiedKillerLevel } from '../domain/ranking';
import { getLocalDateString } from '../domain/routine';
import {
  getLeaderboard,
  recoverParticipant,
  registerParticipant,
  requestWithdrawal,
  syncToday,
  LeaderboardResult,
  RankingApiRequestError,
  SyncTodayResult,
} from '../domain/ranking_client';

const LEADERBOARD_LIMIT = 50;

function toMessage(err: unknown): string {
  return err instanceof RankingApiRequestError ? err.message : '알 수 없는 오류가 발생했습니다.';
}

export function useRankingWindow() {
  const [profile, setProfile] = useState<RankingProfile | null>(null);
  const [todaySolvedCount, setTodaySolvedCount] = useState(0);
  // 초고난도 도전 랭킹: 전체 기간 최고 도달 킬러 문항 레벨 (도메인 규칙: domain/ranking.ts).
  const [maxKillerLevel, setMaxKillerLevel] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResult | null>(null);
  const [lastSync, setLastSync] = useState<SyncTodayResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 백업을 복원했는데 아직 참여 중이 아니면(deviceToken 없음), 복구할 계정이 있는지 보여준다.
  const [recoverySeed, setRecoverySeed] = useState<RankingRecoverySeed | null>(null);
  // 계획서 §6: 실패해 대기 중인 연동 요청이 있으면 창을 열었을 때 알려준다.
  const [pendingSync, setPendingSync] = useState<RankingSyncQueueItem | null>(null);

  const refreshLeaderboard = useCallback(async () => {
    try {
      setLeaderboard(await getLeaderboard(LEADERBOARD_LIMIT));
    } catch (err) {
      setError(toMessage(err));
    }
  }, []);

  useEffect(() => {
    (async () => {
      // 오늘 완료 수는 제출 기록에서 직접 계산한다 (계획서 §5.1).
      const [storedProfile, attempts] = await Promise.all([
        getRankingProfile(),
        getAttempts(),
      ]);
      setProfile(storedProfile);
      setTodaySolvedCount(countTodayCompletedQuestions(attempts));
      setMaxKillerLevel(getMaxQualifiedKillerLevel(attempts));
      if (!storedProfile) setRecoverySeed(await getRankingRecoverySeed());
      setPendingSync(await getPendingSyncRequest());
      await refreshLeaderboard();
      setLoading(false);
    })();
  }, [refreshLeaderboard]);

  const register = useCallback(async (nickname: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await registerParticipant(nickname.trim());
      const next: RankingProfile = {
        nickname: result.nickname,
        participantId: result.participantId,
        deviceToken: result.deviceToken,
        recoveryToken: result.recoveryToken,
      };
      await saveRankingProfile(next);
      setProfile(next);
      return { ok: true as const };
    } catch (err) {
      const message = toMessage(err);
      setError(message);
      return { ok: false as const, message };
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * 백업 복원으로 남은 복구 재료로 서버 계정을 되찾는다.
   * 탈퇴 후 유예 기간이 지나 서버가 계정을 이미 지웠다면 실패하며,
   * 그 경우 시드를 지우고 새로 참여하도록 안내한다.
   */
  const recoverFromBackup = useCallback(async () => {
    if (!recoverySeed) return { ok: false as const, message: '복구할 백업 정보가 없습니다.' };
    setBusy(true);
    setError(null);
    try {
      const result = await recoverParticipant(recoverySeed.participantId, recoverySeed.recoveryToken);
      const next: RankingProfile = {
        nickname: result.nickname,
        participantId: result.participantId,
        deviceToken: result.deviceToken,
        recoveryToken: recoverySeed.recoveryToken,
      };
      await saveRankingProfile(next);
      await clearRankingRecoverySeed();
      setProfile(next);
      setRecoverySeed(null);
      return { ok: true as const };
    } catch (err) {
      const message = toMessage(err);
      setError(message);
      // 탈퇴+유예 만료로 서버 계정이 사라진 경우: 더 시도할 수 없으니 시드를 치운다.
      if (err instanceof RankingApiRequestError && err.status === 401) {
        await clearRankingRecoverySeed();
        setRecoverySeed(null);
      }
      return { ok: false as const, message };
    } finally {
      setBusy(false);
    }
  }, [recoverySeed]);

  const dismissRecoverySeed = useCallback(async () => {
    await clearRankingRecoverySeed();
    setRecoverySeed(null);
  }, []);

  const sync = useCallback(async () => {
    if (!profile) return { ok: false as const, message: '먼저 랭킹에 참여해 주세요.' };
    setBusy(true);
    setError(null);
    const localDate = getLocalDateString();
    let solvedCount = todaySolvedCount;
    try {
      // 별도 랭킹 창을 열어 둔 동안 완료한 도전도 전송 직전에 다시 읽는다.
      const attempts = await getAttempts();
      solvedCount = countTodayCompletedQuestions(attempts, localDate);
      const clearedLevel = getMaxQualifiedKillerLevel(attempts);
      setTodaySolvedCount(solvedCount);
      setMaxKillerLevel(clearedLevel);
      const result = await syncToday(profile, localDate, solvedCount, clearedLevel);
      await clearPendingSyncRequest();
      setPendingSync(null);
      setLastSync(result);
      // 마지막 연동 시각을 프로필에 남겨, 창을 새로 열었을 때도 "아직 연동 안 함"과
      // 구분해 보여줄 수 있게 한다(계획서 §3.2, 수동 연동 방식 안내 보완).
      const syncedProfile: RankingProfile = { ...profile, lastSyncedDate: localDate, lastSyncedSolvedCount: solvedCount };
      await saveRankingProfile(syncedProfile);
      setProfile(syncedProfile);
      await refreshLeaderboard();
      return { ok: true as const, result };
    } catch (err) {
      const message = toMessage(err);
      setError(message);
      // 서버/네트워크 장애(0, 429, 5xx)만 기기에 대기시킨다 (계획서 §6).
      if (err instanceof RankingApiRequestError && (err.status === 0 || err.status === 429 || err.status >= 500)) {
        await setPendingSyncRequest(localDate, solvedCount);
        setPendingSync({ localDate, solvedCount, queuedAt: new Date().toISOString() });
      }
      return { ok: false as const, message };
    } finally {
      setBusy(false);
    }
  }, [profile, todaySolvedCount, refreshLeaderboard]);

  const withdraw = useCallback(async () => {
    if (!profile) return { ok: false as const, message: '참여 정보가 없습니다.' };
    setBusy(true);
    setError(null);
    try {
      await requestWithdrawal(profile);
      await clearRankingProfile();
      setProfile(null);
      setLastSync(null);
      await refreshLeaderboard();
      return { ok: true as const };
    } catch (err) {
      const message = toMessage(err);
      setError(message);
      return { ok: false as const, message };
    } finally {
      setBusy(false);
    }
  }, [profile, refreshLeaderboard]);

  return {
    profile,
    todaySolvedCount,
    maxKillerLevel,
    leaderboard,
    lastSync,
    loading,
    busy,
    error,
    recoverySeed,
    pendingSync,
    register,
    sync,
    withdraw,
    recoverFromBackup,
    dismissRecoverySeed,
  };
}

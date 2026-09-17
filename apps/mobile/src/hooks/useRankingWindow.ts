/**
 * 랭킹 창 전용 데이터 훅.
 * Reference: docs/ranking/RANKING_FEATURE_PLAN.md §3.2, §3.3, §6
 *
 * 별도 브라우저 창에서도 단독으로 동작해야 하므로 useAppController에 기대지 않고
 * 기기 저장소에서 직접 읽는다. 저장소는 첫 접근 시 알아서 초기화되므로
 * 시드 생성/마이그레이션을 수행하는 initializeDatabase()는 호출하지 않는다.
 */

import { useCallback, useEffect, useState } from 'react';
import { RankingProfile } from '../contracts/types';
import {
  getAttempts,
  getRankingProfile,
  saveRankingProfile,
  clearRankingProfile,
  setPendingSyncRequest,
  clearPendingSyncRequest,
} from '../data/db';
import { countTodayCompletedQuestions } from '../domain/ranking';
import { getLocalDateString } from '../domain/routine';
import {
  getLeaderboard,
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
  const [leaderboard, setLeaderboard] = useState<LeaderboardResult | null>(null);
  const [lastSync, setLastSync] = useState<SyncTodayResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const [storedProfile, attempts] = await Promise.all([getRankingProfile(), getAttempts()]);
      setProfile(storedProfile);
      setTodaySolvedCount(countTodayCompletedQuestions(attempts));
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

  const sync = useCallback(async () => {
    if (!profile) return { ok: false as const, message: '먼저 랭킹에 참여해 주세요.' };
    setBusy(true);
    setError(null);
    const localDate = getLocalDateString();
    try {
      const result = await syncToday(profile, localDate, todaySolvedCount);
      await clearPendingSyncRequest();
      setLastSync(result);
      await refreshLeaderboard();
      return { ok: true as const, result };
    } catch (err) {
      const message = toMessage(err);
      setError(message);
      // 서버/네트워크 장애(0, 429, 5xx)만 기기에 대기시킨다 (계획서 §6).
      if (err instanceof RankingApiRequestError && (err.status === 0 || err.status === 429 || err.status >= 500)) {
        await setPendingSyncRequest(localDate, todaySolvedCount);
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
    leaderboard,
    lastSync,
    loading,
    busy,
    error,
    register,
    sync,
    withdraw,
  };
}

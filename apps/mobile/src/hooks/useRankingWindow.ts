/**
 * 랭킹 창 전용 데이터 훅.
 * Reference: docs/ranking/RANKING_FEATURE_PLAN.md §3.2, §3.3, §6
 *
 * 별도 브라우저 창에서도 단독으로 동작해야 하므로 useAppController에 기대지 않고
 * 기기 저장소에서 직접 읽는다. 저장소는 첫 접근 시 알아서 초기화되므로
 * 시드 생성/마이그레이션을 수행하는 initializeDatabase()는 호출하지 않는다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { RankingProfile, RankingRecoverySeed, RankingSyncQueueItem } from '../contracts/types';
import {
  getAttempts,
  getRankingProfile,
  saveRankingProfile,
  clearRankingProfile,
  getPendingSyncRequest,
  getRankingRecoverySeed,
  clearRankingRecoverySeed,
} from '../data/db';
import { countTodayCompletedQuestions, getMaxQualifiedKillerLevel } from '../domain/ranking';
import {
  getLeaderboard,
  recoverParticipant,
  registerParticipant,
  requestWithdrawal,
  LeaderboardResult,
  RankingApiRequestError,
  SyncTodayResult,
} from '../domain/ranking_client';
import { syncRankingProgress } from '../domain/ranking_sync';
import { base64ToU8, decompressBackupPayload } from '../utils/backupArchive';

const LEADERBOARD_LIMIT = 20;

function toMessage(err: unknown): string {
  return err instanceof RankingApiRequestError ? err.message : '알 수 없는 오류가 발생했습니다.';
}

function recoverySeedFromBackup(content: string): RankingRecoverySeed {
  let backup: Record<string, unknown>;
  try {
    backup = JSON.parse(content);
  } catch {
    throw new Error('올바른 Celueste 백업 파일이 아닙니다. JSON 또는 이전 ZIP 백업을 선택해 주세요.');
  }
  if (
    typeof backup?.rankingParticipantId !== 'string' || !backup.rankingParticipantId ||
    typeof backup?.rankingRecoveryToken !== 'string' || !backup.rankingRecoveryToken
  ) {
    throw new Error('이 백업에는 랭킹 계정 복구 정보가 없습니다. 랭킹에 참여한 뒤 저장한 전체 백업을 선택해 주세요.');
  }
  return {
    nickname: typeof backup.rankingNickname === 'string' ? backup.rankingNickname : '',
    participantId: backup.rankingParticipantId,
    recoveryToken: backup.rankingRecoveryToken,
  };
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
  const registrationInFlightRef = useRef(false);
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
    if (registrationInFlightRef.current) {
      return { ok: false as const, message: '랭킹 등록을 처리하고 있습니다.' };
    }
    registrationInFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const existingProfile = profile ?? (await getRankingProfile());
      if (existingProfile) {
        setProfile(existingProfile);
        const message = '이미 등록된 랭킹 계정이 있습니다. 추가 등록할 수 없습니다.';
        setError(message);
        return { ok: false as const, message };
      }
      const result = await registerParticipant(nickname.trim());
      const next: RankingProfile = {
        nickname: result.nickname,
        participantId: result.participantId,
        deviceToken: result.deviceToken,
        recoveryToken: result.recoveryToken,
      };
      await saveRankingProfile(next);
      setProfile(next);
      // 최초 등록 직후 기존 오늘 기록도 별도 버튼 없이 반영한다.
      try {
        const synced = await syncRankingProgress(next);
        if (synced) {
          setProfile(synced.profile);
          setLastSync(synced.result);
          setTodaySolvedCount(synced.solvedCount);
          setMaxKillerLevel(synced.maxKillerLevel);
          await refreshLeaderboard();
        }
      } catch {
        setPendingSync(await getPendingSyncRequest());
      }
      return { ok: true as const };
    } catch (err) {
      const message = toMessage(err);
      setError(message);
      return { ok: false as const, message };
    } finally {
      registrationInFlightRef.current = false;
      setBusy(false);
    }
  }, [profile, refreshLeaderboard]);

  /**
   * 백업 복원으로 남은 복구 재료로 서버 계정을 되찾는다.
   * 탈퇴 후 유예 기간이 지나 서버가 계정을 이미 지웠다면 실패하며,
   * 그 경우 시드를 지우고 새로 참여하도록 안내한다.
   */
  const recoverWithSeed = useCallback(async (seed: RankingRecoverySeed) => {
    setBusy(true);
    setError(null);
    try {
      if (await getRankingProfile()) {
        return { ok: false as const, message: '이미 연결된 랭킹 계정이 있습니다.' };
      }
      const result = await recoverParticipant(seed.participantId, seed.recoveryToken);
      const next: RankingProfile = {
        nickname: result.nickname,
        participantId: result.participantId,
        deviceToken: result.deviceToken,
        recoveryToken: seed.recoveryToken,
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
      if (err instanceof RankingApiRequestError && err.status === 401 && recoverySeed?.participantId === seed.participantId) {
        await clearRankingRecoverySeed();
        setRecoverySeed(null);
      }
      return { ok: false as const, message };
    } finally {
      setBusy(false);
    }
  }, [recoverySeed]);

  const recoverFromBackup = useCallback(async () => {
    if (!recoverySeed) return { ok: false as const, message: '복구할 백업 정보가 없습니다.' };
    return recoverWithSeed(recoverySeed);
  }, [recoverySeed, recoverWithSeed]);

  const recoverFromBackupFile = useCallback(async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets?.length) return { ok: false as const, canceled: true as const };
      const file = picked.assets[0];
      const bytes = Platform.OS === 'web' && (file as any).file
        ? new Uint8Array(await (file as any).file.arrayBuffer())
        : base64ToU8(await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 }));
      return recoverWithSeed(recoverySeedFromBackup(decompressBackupPayload(bytes)));
    } catch (err) {
      const message = err instanceof Error ? err.message : '백업 파일을 읽을 수 없습니다.';
      setError(message);
      return { ok: false as const, message };
    }
  }, [recoverWithSeed]);

  const dismissRecoverySeed = useCallback(async () => {
    await clearRankingRecoverySeed();
    setRecoverySeed(null);
  }, []);

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
    withdraw,
    recoverFromBackup,
    recoverFromBackupFile,
    dismissRecoverySeed,
  };
}

/**
 * Ranking API Client
 * Reference: docs/ranking/RANKING_API_SPEC.md §4
 *
 * 참여하지 않은 사용자는 이 파일의 함수가 호출되지 않아야 한다
 * (FEATURE_PLAN §8 완료 기준: 미참여 사용자는 네트워크 요청이 발생하지 않음).
 */

import { RankingProfile } from '../contracts/types';

// 실제 배포 전까지는 빈 문자열. 화면에서는 RANKING_API_BASE_URL이 없으면
// 랭킹 기능 진입점을 노출하지 않는다 (서버 미배포 상태 보호).
export const RANKING_API_BASE_URL = '';

export class RankingApiRequestError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'RankingApiRequestError';
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  if (!RANKING_API_BASE_URL) {
    throw new RankingApiRequestError('SERVICE_UNAVAILABLE', '랭킹 서버가 아직 연결되지 않았습니다.', 503);
  }
  let response: Response;
  try {
    response = await fetch(`${RANKING_API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    });
  } catch {
    throw new RankingApiRequestError('SERVER_ERROR', '랭킹 서버에 연결할 수 없습니다.', 0);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const err: { code?: string; message?: string } | undefined = body?.error;
    throw new RankingApiRequestError(
      err?.code ?? 'SERVER_ERROR',
      err?.message ?? '알 수 없는 오류가 발생했습니다.',
      response.status
    );
  }
  return body as T;
}

export interface RegisterParticipantResult {
  participantId: string;
  nickname: string;
  deviceToken: string;
  recoveryToken: string;
  createdAt: string;
}

export async function registerParticipant(nickname: string): Promise<RegisterParticipantResult> {
  return request<RegisterParticipantResult>('/v1/participants', {
    method: 'POST',
    body: JSON.stringify({ nickname }),
  });
}

export interface RecoverParticipantResult {
  participantId: string;
  nickname: string;
  deviceToken: string;
}

export async function recoverParticipant(
  participantId: string,
  recoveryToken: string
): Promise<RecoverParticipantResult> {
  return request<RecoverParticipantResult>('/v1/participants/recover', {
    method: 'POST',
    body: JSON.stringify({ participantId, recoveryToken }),
  });
}

export interface SyncTodayResult {
  studyDate: string;
  solvedCount: number;
  qualifiedConsistency: boolean;
  totalSolved: number;
  currentStreak: number;
  /** 초고난도 도전 랭킹: 전체 기간 최고 도달 킬러 문항 레벨(0이면 아직 없음). */
  maxKillerLevel: number;
  solvedRank: number;
  consistencyRank: number;
  killerRank: number;
  leaderboardUpdatedAt: string;
}

export async function syncToday(
  profile: RankingProfile,
  localDate: string,
  solvedCount: number,
  maxKillerLevel: number
): Promise<SyncTodayResult> {
  return request<SyncTodayResult>('/v1/sync/today', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${profile.deviceToken}`,
      'Idempotency-Key': `${profile.participantId}-${localDate}-${Date.now()}`,
    },
    body: JSON.stringify({ localDate, timezone: 'Asia/Seoul', solvedCount, maxKillerLevel }),
  });
}

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  /** 최다 문제 풀이는 누적 문제 수, 꾸준함은 연속 학습일, 초고난도 도전은 최고 도달 레벨. */
  value: number;
}

export interface LeaderboardResult {
  mostSolved: LeaderboardEntry[];
  mostConsistent: LeaderboardEntry[];
  mostKillerLevel: LeaderboardEntry[];
  updatedAt: string;
}

/** 메인 카드는 기본값(1위만), 랭킹 창은 limit을 키워 전체 목록을 받는다. */
export async function getLeaderboard(limit = 1): Promise<LeaderboardResult> {
  return request<LeaderboardResult>(`/v1/leaderboard?limit=${limit}`, { method: 'GET' });
}

export async function requestWithdrawal(
  profile: RankingProfile
): Promise<{ status: string; scheduledDeletionAt: string }> {
  return request('/v1/participants/me', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${profile.deviceToken}` },
  });
}

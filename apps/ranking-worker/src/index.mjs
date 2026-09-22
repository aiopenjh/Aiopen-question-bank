// Celueste 랭킹 API 진입점
// Reference: docs/ranking/RANKING_API_SPEC.md, RANKING_SERVER_OPTIONS.md §3

import { corsHeaders, errorResponse, resolveAllowedOrigin } from './util.mjs';
import {
  registerParticipant,
  recoverParticipant,
  syncToday,
  getLeaderboard,
  requestDeletion,
  purgeExpiredDeletions,
} from './routes.mjs';

export default {
  async fetch(request, env) {
    const origin = resolveAllowedOrigin(request, env);
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/v1/, '');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    try {
      if (path === '/participants' && request.method === 'POST') {
        return await registerParticipant(request, env, origin);
      }
      if (path === '/participants/recover' && request.method === 'POST') {
        return await recoverParticipant(request, env, origin);
      }
      if (path === '/sync/today' && request.method === 'POST') {
        return await syncToday(request, env, origin);
      }
      if (path === '/leaderboard' && request.method === 'GET') {
        return await getLeaderboard(request, env, origin);
      }
      if (path === '/participants/me' && request.method === 'DELETE') {
        return await requestDeletion(request, env, origin);
      }
      return errorResponse('INVALID_INPUT', '알 수 없는 경로입니다.', 404, origin);
    } catch (err) {
      // 요청 본문/토큰 원문은 로그에 남기지 않는다 (API_SPEC §5).
      console.error('ranking-worker error:', err instanceof Error ? err.message : err);
      return errorResponse('SERVER_ERROR', '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', 500, origin);
    }
  },

  /** 매일 1회 유예 기간이 지난 탈퇴 참여자를 정리한다. wrangler.toml에 cron 트리거 등록 필요. */
  async scheduled(_event, env) {
    await purgeExpiredDeletions(env);
  },
};

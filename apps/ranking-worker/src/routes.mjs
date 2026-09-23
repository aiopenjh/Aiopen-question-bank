// 엔드포인트 핸들러
// Reference: docs/ranking/RANKING_API_SPEC.md §4, §5, §6

import { errorResponse, isoNow, jsonResponse, randomToken, sha256Hex, todaySeoul, validateNickname } from './util.mjs';

const CONSISTENCY_MIN = 3;

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function bearerToken(request) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/);
  return match ? match[1] : null;
}

/** 유효한(탈퇴 유예 포함) device token으로 참여자를 찾는다. */
async function findParticipantByDeviceToken(env, deviceToken) {
  if (!deviceToken) return null;
  const hash = await sha256Hex(deviceToken);
  return env.DB.prepare('SELECT * FROM participants WHERE device_token_hash = ?')
    .bind(hash)
    .first();
}

// 4.1 POST /participants
export async function registerParticipant(request, env, origin) {
  const body = await readJson(request);
  const check = validateNickname(body?.nickname);
  if (!check.ok) {
    return errorResponse('INVALID_INPUT', '닉네임은 2~12자이며 금칙어를 포함할 수 없습니다.', 400, origin);
  }

  const existing = await env.DB.prepare(
    'SELECT id, deleted_at FROM participants WHERE nickname = ?'
  )
    .bind(check.nickname)
    .first();
  if (existing) {
    // 탈퇴 유예 중인 계정도 복구 기회를 보장한다. 유예가 끝나 Cron이 삭제한 뒤에만 재사용된다.
    return errorResponse('NICKNAME_TAKEN', '이미 사용 중이거나 탈퇴 유예 중인 닉네임입니다.', 409, origin);
  }

  const participantId = randomToken('pt');
  const deviceToken = randomToken('dt');
  const recoveryToken = randomToken('rt');
  const now = isoNow();

  try {
    await env.DB.prepare(
      `INSERT INTO participants (id, nickname, recovery_token_hash, device_token_hash, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`
    )
      .bind(
        participantId,
        check.nickname,
        await sha256Hex(recoveryToken),
        await sha256Hex(deviceToken),
        now,
        now
      )
      .run();
  } catch (err) {
    if (String(err).includes('UNIQUE constraint failed')) {
      return errorResponse('NICKNAME_TAKEN', '이미 사용 중인 닉네임입니다.', 409, origin);
    }
    throw err;
  }

  return jsonResponse(
    { participantId, nickname: check.nickname, deviceToken, recoveryToken, createdAt: now },
    201,
    origin
  );
}

// 4.2 POST /participants/recover
export async function recoverParticipant(request, env, origin) {
  const body = await readJson(request);
  const { participantId, recoveryToken } = body || {};
  if (!participantId || !recoveryToken) {
    return errorResponse('INVALID_INPUT', 'participantId와 recoveryToken이 필요합니다.', 400, origin);
  }

  const recoveryHash = await sha256Hex(recoveryToken);
  const participant = await env.DB.prepare(
    'SELECT * FROM participants WHERE id = ? AND recovery_token_hash = ?'
  )
    .bind(participantId, recoveryHash)
    .first();

  if (!participant) {
    return errorResponse('INVALID_DEVICE_TOKEN', '복구 정보가 일치하지 않습니다. 백업 파일을 확인해 주세요.', 401, origin);
  }

  const newDeviceToken = randomToken('dt');
  const now = isoNow();

  // 유예 기간 중 탈퇴 요청이었다면 복구 시도로 취소한다 (FEATURE_PLAN §10 확정 정책).
  await env.DB.prepare(
    'UPDATE participants SET device_token_hash = ?, updated_at = ?, deleted_at = NULL WHERE id = ?'
  )
    .bind(await sha256Hex(newDeviceToken), now, participant.id)
    .run();

  return jsonResponse(
    { participantId: participant.id, nickname: participant.nickname, deviceToken: newDeviceToken },
    200,
    origin
  );
}

// 4.3 POST /sync/today
export async function syncToday(request, env, origin) {
  const deviceToken = bearerToken(request);
  const participant = await findParticipantByDeviceToken(env, deviceToken);
  if (!participant || participant.deleted_at) {
    return errorResponse('INVALID_DEVICE_TOKEN', '백업을 이용해 복구해 주세요.', 401, origin);
  }

  const body = await readJson(request);
  const solvedCount = body?.solvedCount;
  const dailyMax = Number(env.DAILY_SOLVED_COUNT_MAX || 500);
  if (!Number.isInteger(solvedCount) || solvedCount < 0) {
    return errorResponse('INVALID_INPUT', 'solvedCount는 0 이상의 정수여야 합니다.', 400, origin);
  }
  if (solvedCount > dailyMax) {
    return errorResponse('COUNT_OUT_OF_RANGE', '완료 수가 일일 허용 범위를 초과했습니다.', 422, origin);
  }
  // 초고난도 도전 랭킹(ROADMAP §Step 1). 미전송 시 갱신하지 않는다(구버전 클라이언트 호환).
  const maxKillerLevel = body?.maxKillerLevel;
  if (maxKillerLevel !== undefined && (!Number.isInteger(maxKillerLevel) || maxKillerLevel < 0)) {
    return errorResponse('INVALID_INPUT', 'maxKillerLevel은 0 이상의 정수여야 합니다.', 400, origin);
  }

  const studyDate = todaySeoul();
  const now = isoNow();

  await env.DB.prepare(
    `INSERT INTO daily_learning (participant_id, study_date, solved_count, qualified_consistency, last_sync_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (participant_id, study_date)
     DO UPDATE SET solved_count = MAX(daily_learning.solved_count, excluded.solved_count),
                   qualified_consistency = MAX(daily_learning.qualified_consistency, excluded.qualified_consistency),
                   last_sync_at = excluded.last_sync_at`
  )
    .bind(participant.id, studyDate, solvedCount, solvedCount >= CONSISTENCY_MIN ? 1 : 0, now)
    .run();

  // 동시 요청이 와도 DB에 저장된 MAX 결과를 기준으로 통계를 계산한다.
  const storedToday = await env.DB.prepare(
    'SELECT * FROM daily_learning WHERE participant_id = ? AND study_date = ?'
  )
    .bind(participant.id, studyDate)
    .first();
  const newSolvedCount = storedToday.solved_count;
  const qualified = !!storedToday.qualified_consistency;
  const stats = await recomputeStats(env, participant.id, studyDate, qualified, maxKillerLevel);

  return jsonResponse(
    {
      studyDate,
      solvedCount: newSolvedCount,
      qualifiedConsistency: qualified,
      totalSolved: stats.total_solved,
      currentStreak: stats.current_streak,
      maxKillerLevel: stats.max_killer_level,
      solvedRank: await rankOf(env, 'total_solved', participant.id),
      consistencyRank: await rankOf(env, 'current_streak', participant.id),
      killerRank: await rankOf(env, 'max_killer_level', participant.id),
      leaderboardUpdatedAt: now,
    },
    200,
    origin
  );
}

/**
 * 참여자 통계 재계산. 같은 날 재연동이 반복돼도 total_solved 증분은
 * solved_count의 델타(신규-기존)만 반영해 값이 부풀지 않게 한다.
 * current_streak은 "어제까지의 스트릭 + (오늘 qualified면 1)"로 계산한다.
 */
async function recomputeStats(env, participantId, studyDate, qualifiedToday, incomingMaxKillerLevel) {
  const statsRow = await env.DB.prepare('SELECT * FROM participant_stats WHERE participant_id = ?')
    .bind(participantId)
    .first();

  // total_solved: 날짜별 solved_count 합계를 다시 집계한다 (테이블이 작아 매번 합산해도 충분히 저렴).
  const totalRow = await env.DB.prepare(
    'SELECT COALESCE(SUM(solved_count), 0) AS total FROM daily_learning WHERE participant_id = ?'
  )
    .bind(participantId)
    .first();
  const totalSolved = totalRow.total;

  let currentStreak = statsRow?.current_streak ?? 0;
  const lastQualifiedDate = statsRow?.last_qualified_date ?? null;

  // 오늘을 아직 스트릭에 반영하지 않았다면 이어붙이거나 새로 시작한다.
  // 그 외 경우(자격 유지/미달)는 currentStreak을 그대로 둔다 (재연동으로 3문제 미만 하락은
  // 클라이언트가 보내지 않는 한 발생하지 않고, 과도한 조작 방지는 초기 범위 밖 - FEATURE_PLAN §9).
  if (qualifiedToday && lastQualifiedDate !== studyDate) {
    const yesterday = addDaysToDateString(studyDate, -1);
    currentStreak = lastQualifiedDate === yesterday ? currentStreak + 1 : 1;
  }

  const bestStreak = Math.max(statsRow?.best_streak ?? 0, currentStreak);
  const newLastQualifiedDate = qualifiedToday ? studyDate : lastQualifiedDate;
  // 초고난도 도전 랭킹: 전체 기간 최고 도달 레벨만 단조 증가(MAX)로 저장한다.
  const maxKillerLevel = Math.max(statsRow?.max_killer_level ?? 0, incomingMaxKillerLevel ?? 0);
  const now = isoNow();

  await env.DB.prepare(
    `INSERT INTO participant_stats (participant_id, total_solved, current_streak, best_streak, last_qualified_date, max_killer_level, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (participant_id)
     DO UPDATE SET total_solved = excluded.total_solved,
                   current_streak = excluded.current_streak,
                   best_streak = MAX(participant_stats.best_streak, excluded.best_streak),
                   last_qualified_date = excluded.last_qualified_date,
                   max_killer_level = MAX(participant_stats.max_killer_level, excluded.max_killer_level),
                   updated_at = excluded.updated_at`
  )
    .bind(participantId, totalSolved, currentStreak, bestStreak, newLastQualifiedDate, maxKillerLevel, now)
    .run();

  return { total_solved: totalSolved, current_streak: currentStreak, max_killer_level: maxKillerLevel };
}

function addDaysToDateString(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

async function rankOf(env, column, participantId) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) + 1 AS rank FROM participant_stats
     WHERE ${column} > (SELECT ${column} FROM participant_stats WHERE participant_id = ?)`
  )
    .bind(participantId)
    .first();
  return row.rank;
}

// 4.4 GET /leaderboard?limit=N
// 메인 화면 카드는 limit=1(1위만), 랭킹 창은 limit=N(전체 목록)으로 같은 엔드포인트를 쓴다.
const DEFAULT_LEADERBOARD_LIMIT = 1;
const MAX_LEADERBOARD_LIMIT = 50;

export async function getLeaderboard(request, env, origin) {
  let limit = DEFAULT_LEADERBOARD_LIMIT;
  if (request) {
    const raw = Number(new URL(request.url).searchParams.get('limit'));
    if (Number.isInteger(raw) && raw > 0) limit = Math.min(raw, MAX_LEADERBOARD_LIMIT);
  }

  return jsonResponse(
    {
      mostSolved: await topRanking(env, 'total_solved', limit),
      mostConsistent: await topRanking(env, 'current_streak', limit),
      mostKillerLevel: await topRanking(env, 'max_killer_level', limit),
      updatedAt: isoNow(),
    },
    200,
    origin
  );
}

/** 탈퇴하지 않은 참여자만 상위 순으로 반환한다. 동점은 DB 순서를 따르며 같은 순위를 부여하지 않는다. */
async function topRanking(env, column, limit) {
  const rows = await env.DB.prepare(
    `SELECT p.nickname, s.${column} AS value FROM participant_stats s
     JOIN participants p ON p.id = s.participant_id
     WHERE p.deleted_at IS NULL
     ORDER BY s.${column} DESC LIMIT ?`
  )
    .bind(limit)
    .all();

  return (rows.results ?? []).map((row, index) => ({
    rank: index + 1,
    nickname: row.nickname,
    value: row.value,
  }));
}

// 4.6 DELETE /participants/me
export async function requestDeletion(request, env, origin) {
  const deviceToken = bearerToken(request);
  const participant = await findParticipantByDeviceToken(env, deviceToken);
  if (!participant) {
    return errorResponse('INVALID_DEVICE_TOKEN', '백업을 이용해 복구해 주세요.', 401, origin);
  }

  const now = new Date();
  const graceDays = Number(env.DELETION_GRACE_PERIOD_DAYS || 3);
  const scheduledDeletionAt = new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000).toISOString();

  await env.DB.prepare('UPDATE participants SET deleted_at = ?, updated_at = ? WHERE id = ?')
    .bind(now.toISOString(), now.toISOString(), participant.id)
    .run();

  return jsonResponse({ status: 'PENDING_DELETION', scheduledDeletionAt }, 202, origin);
}

/**
 * 유예 기간이 지난 탈퇴 참여자를 완전 삭제한다.
 * Cron Trigger 또는 다른 요청 처리 중 지연 삭제로 호출한다 (API_SPEC §4.6).
 */
export async function purgeExpiredDeletions(env) {
  const graceDays = Number(env.DELETION_GRACE_PERIOD_DAYS || 3);
  const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000).toISOString();

  const expired = await env.DB.prepare(
    'SELECT id FROM participants WHERE deleted_at IS NOT NULL AND deleted_at <= ?'
  )
    .bind(cutoff)
    .all();

  for (const row of expired.results ?? []) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM daily_learning WHERE participant_id = ?').bind(row.id),
      env.DB.prepare('DELETE FROM participant_stats WHERE participant_id = ?').bind(row.id),
      env.DB.prepare('DELETE FROM participants WHERE id = ?').bind(row.id),
    ]);
  }

  return expired.results?.length ?? 0;
}

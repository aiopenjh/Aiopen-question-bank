// 엔드포인트 핸들러
// Reference: docs/ranking/RANKING_API_SPEC.md §4, §5, §6

import { errorResponse, isoNow, jsonResponse, randomToken, sha256Hex, todaySeoul, validateNickname } from './util.mjs';

const CONSISTENCY_MIN = 3;
// 참여자별 /sync/today 최소 호출 간격. 참여자·IP 단위 호출 제한(API_SPEC §5)의 최소 구현.
const SYNC_MIN_INTERVAL_MS = 10_000;

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
    'SELECT id FROM participants WHERE nickname = ? AND deleted_at IS NULL'
  )
    .bind(check.nickname)
    .first();
  if (existing) {
    return errorResponse('NICKNAME_TAKEN', '이미 사용 중인 닉네임입니다.', 409, origin);
  }

  const participantId = randomToken('pt');
  const deviceToken = randomToken('dt');
  const recoveryToken = randomToken('rt');
  const now = isoNow();

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

  const studyDate = todaySeoul();
  const now = isoNow();

  const recent = await env.DB.prepare(
    'SELECT last_sync_at FROM daily_learning WHERE participant_id = ? AND study_date = ?'
  )
    .bind(participant.id, studyDate)
    .first();
  if (recent && Date.now() - new Date(recent.last_sync_at).getTime() < SYNC_MIN_INTERVAL_MS) {
    return errorResponse('RATE_LIMITED', '잠시 후 다시 시도해 주세요.', 429, origin);
  }

  const existing = await env.DB.prepare(
    'SELECT * FROM daily_learning WHERE participant_id = ? AND study_date = ?'
  )
    .bind(participant.id, studyDate)
    .first();

  const newSolvedCount = Math.max(existing?.solved_count ?? 0, solvedCount);
  const qualified = newSolvedCount >= CONSISTENCY_MIN;
  const wasQualifiedBefore = !!existing?.qualified_consistency;

  await env.DB.prepare(
    `INSERT INTO daily_learning (participant_id, study_date, solved_count, qualified_consistency, last_sync_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (participant_id, study_date)
     DO UPDATE SET solved_count = excluded.solved_count,
                   qualified_consistency = excluded.qualified_consistency,
                   last_sync_at = excluded.last_sync_at`
  )
    .bind(participant.id, studyDate, newSolvedCount, qualified ? 1 : 0, now)
    .run();

  const stats = await recomputeStats(env, participant.id, studyDate, qualified, wasQualifiedBefore);

  return jsonResponse(
    {
      studyDate,
      solvedCount: newSolvedCount,
      qualifiedConsistency: qualified,
      totalSolved: stats.total_solved,
      currentStreak: stats.current_streak,
      solvedRank: await rankOf(env, 'total_solved', participant.id),
      consistencyRank: await rankOf(env, 'current_streak', participant.id),
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
async function recomputeStats(env, participantId, studyDate, qualifiedToday, wasQualifiedBefore) {
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

  // qualifiedToday && !wasQualifiedBefore: 오늘 새로 자격을 얻었으므로 스트릭을 이어붙이거나 새로 시작한다.
  // 그 외 경우(자격 유지/미달)는 currentStreak을 그대로 둔다 (재연동으로 3문제 미만 하락은
  // 클라이언트가 보내지 않는 한 발생하지 않고, 과도한 조작 방지는 초기 범위 밖 - FEATURE_PLAN §9).
  if (qualifiedToday && !wasQualifiedBefore) {
    const yesterday = addDaysToDateString(studyDate, -1);
    currentStreak = lastQualifiedDate === yesterday ? currentStreak + 1 : 1;
  }

  const bestStreak = Math.max(statsRow?.best_streak ?? 0, currentStreak);
  const newLastQualifiedDate = qualifiedToday ? studyDate : lastQualifiedDate;
  const now = isoNow();

  await env.DB.prepare(
    `INSERT INTO participant_stats (participant_id, total_solved, current_streak, best_streak, last_qualified_date, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (participant_id)
     DO UPDATE SET total_solved = excluded.total_solved,
                   current_streak = excluded.current_streak,
                   best_streak = excluded.best_streak,
                   last_qualified_date = excluded.last_qualified_date,
                   updated_at = excluded.updated_at`
  )
    .bind(participantId, totalSolved, currentStreak, bestStreak, newLastQualifiedDate, now)
    .run();

  return { total_solved: totalSolved, current_streak: currentStreak };
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

// 4.4 GET /leaderboard
export async function getLeaderboard(request, env, origin) {
  const mostSolved = await env.DB.prepare(
    `SELECT p.nickname, s.total_solved FROM participant_stats s
     JOIN participants p ON p.id = s.participant_id
     WHERE p.deleted_at IS NULL
     ORDER BY s.total_solved DESC LIMIT 1`
  ).first();

  const mostConsistent = await env.DB.prepare(
    `SELECT p.nickname, s.current_streak FROM participant_stats s
     JOIN participants p ON p.id = s.participant_id
     WHERE p.deleted_at IS NULL
     ORDER BY s.current_streak DESC LIMIT 1`
  ).first();

  return jsonResponse(
    {
      mostSolved: mostSolved
        ? { nickname: mostSolved.nickname, totalSolved: mostSolved.total_solved }
        : null,
      mostConsistent: mostConsistent
        ? { nickname: mostConsistent.nickname, currentStreak: mostConsistent.current_streak }
        : null,
      updatedAt: isoNow(),
    },
    200,
    origin
  );
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

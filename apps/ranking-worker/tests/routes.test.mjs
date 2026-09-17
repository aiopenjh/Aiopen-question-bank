import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerParticipant,
  recoverParticipant,
  syncToday,
  getLeaderboard,
  requestDeletion,
  purgeExpiredDeletions,
} from '../src/routes.mjs';
import { createMockD1 } from './mock-d1.mjs';

function makeEnv(overrides = {}) {
  return {
    DB: createMockD1(),
    DAILY_SOLVED_COUNT_MAX: '500',
    DELETION_GRACE_PERIOD_DAYS: '3',
    ...overrides,
  };
}

function jsonRequest(body, headers = {}) {
  return new Request('https://example.test/', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

async function register(env, nickname = '테스터') {
  const res = await registerParticipant(jsonRequest({ nickname }), env, null);
  return res.json();
}

/** 서버는 요청의 localDate가 아니라 자기 시계의 서울 날짜에 기록한다. 테스트도 같은 기준을 써야 한다. */
function seoulDate(offsetDays = 0) {
  const base = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(base);
}

test('닉네임 중복 등록은 NICKNAME_TAKEN 409', async () => {
  const env = makeEnv();
  await register(env, '중복이');
  const res = await registerParticipant(jsonRequest({ nickname: '중복이' }), env, null);
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error.code, 'NICKNAME_TAKEN');
});

test('같은 날 재연동은 MAX 규칙으로 갱신되고 총합이 부풀지 않는다 (2문제 -> 4문제)', async () => {
  const env = makeEnv();
  const participant = await register(env);

  const first = await syncToday(
    jsonRequest({ localDate: '2026-09-16', solvedCount: 2 }, { Authorization: `Bearer ${participant.deviceToken}` }),
    env,
    null
  );
  const firstBody = await first.json();
  assert.equal(firstBody.solvedCount, 2);
  assert.equal(firstBody.qualifiedConsistency, false);
  assert.equal(firstBody.totalSolved, 2);

  // 최소 호출 간격 제한을 우회하기 위해 daily_learning의 last_sync_at을 과거로 되돌린다 (테스트 전용).
  const key = `${participant.participantId}::${seoulDate()}`;
  env.DB._stores.dailyLearning.get(key).last_sync_at = new Date(Date.now() - 60_000).toISOString();

  const second = await syncToday(
    jsonRequest({ localDate: '2026-09-16', solvedCount: 4 }, { Authorization: `Bearer ${participant.deviceToken}` }),
    env,
    null
  );
  const secondBody = await second.json();
  assert.equal(secondBody.solvedCount, 4, '완료 수 4가 반영되어야 한다 (계획서 §8 완료 기준)');
  assert.equal(secondBody.qualifiedConsistency, true, '4문제는 꾸준함 인정');
  assert.equal(secondBody.totalSolved, 4, '같은 날 재연동은 누적되지 않고 MAX로 갱신');
  assert.equal(secondBody.currentStreak, 1, '꾸준함 1일이 반영되어야 한다 (계획서 §8 완료 기준)');
});

test('같은 날 짧은 간격 재연동은 RATE_LIMITED 429', async () => {
  const env = makeEnv();
  const participant = await register(env);
  await syncToday(
    jsonRequest({ localDate: '2026-09-16', solvedCount: 3 }, { Authorization: `Bearer ${participant.deviceToken}` }),
    env,
    null
  );
  const res = await syncToday(
    jsonRequest({ localDate: '2026-09-16', solvedCount: 5 }, { Authorization: `Bearer ${participant.deviceToken}` }),
    env,
    null
  );
  assert.equal(res.status, 429);
  const body = await res.json();
  assert.equal(body.error.code, 'RATE_LIMITED');
});

test('solvedCount가 일일 상한을 초과하면 COUNT_OUT_OF_RANGE 422', async () => {
  const env = makeEnv();
  const participant = await register(env);
  const res = await syncToday(
    jsonRequest({ localDate: '2026-09-16', solvedCount: 501 }, { Authorization: `Bearer ${participant.deviceToken}` }),
    env,
    null
  );
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.error.code, 'COUNT_OUT_OF_RANGE');
});

test('잘못된 deviceToken은 INVALID_DEVICE_TOKEN 401', async () => {
  const env = makeEnv();
  const res = await syncToday(
    jsonRequest({ localDate: '2026-09-16', solvedCount: 3 }, { Authorization: 'Bearer dt_unknown_token' }),
    env,
    null
  );
  assert.equal(res.status, 401);
});

test('연속 학습일: 이틀 연속 3문제 이상이면 streak 2', async () => {
  const env = makeEnv();
  const participant = await register(env);

  // 서버가 todaySeoul()로 오늘 날짜를 직접 계산하므로, 연속 이틀을 만들려면
  // daily_learning에 "어제" 기록을 직접 심어 recomputeStats의 스트릭 이어붙임을 검증한다.
  const todayStr = seoulDate();
  const yesterdayStr = seoulDate(-1);

  env.DB._stores.dailyLearning.set(`${participant.participantId}::${yesterdayStr}`, {
    participant_id: participant.participantId,
    study_date: yesterdayStr,
    solved_count: 3,
    qualified_consistency: 1,
    last_sync_at: new Date(Date.now() - 60_000).toISOString(),
  });
  env.DB._stores.participantStats.set(participant.participantId, {
    participant_id: participant.participantId,
    total_solved: 3,
    current_streak: 1,
    best_streak: 1,
    last_qualified_date: yesterdayStr,
    updated_at: new Date().toISOString(),
  });

  const res = await syncToday(
    jsonRequest({ localDate: todayStr, solvedCount: 3 }, { Authorization: `Bearer ${participant.deviceToken}` }),
    env,
    null
  );
  const body = await res.json();
  assert.equal(body.currentStreak, 2, '어제도 자격을 얻었다면 오늘 이어서 2일 연속');
});

test('연속 학습일: 어제 끊겼으면 오늘 자격을 얻어도 streak는 1로 새로 시작', async () => {
  const env = makeEnv();
  const participant = await register(env);

  const todayStr = seoulDate();
  const twoDaysAgoStr = seoulDate(-2);

  // 그저께는 자격을 얻었지만 어제는 기록이 없어 연속이 끊긴 상태.
  env.DB._stores.participantStats.set(participant.participantId, {
    participant_id: participant.participantId,
    total_solved: 5,
    current_streak: 4,
    best_streak: 4,
    last_qualified_date: twoDaysAgoStr,
    updated_at: new Date().toISOString(),
  });

  const res = await syncToday(
    jsonRequest({ localDate: todayStr, solvedCount: 3 }, { Authorization: `Bearer ${participant.deviceToken}` }),
    env,
    null
  );
  const body = await res.json();
  assert.equal(body.currentStreak, 1, '연속이 끊긴 뒤 다시 자격을 얻으면 새 연속 기록(1일)이 시작되어야 한다 (계획서 §5.2)');
});

test('복구: participantId+recoveryToken 일치 시 새 deviceToken 발급', async () => {
  const env = makeEnv();
  const participant = await register(env);
  const res = await recoverParticipant(
    jsonRequest({ participantId: participant.participantId, recoveryToken: participant.recoveryToken }),
    env,
    null
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.notEqual(body.deviceToken, participant.deviceToken);
  assert.equal(body.nickname, participant.nickname);
});

test('복구: 잘못된 recoveryToken은 INVALID_DEVICE_TOKEN 401', async () => {
  const env = makeEnv();
  const participant = await register(env);
  const res = await recoverParticipant(
    jsonRequest({ participantId: participant.participantId, recoveryToken: 'rt_틀림' }),
    env,
    null
  );
  assert.equal(res.status, 401);
});

test('탈퇴: 요청 시 PENDING_DELETION이며 즉시 리더보드에서 제외된다', async () => {
  const env = makeEnv();
  const participant = await register(env, '탈퇴예정자');
  await syncToday(
    jsonRequest({ localDate: '2026-09-16', solvedCount: 5 }, { Authorization: `Bearer ${participant.deviceToken}` }),
    env,
    null
  );

  const delRes = await requestDeletion(
    new Request('https://example.test/', { headers: { Authorization: `Bearer ${participant.deviceToken}` } }),
    env,
    null
  );
  assert.equal(delRes.status, 202);
  const delBody = await delRes.json();
  assert.equal(delBody.status, 'PENDING_DELETION');
  assert.ok(delBody.scheduledDeletionAt);

  const board = await (await getLeaderboard(null, env, null)).json();
  assert.equal(board.mostSolved.length, 0, '탈퇴 요청 즉시 공개 랭킹에서 제외되어야 한다');
});

test('탈퇴: 유예 기간 중 복구를 시도하면 탈퇴가 취소된다', async () => {
  const env = makeEnv();
  const participant = await register(env, '마음바뀐사람');
  await requestDeletion(
    new Request('https://example.test/', { headers: { Authorization: `Bearer ${participant.deviceToken}` } }),
    env,
    null
  );
  assert.ok(env.DB._stores.participants.get(participant.participantId).deleted_at);

  await recoverParticipant(
    jsonRequest({ participantId: participant.participantId, recoveryToken: participant.recoveryToken }),
    env,
    null
  );
  assert.equal(
    env.DB._stores.participants.get(participant.participantId).deleted_at,
    null,
    '복구 시도로 탈퇴 요청이 취소되어야 한다 (FEATURE_PLAN §10 확정 정책)'
  );
});

test('purgeExpiredDeletions: 유예 기간이 지난 참여자만 완전 삭제된다', async () => {
  const env = makeEnv();
  const expired = await register(env, '오래된탈퇴자');
  const recent = await register(env, '방금탈퇴자');

  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  env.DB._stores.participants.get(expired.participantId).deleted_at = fourDaysAgo;
  env.DB._stores.participants.get(recent.participantId).deleted_at = oneDayAgo;

  const purgedCount = await purgeExpiredDeletions(env);
  assert.equal(purgedCount, 1);
  assert.equal(env.DB._stores.participants.has(expired.participantId), false, '3일 지난 참여자는 삭제');
  assert.equal(env.DB._stores.participants.has(recent.participantId), true, '유예 기간 중인 참여자는 유지');
});

test('리더보드: 참여자가 없으면 빈 목록을 반환한다', async () => {
  const env = makeEnv();
  const board = await (await getLeaderboard(null, env, null)).json();
  assert.deepEqual(board.mostSolved, []);
  assert.deepEqual(board.mostConsistent, []);
});

test('리더보드: limit을 주면 상위 N명을 순위 순으로 반환한다 (랭킹 창용)', async () => {
  const env = makeEnv();
  // 서로 다른 누적 문제 수를 가진 참여자 3명을 만든다.
  const fixtures = [
    { nickname: '일등', total: 30, streak: 2 },
    { nickname: '이등', total: 20, streak: 9 },
    { nickname: '삼등', total: 10, streak: 5 },
  ];
  for (const f of fixtures) {
    const p = await register(env, f.nickname);
    env.DB._stores.participantStats.set(p.participantId, {
      participant_id: p.participantId,
      total_solved: f.total,
      current_streak: f.streak,
      best_streak: f.streak,
      last_qualified_date: '2026-09-16',
      updated_at: new Date().toISOString(),
    });
  }

  const listRequest = new Request('https://example.test/v1/leaderboard?limit=10');
  const board = await (await getLeaderboard(listRequest, env, null)).json();

  assert.deepEqual(
    board.mostSolved.map((r) => [r.rank, r.nickname, r.value]),
    [
      [1, '일등', 30],
      [2, '이등', 20],
      [3, '삼등', 10],
    ],
    '최다 문제 풀이는 누적 수 내림차순'
  );
  assert.deepEqual(
    board.mostConsistent.map((r) => [r.rank, r.nickname, r.value]),
    [
      [1, '이등', 9],
      [2, '삼등', 5],
      [3, '일등', 2],
    ],
    '꾸준함은 연속일 내림차순으로 별도 집계 (두 항목은 서로 독립, FEATURE_PLAN §10)'
  );
});

test('리더보드: limit 없이 호출하면 1위만 반환한다 (메인 화면 카드용)', async () => {
  const env = makeEnv();
  for (const [nickname, total] of [['많이푼사람', 40], ['조금푼사람', 5]]) {
    const p = await register(env, nickname);
    env.DB._stores.participantStats.set(p.participantId, {
      participant_id: p.participantId,
      total_solved: total,
      current_streak: 1,
      best_streak: 1,
      last_qualified_date: '2026-09-16',
      updated_at: new Date().toISOString(),
    });
  }

  const board = await (await getLeaderboard(null, env, null)).json();
  assert.equal(board.mostSolved.length, 1);
  assert.equal(board.mostSolved[0].nickname, '많이푼사람');
});

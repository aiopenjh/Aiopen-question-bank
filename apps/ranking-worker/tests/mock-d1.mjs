// D1 최소 모의 구현. wrangler dev/실제 SQLite 없이 routes.mjs의 SQL을
// node --test로 검증하기 위한 것. 이 프로젝트가 실제로 쓰는 4가지 쿼리
// 형태(SELECT 1건/목록, INSERT ... ON CONFLICT DO UPDATE, UPDATE, DELETE)
// 만 지원한다 - 새 SQL 패턴을 쓰면 이 파일도 함께 늘어난다.

export function createMockD1() {
  const participants = new Map(); // id -> row
  const dailyLearning = new Map(); // `${participantId}::${studyDate}` -> row
  const participantStats = new Map(); // participantId -> row

  function prepare(sql) {
    return {
      _sql: sql.trim(),
      _params: [],
      bind(...params) {
        this._params = params;
        return this;
      },
      async first() {
        return execute(this._sql, this._params, { participants, dailyLearning, participantStats }).first();
      },
      async run() {
        return execute(this._sql, this._params, { participants, dailyLearning, participantStats }).run();
      },
      async all() {
        return execute(this._sql, this._params, { participants, dailyLearning, participantStats }).all();
      },
    };
  }

  async function batch(statements) {
    const results = [];
    for (const stmt of statements) {
      results.push(await stmt.run());
    }
    return results;
  }

  return { prepare, batch, _stores: { participants, dailyLearning, participantStats } };
}

/** participant_stats 컬럼 3종(total_solved/current_streak/max_killer_level) 중 SQL에 쓰인 것을 고른다. */
function pickStatsColumn(sql) {
  if (sql.includes('total_solved')) return 'total_solved';
  if (sql.includes('max_killer_level')) return 'max_killer_level';
  return 'current_streak';
}

function execute(sql, params, stores) {
  const { participants, dailyLearning, participantStats } = stores;

  if (sql.startsWith('SELECT id, deleted_at FROM participants WHERE nickname') || sql.startsWith('SELECT id FROM participants WHERE nickname')) {
    const [nickname] = params;
    const found = [...participants.values()].find((p) => p.nickname === nickname);
    return { first: async () => (found ? { id: found.id, deleted_at: found.deleted_at } : null) };
  }

  if (sql.startsWith('SELECT * FROM participants WHERE device_token_hash')) {
    const [hash] = params;
    const found = [...participants.values()].find((p) => p.device_token_hash === hash);
    return { first: async () => found ?? null };
  }

  if (sql.startsWith('SELECT * FROM participants WHERE id = ? AND recovery_token_hash')) {
    const [id, hash] = params;
    const found = participants.get(id);
    return { first: async () => (found && found.recovery_token_hash === hash ? found : null) };
  }

  if (sql.startsWith('INSERT INTO participants')) {
    const [id, nickname, recoveryHash, deviceHash, createdAt, updatedAt] = params;
    participants.set(id, {
      id,
      nickname,
      recovery_token_hash: recoveryHash,
      device_token_hash: deviceHash,
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: null,
    });
    return { run: async () => ({ success: true }) };
  }

  if (sql.startsWith('UPDATE participants SET device_token_hash')) {
    const [deviceHash, updatedAt, id] = params;
    const row = participants.get(id);
    if (row) {
      row.device_token_hash = deviceHash;
      row.updated_at = updatedAt;
      row.deleted_at = null;
    }
    return { run: async () => ({ success: true }) };
  }

  if (sql.startsWith('UPDATE participants SET deleted_at')) {
    const [deletedAt, updatedAt, id] = params;
    const row = participants.get(id);
    if (row) {
      row.deleted_at = deletedAt;
      row.updated_at = updatedAt;
    }
    return { run: async () => ({ success: true }) };
  }

  if (sql.startsWith('SELECT last_sync_at FROM daily_learning')) {
    const [participantId, studyDate] = params;
    const row = dailyLearning.get(`${participantId}::${studyDate}`);
    return { first: async () => (row ? { last_sync_at: row.last_sync_at } : null) };
  }

  if (sql.startsWith('SELECT * FROM daily_learning WHERE participant_id')) {
    const [participantId, studyDate] = params;
    const row = dailyLearning.get(`${participantId}::${studyDate}`);
    return { first: async () => row ?? null };
  }

  if (sql.startsWith('INSERT INTO daily_learning')) {
    const [participantId, studyDate, solvedCount, qualified, lastSyncAt] = params;
    dailyLearning.set(`${participantId}::${studyDate}`, {
      participant_id: participantId,
      study_date: studyDate,
      solved_count: solvedCount,
      qualified_consistency: qualified,
      last_sync_at: lastSyncAt,
    });
    return { run: async () => ({ success: true }) };
  }

  if (sql.startsWith('SELECT * FROM participant_stats WHERE participant_id')) {
    const [participantId] = params;
    return { first: async () => participantStats.get(participantId) ?? null };
  }

  if (sql.startsWith('SELECT COALESCE(SUM(solved_count)')) {
    const [participantId] = params;
    let total = 0;
    for (const row of dailyLearning.values()) {
      if (row.participant_id === participantId) total += row.solved_count;
    }
    return { first: async () => ({ total }) };
  }

  if (sql.startsWith('INSERT INTO participant_stats')) {
    const [participantId, totalSolved, currentStreak, bestStreak, lastQualifiedDate, maxKillerLevel, updatedAt] = params;
    participantStats.set(participantId, {
      participant_id: participantId,
      total_solved: totalSolved,
      current_streak: currentStreak,
      best_streak: bestStreak,
      last_qualified_date: lastQualifiedDate,
      max_killer_level: maxKillerLevel,
      updated_at: updatedAt,
    });
    return { run: async () => ({ success: true }) };
  }

  if (sql.includes('FROM participant_stats s') && sql.includes('JOIN participants p')) {
    const column = pickStatsColumn(sql);
    const [limit] = params;
    const rows = [];
    for (const stats of participantStats.values()) {
      const participant = participants.get(stats.participant_id);
      if (!participant || participant.deleted_at) continue;
      rows.push({ nickname: participant.nickname, value: stats[column] });
    }
    rows.sort((a, b) => b.value - a.value);
    return { all: async () => ({ results: rows.slice(0, limit) }) };
  }

  if (sql.startsWith('SELECT COUNT(*) + 1 AS rank')) {
    const column = pickStatsColumn(sql);
    const [participantId] = params;
    const mine = participantStats.get(participantId);
    const myValue = mine ? mine[column] : 0;
    let higherCount = 0;
    for (const stats of participantStats.values()) {
      if (stats[column] > myValue) higherCount += 1;
    }
    return { first: async () => ({ rank: higherCount + 1 }) };
  }

  if (sql.startsWith('SELECT id FROM participants WHERE deleted_at IS NOT NULL')) {
    const [cutoff] = params;
    const expired = [...participants.values()].filter((p) => p.deleted_at && p.deleted_at <= cutoff);
    return { all: async () => ({ results: expired.map((p) => ({ id: p.id })) }) };
  }

  if (sql.startsWith('DELETE FROM daily_learning WHERE participant_id')) {
    const [participantId] = params;
    for (const key of [...dailyLearning.keys()]) {
      if (key.startsWith(`${participantId}::`)) dailyLearning.delete(key);
    }
    return { run: async () => ({ success: true }) };
  }

  if (sql.startsWith('DELETE FROM participant_stats WHERE participant_id')) {
    const [participantId] = params;
    participantStats.delete(participantId);
    return { run: async () => ({ success: true }) };
  }

  if (sql.startsWith('DELETE FROM participants WHERE id')) {
    const [id] = params;
    participants.delete(id);
    return { run: async () => ({ success: true }) };
  }

  throw new Error(`mock-d1: 지원하지 않는 쿼리입니다: ${sql}`);
}

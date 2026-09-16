-- Celueste Ranking Worker - initial schema
-- Reference: docs/ranking/RANKING_API_SPEC.md §2

CREATE TABLE participants (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL UNIQUE,
  recovery_token_hash TEXT NOT NULL,
  device_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX idx_participants_device_token_hash ON participants (device_token_hash);
CREATE INDEX idx_participants_recovery_token_hash ON participants (recovery_token_hash);
CREATE INDEX idx_participants_deleted_at ON participants (deleted_at);

CREATE TABLE daily_learning (
  participant_id TEXT NOT NULL REFERENCES participants (id),
  study_date TEXT NOT NULL,
  solved_count INTEGER NOT NULL,
  qualified_consistency INTEGER NOT NULL, -- 0/1
  last_sync_at TEXT NOT NULL,
  PRIMARY KEY (participant_id, study_date)
);

CREATE TABLE participant_stats (
  participant_id TEXT PRIMARY KEY REFERENCES participants (id),
  total_solved INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  last_qualified_date TEXT,
  updated_at TEXT NOT NULL
);

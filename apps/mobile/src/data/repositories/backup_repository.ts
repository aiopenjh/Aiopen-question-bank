/**
 * Backup & Restore Repository
 * Reference: CogniQuest_개발명세_v1 (R11, T14 준수)
 */

import AsyncStorage from '../app_storage';
import {
  Profile,
  RoutineRevision,
  Topic,
  Source,
  SourceRevision,
  SourceChunk,
  TopicSourceLink,
  Unit,
  LearningSpec,
  QuestionRevision,
  StudySession,
  SessionItem,
  Attempt,
  ReviewState,
  ManualCompletion,
  RankingProfile,
  RankingRecoverySeed,
} from '../../contracts/types';
import type { AlarmConfig } from '../../utils/notifications';
import { STORAGE_KEYS, CURRENT_DB_VERSION, getCurrentISOTime } from '../storage_keys';

export interface AppBackupPayload {
  version: number;
  exportedAt: string;
  profile: Profile | null;
  routine: RoutineRevision | null;
  topics: Topic[];
  sources: Source[];
  sourceRevisions: SourceRevision[];
  sourceChunks: SourceChunk[];
  topicSourceLinks: TopicSourceLink[];
  units: Unit[];
  learningSpecs: LearningSpec[];
  questions: QuestionRevision[];
  sessions: StudySession[];
  sessionItems: SessionItem[];
  attempts: Attempt[];
  reviewStates: ReviewState[];
  manualCompletions: ManualCompletion[];
  preferredModel: string | null;
  lastStudiedTopicId: string | null;
  customNoteQuestionIds: string[];
  alarmConfig?: AlarmConfig | null;
  /**
   * 랭킹 참여 복구 정보. rankingRecoveryToken이 포함된 백업 파일은
   * 랭킹 계정을 복구할 수 있는 민감한 파일이다 (내보내기 안내에 표시할 것).
   * deviceToken은 제외: 새 기기 복구 시 POST /participants/recover로 재발급받는다.
   */
  rankingNickname: string | null;
  rankingParticipantId: string | null;
  rankingRecoveryToken: string | null;
}

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
type JsonRecord = Record<string, unknown>;

// API_KEY is intentionally absent. It must never enter either backup or restore.
const BACKUP_STORAGE_KEYS = [
  STORAGE_KEYS.PROFILE,
  STORAGE_KEYS.ROUTINE,
  STORAGE_KEYS.TOPICS,
  STORAGE_KEYS.SOURCES,
  STORAGE_KEYS.SOURCE_REVISIONS,
  STORAGE_KEYS.SOURCE_CHUNKS,
  STORAGE_KEYS.TOPIC_SOURCE_LINKS,
  STORAGE_KEYS.UNITS,
  STORAGE_KEYS.LEARNING_SPECS,
  STORAGE_KEYS.QUESTIONS,
  STORAGE_KEYS.SESSIONS,
  STORAGE_KEYS.SESSION_ITEMS,
  STORAGE_KEYS.ATTEMPTS,
  STORAGE_KEYS.REVIEW_STATES,
  STORAGE_KEYS.MANUAL_COMPLETIONS,
  STORAGE_KEYS.PREFERRED_MODEL,
  STORAGE_KEYS.LAST_STUDIED_TOPIC,
  STORAGE_KEYS.CUSTOM_NOTE_QUESTIONS,
  STORAGE_KEYS.ALARM_CONFIG,
  STORAGE_KEYS.RANKING_PROFILE,
] as const;

const RESTORE_STORAGE_KEYS: StorageKey[] = [
  STORAGE_KEYS.DB_VERSION,
  ...BACKUP_STORAGE_KEYS,
  // 백업에는 포함되지 않지만(수출 대상 아님) 복원 중에 새로 쓰므로 롤백 스냅샷에 넣는다.
  STORAGE_KEYS.RANKING_RECOVERY_SEED,
];

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStoredObject<T>(raw: string | null, label: string): T | null {
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error(`${label} 저장 데이터 형식이 올바르지 않습니다.`);
  }
  return parsed as T;
}

function parseStoredArray<T>(raw: string | null, label: string): T[] {
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} 저장 데이터 형식이 올바르지 않습니다.`);
  }
  return parsed as T[];
}

function readOptionalObject<T>(source: JsonRecord, key: string): T | null {
  const value = source[key];
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error(`${key} 필드 형식이 올바르지 않습니다.`);
  }
  return value as T;
}

function readArray<T>(source: JsonRecord, key: string, required = false): T[] {
  const value = source[key];
  if (value === undefined) {
    if (required) throw new Error(`${key} 필드가 없습니다.`);
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => !isRecord(item))) {
    throw new Error(`${key} 필드 형식이 올바르지 않습니다.`);
  }
  return value as T[];
}

function readOptionalString(
  source: JsonRecord,
  key: string,
  legacyKey?: string
): string | null {
  const value = source[key] ?? (legacyKey ? source[legacyKey] : undefined);
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new Error(`${key} 필드 형식이 올바르지 않습니다.`);
  }
  return value;
}

function readStringArray(
  source: JsonRecord,
  key: string,
  legacyKey?: string
): string[] {
  const value = source[key] ?? (legacyKey ? source[legacyKey] : undefined);
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${key} 필드 형식이 올바르지 않습니다.`);
  }
  return value;
}

function readAlarmConfig(source: JsonRecord): AlarmConfig | null | undefined {
  if (!Object.prototype.hasOwnProperty.call(source, 'alarmConfig')) return undefined;
  const value = source.alarmConfig;
  if (value === null) return null;
  if (!isRecord(value)) throw new Error('alarmConfig 필드 형식이 올바르지 않습니다.');

  const allowedDays = new Set(['월', '화', '수', '목', '금', '토', '일']);
  const selectedDays = value.selectedDays;
  const hasMultipleTimes =
    typeof value.enabled === 'boolean' &&
    Array.isArray(value.times) &&
    value.times.every(
      (time) =>
        isRecord(time) &&
        Number.isInteger(time.hour) &&
        Number.isInteger(time.minute) &&
        (time.hour as number) >= 0 &&
        (time.hour as number) <= 23 &&
        (time.minute as number) >= 0 &&
        (time.minute as number) <= 59
    );
  const hasUnifiedTime =
    typeof value.enabled === 'boolean' &&
    Number.isInteger(value.hour) &&
    Number.isInteger(value.minute) &&
    (value.hour as number) >= 0 &&
    (value.hour as number) <= 23 &&
    (value.minute as number) >= 0 &&
    (value.minute as number) <= 59;
  const hasLegacyTime =
    typeof value.morningEnabled === 'boolean' &&
    typeof value.eveningEnabled === 'boolean' &&
    Number.isInteger(value.morningHour) &&
    Number.isInteger(value.eveningHour) &&
    (value.morningHour as number) >= 0 &&
    (value.morningHour as number) <= 23 &&
    (value.eveningHour as number) >= 0 &&
    (value.eveningHour as number) <= 23;
  const isValid =
    (hasMultipleTimes || hasUnifiedTime || hasLegacyTime) &&
    Array.isArray(selectedDays) &&
    selectedDays.every((day) => typeof day === 'string' && allowedDays.has(day));

  if (!isValid) throw new Error('alarmConfig 필드 값이 올바르지 않습니다.');
  return value as unknown as AlarmConfig;
}

function normalizeBackupPayload(value: unknown): AppBackupPayload {
  if (!isRecord(value)) {
    throw new Error('백업 최상위 데이터가 객체 형식이 아닙니다.');
  }

  const version = value.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error('백업 데이터 버전이 올바르지 않습니다.');
  }
  if (version > CURRENT_DB_VERSION) {
    throw new Error('현재 앱보다 새로운 버전에서 생성된 백업입니다. 앱을 먼저 업데이트해 주세요.');
  }

  if (value.exportedAt !== undefined && typeof value.exportedAt !== 'string') {
    throw new Error('exportedAt 필드 형식이 올바르지 않습니다.');
  }

  return {
    version,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : '',
    profile: readOptionalObject<Profile>(value, 'profile'),
    routine: readOptionalObject<RoutineRevision>(value, 'routine'),
    // topics/questions are the two fields present in every historical backup.
    topics: readArray<Topic>(value, 'topics', true),
    sources: readArray<Source>(value, 'sources'),
    sourceRevisions: readArray<SourceRevision>(value, 'sourceRevisions'),
    sourceChunks: readArray<SourceChunk>(value, 'sourceChunks'),
    topicSourceLinks: readArray<TopicSourceLink>(value, 'topicSourceLinks'),
    units: readArray<Unit>(value, 'units'),
    learningSpecs: readArray<LearningSpec>(value, 'learningSpecs'),
    questions: readArray<QuestionRevision>(value, 'questions', true),
    sessions: readArray<StudySession>(value, 'sessions'),
    sessionItems: readArray<SessionItem>(value, 'sessionItems'),
    attempts: readArray<Attempt>(value, 'attempts'),
    reviewStates: readArray<ReviewState>(value, 'reviewStates'),
    manualCompletions: readArray<ManualCompletion>(value, 'manualCompletions'),
    preferredModel: readOptionalString(value, 'preferredModel'),
    lastStudiedTopicId: readOptionalString(value, 'lastStudiedTopicId', 'lastStudiedTopic'),
    customNoteQuestionIds: readStringArray(
      value,
      'customNoteQuestionIds',
      'customNoteQuestions'
    ),
    alarmConfig: readAlarmConfig(value),
    rankingNickname: readOptionalString(value, 'rankingNickname'),
    rankingParticipantId: readOptionalString(value, 'rankingParticipantId'),
    rankingRecoveryToken: readOptionalString(value, 'rankingRecoveryToken'),
  };
}

/** 문제은행과 랭킹 복구에 필요한 정보만 내보낸다. 구형 전체 백업 복원은 유지한다. */
export async function exportBackupJSON(): Promise<string> {
  const entries = await AsyncStorage.multiGet([
    STORAGE_KEYS.TOPICS,
    STORAGE_KEYS.UNITS,
    STORAGE_KEYS.LEARNING_SPECS,
    STORAGE_KEYS.QUESTIONS,
    STORAGE_KEYS.RANKING_PROFILE,
  ]);
  const stored = new Map(entries);

  const rankingProfile = parseStoredObject<RankingProfile>(
    stored.get(STORAGE_KEYS.RANKING_PROFILE) ?? null,
    '랭킹 참여 정보'
  );

  const payload = {
    version: CURRENT_DB_VERSION,
    exportedAt: getCurrentISOTime(),
    topics: parseStoredArray<Topic>(stored.get(STORAGE_KEYS.TOPICS) ?? null, '과목'),
    units: parseStoredArray<Unit>(stored.get(STORAGE_KEYS.UNITS) ?? null, '단원'),
    learningSpecs: parseStoredArray<LearningSpec>(
      stored.get(STORAGE_KEYS.LEARNING_SPECS) ?? null,
      '학습 명세'
    ),
    questions: parseStoredArray<QuestionRevision>(
      stored.get(STORAGE_KEYS.QUESTIONS) ?? null,
      '문제'
    ),
    rankingNickname: rankingProfile?.nickname ?? null,
    rankingParticipantId: rankingProfile?.participantId ?? null,
    rankingRecoveryToken: rankingProfile?.recoveryToken ?? null,
  };

  return JSON.stringify(payload, null, 2);
}

async function rollbackStorage(
  snapshot: ReadonlyArray<readonly [string, string | null]>
): Promise<void> {
  const previousValues: [string, string][] = [];
  const previouslyMissingKeys: string[] = [];

  for (const [key, value] of snapshot) {
    if (value === null) previouslyMissingKeys.push(key);
    else previousValues.push([key, value]);
  }

  if (previousValues.length > 0) await AsyncStorage.multiSet(previousValues);
  if (previouslyMissingKeys.length > 0) await AsyncStorage.multiRemove(previouslyMissingKeys);
}

/**
 * 백업 JSON 전체 사전 검증 및 교체 복원.
 * 저장 중 실패하면 복원 대상 키의 이전 스냅샷으로 되돌린다.
 */
export async function restoreBackupJSON(
  jsonString: string
): Promise<{ success: boolean; message: string }> {
  let payload: AppBackupPayload;
  try {
    payload = normalizeBackupPayload(JSON.parse(jsonString));
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : '알 수 없는 형식 오류';
    return {
      success: false,
      message: `백업 파일 형식이 올바르지 않거나 손상되었습니다: ${detail} 기존 데이터는 변경되지 않았습니다.`,
    };
  }

  let snapshot: ReadonlyArray<readonly [string, string | null]>;
  try {
    snapshot = await AsyncStorage.multiGet(RESTORE_STORAGE_KEYS);
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : '알 수 없는 저장소 오류';
    return {
      success: false,
      message: `기존 데이터를 안전하게 보관하지 못해 복원을 시작하지 않았습니다: ${detail}`,
    };
  }
  const valuesToWrite: [string, string][] = [
    [STORAGE_KEYS.DB_VERSION, payload.version.toString()],
    [STORAGE_KEYS.TOPICS, JSON.stringify(payload.topics)],
    [STORAGE_KEYS.SOURCES, JSON.stringify(payload.sources)],
    [STORAGE_KEYS.SOURCE_REVISIONS, JSON.stringify(payload.sourceRevisions)],
    [STORAGE_KEYS.SOURCE_CHUNKS, JSON.stringify(payload.sourceChunks)],
    [STORAGE_KEYS.TOPIC_SOURCE_LINKS, JSON.stringify(payload.topicSourceLinks)],
    [STORAGE_KEYS.UNITS, JSON.stringify(payload.units)],
    [STORAGE_KEYS.LEARNING_SPECS, JSON.stringify(payload.learningSpecs)],
    [STORAGE_KEYS.QUESTIONS, JSON.stringify(payload.questions)],
    [STORAGE_KEYS.SESSIONS, JSON.stringify(payload.sessions)],
    [STORAGE_KEYS.SESSION_ITEMS, JSON.stringify(payload.sessionItems)],
    [STORAGE_KEYS.ATTEMPTS, JSON.stringify(payload.attempts)],
    [STORAGE_KEYS.REVIEW_STATES, JSON.stringify(payload.reviewStates)],
    [STORAGE_KEYS.MANUAL_COMPLETIONS, JSON.stringify(payload.manualCompletions)],
    [STORAGE_KEYS.CUSTOM_NOTE_QUESTIONS, JSON.stringify(payload.customNoteQuestionIds)],
  ];
  const keysToRemove: string[] = [];

  const addOptionalValue = (key: StorageKey, value: object | string | null) => {
    if (value === null) {
      keysToRemove.push(key);
    } else {
      valuesToWrite.push([key, typeof value === 'string' ? value : JSON.stringify(value)]);
    }
  };

  addOptionalValue(STORAGE_KEYS.PROFILE, payload.profile);
  addOptionalValue(STORAGE_KEYS.ROUTINE, payload.routine);
  addOptionalValue(STORAGE_KEYS.PREFERRED_MODEL, payload.preferredModel);
  addOptionalValue(STORAGE_KEYS.LAST_STUDIED_TOPIC, payload.lastStudiedTopicId);
  if (payload.alarmConfig !== undefined) {
    addOptionalValue(STORAGE_KEYS.ALARM_CONFIG, payload.alarmConfig);
  }
  // rankingRecoveryToken은 로컬 프로필을 직접 복원하지 않는다 (deviceToken이 백업에 없음).
  // 대신 복구 재료를 남겨두면, 랭킹 창이 POST /participants/recover로
  // 새 deviceToken을 발급받아 참여자 복구를 완료한다 (탈퇴하지 않았다면 서버 계정은 그대로다).
  if (payload.rankingParticipantId && payload.rankingRecoveryToken) {
    const seed: RankingRecoverySeed = {
      nickname: payload.rankingNickname ?? '',
      participantId: payload.rankingParticipantId,
      recoveryToken: payload.rankingRecoveryToken,
    };
    valuesToWrite.push([STORAGE_KEYS.RANKING_RECOVERY_SEED, JSON.stringify(seed)]);
  }

  try {
    await AsyncStorage.multiSet(valuesToWrite);
    if (keysToRemove.length > 0) await AsyncStorage.multiRemove(keysToRemove);
    const rankingNote =
      payload.rankingParticipantId && payload.rankingRecoveryToken
        ? ' 랭킹 창을 열면 이 백업의 랭킹 계정을 복구할 수 있습니다.'
        : '';
    return {
      success: true,
      message: `백업에 담긴 학습 데이터가 복원되었습니다.${rankingNote}`,
    };
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : '알 수 없는 저장 오류';
    try {
      await rollbackStorage(snapshot);
      return {
        success: false,
        message: `복원 저장 중 오류가 발생해 기존 데이터로 되돌렸습니다: ${detail}`,
      };
    } catch (rollbackError: unknown) {
      const rollbackDetail = rollbackError instanceof Error
        ? rollbackError.message
        : '알 수 없는 롤백 오류';
      return {
        success: false,
        message: `복원과 원상 복구 중 오류가 발생했습니다. 복원 오류: ${detail} / 원상 복구 오류: ${rollbackDetail}`,
      };
    }
  }
}

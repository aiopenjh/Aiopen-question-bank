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

export type BackupKind = 'question-bank' | 'full';

export interface AppBackupPayload {
  backupKind: BackupKind;
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

const QUESTION_BANK_RESTORE_KEYS: StorageKey[] = [
  STORAGE_KEYS.TOPICS,
  STORAGE_KEYS.UNITS,
  STORAGE_KEYS.LEARNING_SPECS,
  STORAGE_KEYS.QUESTIONS,
];

const LEGACY_FULL_BACKUP_FIELDS = [
  'profile',
  'routine',
  'sources',
  'sourceRevisions',
  'sourceChunks',
  'topicSourceLinks',
  'sessions',
  'sessionItems',
  'attempts',
  'reviewStates',
  'manualCompletions',
  'preferredModel',
  'lastStudiedTopicId',
  'lastStudiedTopic',
  'customNoteQuestionIds',
  'customNoteQuestions',
  'alarmConfig',
] as const;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBackupKind(source: JsonRecord): BackupKind {
  if (source.backupKind !== undefined) {
    if (source.backupKind === 'question-bank' || source.backupKind === 'full') {
      return source.backupKind;
    }
    throw new Error('backupKind 필드 값이 올바르지 않습니다.');
  }

  // backupKind 도입 전 전체 백업은 아래 필드를 명시적으로 포함했다.
  // 축소 문제은행 백업은 이 필드들을 아예 내보내지 않았으므로 구분할 수 있다.
  return LEGACY_FULL_BACKUP_FIELDS.some((key) =>
    Object.prototype.hasOwnProperty.call(source, key)
  )
    ? 'full'
    : 'question-bank';
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
    backupKind: readBackupKind(value),
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

export interface BackupInspection {
  backupKind: BackupKind;
  exportedAt: string;
  includesRankingRecovery: boolean;
}

export function inspectBackupJSON(jsonString: string): BackupInspection {
  const payload = normalizeBackupPayload(JSON.parse(jsonString));
  return {
    backupKind: payload.backupKind,
    exportedAt: payload.exportedAt,
    includesRankingRecovery: !!(
      payload.rankingParticipantId && payload.rankingRecoveryToken
    ),
  };
}

/**
 * 문제은행 공유용 백업은 문제 구성만 담고, 전체 백업은 기기 이전·장애 복구용 데이터를 담는다.
 * API 키는 두 형식 모두 의도적으로 제외한다.
 */
export async function exportBackupJSON(
  backupKind: BackupKind = 'question-bank'
): Promise<string> {
  const keys = backupKind === 'full'
    ? [...BACKUP_STORAGE_KEYS]
    : [
        STORAGE_KEYS.TOPICS,
        STORAGE_KEYS.UNITS,
        STORAGE_KEYS.LEARNING_SPECS,
        STORAGE_KEYS.QUESTIONS,
      ];
  const entries = await AsyncStorage.multiGet(keys);
  const stored = new Map(entries);

  const questionBankPayload = {
    backupKind: 'question-bank' as const,
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
  };

  if (backupKind === 'question-bank') {
    return JSON.stringify(questionBankPayload, null, 2);
  }

  const rankingProfile = parseStoredObject<RankingProfile>(
    stored.get(STORAGE_KEYS.RANKING_PROFILE) ?? null,
    '랭킹 참여 정보'
  );
  const payload: AppBackupPayload = {
    ...questionBankPayload,
    backupKind: 'full',
    profile: parseStoredObject<Profile>(stored.get(STORAGE_KEYS.PROFILE) ?? null, '프로필'),
    routine: parseStoredObject<RoutineRevision>(
      stored.get(STORAGE_KEYS.ROUTINE) ?? null,
      '학습 루틴'
    ),
    sources: parseStoredArray<Source>(stored.get(STORAGE_KEYS.SOURCES) ?? null, '학습 자료'),
    sourceRevisions: parseStoredArray<SourceRevision>(
      stored.get(STORAGE_KEYS.SOURCE_REVISIONS) ?? null,
      '학습 자료 버전'
    ),
    sourceChunks: parseStoredArray<SourceChunk>(
      stored.get(STORAGE_KEYS.SOURCE_CHUNKS) ?? null,
      '학습 자료 본문'
    ),
    topicSourceLinks: parseStoredArray<TopicSourceLink>(
      stored.get(STORAGE_KEYS.TOPIC_SOURCE_LINKS) ?? null,
      '과목 자료 연결'
    ),
    sessions: parseStoredArray<StudySession>(
      stored.get(STORAGE_KEYS.SESSIONS) ?? null,
      '학습 세션'
    ),
    sessionItems: parseStoredArray<SessionItem>(
      stored.get(STORAGE_KEYS.SESSION_ITEMS) ?? null,
      '학습 세션 문제'
    ),
    attempts: parseStoredArray<Attempt>(stored.get(STORAGE_KEYS.ATTEMPTS) ?? null, '풀이 기록'),
    reviewStates: parseStoredArray<ReviewState>(
      stored.get(STORAGE_KEYS.REVIEW_STATES) ?? null,
      '복습 상태'
    ),
    manualCompletions: parseStoredArray<ManualCompletion>(
      stored.get(STORAGE_KEYS.MANUAL_COMPLETIONS) ?? null,
      '수동 완료 기록'
    ),
    preferredModel: stored.get(STORAGE_KEYS.PREFERRED_MODEL) ?? null,
    lastStudiedTopicId: stored.get(STORAGE_KEYS.LAST_STUDIED_TOPIC) ?? null,
    customNoteQuestionIds: parseStoredArray<string>(
      stored.get(STORAGE_KEYS.CUSTOM_NOTE_QUESTIONS) ?? null,
      '나만의 오답노트'
    ),
    alarmConfig: parseStoredObject<AlarmConfig>(
      stored.get(STORAGE_KEYS.ALARM_CONFIG) ?? null,
      '알람 설정'
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
 * 백업 JSON 전체 사전 검증 후 종류에 맞게 복원한다.
 * 문제은행 백업은 문제 구성만 교체하고 기존 학습 기록·자료·설정을 유지한다.
 * 전체 백업은 API 키를 제외한 로컬 데이터를 교체한다.
 * 저장 중 실패하면 실제 복원 대상 키의 이전 스냅샷으로 되돌린다.
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

  const isFullBackup = payload.backupKind === 'full';
  const restoreStorageKeys = isFullBackup
    ? [
        ...RESTORE_STORAGE_KEYS,
        STORAGE_KEYS.RANKING_SYNC_QUEUE,
      ]
    : QUESTION_BANK_RESTORE_KEYS;

  let snapshot: ReadonlyArray<readonly [string, string | null]>;
  try {
    snapshot = await AsyncStorage.multiGet(restoreStorageKeys);
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : '알 수 없는 저장소 오류';
    return {
      success: false,
      message: `기존 데이터를 안전하게 보관하지 못해 복원을 시작하지 않았습니다: ${detail}`,
    };
  }
  const valuesToWrite: [string, string][] = [
    [STORAGE_KEYS.TOPICS, JSON.stringify(payload.topics)],
    [STORAGE_KEYS.UNITS, JSON.stringify(payload.units)],
    [STORAGE_KEYS.LEARNING_SPECS, JSON.stringify(payload.learningSpecs)],
    [STORAGE_KEYS.QUESTIONS, JSON.stringify(payload.questions)],
  ];
  const keysToRemove: string[] = [];

  const addOptionalValue = (key: StorageKey, value: object | string | null) => {
    if (value === null) {
      keysToRemove.push(key);
    } else {
      valuesToWrite.push([key, typeof value === 'string' ? value : JSON.stringify(value)]);
    }
  };

  if (isFullBackup) {
    valuesToWrite.push(
      [STORAGE_KEYS.DB_VERSION, payload.version.toString()],
      [STORAGE_KEYS.SOURCES, JSON.stringify(payload.sources)],
      [STORAGE_KEYS.SOURCE_REVISIONS, JSON.stringify(payload.sourceRevisions)],
      [STORAGE_KEYS.SOURCE_CHUNKS, JSON.stringify(payload.sourceChunks)],
      [STORAGE_KEYS.TOPIC_SOURCE_LINKS, JSON.stringify(payload.topicSourceLinks)],
      [STORAGE_KEYS.SESSIONS, JSON.stringify(payload.sessions)],
      [STORAGE_KEYS.SESSION_ITEMS, JSON.stringify(payload.sessionItems)],
      [STORAGE_KEYS.ATTEMPTS, JSON.stringify(payload.attempts)],
      [STORAGE_KEYS.REVIEW_STATES, JSON.stringify(payload.reviewStates)],
      [STORAGE_KEYS.MANUAL_COMPLETIONS, JSON.stringify(payload.manualCompletions)],
      [STORAGE_KEYS.CUSTOM_NOTE_QUESTIONS, JSON.stringify(payload.customNoteQuestionIds)]
    );

    addOptionalValue(STORAGE_KEYS.PROFILE, payload.profile);
    addOptionalValue(STORAGE_KEYS.ROUTINE, payload.routine);
    addOptionalValue(STORAGE_KEYS.PREFERRED_MODEL, payload.preferredModel);
    addOptionalValue(STORAGE_KEYS.LAST_STUDIED_TOPIC, payload.lastStudiedTopicId);
    if (payload.alarmConfig !== undefined) {
      addOptionalValue(STORAGE_KEYS.ALARM_CONFIG, payload.alarmConfig);
    }

    // deviceToken은 기기 전용이므로 기존 랭킹 프로필/대기열을 그대로 쓰지 않는다.
    keysToRemove.push(STORAGE_KEYS.RANKING_PROFILE, STORAGE_KEYS.RANKING_SYNC_QUEUE);
    // 복구 토큰은 전체 백업에서만 새 기기용 seed로 전환한다.
    if (payload.rankingParticipantId && payload.rankingRecoveryToken) {
      const seed: RankingRecoverySeed = {
        nickname: payload.rankingNickname ?? '',
        participantId: payload.rankingParticipantId,
        recoveryToken: payload.rankingRecoveryToken,
      };
      valuesToWrite.push([STORAGE_KEYS.RANKING_RECOVERY_SEED, JSON.stringify(seed)]);
    } else {
      keysToRemove.push(STORAGE_KEYS.RANKING_RECOVERY_SEED);
    }
  }

  try {
    await AsyncStorage.multiSet(valuesToWrite);
    if (keysToRemove.length > 0) await AsyncStorage.multiRemove(keysToRemove);
    const rankingNote =
      isFullBackup && payload.rankingParticipantId && payload.rankingRecoveryToken
        ? ' 랭킹 창을 열면 이 백업의 랭킹 계정을 복구할 수 있습니다.'
        : '';
    return {
      success: true,
      message: isFullBackup
        ? `전체 백업의 학습 데이터가 복원되었습니다.${rankingNote}`
        : '문제은행이 복원되었습니다. 기존 풀이·복습·교재·설정 데이터는 유지했습니다.',
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

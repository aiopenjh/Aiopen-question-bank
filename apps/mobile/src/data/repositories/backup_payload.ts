/**
 * 백업 JSON 형식 판정·정규화. 저장소 입출력은 backup_repository.ts가 맡는다.
 */

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
  AttemptCorrection,
  ReviewState,
  ManualCompletion,
} from '../../contracts/types';
import { normalizeAlarmConfig, type AlarmConfig } from '../../utils/notifications';
import { filterCorrectionsForAttempts, normalizeAttemptCorrections } from '../../domain/attempt_outcome';
import { normalizeStoredQuestions } from '../../domain/question_integrity';
import { CURRENT_DB_VERSION } from '../storage_keys';

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
  /** 사용자 정정 기록(전체 백업만). 원래 채점 attempts는 그대로이며, 없는 구형 백업은 빈 목록으로 복원한다. */
  attemptCorrections: AttemptCorrection[];
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

type JsonRecord = Record<string, unknown>;

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

export function parseStoredObject<T>(raw: string | null, label: string): T | null {
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error(`${label} 저장 데이터 형식이 올바르지 않습니다.`);
  }
  return parsed as T;
}

export function parseStoredArray<T>(raw: string | null, label: string): T[] {
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
  const hasValidSelectedDays =
    selectedDays === undefined ||
    (Array.isArray(selectedDays) &&
      selectedDays.every((day) => typeof day === 'string' && allowedDays.has(day)));
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
    (hasMultipleTimes || hasUnifiedTime || hasLegacyTime) && hasValidSelectedDays;

  if (!isValid) throw new Error('alarmConfig 필드 값이 올바르지 않습니다.');
  return normalizeAlarmConfig(value as Partial<AlarmConfig>);
}

export function normalizeBackupPayload(value: unknown): AppBackupPayload {
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

  const attempts = readArray<Attempt>(value, 'attempts');
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
    questions: normalizeStoredQuestions(readArray<QuestionRevision>(value, 'questions', true)),
    sessions: readArray<StudySession>(value, 'sessions'),
    sessionItems: readArray<SessionItem>(value, 'sessionItems'),
    attempts,
    // 형식이 틀리면 복원을 거부하고, 이 백업의 풀이 기록과 맞지 않는 고아 정정은 제외한다.
    attemptCorrections: filterCorrectionsForAttempts(
      normalizeAttemptCorrections(value.attemptCorrections),
      attempts
    ),
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

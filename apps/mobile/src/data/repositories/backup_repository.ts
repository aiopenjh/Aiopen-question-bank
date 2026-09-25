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
  AttemptCorrection,
  ReviewState,
  ManualCompletion,
  RankingProfile,
  RankingRecoverySeed,
} from '../../contracts/types';
import type { AlarmConfig } from '../../utils/notifications';
import { filterCorrectionsForAttempts } from '../../domain/attempt_outcome';
import { STORAGE_KEYS, CURRENT_DB_VERSION, getCurrentISOTime } from '../storage_keys';
import {
  normalizeBackupPayload,
  parseStoredArray,
  parseStoredObject,
  type AppBackupPayload,
  type BackupKind,
} from './backup_payload';

export { inspectBackupJSON } from './backup_payload';
export type { AppBackupPayload, BackupInspection, BackupKind } from './backup_payload';

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

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
  STORAGE_KEYS.ATTEMPT_CORRECTIONS,
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

  const storedAttempts = parseStoredArray<Attempt>(stored.get(STORAGE_KEYS.ATTEMPTS) ?? null, '풀이 기록');
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
    attempts: storedAttempts,
    attemptCorrections: filterCorrectionsForAttempts(
      parseStoredArray<AttemptCorrection>(stored.get(STORAGE_KEYS.ATTEMPT_CORRECTIONS) ?? null, '사용자 정정 기록'),
      storedAttempts
    ),
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
      [STORAGE_KEYS.ATTEMPT_CORRECTIONS, JSON.stringify(payload.attemptCorrections)],
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

    // 복구 가능한 랭킹 정보가 있을 때만 현재 기기 연결을 백업 계정으로 전환한다.
    // 토큰 없는 전체 백업이 현재 기기의 유효한 랭킹 연결을 지우면 복구할 수 없으므로
    // 기존 프로필·대기열·seed를 그대로 유지한다.
    if (payload.rankingParticipantId && payload.rankingRecoveryToken) {
      keysToRemove.push(STORAGE_KEYS.RANKING_PROFILE, STORAGE_KEYS.RANKING_SYNC_QUEUE);
      const seed: RankingRecoverySeed = {
        nickname: payload.rankingNickname ?? '',
        participantId: payload.rankingParticipantId,
        recoveryToken: payload.rankingRecoveryToken,
      };
      valuesToWrite.push([STORAGE_KEYS.RANKING_RECOVERY_SEED, JSON.stringify(seed)]);
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

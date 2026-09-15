import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  serializeStorage,
  recoverStorageJournal,
  writeStorageTransaction,
} from './storageTransaction';
import { validateDraft, validateQuestion } from './db';

// Export an explicit allow-list; API credentials and device permission state never enter a backup.
const collections: Record<string, string> = {
  topics: 'topics',
  units: 'units',
  questions: 'questions',
  attempts: 'attempts',
  reviewStates: 'review_states',
  manualCompletions: 'manual_completions',
  sources: 'sources',
  sourceRevisions: 'source_revisions',
  sourceChunks: 'source_chunks',
  learningSpecs: 'learning_specs',
  sessions: 'sessions',
  sessionItems: 'session_items',
};
const key = (name: string) => `@cogniquest:${name}`;
const legacyMissingCollections = new Set([
  'sources', 'sourceRevisions', 'sourceChunks', 'learningSpecs', 'sessions', 'sessionItems',
]);

async function read(name: string, fallback: unknown) {
  const raw = await AsyncStorage.getItem(key(name));
  return raw === null ? fallback : JSON.parse(raw);
}

export async function exportBackupJSON(): Promise<string> {
  return serializeStorage(async () => {
    await recoverStorageJournal();
    const payload: Record<string, unknown> = {
      version: 3,
      exportedAt: new Date().toISOString(),
    };
    for (const [field, storage] of Object.entries(collections)) {
      payload[field] = await read(storage, []);
    }
    payload.profile = await read('profile', null);
    payload.routine = await read('routine', null);
    payload.activeExam = await read('active_exam', null);
    payload.settings = {
      preferredModel: await AsyncStorage.getItem(key('preferred_ai_model')) || '',
      lastStudiedTopic: await AsyncStorage.getItem(key('last_studied_topic')),
    };
    return JSON.stringify(payload, null, 2);
  });
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isTimestamp(value: unknown): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)
    && isDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}

function isTimezone(value: unknown): boolean {
  if (!isId(value)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function validateBackup(payload: any): void {
  const invalid = () => {
    throw new Error('백업 구조 또는 자료 내용이 올바르지 않습니다. 기존 자료를 변경하지 않았습니다.');
  };
  if (!payload || ![2, 3].includes(payload.version)) invalid();

  const { profile, routine } = payload;
  if (!profile || !isId(profile.id) || !isId(profile.displayName)
    || !isTimezone(profile.timezone) || !isTimestamp(profile.createdAt)) invalid();
  if (!isTimestamp(payload.exportedAt)) invalid();

  if (routine !== null) {
    const validPresets = ['mon_wed_fri', 'weekdays', 'weekends', 'daily', 'custom'];
    if (!routine || !isId(routine.id) || routine.ownerId !== profile.id
      || !validPresets.includes(routine.preset) || !isTimezone(routine.timezone)
      || !isDate(routine.effectiveDate) || !Array.isArray(routine.activeDays)
      || routine.activeDays.some((day: unknown) => !Number.isInteger(day) || Number(day) < 0 || Number(day) > 6)
      || new Set(routine.activeDays).size !== routine.activeDays.length
      || typeof routine.preferredTime !== 'string'
      || !/^([01]\d|2[0-3]):[0-5]\d$/.test(routine.preferredTime)
      || !Number.isInteger(routine.targetQuestionCount) || routine.targetQuestionCount < 1) invalid();
  }

  const requiredStrings: Record<string, string[]> = {
    topics: ['id', 'ownerId', 'name', 'description'],
    units: ['id', 'topicId', 'title'],
    questions: ['id', 'stem', 'answerOptionId', 'explanation'],
    attempts: ['id', 'submissionKey', 'answerOptionId', 'submittedAt'],
    reviewStates: ['ownerId', 'questionRevisionId', 'dueDate', 'lastAttemptId'],
    manualCompletions: ['ownerId', 'unitId', 'changedAt'],
    sources: ['id', 'ownerId', 'kind', 'title'],
    sourceRevisions: ['id', 'sourceId', 'hash'],
    sourceChunks: ['id', 'revisionId', 'rawText', 'normalizedText'],
    learningSpecs: ['id', 'topicId'],
    sessions: ['id', 'topicId'],
    sessionItems: ['id', 'sessionId', 'questionRevisionId'],
  };
  for (const field of Object.keys(collections)) {
    // Legacy exports had no source/session collections. Restore replaces, never mixes profiles.
    if (payload.version === 2 && legacyMissingCollections.has(field)) payload[field] = [];
    if (!Array.isArray(payload[field])) invalid();
    const ids = new Set<string>();
    for (const row of payload[field]) {
      if (!row || typeof row !== 'object'
        || requiredStrings[field].some(name => typeof row[name] !== 'string')) invalid();
      if (requiredStrings[field].includes('id') && (!isId(row.id) || ids.has(row.id))) invalid();
      if (row.id) ids.add(row.id);
    }
  }

  if (payload.topics.some((topic: any) => topic.learnerLevel !== undefined
    && !['beginner', 'basic', 'advanced', 'master'].includes(topic.learnerLevel))) invalid();
  payload.questions.forEach(validateQuestion);
  if (payload.attempts.some((attempt: any) => typeof attempt.isCorrect !== 'boolean' || !isTimestamp(attempt.submittedAt))
    || payload.reviewStates.some((review: any) => !Number.isInteger(review.stage) || review.stage < 0 || review.stage > 5 || !isDate(review.dueDate))
    || payload.manualCompletions.some((completion: any) => typeof completion.completed !== 'boolean' || !isTimestamp(completion.changedAt))) invalid();
  if (payload.learningSpecs.some((spec: any) => !Array.isArray(spec.unitIds)
    || spec.unitIds.some((id: unknown) => !isId(id))
    || !Array.isArray(spec.sourceRevisionIds) || spec.sourceRevisionIds.some((id: unknown) => !isId(id)))) invalid();

  const sourceIds = new Set(payload.sources.map((source: any) => source.id));
  const revisionIds = new Set(payload.sourceRevisions.map((revision: any) => revision.id));
  if (payload.sources.some((source: any) => typeof source.allowExternalProcessing !== 'boolean')
    || payload.sourceRevisions.some((revision: any) => !sourceIds.has(revision.sourceId))
    || payload.sourceChunks.some((chunk: any) => !revisionIds.has(chunk.revisionId)
      || !chunk.locator || typeof chunk.locator.kind !== 'string')) invalid();

  if (payload.version === 2) {
    payload.activeExam = null;
    payload.settings = { preferredModel: '', lastStudiedTopic: null };
  }
  if (payload.activeExam != null) validateDraft(payload.activeExam);
  if (!payload.settings || typeof payload.settings.preferredModel !== 'string'
    || (payload.settings.lastStudiedTopic !== null && !isId(payload.settings.lastStudiedTopic))) invalid();
}

export async function restoreBackupJSON(jsonString: string): Promise<{ success: boolean; message: string }> {
  return serializeStorage(async () => {
    try {
      await recoverStorageJournal();
      const payload = JSON.parse(jsonString);
      validateBackup(payload);
      const writes: [string, string | null][] = Object.entries(collections).map(
        ([field, storage]) => [key(storage), JSON.stringify(payload[field])],
      );
      writes.push(
        [key('profile'), JSON.stringify(payload.profile)],
        [key('routine'), JSON.stringify(payload.routine)],
        [key('active_exam'), payload.activeExam ? JSON.stringify(payload.activeExam) : null],
        [key('preferred_ai_model'), payload.settings.preferredModel],
        [key('last_studied_topic'), payload.settings.lastStudiedTopic],
        [key('db_version'), '3'],
      );
      await writeStorageTransaction(writes);
      return {
        success: true,
        message: payload.version === 2
          ? '학습 기록을 복원했습니다. 구형 백업에 없는 자료와 진행 중 시험은 기존 자료와 혼합되지 않도록 비웠습니다. API 키는 유지됩니다.'
          : '자료·학습 기록·진행 중 시험·설정을 복원했습니다. API 키는 유지되며 알림은 다시 예약해야 합니다.',
      };
    } catch (error: any) {
      return { success: false, message: error?.message || '백업 복원에 실패했습니다.' };
    }
  });
}

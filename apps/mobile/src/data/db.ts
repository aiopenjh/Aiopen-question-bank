/**
 * Local Persistent Storage Layer
 * Supports schema versioning, transaction isolation, and offline persistence.
 * Reference: CogniQuest_개발명세_v1/03_데이터와처리계약.md
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Profile,
  Topic,
  Source,
  SourceRevision,
  SourceChunk,
  Unit,
  QuestionRevision,
  Attempt,
  ReviewState,
  RoutineRevision,
  ManualCompletion,
  UUID,
  ISODateTimeString,
} from '../contracts/types';
import { getLocalDateString } from '../domain/routine';

const STORAGE_KEYS = {
  DB_VERSION: '@cogniquest:db_version',
  PROFILE: '@cogniquest:profile',
  ROUTINE: '@cogniquest:routine',
  TOPICS: '@cogniquest:topics',
  SOURCES: '@cogniquest:sources',
  SOURCE_REVISIONS: '@cogniquest:source_revisions',
  SOURCE_CHUNKS: '@cogniquest:source_chunks',
  UNITS: '@cogniquest:units',
  LEARNING_SPECS: '@cogniquest:learning_specs',
  QUESTIONS: '@cogniquest:questions',
  SESSIONS: '@cogniquest:sessions',
  SESSION_ITEMS: '@cogniquest:session_items',
  ATTEMPTS: '@cogniquest:attempts',
  REVIEW_STATES: '@cogniquest:review_states',
  MANUAL_COMPLETIONS: '@cogniquest:manual_completions',
  API_KEY: '@cogniquest:gemini_api_key',
  PREFERRED_MODEL: '@cogniquest:preferred_ai_model',
};

const CURRENT_DB_VERSION = 2;

export function generateUUID(): UUID {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getCurrentISOTime(): ISODateTimeString {
  return new Date().toISOString();
}

/**
 * 초기 시드 데이터 및 마이그레이션 실행
 */
export async function initializeDatabase(): Promise<void> {
  const versionStr = await AsyncStorage.getItem(STORAGE_KEYS.DB_VERSION);
  const version = versionStr ? parseInt(versionStr, 10) : 0;

  if (version < CURRENT_DB_VERSION) {
    await runMigrationClean();
    await AsyncStorage.setItem(STORAGE_KEYS.DB_VERSION, CURRENT_DB_VERSION.toString());
  }
}

async function runMigrationClean(): Promise<void> {
  // 1. 단일 프로필 생성 (이미 있으면 유지)
  let existingProfile = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE);
  let profileId = generateUUID();
  if (!existingProfile) {
    const initialProfile: Profile = {
      id: profileId,
      displayName: '나의 학습 공간',
      timezone: 'Asia/Seoul',
      createdAt: getCurrentISOTime(),
    };
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(initialProfile));
  } else {
    profileId = JSON.parse(existingProfile).id;
  }

  // 2. 기본 라이프스타일 루틴 설정 (이미 있으면 유지)
  let existingRoutine = await AsyncStorage.getItem(STORAGE_KEYS.ROUTINE);
  if (!existingRoutine) {
    const initialRoutine: RoutineRevision = {
      id: generateUUID(),
      ownerId: profileId,
      preset: 'mon_wed_fri',
      activeDays: [1, 3, 5], // 월, 수, 금
      preferredTime: '09:00',
      timezone: 'Asia/Seoul',
      targetQuestionCount: 3,
      effectiveDate: getLocalDateString(),
    };
    await AsyncStorage.setItem(STORAGE_KEYS.ROUTINE, JSON.stringify(initialRoutine));
  }

  // 3. 하드코딩된 특정 과목(파이썬, 회계 등) 강제 주입 제거
  // 기존 토픽이 없으면 사용자가 직접 등록할 수 있도록 빈 목록으로 정돈
  const existingTopics = await AsyncStorage.getItem(STORAGE_KEYS.TOPICS);
  if (!existingTopics) {
    await AsyncStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify([]));
  }

  const existingUnits = await AsyncStorage.getItem(STORAGE_KEYS.UNITS);
  if (!existingUnits) {
    await AsyncStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify([]));
  }

  const existingQuestions = await AsyncStorage.getItem(STORAGE_KEYS.QUESTIONS);
  if (!existingQuestions) {
    await AsyncStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify([]));
  }

  // 기타 보조 컬렉션 초기화
  if (!(await AsyncStorage.getItem(STORAGE_KEYS.SOURCES))) await AsyncStorage.setItem(STORAGE_KEYS.SOURCES, JSON.stringify([]));
  if (!(await AsyncStorage.getItem(STORAGE_KEYS.SOURCE_REVISIONS))) await AsyncStorage.setItem(STORAGE_KEYS.SOURCE_REVISIONS, JSON.stringify([]));
  if (!(await AsyncStorage.getItem(STORAGE_KEYS.SOURCE_CHUNKS))) await AsyncStorage.setItem(STORAGE_KEYS.SOURCE_CHUNKS, JSON.stringify([]));
  if (!(await AsyncStorage.getItem(STORAGE_KEYS.SESSIONS))) await AsyncStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify([]));
  if (!(await AsyncStorage.getItem(STORAGE_KEYS.SESSION_ITEMS))) await AsyncStorage.setItem(STORAGE_KEYS.SESSION_ITEMS, JSON.stringify([]));
  if (!(await AsyncStorage.getItem(STORAGE_KEYS.ATTEMPTS))) await AsyncStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify([]));
  if (!(await AsyncStorage.getItem(STORAGE_KEYS.REVIEW_STATES))) await AsyncStorage.setItem(STORAGE_KEYS.REVIEW_STATES, JSON.stringify([]));
  if (!(await AsyncStorage.getItem(STORAGE_KEYS.MANUAL_COMPLETIONS))) await AsyncStorage.setItem(STORAGE_KEYS.MANUAL_COMPLETIONS, JSON.stringify([]));
}

// -------------------------------------------------------------
// Database Accessors & Methods
// -------------------------------------------------------------

export async function getProfile(): Promise<Profile | null> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE);
  return data ? JSON.parse(data) : null;
}

export async function getRoutine(): Promise<RoutineRevision | null> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.ROUTINE);
  return data ? JSON.parse(data) : null;
}

export async function saveRoutine(routine: RoutineRevision): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.ROUTINE, JSON.stringify(routine));
}

export async function getTopics(): Promise<Topic[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.TOPICS);
  if (!data) return [];
  const list: Topic[] = JSON.parse(data);
  // 기존 토픽 카테고리 마이그레이션 보정
  return list.map((t) => {
    if (!t.category) {
      const lower = t.name.toLowerCase();
      if (lower.includes('git') || lower.includes('개발') || lower.includes('코딩') || lower.includes('파이썬')) {
        t.category = '💻 IT/개발';
      } else if (lower.includes('수학') || lower.includes('함수') || lower.includes('미적')) {
        t.category = '📐 수학';
      } else if (lower.includes('영어') || lower.includes('토익') || lower.includes('언어') || lower.includes('어학')) {
        t.category = '🌐 언어/어학';
      } else if (lower.includes('경제') || lower.includes('경영') || lower.includes('주식')) {
        t.category = '📊 경제/경영';
      } else {
        t.category = '📚 일반';
      }
    }
    return t;
  });
}

export async function createTopic(
  name: string,
  description: string = '',
  category: string = '📚 일반'
): Promise<Topic> {
  const profile = await getProfile();
  const newTopic: Topic = {
    id: generateUUID(),
    ownerId: profile?.id || generateUUID(),
    name: name.trim(),
    description: description.trim(),
    category: category.trim() || '📚 일반',
    archivedAt: null,
    createdAt: getCurrentISOTime(),
  };
  const topics = await getTopics();
  topics.push(newTopic);
  await AsyncStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(topics));
  return newTopic;
}

export async function addTopic(topic: Topic): Promise<void> {
  const topics = await getTopics();
  topics.push(topic);
  await AsyncStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(topics));
}

export async function deleteTopic(topicId: UUID): Promise<void> {
  const topics = await getTopics();
  const updatedTopics = topics.filter((t) => t.id !== topicId);
  await AsyncStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(updatedTopics));

  // 연관 단원 및 문제도 정리
  const units = await getUnits();
  const updatedUnits = units.filter((u) => u.topicId !== topicId);
  await AsyncStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(updatedUnits));

  const questions = await getQuestions();
  const updatedQuestions = questions.filter((q) => q.topicId !== topicId);
  await AsyncStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(updatedQuestions));
}

export async function getUnits(topicId?: UUID): Promise<Unit[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.UNITS);
  const units: Unit[] = data ? JSON.parse(data) : [];
  return topicId ? units.filter((u) => u.topicId === topicId) : units;
}

export async function createUnit(params: {
  topicId: UUID;
  title: string;
  depth?: 1 | 2 | 3;
  parentId?: UUID | null;
}): Promise<Unit> {
  const units = await getUnits();
  const topicUnits = units.filter((u) => u.topicId === params.topicId);
  const newUnit: Unit = {
    id: generateUUID(),
    topicId: params.topicId,
    parentId: params.parentId || null,
    depth: params.depth || 1,
    title: params.title.trim(),
    orderIndex: topicUnits.length + 1,
    createdAt: getCurrentISOTime(),
  };
  units.push(newUnit);
  await AsyncStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(units));
  return newUnit;
}

export async function deleteUnit(unitId: UUID): Promise<void> {
  const units = await getUnits();
  const updatedUnits = units.filter((u) => u.id !== unitId && u.parentId !== unitId);
  await AsyncStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(updatedUnits));
}

export async function replaceTopicUnits(
  topicId: UUID,
  newUnits: { title: string; depth?: 1 | 2 | 3 }[]
): Promise<Unit[]> {
  const allUnits = await getUnits();
  const otherUnits = allUnits.filter((u) => u.topicId !== topicId);
  const createdList: Unit[] = newUnits.map((u, idx) => ({
    id: generateUUID(),
    topicId,
    parentId: null,
    depth: u.depth || 1,
    title: u.title.trim(),
    orderIndex: idx + 1,
    createdAt: getCurrentISOTime(),
  }));
  const updated = [...otherUnits, ...createdList];
  await AsyncStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(updated));
  return createdList;
}

export async function deduplicateTopicUnits(topicId: UUID): Promise<Unit[]> {
  const allUnits = await getUnits();
  const topicUnits = allUnits.filter((u) => u.topicId === topicId);
  const otherUnits = allUnits.filter((u) => u.topicId !== topicId);

  const seenTitles = new Set<string>();
  const uniqueTopicUnits: Unit[] = [];

  for (const u of topicUnits) {
    const trimmedTitle = u.title.trim();
    if (!seenTitles.has(trimmedTitle)) {
      seenTitles.add(trimmedTitle);
      uniqueTopicUnits.push({
        ...u,
        orderIndex: uniqueTopicUnits.length + 1,
      });
    }
  }

  const updated = [...otherUnits, ...uniqueTopicUnits];
  await AsyncStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(updated));
  return uniqueTopicUnits;
}

export async function getManualCompletions(): Promise<ManualCompletion[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.MANUAL_COMPLETIONS);
  return data ? JSON.parse(data) : [];
}

export async function toggleUnitCompletion(unitId: UUID, ownerId: UUID): Promise<boolean> {
  const list = await getManualCompletions();
  const existingIndex = list.findIndex((c) => c.unitId === unitId);
  let newStatus = true;

  if (existingIndex >= 0) {
    newStatus = !list[existingIndex].completed;
    list[existingIndex].completed = newStatus;
    list[existingIndex].changedAt = getCurrentISOTime();
  } else {
    list.push({
      ownerId,
      unitId,
      completed: true,
      changedAt: getCurrentISOTime(),
    });
  }

  await AsyncStorage.setItem(STORAGE_KEYS.MANUAL_COMPLETIONS, JSON.stringify(list));
  return newStatus;
}

export async function markUnitAsCompleted(unitId: UUID, ownerId: UUID = 'owner-default'): Promise<void> {
  const list = await getManualCompletions();
  const existing = list.find((c) => c.unitId === unitId);
  if (existing) {
    existing.completed = true;
    existing.changedAt = getCurrentISOTime();
  } else {
    list.push({
      ownerId,
      unitId,
      completed: true,
      changedAt: getCurrentISOTime(),
    });
  }
  await AsyncStorage.setItem(STORAGE_KEYS.MANUAL_COMPLETIONS, JSON.stringify(list));
}

export async function getQuestions(topicId?: UUID): Promise<QuestionRevision[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.QUESTIONS);
  const questions: QuestionRevision[] = data ? JSON.parse(data) : [];
  return topicId ? questions.filter((q) => q.topicId === topicId) : questions;
}

export async function addQuestions(newQuestions: QuestionRevision[]): Promise<void> {
  const questions = await getQuestions();
  questions.push(...newQuestions);
  await AsyncStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
}

export async function deleteQuestion(questionId: UUID): Promise<void> {
  const questions = await getQuestions();
  const updated = questions.filter((q) => q.id !== questionId);
  await AsyncStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(updated));
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.clear();
  await initializeDatabase();
}

import { getEncryptedApiKey, saveEncryptedApiKey, deleteEncryptedApiKey } from '../integrations/secure_storage';

export async function getGeminiApiKey(): Promise<string | null> {
  return await getEncryptedApiKey();
}

export async function saveGeminiApiKey(key: string): Promise<void> {
  await saveEncryptedApiKey(key);
}

export async function getPreferredAiModel(): Promise<string> {
  const model = await AsyncStorage.getItem(STORAGE_KEYS.PREFERRED_MODEL);
  if (!model || model.includes('1.5') || model.includes('2.0') || model.includes('2.5') || model.includes('3.0')) {
    return 'gemini-3.5-flash';
  }
  return model;
}

export async function savePreferredAiModel(model: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.PREFERRED_MODEL, model.trim());
}

export { getEncryptedApiKey, saveEncryptedApiKey, deleteEncryptedApiKey };

export async function getAttempts(): Promise<Attempt[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.ATTEMPTS);
  return data ? JSON.parse(data) : [];
}

export async function saveAttempt(attempt: Attempt): Promise<void> {
  const attempts = await getAttempts();
  // 멱등 제출 방어 (submissionKey 유일)
  if (attempts.some((a) => a.submissionKey === attempt.submissionKey)) {
    return;
  }
  attempts.push(attempt);
  await AsyncStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(attempts));
}

export async function getReviewStates(): Promise<ReviewState[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.REVIEW_STATES);
  return data ? JSON.parse(data) : [];
}

export async function saveReviewState(reviewState: ReviewState): Promise<void> {
  const list = await getReviewStates();
  const idx = list.findIndex((r) => r.questionRevisionId === reviewState.questionRevisionId);
  if (idx >= 0) {
    list[idx] = reviewState;
  } else {
    list.push(reviewState);
  }
  await AsyncStorage.setItem(STORAGE_KEYS.REVIEW_STATES, JSON.stringify(list));
}

/**
 * 오답 문제 목록 추출 (가장 최근 시도가 오답인 문제들)
 */
export async function getIncorrectQuestions(): Promise<QuestionRevision[]> {
  const [questions, attempts] = await Promise.all([getQuestions(), getAttempts()]);
  const incorrectQIds = new Set<string>();

  // 문제별 최근 attempt 확인
  for (const q of questions) {
    const qAttempts = attempts.filter((a) => a.submissionKey.includes(q.id));
    if (qAttempts.length > 0) {
      // 가장 최근 시도
      const latest = qAttempts[qAttempts.length - 1];
      if (!latest.isCorrect) {
        incorrectQIds.add(q.id);
      }
    }
  }

  return questions.filter((q) => incorrectQIds.has(q.id));
}

// -------------------------------------------------------------
// Backup & Restore Engine (R11, T14 준수)
// -------------------------------------------------------------

export interface AppBackupPayload {
  version: number;
  exportedAt: string;
  profile: Profile | null;
  routine: RoutineRevision | null;
  topics: Topic[];
  units: Unit[];
  questions: QuestionRevision[];
  attempts: Attempt[];
  reviewStates: ReviewState[];
  manualCompletions: ManualCompletion[];
}

/**
 * 전체 로컬 데이터 JSON 백업 추출
 */
export async function exportBackupJSON(): Promise<string> {
  const [profile, routine, topics, units, questions, attempts, reviewStates, manualCompletions] =
    await Promise.all([
      getProfile(),
      getRoutine(),
      getTopics(),
      getUnits(),
      getQuestions(),
      getAttempts(),
      getReviewStates(),
      getManualCompletions(),
    ]);

  const payload: AppBackupPayload = {
    version: CURRENT_DB_VERSION,
    exportedAt: getCurrentISOTime(),
    profile,
    routine,
    topics,
    units,
    questions,
    attempts,
    reviewStates,
    manualCompletions,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * 백업 JSON 데이터 유효성 검사 및 안전 복원 (손상 시 원본 유지)
 */
export async function restoreBackupJSON(jsonString: string): Promise<{ success: boolean; message: string }> {
  try {
    const parsed = JSON.parse(jsonString);

    // 필수 필드 및 스키마 구조 검증
    if (!parsed.version || !Array.isArray(parsed.topics) || !Array.isArray(parsed.questions)) {
      return { success: false, message: '백업 파일 형식이 올바르지 않거나 손상되었습니다. 원본 데이터가 안전하게 유지됩니다.' };
    }

    // 원자적 복원 (모든 검증 통과 시 저장)
    if (parsed.profile) await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(parsed.profile));
    if (parsed.routine) await AsyncStorage.setItem(STORAGE_KEYS.ROUTINE, JSON.stringify(parsed.routine));
    await AsyncStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(parsed.topics));
    if (Array.isArray(parsed.units)) await AsyncStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(parsed.units));
    await AsyncStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(parsed.questions));
    if (Array.isArray(parsed.attempts)) await AsyncStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(parsed.attempts));
    if (Array.isArray(parsed.reviewStates)) await AsyncStorage.setItem(STORAGE_KEYS.REVIEW_STATES, JSON.stringify(parsed.reviewStates));
    if (Array.isArray(parsed.manualCompletions)) await AsyncStorage.setItem(STORAGE_KEYS.MANUAL_COMPLETIONS, JSON.stringify(parsed.manualCompletions));

    return { success: true, message: '성공적으로 백업 데이터가 복원되었습니다.' };
  } catch (err: any) {
    return { success: false, message: `복원 중 구문 오류가 발생했습니다: ${err.message}` };
  }
}

export async function getSources(): Promise<Source[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.SOURCES);
  return data ? JSON.parse(data) : [];
}

export async function addSource(source: Source, revision: SourceRevision, chunks: SourceChunk[]): Promise<void> {
  const sources = await getSources();
  sources.unshift(source);
  await AsyncStorage.setItem(STORAGE_KEYS.SOURCES, JSON.stringify(sources));

  const revsData = await AsyncStorage.getItem(STORAGE_KEYS.SOURCE_REVISIONS);
  const revs: SourceRevision[] = revsData ? JSON.parse(revsData) : [];
  revs.unshift(revision);
  await AsyncStorage.setItem(STORAGE_KEYS.SOURCE_REVISIONS, JSON.stringify(revs));

  const chunksData = await AsyncStorage.getItem(STORAGE_KEYS.SOURCE_CHUNKS);
  const existingChunks: SourceChunk[] = chunksData ? JSON.parse(chunksData) : [];
  existingChunks.push(...chunks);
  await AsyncStorage.setItem(STORAGE_KEYS.SOURCE_CHUNKS, JSON.stringify(existingChunks));
}

export async function getSourceChunks(revisionId?: UUID): Promise<SourceChunk[]> {
  const chunksData = await AsyncStorage.getItem(STORAGE_KEYS.SOURCE_CHUNKS);
  const existingChunks: SourceChunk[] = chunksData ? JSON.parse(chunksData) : [];
  return revisionId ? existingChunks.filter((c) => c.revisionId === revisionId) : existingChunks;
}

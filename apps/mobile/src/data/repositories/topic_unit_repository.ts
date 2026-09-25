/**
 * Topic & Unit Local Storage Repository
 * Reference: CogniQuest_개발명세_v1/03_데이터와처리계약.md
 */

import AsyncStorage from '../app_storage';
import {
  Topic,
  Unit,
  QuestionRevision,
  Profile,
  UUID,
  LearnerKnowledgeLevel,
  LearningSpec,
  StudySession,
  SessionItem,
  Attempt,
  ReviewState,
  ManualCompletion,
  TopicSourceLink,
  AttemptCorrection,
} from '../../contracts/types';
import { STORAGE_KEYS, generateUUID, getCurrentISOTime } from '../storage_keys';
import { legacyLevelToDifficulty, normalizeDifficultyLevel } from '../../domain/difficulty';
import {
  collectReferencedUnitIds,
  filterCorrectionsAfterRemoval,
  planTopicUnitReplacement,
  planUnitDeduplication,
  selectAttemptIdsForQuestions,
} from './unit_reference_plan';

type StorageSnapshot = [string, string | null][];

function parseStoredArray<T>(stored: Map<string, string | null>, key: string): T[] {
  const raw = stored.get(key);
  return raw ? JSON.parse(raw) : [];
}

async function writeWithRollback(
  values: [string, string][],
  snapshot: StorageSnapshot
): Promise<void> {
  try {
    await AsyncStorage.multiSet(values);
  } catch (error) {
    const restoreValues = snapshot.filter((entry): entry is [string, string] => entry[1] !== null);
    const removeKeys = snapshot.filter((entry) => entry[1] === null).map(([key]) => key);
    if (restoreValues.length > 0) await AsyncStorage.multiSet(restoreValues);
    if (removeKeys.length > 0) await AsyncStorage.multiRemove(removeKeys);
    throw error;
  }
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
    t.difficultyLevel = normalizeDifficultyLevel(
      t.difficultyLevel,
      legacyLevelToDifficulty(t.learnerLevel)
    );
    return t;
  });
}

export async function createTopic(
  name: string,
  description: string = '',
  category: string = '📚 일반',
  learnerLevel: LearnerKnowledgeLevel = 'basic',
  difficultyLevel: number = legacyLevelToDifficulty(learnerLevel)
): Promise<Topic> {
  const profileData = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE);
  const profile: Profile | null = profileData ? JSON.parse(profileData) : null;
  const newTopic: Topic = {
    id: generateUUID(),
    ownerId: profile?.id || generateUUID(),
    name: name.trim(),
    description: description.trim(),
    category: category.trim() || '📚 일반',
    learnerLevel,
    difficultyLevel: normalizeDifficultyLevel(difficultyLevel),
    archivedAt: null,
    createdAt: getCurrentISOTime(),
  };
  const topics = await getTopics();
  topics.push(newTopic);
  await AsyncStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(topics));
  return newTopic;
}

export async function createTopicWithUnits(params: {
  name: string;
  description?: string;
  category?: string;
  learnerLevel?: LearnerKnowledgeLevel;
  difficultyLevel?: number;
  units?: { title: string; depth?: 1 | 2 | 3 }[];
}): Promise<{ topic: Topic; units: Unit[] }> {
  const snapshot = await AsyncStorage.multiGet([
    STORAGE_KEYS.PROFILE,
    STORAGE_KEYS.TOPICS,
    STORAGE_KEYS.UNITS,
  ]);
  const stored = new Map(snapshot);
  const profile: Profile | null = stored.get(STORAGE_KEYS.PROFILE)
    ? JSON.parse(stored.get(STORAGE_KEYS.PROFILE) as string)
    : null;
  const topics: Topic[] = stored.get(STORAGE_KEYS.TOPICS)
    ? JSON.parse(stored.get(STORAGE_KEYS.TOPICS) as string)
    : [];
  const allUnits: Unit[] = stored.get(STORAGE_KEYS.UNITS)
    ? JSON.parse(stored.get(STORAGE_KEYS.UNITS) as string)
    : [];
  const learnerLevel = params.learnerLevel || 'basic';
  const topic: Topic = {
    id: generateUUID(),
    ownerId: profile?.id || generateUUID(),
    name: params.name.trim(),
    description: (params.description || '').trim(),
    category: params.category?.trim() || '📚 일반',
    learnerLevel,
    difficultyLevel: normalizeDifficultyLevel(
      params.difficultyLevel,
      legacyLevelToDifficulty(learnerLevel)
    ),
    archivedAt: null,
    createdAt: getCurrentISOTime(),
  };
  const createdUnits: Unit[] = (params.units || [])
    .filter((unit) => unit.title.trim().length > 0)
    .map((unit, index) => ({
      id: generateUUID(),
      topicId: topic.id,
      parentId: null,
      depth: unit.depth || 1,
      title: unit.title.trim(),
      orderIndex: index + 1,
      createdAt: getCurrentISOTime(),
    }));

  await writeWithRollback([
    [STORAGE_KEYS.TOPICS, JSON.stringify([...topics, topic])],
    [STORAGE_KEYS.UNITS, JSON.stringify([...allUnits, ...createdUnits])],
  ], snapshot);

  return { topic, units: createdUnits };
}

export async function addTopic(topic: Topic): Promise<void> {
  const topics = await getTopics();
  topics.push(topic);
  await AsyncStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(topics));
}

export async function updateUnitDifficulty(
  topicId: UUID,
  unitId: UUID,
  difficultyLevel: number
): Promise<void> {
  const units = await getUnits();
  const unit = units.find((item) => item.id === unitId && item.topicId === topicId);
  if (!unit) throw new Error('난이도를 변경할 단원을 찾지 못했습니다.');
  unit.difficultyLevel = normalizeDifficultyLevel(difficultyLevel);
  await AsyncStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(units));
}

export async function deleteTopic(topicId: UUID): Promise<void> {
  const keys = [
    STORAGE_KEYS.TOPICS,
    STORAGE_KEYS.UNITS,
    STORAGE_KEYS.LEARNING_SPECS,
    STORAGE_KEYS.QUESTIONS,
    STORAGE_KEYS.SESSIONS,
    STORAGE_KEYS.SESSION_ITEMS,
    STORAGE_KEYS.ATTEMPTS,
    STORAGE_KEYS.ATTEMPT_CORRECTIONS,
    STORAGE_KEYS.REVIEW_STATES,
    STORAGE_KEYS.MANUAL_COMPLETIONS,
    STORAGE_KEYS.CUSTOM_NOTE_QUESTIONS,
    STORAGE_KEYS.LAST_STUDIED_TOPIC,
    STORAGE_KEYS.TOPIC_SOURCE_LINKS,
  ] as const;
  const snapshot = await AsyncStorage.multiGet([...keys]);
  const stored = new Map(snapshot);

  const topics = parseStoredArray<Topic>(stored, STORAGE_KEYS.TOPICS);
  const units = parseStoredArray<Unit>(stored, STORAGE_KEYS.UNITS);
  const specs = parseStoredArray<LearningSpec>(stored, STORAGE_KEYS.LEARNING_SPECS);
  const questions = parseStoredArray<QuestionRevision>(stored, STORAGE_KEYS.QUESTIONS);
  const sessions = parseStoredArray<StudySession>(stored, STORAGE_KEYS.SESSIONS);
  const sessionItems = parseStoredArray<SessionItem>(stored, STORAGE_KEYS.SESSION_ITEMS);
  const attempts = parseStoredArray<Attempt>(stored, STORAGE_KEYS.ATTEMPTS);
  const corrections = parseStoredArray<AttemptCorrection>(stored, STORAGE_KEYS.ATTEMPT_CORRECTIONS);
  const reviewStates = parseStoredArray<ReviewState>(stored, STORAGE_KEYS.REVIEW_STATES);
  const completions = parseStoredArray<ManualCompletion>(stored, STORAGE_KEYS.MANUAL_COMPLETIONS);
  const customNotes = parseStoredArray<string>(stored, STORAGE_KEYS.CUSTOM_NOTE_QUESTIONS);
  const topicSourceLinks = parseStoredArray<TopicSourceLink>(stored, STORAGE_KEYS.TOPIC_SOURCE_LINKS);

  const removedUnitIds = new Set(units.filter((item) => item.topicId === topicId).map((item) => item.id));
  const removedSpecIds = new Set(specs.filter((item) => item.topicId === topicId).map((item) => item.id));
  const removedQuestionIds = new Set(
    questions.filter((item) => item.topicId === topicId).flatMap((item) => [item.id, item.questionId])
  );
  const removedSessionIds = new Set(
    sessions
      .filter((item) => item.topicId === topicId || removedSpecIds.has(item.specId))
      .map((item) => item.id)
  );
  const removedSessionItemIds = new Set(
    sessionItems
      .filter(
        (item) =>
          removedSessionIds.has(item.sessionId) || removedQuestionIds.has(item.questionRevisionId)
      )
      .map((item) => item.id)
  );
  // 풀이 기록은 submissionKey로 문제를 가리킨다. 다른 과목 문제 ID가 부분 문자열로 겹쳐도 지우지 않는다.
  const removedAttemptIds = selectAttemptIdsForQuestions(
    attempts,
    questions.flatMap((item) => [item.id, item.questionId]),
    removedQuestionIds
  );
  attempts
    .filter((item) => removedSessionItemIds.has(item.sessionItemId))
    .forEach((item) => removedAttemptIds.add(item.id));

  const values: [string, string][] = [
    [STORAGE_KEYS.TOPICS, JSON.stringify(topics.filter((item) => item.id !== topicId))],
    [STORAGE_KEYS.UNITS, JSON.stringify(units.filter((item) => item.topicId !== topicId))],
    [STORAGE_KEYS.LEARNING_SPECS, JSON.stringify(specs.filter((item) => item.topicId !== topicId))],
    [STORAGE_KEYS.QUESTIONS, JSON.stringify(questions.filter((item) => item.topicId !== topicId))],
    [STORAGE_KEYS.SESSIONS, JSON.stringify(sessions.filter((item) => !removedSessionIds.has(item.id)))],
    [STORAGE_KEYS.SESSION_ITEMS, JSON.stringify(sessionItems.filter((item) => !removedSessionItemIds.has(item.id)))],
    [STORAGE_KEYS.ATTEMPTS, JSON.stringify(attempts.filter((item) => !removedAttemptIds.has(item.id)))],
    [
      STORAGE_KEYS.ATTEMPT_CORRECTIONS,
      JSON.stringify(filterCorrectionsAfterRemoval(corrections, removedAttemptIds, removedQuestionIds)),
    ],
    [
      STORAGE_KEYS.REVIEW_STATES,
      JSON.stringify(reviewStates.filter((item) => !removedQuestionIds.has(item.questionRevisionId))),
    ],
    [
      STORAGE_KEYS.MANUAL_COMPLETIONS,
      JSON.stringify(completions.filter((item) => !removedUnitIds.has(item.unitId))),
    ],
    [
      STORAGE_KEYS.CUSTOM_NOTE_QUESTIONS,
      JSON.stringify(customNotes.filter((questionId) => !removedQuestionIds.has(questionId))),
    ],
    [
      STORAGE_KEYS.TOPIC_SOURCE_LINKS,
      JSON.stringify(topicSourceLinks.filter((link) => link.topicId !== topicId)),
    ],
  ];
  if (stored.get(STORAGE_KEYS.LAST_STUDIED_TOPIC) === topicId) {
    values.push([STORAGE_KEYS.LAST_STUDIED_TOPIC, '']);
  }

  await writeWithRollback(values, snapshot);
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
  const keys = [
    STORAGE_KEYS.UNITS,
    STORAGE_KEYS.LEARNING_SPECS,
    STORAGE_KEYS.QUESTIONS,
    STORAGE_KEYS.SESSIONS,
    STORAGE_KEYS.SESSION_ITEMS,
    STORAGE_KEYS.ATTEMPTS,
    STORAGE_KEYS.ATTEMPT_CORRECTIONS,
    STORAGE_KEYS.REVIEW_STATES,
    STORAGE_KEYS.MANUAL_COMPLETIONS,
    STORAGE_KEYS.CUSTOM_NOTE_QUESTIONS,
  ] as const;
  const snapshot = await AsyncStorage.multiGet([...keys]);
  const stored = new Map(snapshot);

  const units = parseStoredArray<Unit>(stored, STORAGE_KEYS.UNITS);
  const removedUnitIds = new Set<UUID>([unitId]);
  let foundChild = true;
  while (foundChild) {
    foundChild = false;
    for (const unit of units) {
      if (unit.parentId && removedUnitIds.has(unit.parentId) && !removedUnitIds.has(unit.id)) {
        removedUnitIds.add(unit.id);
        foundChild = true;
      }
    }
  }

  const specs = parseStoredArray<LearningSpec>(stored, STORAGE_KEYS.LEARNING_SPECS);
  // 삭제 단원만 가리키던 명세만 지운다. 처음부터 단원 지정이 없던 명세는 이 단원과 무관하다.
  const nextSpecs = specs.flatMap((spec) => {
    if (!Array.isArray(spec.unitIds) || !spec.unitIds.some((id) => removedUnitIds.has(id))) return [spec];
    const unitIds = spec.unitIds.filter((id) => !removedUnitIds.has(id));
    return unitIds.length > 0 ? [{ ...spec, unitIds }] : [];
  });
  const nextSpecIds = new Set(nextSpecs.map((spec) => spec.id));
  const removedSpecIds = new Set(specs.filter((spec) => !nextSpecIds.has(spec.id)).map((spec) => spec.id));

  const questions = parseStoredArray<QuestionRevision>(stored, STORAGE_KEYS.QUESTIONS);
  const removedQuestionIds = new Set(
    questions
      .filter((question) => question.unitId && removedUnitIds.has(question.unitId))
      .flatMap((question) => [question.id, question.questionId])
  );
  const sessions = parseStoredArray<StudySession>(stored, STORAGE_KEYS.SESSIONS);
  const removedSessionIds = new Set(
    sessions.filter((session) => removedSpecIds.has(session.specId)).map((session) => session.id)
  );
  const sessionItems = parseStoredArray<SessionItem>(stored, STORAGE_KEYS.SESSION_ITEMS);
  const removedSessionItemIds = new Set(
    sessionItems
      .filter(
        (item) =>
          removedSessionIds.has(item.sessionId) || removedQuestionIds.has(item.questionRevisionId)
      )
      .map((item) => item.id)
  );
  const attempts = parseStoredArray<Attempt>(stored, STORAGE_KEYS.ATTEMPTS);
  const corrections = parseStoredArray<AttemptCorrection>(stored, STORAGE_KEYS.ATTEMPT_CORRECTIONS);
  const reviewStates = parseStoredArray<ReviewState>(stored, STORAGE_KEYS.REVIEW_STATES);
  const completions = parseStoredArray<ManualCompletion>(stored, STORAGE_KEYS.MANUAL_COMPLETIONS);
  const customNotes = parseStoredArray<string>(stored, STORAGE_KEYS.CUSTOM_NOTE_QUESTIONS);
  // 확인 문구의 "관련 풀이 기록": 삭제 문제를 submissionKey로 가리키는 풀이와 그 정정 기록.
  const removedAttemptIds = selectAttemptIdsForQuestions(
    attempts,
    questions.flatMap((question) => [question.id, question.questionId]),
    removedQuestionIds
  );
  attempts
    .filter((attempt) => removedSessionItemIds.has(attempt.sessionItemId))
    .forEach((attempt) => removedAttemptIds.add(attempt.id));

  const values: [string, string][] = [
    [STORAGE_KEYS.UNITS, JSON.stringify(units.filter((unit) => !removedUnitIds.has(unit.id)))],
    [STORAGE_KEYS.LEARNING_SPECS, JSON.stringify(nextSpecs)],
    [
      STORAGE_KEYS.QUESTIONS,
      JSON.stringify(questions.filter((question) => !removedQuestionIds.has(question.id))),
    ],
    [STORAGE_KEYS.SESSIONS, JSON.stringify(sessions.filter((session) => !removedSessionIds.has(session.id)))],
    [
      STORAGE_KEYS.SESSION_ITEMS,
      JSON.stringify(sessionItems.filter((item) => !removedSessionItemIds.has(item.id))),
    ],
    [
      STORAGE_KEYS.ATTEMPTS,
      JSON.stringify(attempts.filter((attempt) => !removedAttemptIds.has(attempt.id))),
    ],
    [
      STORAGE_KEYS.ATTEMPT_CORRECTIONS,
      JSON.stringify(filterCorrectionsAfterRemoval(corrections, removedAttemptIds, removedQuestionIds)),
    ],
    [
      STORAGE_KEYS.REVIEW_STATES,
      JSON.stringify(reviewStates.filter((state) => !removedQuestionIds.has(state.questionRevisionId))),
    ],
    [
      STORAGE_KEYS.MANUAL_COMPLETIONS,
      JSON.stringify(completions.filter((completion) => !removedUnitIds.has(completion.unitId))),
    ],
    [
      STORAGE_KEYS.CUSTOM_NOTE_QUESTIONS,
      JSON.stringify(customNotes.filter((questionId) => !removedQuestionIds.has(questionId))),
    ],
  ];

  await writeWithRollback(values, snapshot);
}

export async function replaceTopicUnits(
  topicId: UUID,
  newUnits: { title: string; depth?: 1 | 2 | 3 }[]
): Promise<Unit[]> {
  // 같은 의미가 확실한 단원은 기존 ID를 유지하고, 대응되지 않아도 기록이 있는 단원은 보존한다.
  // 문제·학습 명세·완료 기록은 수정하지 않으므로 단원 키 하나만 저장한다.
  const stored = new Map(await AsyncStorage.multiGet([
    STORAGE_KEYS.UNITS,
    STORAGE_KEYS.QUESTIONS,
    STORAGE_KEYS.LEARNING_SPECS,
    STORAGE_KEYS.MANUAL_COMPLETIONS,
  ]));
  const allUnits = parseStoredArray<Unit>(stored, STORAGE_KEYS.UNITS);
  const referencedUnitIds = collectReferencedUnitIds(
    parseStoredArray<QuestionRevision>(stored, STORAGE_KEYS.QUESTIONS),
    parseStoredArray<LearningSpec>(stored, STORAGE_KEYS.LEARNING_SPECS),
    parseStoredArray<ManualCompletion>(stored, STORAGE_KEYS.MANUAL_COMPLETIONS)
  );
  const { replaced, topicUnits } = planTopicUnitReplacement({
    topicId,
    currentUnits: allUnits.filter((u) => u.topicId === topicId),
    newUnits,
    referencedUnitIds,
    now: getCurrentISOTime(),
    createId: generateUUID,
  });
  const otherUnits = allUnits.filter((u) => u.topicId !== topicId);
  await AsyncStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify([...otherUnits, ...topicUnits]));
  return replaced;
}

export async function deduplicateTopicUnits(topicId: UUID): Promise<Unit[]> {
  const keys = [
    STORAGE_KEYS.UNITS,
    STORAGE_KEYS.QUESTIONS,
    STORAGE_KEYS.LEARNING_SPECS,
    STORAGE_KEYS.MANUAL_COMPLETIONS,
  ] as const;
  const snapshot = await AsyncStorage.multiGet([...keys]);
  const stored = new Map(snapshot);
  const allUnits = parseStoredArray<Unit>(stored, STORAGE_KEYS.UNITS);
  const plan = planUnitDeduplication({
    topicUnits: allUnits.filter((u) => u.topicId === topicId),
    questions: parseStoredArray<QuestionRevision>(stored, STORAGE_KEYS.QUESTIONS),
    specs: parseStoredArray<LearningSpec>(stored, STORAGE_KEYS.LEARNING_SPECS),
    completions: parseStoredArray<ManualCompletion>(stored, STORAGE_KEYS.MANUAL_COMPLETIONS),
  });
  const otherUnits = allUnits.filter((u) => u.topicId !== topicId);
  const values: [string, string][] = [
    [STORAGE_KEYS.UNITS, JSON.stringify([...otherUnits, ...plan.topicUnits])],
  ];
  // 중복 단원을 지우기 전에 그 단원을 가리키던 기록을 남는 단원으로 함께 옮긴다.
  if (plan.mergedCount > 0) {
    values.push(
      [STORAGE_KEYS.QUESTIONS, JSON.stringify(plan.questions)],
      [STORAGE_KEYS.LEARNING_SPECS, JSON.stringify(plan.specs)],
      [STORAGE_KEYS.MANUAL_COMPLETIONS, JSON.stringify(plan.completions)]
    );
  }
  await writeWithRollback(values, snapshot);
  return plan.topicUnits;
}

export async function getLastStudiedTopicId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.LAST_STUDIED_TOPIC);
  } catch (err) {
    return null;
  }
}

export async function saveLastStudiedTopicId(topicId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_STUDIED_TOPIC, topicId);
  } catch (err) {
    console.error('Failed to save last studied topic id:', err);
  }
}

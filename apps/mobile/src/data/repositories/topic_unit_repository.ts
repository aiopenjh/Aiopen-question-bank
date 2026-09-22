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
} from '../../contracts/types';
import { STORAGE_KEYS, generateUUID, getCurrentISOTime } from '../storage_keys';
import { legacyLevelToDifficulty, normalizeDifficultyLevel } from '../../domain/difficulty';

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

  try {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.TOPICS, JSON.stringify([...topics, topic])],
      [STORAGE_KEYS.UNITS, JSON.stringify([...allUnits, ...createdUnits])],
    ]);
  } catch (error) {
    const restoreValues = snapshot.filter((entry): entry is [string, string] => entry[1] !== null);
    const removeKeys = snapshot.filter((entry) => entry[1] === null).map(([key]) => key);
    if (restoreValues.length > 0) await AsyncStorage.multiSet(restoreValues);
    if (removeKeys.length > 0) await AsyncStorage.multiRemove(removeKeys);
    throw error;
  }

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
    STORAGE_KEYS.REVIEW_STATES,
    STORAGE_KEYS.MANUAL_COMPLETIONS,
    STORAGE_KEYS.CUSTOM_NOTE_QUESTIONS,
    STORAGE_KEYS.LAST_STUDIED_TOPIC,
    STORAGE_KEYS.TOPIC_SOURCE_LINKS,
  ] as const;
  const snapshot = await AsyncStorage.multiGet([...keys]);
  const stored = new Map(snapshot);
  const parseArray = <T,>(key: string): T[] => {
    const raw = stored.get(key);
    return raw ? JSON.parse(raw) : [];
  };

  const topics = parseArray<Topic>(STORAGE_KEYS.TOPICS);
  const units = parseArray<Unit>(STORAGE_KEYS.UNITS);
  const specs = parseArray<LearningSpec>(STORAGE_KEYS.LEARNING_SPECS);
  const questions = parseArray<QuestionRevision>(STORAGE_KEYS.QUESTIONS);
  const sessions = parseArray<StudySession>(STORAGE_KEYS.SESSIONS);
  const sessionItems = parseArray<SessionItem>(STORAGE_KEYS.SESSION_ITEMS);
  const attempts = parseArray<Attempt>(STORAGE_KEYS.ATTEMPTS);
  const reviewStates = parseArray<ReviewState>(STORAGE_KEYS.REVIEW_STATES);
  const completions = parseArray<ManualCompletion>(STORAGE_KEYS.MANUAL_COMPLETIONS);
  const customNotes = parseArray<string>(STORAGE_KEYS.CUSTOM_NOTE_QUESTIONS);
  const topicSourceLinks = parseArray<TopicSourceLink>(STORAGE_KEYS.TOPIC_SOURCE_LINKS);

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

  const values: [string, string][] = [
    [STORAGE_KEYS.TOPICS, JSON.stringify(topics.filter((item) => item.id !== topicId))],
    [STORAGE_KEYS.UNITS, JSON.stringify(units.filter((item) => item.topicId !== topicId))],
    [STORAGE_KEYS.LEARNING_SPECS, JSON.stringify(specs.filter((item) => item.topicId !== topicId))],
    [STORAGE_KEYS.QUESTIONS, JSON.stringify(questions.filter((item) => item.topicId !== topicId))],
    [STORAGE_KEYS.SESSIONS, JSON.stringify(sessions.filter((item) => !removedSessionIds.has(item.id)))],
    [STORAGE_KEYS.SESSION_ITEMS, JSON.stringify(sessionItems.filter((item) => !removedSessionItemIds.has(item.id)))],
    [
      STORAGE_KEYS.ATTEMPTS,
      JSON.stringify(
        attempts.filter(
          (item) =>
            !removedSessionItemIds.has(item.sessionItemId) &&
            !Array.from(removedQuestionIds).some((questionId) => item.submissionKey.includes(questionId))
        )
      ),
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
    STORAGE_KEYS.REVIEW_STATES,
    STORAGE_KEYS.MANUAL_COMPLETIONS,
    STORAGE_KEYS.CUSTOM_NOTE_QUESTIONS,
  ] as const;
  const snapshot = await AsyncStorage.multiGet([...keys]);
  const stored = new Map(snapshot);
  const parseArray = <T,>(key: string): T[] => {
    const raw = stored.get(key);
    return raw ? JSON.parse(raw) : [];
  };

  const units = parseArray<Unit>(STORAGE_KEYS.UNITS);
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

  const specs = parseArray<LearningSpec>(STORAGE_KEYS.LEARNING_SPECS);
  const nextSpecs = specs
    .map((spec) => ({
      ...spec,
      unitIds: spec.unitIds.filter((id) => !removedUnitIds.has(id)),
    }))
    .filter((spec) => spec.unitIds.length > 0);
  const nextSpecIds = new Set(nextSpecs.map((spec) => spec.id));
  const removedSpecIds = new Set(specs.filter((spec) => !nextSpecIds.has(spec.id)).map((spec) => spec.id));

  const questions = parseArray<QuestionRevision>(STORAGE_KEYS.QUESTIONS);
  const removedQuestionIds = new Set(
    questions
      .filter((question) => question.unitId && removedUnitIds.has(question.unitId))
      .flatMap((question) => [question.id, question.questionId])
  );
  const sessions = parseArray<StudySession>(STORAGE_KEYS.SESSIONS);
  const removedSessionIds = new Set(
    sessions.filter((session) => removedSpecIds.has(session.specId)).map((session) => session.id)
  );
  const sessionItems = parseArray<SessionItem>(STORAGE_KEYS.SESSION_ITEMS);
  const removedSessionItemIds = new Set(
    sessionItems
      .filter(
        (item) =>
          removedSessionIds.has(item.sessionId) || removedQuestionIds.has(item.questionRevisionId)
      )
      .map((item) => item.id)
  );
  const attempts = parseArray<Attempt>(STORAGE_KEYS.ATTEMPTS);
  const reviewStates = parseArray<ReviewState>(STORAGE_KEYS.REVIEW_STATES);
  const completions = parseArray<ManualCompletion>(STORAGE_KEYS.MANUAL_COMPLETIONS);
  const customNotes = parseArray<string>(STORAGE_KEYS.CUSTOM_NOTE_QUESTIONS);

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
      JSON.stringify(attempts.filter((attempt) => !removedSessionItemIds.has(attempt.sessionItemId))),
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

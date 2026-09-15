/**
 * Topic & Unit Local Storage Repository
 * Reference: CogniQuest_개발명세_v1/03_데이터와처리계약.md
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Topic, Unit, QuestionRevision, Profile, UUID, LearnerKnowledgeLevel } from '../../contracts/types';
import { STORAGE_KEYS, generateUUID, getCurrentISOTime } from '../storage_keys';

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
  category: string = '📚 일반',
  learnerLevel: LearnerKnowledgeLevel = 'basic'
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

  const questionsData = await AsyncStorage.getItem(STORAGE_KEYS.QUESTIONS);
  if (questionsData) {
    const questions: QuestionRevision[] = JSON.parse(questionsData);
    const updatedQuestions = questions.filter((q) => q.topicId !== topicId);
    await AsyncStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(updatedQuestions));
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

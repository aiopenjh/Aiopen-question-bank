/**
 * Question, Attempt, Review State & Completion Repository
 * Reference: CogniQuest_개발명세_v1/03_데이터와처리계약.md
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  QuestionRevision,
  Attempt,
  ReviewState,
  ManualCompletion,
  UUID,
} from '../../contracts/types';
import { STORAGE_KEYS, getCurrentISOTime } from '../storage_keys';
import { areQuestionStemsTooSimilar } from '../../domain/question_similarity';

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

function selectUniqueQuestions(
  existingQuestions: QuestionRevision[],
  newQuestions: QuestionRevision[]
): QuestionRevision[] {
  const accepted: QuestionRevision[] = [];
  const knownIds = new Set(existingQuestions.map((question) => question.id));

  for (const question of newQuestions) {
    if (knownIds.has(question.id)) continue;
    const comparisonPool = [...existingQuestions, ...accepted].filter(
      (saved) => saved.topicId === question.topicId
    );
    if (comparisonPool.some((saved) => areQuestionStemsTooSimilar(saved.stem, question.stem))) {
      continue;
    }
    knownIds.add(question.id);
    accepted.push(question);
  }
  return accepted;
}

export async function addQuestions(newQuestions: QuestionRevision[]): Promise<QuestionRevision[]> {
  const questions = await getQuestions();
  const uniqueQuestions = selectUniqueQuestions(questions, newQuestions);

  if (uniqueQuestions.length === 0) return [];
  await AsyncStorage.setItem(
    STORAGE_KEYS.QUESTIONS,
    JSON.stringify([...questions, ...uniqueQuestions])
  );
  return uniqueQuestions;
}

export interface SaveQuestionsForUnitResult {
  saved: QuestionRevision[];
  skippedCount: number;
  committed: boolean;
}

export async function saveQuestionsForUnit(
  topicId: UUID,
  unitId: UUID,
  newQuestions: QuestionRevision[],
  replaceExisting: boolean
): Promise<SaveQuestionsForUnitResult> {
  const questions = await getQuestions();
  const prepared = newQuestions.map((question) => ({ ...question, topicId, unitId }));
  const retained = replaceExisting
    ? questions.filter((question) => !(question.topicId === topicId && question.unitId === unitId))
    : questions;
  const uniqueQuestions = selectUniqueQuestions(questions, prepared);
  const skippedCount = prepared.length - uniqueQuestions.length;

  // 교체는 전 문항이 검증된 경우에만 한 번에 반영하여 기존 문제 유실을 막습니다.
  if (replaceExisting && skippedCount > 0) {
    return { saved: [], skippedCount, committed: false };
  }
  if (uniqueQuestions.length === 0) {
    return { saved: [], skippedCount, committed: false };
  }

  await AsyncStorage.setItem(
    STORAGE_KEYS.QUESTIONS,
    JSON.stringify(replaceExisting ? [...retained, ...uniqueQuestions] : [...questions, ...uniqueQuestions])
  );
  return { saved: uniqueQuestions, skippedCount, committed: true };
}

export async function deleteQuestion(questionId: UUID): Promise<void> {
  const questions = await getQuestions();
  const updated = questions.filter((q) => q.id !== questionId);
  await AsyncStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(updated));
}

export async function deleteQuestionsForUnit(topicId: UUID, unitId: UUID, _unitTitle?: string): Promise<void> {
  const questions = await getQuestions();
  const updated = questions.filter(
    (q) => !(q.topicId === topicId && q.unitId === unitId)
  );
  await AsyncStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(updated));
}

export async function getCustomNoteQuestionIds(): Promise<string[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_NOTE_QUESTIONS);
  return data ? JSON.parse(data) : [];
}

export async function toggleCustomNoteQuestion(questionId: UUID): Promise<boolean> {
  const list = await getCustomNoteQuestionIds();
  const set = new Set(list);
  let isSaved = false;
  if (set.has(questionId)) {
    set.delete(questionId);
    isSaved = false;
  } else {
    set.add(questionId);
    isSaved = true;
  }
  await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_NOTE_QUESTIONS, JSON.stringify(Array.from(set)));
  return isSaved;
}

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

/**
 * 사용자 정정 기록 저장소.
 * 원래 채점(ATTEMPTS)은 건드리지 않고 별도 키에 정정 기록만 둔다. 복습 상태를 함께 바꿀 때는
 * multiSet 한 번으로 저장해 SQLite·IndexedDB에서는 하나의 트랜잭션으로 반영한다.
 */

import AsyncStorage from '../app_storage';
import { AttemptCorrection, ReviewState } from '../../contracts/types';
import { STORAGE_KEYS } from '../storage_keys';
import { readStoredAttemptCorrections } from '../../domain/attempt_outcome';

/**
 * 복습 상태가 expected와 같을 때만 next로 바꾼다. 그 사이 같은 문제를 다시 풀었다면 새 결과가 우선이다.
 * expected가 null이면 저장된 상태가 없을 때만 추가하고, next가 null이면 상태를 지운다.
 */
export interface ReviewStateChange {
  questionRevisionId: string;
  expected: ReviewState | null;
  next: ReviewState | null;
}

export async function getAttemptCorrections(): Promise<AttemptCorrection[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.ATTEMPT_CORRECTIONS);
  if (!raw) return [];
  try {
    return readStoredAttemptCorrections(JSON.parse(raw));
  } catch {
    return [];
  }
}

function applyReviewChange(list: ReviewState[], change?: ReviewStateChange): ReviewState[] | null {
  if (!change) return null;
  const index = list.findIndex((item) => item.questionRevisionId === change.questionRevisionId);
  const current = index >= 0 ? list[index] : undefined;
  const matches = change.expected === null
    ? current === undefined
    : current !== undefined &&
      current.lastAttemptId === change.expected.lastAttemptId &&
      current.updatedAt === change.expected.updatedAt;
  if (!matches) return null;
  const next = [...list];
  if (change.next === null) {
    if (index >= 0) next.splice(index, 1);
  } else if (index >= 0) {
    next[index] = change.next;
  } else {
    next.push(change.next);
  }
  return next;
}

async function writeCorrections(
  corrections: AttemptCorrection[],
  reviewChange?: ReviewStateChange
): Promise<{ reviewUpdated: boolean }> {
  // question_repository를 import하면 순환 참조가 생기므로 복습 상태는 직접 읽는다.
  const rawReviews = reviewChange ? await AsyncStorage.getItem(STORAGE_KEYS.REVIEW_STATES) : null;
  const reviews = applyReviewChange(rawReviews ? (JSON.parse(rawReviews) as ReviewState[]) : [], reviewChange);
  const entries: [string, string][] = [[STORAGE_KEYS.ATTEMPT_CORRECTIONS, JSON.stringify(corrections)]];
  if (reviews) entries.push([STORAGE_KEYS.REVIEW_STATES, JSON.stringify(reviews)]);
  await AsyncStorage.multiSet(entries);
  return { reviewUpdated: reviews !== null };
}

/** 같은 제출(submissionKey)의 기존 정정은 새 정정으로 바꾼다. */
export async function saveAttemptCorrection(
  correction: AttemptCorrection,
  reviewChange?: ReviewStateChange
): Promise<{ reviewUpdated: boolean }> {
  const corrections = (await getAttemptCorrections()).filter(
    (item) => item.submissionKey !== correction.submissionKey
  );
  return writeCorrections([...corrections, correction], reviewChange);
}

export async function removeAttemptCorrection(
  submissionKey: string,
  reviewChange?: ReviewStateChange
): Promise<{ reviewUpdated: boolean }> {
  const corrections = (await getAttemptCorrections()).filter(
    (item) => item.submissionKey !== submissionKey
  );
  return writeCorrections(corrections, reviewChange);
}

/**
 * Ranking Domain Logic (선택형 공동 랭킹)
 * Reference: docs/ranking/RANKING_FEATURE_PLAN.md §5
 */

import { Attempt, ISODateString } from '../contracts/types';
import { getLocalDateString } from './routine';

export const CONSISTENCY_MIN_QUESTIONS = 3;

/**
 * 기기에 저장된 오늘(로컬 날짜 기준) 완료 문제 수.
 * 같은 문제를 같은 세션에서 중복 제출해도 questionRevisionId당 1회만 센다.
 * 최종 값 판정은 서버가 한국 날짜 기준으로 다시 계산하며, 이 값은 안내용이다.
 */
export function countTodayCompletedQuestions(
  attempts: Attempt[],
  sessionItemToQuestionId: Map<string, string>,
  today: ISODateString = getLocalDateString()
): number {
  const solvedQuestionIds = new Set<string>();
  for (const attempt of attempts) {
    if (getLocalDateString(new Date(attempt.submittedAt)) !== today) continue;
    const questionId = sessionItemToQuestionId.get(attempt.sessionItemId);
    if (questionId) solvedQuestionIds.add(questionId);
  }
  return solvedQuestionIds.size;
}

/** 오늘 완료 수가 꾸준함 인정 기준(3문제)을 넘는지 여부 */
export function isConsistencyQualified(solvedCount: number): boolean {
  return solvedCount >= CONSISTENCY_MIN_QUESTIONS;
}

/**
 * Ranking Domain Logic (선택형 공동 랭킹)
 * Reference: docs/ranking/RANKING_FEATURE_PLAN.md §5
 */

import { Attempt, ISODateString } from '../contracts/types';
import { CHALLENGE_START_LEVEL, getTopicChallengeLevels } from './challenge_progress';
import { isGradingIncomplete } from './attempt_outcome';
import { getLocalDateString } from './routine';

export const CONSISTENCY_MIN_QUESTIONS = 3;
/** 초고난도 도전 랭킹(PRODUCT_ROADMAP_AND_BETA_PLAN.md §Step 1)의 킬러 문항 기준. difficulty.ts의 "확장 학습" 구간 시작값과 같다. */
export const KILLER_LEVEL_THRESHOLD = CHALLENGE_START_LEVEL;

/**
 * 기기에 저장된 오늘(로컬 날짜 기준) 완료 문제 수.
 * submissionKey(`sub-{questionId}-{date}-...`, question_repository.saveAttempt 참고)
 * 기준으로 같은 문제의 중복 제출을 한 번만 센다.
 * 서버에는 이 집계값만 전송한다. 문제 내용이나 개별 제출 기록은 전송하지 않는다.
 */
export function countTodayCompletedQuestions(
  attempts: Attempt[],
  today: ISODateString = getLocalDateString()
): number {
  const solvedKeys = new Set<string>();
  for (const attempt of attempts) {
    // 채점 미완료 기록은 학습 완료로 세지 않는다.
    if (isGradingIncomplete(attempt)) continue;
    if (getLocalDateString(new Date(attempt.submittedAt)) !== today) continue;
    solvedKeys.add(attempt.submissionKey);
  }
  return solvedKeys.size;
}

/** 오늘 완료 수가 꾸준함 인정 기준(3문제)을 넘는지 여부 */
export function isConsistencyQualified(solvedCount: number): boolean {
  return solvedCount >= CONSISTENCY_MIN_QUESTIONS;
}

/**
 * 과목별로 31부터 순차 통과한 레벨 중 최댓값. 구형 단일 정답 기록은 소급하지 않는다.
 */
export function getMaxQualifiedKillerLevel(
  attempts: Attempt[]
): number {
  let maxLevel = 0;
  for (const level of getTopicChallengeLevels(attempts).values()) maxLevel = Math.max(maxLevel, level);
  return maxLevel;
}

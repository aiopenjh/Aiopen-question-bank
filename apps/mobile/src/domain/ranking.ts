/**
 * Ranking Domain Logic (선택형 공동 랭킹)
 * Reference: docs/ranking/RANKING_FEATURE_PLAN.md §5
 */

import { Attempt, ISODateString, QuestionRevision, SessionItem } from '../contracts/types';
import { getLocalDateString } from './routine';

export const CONSISTENCY_MIN_QUESTIONS = 3;
/** 초고난도 도전 랭킹(PRODUCT_ROADMAP_AND_BETA_PLAN.md §Step 1)의 킬러 문항 기준. difficulty.ts의 "확장 학습" 구간 시작값과 같다. */
export const KILLER_LEVEL_THRESHOLD = 31;

/**
 * 기기에 저장된 오늘(로컬 날짜 기준) 완료 문제 수.
 * submissionKey(`sub-{questionId}-{date}-...`, question_repository.saveAttempt 참고)
 * 기준으로 같은 문제의 중복 제출을 한 번만 센다.
 * 최종 값 판정은 서버가 한국 날짜 기준으로 다시 계산하며, 이 값은 안내용이다.
 */
export function countTodayCompletedQuestions(
  attempts: Attempt[],
  today: ISODateString = getLocalDateString()
): number {
  const solvedKeys = new Set<string>();
  for (const attempt of attempts) {
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
 * 초고난도 도전 랭킹: 정답으로 맞춘 문제 중 difficultyLevel이 킬러 문항 기준(31) 이상인
 * 문제의 전체 기간 최고 도달 레벨. Attempt는 문항 난이도를 직접 갖지 않으므로
 * sessionItemId -> SessionItem.questionRevisionId -> QuestionRevision.difficultyLevel로 조인한다.
 */
export function getMaxQualifiedKillerLevel(
  attempts: Attempt[],
  sessionItems: SessionItem[],
  questions: QuestionRevision[]
): number {
  const revisionIdBySessionItemId = new Map(sessionItems.map((item) => [item.id, item.questionRevisionId]));
  const difficultyByRevisionId = new Map(questions.map((q) => [q.id, q.difficultyLevel ?? 0]));

  let maxLevel = 0;
  for (const attempt of attempts) {
    if (!attempt.isCorrect) continue;
    const revisionId = revisionIdBySessionItemId.get(attempt.sessionItemId);
    const level = revisionId ? difficultyByRevisionId.get(revisionId) ?? 0 : 0;
    if (level >= KILLER_LEVEL_THRESHOLD && level > maxLevel) maxLevel = level;
  }
  return maxLevel;
}

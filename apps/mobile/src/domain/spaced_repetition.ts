/**
 * Spaced Repetition (Ebbinghaus Forgetting Curve) Domain Engine
 * Reference: CogniQuest_개발명세_v1/03_데이터와처리계약.md & AGENTS.md
 */

import { ReviewState, QuestionRevision, ISODateString, UUID } from '../contracts/types';
import { getLocalDateString } from './routine';

// 망각곡선 복습 간격 (일 단위): 1일, 3일, 7일, 14일, 30일
export const FORGETTING_INTERVALS_DAYS = [1, 3, 7, 14, 30];

/**
 * 오늘 날짜를 기준으로 특정 일수 뒤의 YYYY-MM-DD 반환
 */
export function calculateNextDueDate(daysToAdd: number, baseDate: Date = new Date()): ISODateString {
  const target = new Date(baseDate);
  target.setDate(target.getDate() + daysToAdd);
  return getLocalDateString(target);
}

/**
 * 문제 풀이 결과에 따른 망각곡선 복습 상태 갱신
 * - 정답 시: stage + 1 (최대 5), 해당 간격만큼 다음 복습일 지정
 * - 오답 시: stage 0으로 초기화, 다음날 즉시 복습 (간격 1일)
 */
export function calculateNextReviewState(params: {
  ownerId: UUID;
  questionRevisionId: UUID;
  currentReviewState?: ReviewState | null;
  isCorrect: boolean;
  attemptId: UUID;
}): ReviewState {
  const { ownerId, questionRevisionId, currentReviewState, isCorrect, attemptId } = params;

  let nextStage = 0;
  let daysToAdd = 1;

  if (isCorrect) {
    const prevStage = currentReviewState ? currentReviewState.stage : 0;
    nextStage = Math.min(FORGETTING_INTERVALS_DAYS.length - 1, prevStage + 1);
    daysToAdd = FORGETTING_INTERVALS_DAYS[nextStage] || 30;
  } else {
    // 오답 시 0단계로 리셋, 다음날 바로 복습
    nextStage = 0;
    daysToAdd = 1;
  }

  return {
    ownerId,
    questionRevisionId,
    stage: nextStage,
    dueDate: calculateNextDueDate(daysToAdd),
    lastAttemptId: attemptId,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 오늘 날짜 기준으로 복습 기한이 도래한(dueDate <= 오늘) 문제 필터링
 */
export function filterDueReviewQuestions(
  questions: QuestionRevision[],
  reviewStates: ReviewState[],
  today: ISODateString = getLocalDateString()
): QuestionRevision[] {
  const dueQuestionIds = new Set(
    reviewStates
      .filter((rs) => rs.dueDate <= today)
      .map((rs) => rs.questionRevisionId)
  );

  return questions.filter((q) => dueQuestionIds.has(q.id));
}

/**
 * 결과 화면의 문항별 상태와 집계.
 * 채점 미완료는 오답 수와 점수 분모에서 빼고, 사용자 정정은 맞힌 문제로 따로 센다.
 * 점수는 문항별 점수 평균: 객관식 100/0, 채점된 주관식·빈칸형은 실제 점수(부분점수 포함), 정정 문항은 100.
 */

import type { AttemptCorrectionReason, QuestionRevision } from '../contracts/types';
import type { ExamAnswerResult } from './exam_grading';

export type ExamItemStatus = 'correct' | 'corrected' | 'partial' | 'incorrect' | 'grading_failed';

export interface ExamResultSummary {
  statuses: ExamItemStatus[];
  correct: number;
  corrected: number;
  incorrect: number; // 부분점수 포함
  gradingFailed: number;
  /** 채점이 끝난 문항 수(점수 분모) */
  graded: number;
  /** 문항별 점수(0~100). 채점 미완료 문항은 null */
  itemScores: (number | null)[];
  /** 채점 가능한 문항이 없으면 null (점수를 표시하지 않는다) */
  scorePercent: number | null;
}

export function getExamItemStatus(
  question: QuestionRevision,
  userAnswer: string | undefined,
  result: ExamAnswerResult | undefined,
  corrected: boolean
): ExamItemStatus {
  const isMultipleChoice = question.questionType === 'multiple_choice';
  const isCorrect = isMultipleChoice
    ? (userAnswer || '') === question.answerOptionId
    : !!result && result.gradingStatus === 'graded' && (result.gradingScore || 0) >= 100;
  if (isCorrect) return 'correct';
  if (corrected) return 'corrected';
  if (!isMultipleChoice && result?.gradingStatus !== undefined && result.gradingStatus !== 'graded') {
    return 'grading_failed';
  }
  if (!isMultipleChoice && result?.gradingStatus === 'graded' && (result.gradingScore || 0) > 0) {
    return 'partial';
  }
  return 'incorrect';
}

function getItemScore(status: ExamItemStatus, result: ExamAnswerResult | undefined): number | null {
  if (status === 'grading_failed') return null;
  if (status === 'correct' || status === 'corrected') return 100;
  if (status === 'partial') return Math.max(0, Math.min(100, result?.gradingScore || 0));
  return 0;
}

export function summarizeExamResults(
  questions: QuestionRevision[],
  userAnswers: Record<number, string>,
  results: ExamAnswerResult[] | undefined,
  corrections: Record<number, AttemptCorrectionReason> = {}
): ExamResultSummary {
  const statuses = questions.map((question, index) =>
    getExamItemStatus(question, userAnswers[index], results?.[index], corrections[index] !== undefined)
  );
  const count = (...kinds: ExamItemStatus[]) => statuses.filter((status) => kinds.includes(status)).length;
  const correct = count('correct');
  const corrected = count('corrected');
  const gradingFailed = count('grading_failed');
  const graded = questions.length - gradingFailed;
  const itemScores = statuses.map((status, index) => getItemScore(status, results?.[index]));
  const scoreSum = itemScores.reduce<number>((sum, score) => sum + (score ?? 0), 0);
  return {
    statuses,
    correct,
    corrected,
    incorrect: count('incorrect', 'partial'),
    gradingFailed,
    graded,
    itemScores,
    scorePercent: graded > 0 ? Math.round(scoreSum / graded) : null,
  };
}

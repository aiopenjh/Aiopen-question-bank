/**
 * 저장된 문제의 형식 보정과 시험 출제 가능 여부.
 *
 * - 구형 객관식은 questionType 없이 저장되었다. 기기 저장소에서 읽거나 백업을 복원할 때
 *   객관식으로 해석한다. 저장소 조회는 원본을 덮어쓰지 않는다.
 * - 객관식은 보기가 정확히 4개이고 정답 보기가 그 안에 있어야 한다. 아니면 시험에서 제외하고
 *   문제 목록에 '보기 누락'으로 표시한다. 가짜 보기로 채우지 않고, 문제 자체도 삭제하지 않는다.
 */

import type { QuestionRevision } from '../contracts/types';

export const MISSING_OPTIONS_LABEL = '보기 누락';

export function normalizeStoredQuestion(question: QuestionRevision): QuestionRevision {
  const raw = question as Partial<QuestionRevision>;
  const missingType = raw.questionType === undefined || raw.questionType === null;
  const missingOptions = !Array.isArray(raw.options);
  const missingAnswer = typeof raw.answerOptionId !== 'string';
  if (!missingType && !missingOptions && !missingAnswer) return question;
  return {
    ...question,
    ...(missingType ? { questionType: 'multiple_choice' as const } : {}),
    ...(missingOptions ? { options: [] } : {}),
    ...(missingAnswer ? { answerOptionId: '' } : {}),
  };
}

export function normalizeStoredQuestions(questions: readonly QuestionRevision[]): QuestionRevision[] {
  return questions.map(normalizeStoredQuestion);
}

export function hasMissingOptions(question: QuestionRevision): boolean {
  if (question.questionType !== 'multiple_choice') return false;
  const options = Array.isArray(question.options) ? question.options : [];
  return options.length !== 4 || !options.some((option) => option?.id === question.answerOptionId);
}

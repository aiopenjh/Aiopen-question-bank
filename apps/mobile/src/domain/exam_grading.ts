import type { QuestionRevision } from '../contracts/types';
import { gradeSubjectiveAnswer, gradeClozeAnswers } from './grading';

export interface ExamAnswerResult {
  question: QuestionRevision;
  selectedOptionId: string; // multiple_choice만 사용. 그 외 유형은 빈 문자열
  isCorrect: boolean; // multiple_choice 정오 판정. 그 외 유형은 gradingScore 기준(아래)으로 계산됨
  answerText?: string; // short_answer/essay 제출 답안
  clozeAnswers?: string[]; // cloze 제출 답안. clozeBlanks와 배열 순서로 대응
  gradingStatus?: 'pending' | 'graded' | 'failed'; // short_answer/essay/cloze만 사용
  gradingScore?: number; // 0~100
  gradingChecklistResult?: { id: string; met: boolean }[];
  gradingFailedReason?: string;
}

/** Bound provider concurrency while retaining question/result order. */
export async function gradeExamAnswers(
  questions: QuestionRevision[],
  userAnswers: Record<number, string>,
  userClozeAnswers: Record<number, string[]>
): Promise<ExamAnswerResult[]> {
  const results: ExamAnswerResult[] = new Array(questions.length);
  let cursor = 0;
  async function gradeOne(item: QuestionRevision, idx: number): Promise<ExamAnswerResult> {
    const answer = userAnswers[idx] || '';

    if (item.questionType === 'multiple_choice') {
      return {
        question: item,
        selectedOptionId: answer,
        isCorrect: answer === item.answerOptionId,
      };
    }

    if (item.questionType === 'cloze') {
      // 빈칸형: AI 재호출 없이 로컬에서 즉시 채점
      const clozeAnswers = userClozeAnswers[idx] || [];
      const grading = gradeClozeAnswers(item.clozeBlanks || [], clozeAnswers);
      return {
        question: item,
        selectedOptionId: '',
        isCorrect: grading.gradingStatus === 'graded' && (grading.gradingScore || 0) >= 100,
        clozeAnswers,
        gradingStatus: grading.gradingStatus,
        gradingScore: grading.gradingScore,
        gradingChecklistResult: grading.gradingChecklistResult,
      };
    }

    // short_answer / essay: AI 재호출로 채점 (실패 시 재시도 없이 로컬 보존)
    const grading = await gradeSubjectiveAnswer(item, answer);
    return {
      question: item,
      selectedOptionId: '',
      isCorrect: grading.gradingStatus === 'graded' && (grading.gradingScore || 0) >= 100,
      answerText: answer,
      gradingStatus: grading.gradingStatus,
      gradingScore: grading.gradingScore,
      gradingChecklistResult: grading.gradingChecklistResult,
      gradingFailedReason: grading.gradingFailedReason,
    };
  }
  async function worker(): Promise<void> {
    while (cursor < questions.length) {
      const index = cursor++;
      results[index] = await gradeOne(questions[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(2, questions.length) }, () => worker()));
  return results;
}

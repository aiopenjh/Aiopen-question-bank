import { QuestionType } from '../contracts/types';

/** 출제 설정의 문제 유형. 주관식만은 단답형·서술형이며 빈칸형은 포함하지 않는다. */
export type QuestionTypeMode = 'mixed' | 'multiple_choice' | 'subjective';

// 혼합: 객관식·주관식·빈칸형을 문항마다 독립적으로 추첨한다. 구성 비율이나 연속 제한은 없다.
export function createQuestionTypePlan(
  count: number,
  random = Math.random,
  mode: QuestionTypeMode = 'mixed'
): QuestionType[] {
  if (mode === 'multiple_choice') return Array.from({ length: count }, () => 'multiple_choice');
  if (mode === 'subjective') {
    return Array.from({ length: count }, () => (random() < 0.5 ? 'short_answer' : 'essay'));
  }
  return Array.from({ length: count }, () => {
    const category = Math.floor(random() * 3);
    if (category === 0) return 'multiple_choice';
    if (category === 2) return 'cloze';
    return random() < 0.5 ? 'short_answer' : 'essay';
  });
}

export function matchesQuestionTypePlan(
  questions: { questionType: QuestionType }[],
  plan: QuestionType[]
): boolean {
  return questions.length === plan.length && questions.every((question, i) => question.questionType === plan[i]);
}

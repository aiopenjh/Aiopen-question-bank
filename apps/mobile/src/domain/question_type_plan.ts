import { QuestionType } from '../contracts/types';

// 객관식·주관식·빈칸형을 문항마다 독립적으로 추첨한다. 구성 비율이나 연속 제한은 없다.
export function createQuestionTypePlan(count: number, random = Math.random): QuestionType[] {
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

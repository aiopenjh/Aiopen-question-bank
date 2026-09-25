/**
 * 자동 채점용 주관식 적합성 검사. 단답형·서술형 지문이 의견·가치판단을 묻거나,
 * 서술형 채점 기준이 주관적이면 저장하지 않는다(출제 지시문 14번과 같은 기준).
 * 객관식과 빈칸형은 검사하지 않는다("다음 중 옳은 것은?" 같은 객관식 지문 오탐 방지).
 */

import type { QuestionType } from '../contracts/types';

// ponytail: 키워드 목록 기반이라 모든 의견형·모호한 지문을 잡지는 못한다(지시문이 1차 방어).
// 놓치는 사례가 쌓이면 AI 자기 검증 필드나 별도 검토 요청으로 확장한다.
const OPINION_STEM_PATTERNS = [
  /(당신|본인|자신|여러분|학습자)의\s*(생각|의견|견해|입장|가치관|경험)/,
  /어떻게\s*생각(하|합)/,
  /(더|가장)\s*(옳|바람직|나은|좋은|훌륭)/,
  /바람직(한가|하다고|한지)/,
  /(찬성|반대)\s*(하는지|하는가|여부)|찬반/,
  /자유롭게|정답이\s*없/,
];
const SUBJECTIVE_CRITERION_PATTERN = /논리적\s*일관|설득력|창의(성|적)|문장력|표현력|독창/;

export interface SubjectiveCandidate {
  questionType: QuestionType;
  stem: string;
  gradingChecklist?: { criterion: string }[];
}

/** 부적합한 첫 문항 번호(1부터). 모두 적합하면 null. */
export function findUnverifiableSubjective(questions: readonly SubjectiveCandidate[]): number | null {
  const index = questions.findIndex((question) => {
    if (question.questionType !== 'short_answer' && question.questionType !== 'essay') return false;
    if (OPINION_STEM_PATTERNS.some((pattern) => pattern.test(question.stem))) return true;
    return (question.gradingChecklist || []).some((item) => SUBJECTIVE_CRITERION_PATTERN.test(item.criterion));
  });
  return index >= 0 ? index + 1 : null;
}

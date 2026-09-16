import { QuestionRevision } from '../contracts/types';

export function formatIntentMessage(message: string, choices: string[]): string {
  if (choices.length === 0) return message;
  return `${message}\n\n가능한 해석:\n${choices.map((choice) => `• ${choice}`).join('\n')}`;
}

export function buildUnitGenerationContext(
  sourceMaterial: string,
  existingQuestions: QuestionRevision[]
): string | undefined {
  const contextParts: string[] = [];
  if (sourceMaterial.trim().length > 0) {
    contextParts.push(
      `[학습자가 직접 첨부한 교재/자료 핵심 내용 (★최우선 반영 필수★)]:\n${sourceMaterial}\n※ 반드시 학습자가 첨부한 위 교재 내용과 핵심 개념을 직접 활용하여 시험 문제를 정밀 출제해 주십시오.`
    );
  }

  const existingSummary = existingQuestions
    .slice(-15)
    .map((question) => `• ${question.stem}`)
    .join('\n');
  if (existingSummary) {
    contextParts.push(
      `[이 단원에 이미 출제된 기존 문제 목록 (판박이 복사 재탕 절대 금지 & 개념 범위 확장)]:\n${existingSummary}\n※ 핵심 지침:\n1. 위 기존 문제들과 문장 구조나 지문이 똑같은 판박이 재탕 문항은 절대 출제하지 마십시오.\n2. 특정 대표 개념 하나만 반복하지 말고, 이 단원 내의 다양한 다른 세부 개념, 원리, 공식, 이론들을 골고루 탐색하여 출제하십시오.\n3. 단원의 중요 핵심 개념을 다루더라도 구체적 사례 제시, 긍정/부정 비틀기 등 다른 각도로 꼬아낸 변형 문제는 자연스럽게 허용됩니다.`
    );
  }

  return contextParts.length > 0 ? contextParts.join('\n\n') : undefined;
}

/**
 * 기존 저장 문제(deepReasoningHint가 없는 구 데이터)를 위한 온디맨드 힌트 생성기.
 * Reference: AGENTS.md 헌법 1(가짜 하드코딩 배제) — 미연동 시 NEEDS_CONNECTION과 동일하게
 *            명확한 오류로 안내하며, 힌트 없는 문제를 조용히 저장하지 않는다.
 *
 * 자동 호출 금지: API 비용이 발생하므로 사용자가 힌트 모달에서 버튼을 눌렀을 때만
 * 문제 1개당 1회 호출하고, 성공하면 question_repository.updateQuestionHint로 영구
 * 저장하여 이후에는 재사용한다(추가 API 호출 없음).
 */

import { QuestionRevision } from '../contracts/types';
import { getGeminiApiKey } from '../data/db';
import { callUniversalAiCompletion, parseAiJsonResponse } from './ai_client';
import { containsAnswerLeak, MAX_HINT_LENGTH } from './generator_validation';

export class HintGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HintGenerationError';
  }
}

function buildSingleHintPrompt(question: QuestionRevision): string {
  const optionLines = question.options
    .map((option, idx) => `${idx + 1}. ${option.text}`)
    .join('\n');

  return `당신은 학생이 스스로 정답을 추론하도록 돕는 힌트 작성 전문가입니다.
아래 문제를 보고, 정답을 밝히지 않는 힌트(deepReasoningHint) 하나만 작성하세요.

[문제 지문]
${question.stem}

[보기]
${optionLines}

[작성 규칙]
1. 최대 1~2개의 짧은 문장, 200자 이내로 작성합니다.
2. 정답 번호, 정답 보기 문구, 최종 수치, 완성된 계산식, 정답을 도출하는 과정을 절대 포함하지 마세요.
3. "어떤 개념을 먼저 확인해야 하는지", "어느 조건을 다시 봐야 하는지" 정도의 방향만 제시합니다.
4. 기존 해설을 그대로 잘라 쓰지 말고, 힌트 전용 문장으로 새로 작성합니다.

[출력 JSON] (다른 텍스트 없이 이 형식만 출력)
{"deepReasoningHint": "정답을 밝히지 않는 1~2문장 힌트"}`;
}

/**
 * 문제 1개에 대한 전용 힌트를 1회 생성해 반환한다. 저장은 호출자의 책임이다
 * (ExamSessionScreen에서 성공 시 question_repository.updateQuestionHint 호출).
 */
export async function generateHintForExistingQuestion(
  question: QuestionRevision
): Promise<string> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey || apiKey.trim().length < 8) {
    throw new HintGenerationError(
      'AI 힌트를 만들려면 먼저 설정 탭에서 AI 연결을 완료해 주세요.'
    );
  }

  let completionText: string;
  try {
    const completion = await callUniversalAiCompletion(apiKey.trim(), buildSingleHintPrompt(question));
    completionText = completion.text;
  } catch (err: any) {
    throw new HintGenerationError(
      err?.message || 'AI 힌트 생성 중 통신 오류가 발생했습니다. 다시 시도해 주세요.'
    );
  }

  let parsed: unknown;
  try {
    parsed = parseAiJsonResponse<{ deepReasoningHint?: unknown }>(completionText);
  } catch {
    throw new HintGenerationError('AI 힌트 응답 형식을 확인할 수 없습니다. 다시 시도해 주세요.');
  }

  const raw = (parsed as { deepReasoningHint?: unknown } | null)?.deepReasoningHint;
  const hint = typeof raw === 'string' ? raw.trim() : '';
  if (!hint) {
    throw new HintGenerationError('AI가 힌트를 생성하지 못했습니다. 다시 시도해 주세요.');
  }
  if (hint.length > MAX_HINT_LENGTH) {
    throw new HintGenerationError('AI가 생성한 힌트가 너무 깁니다(정답 도출 과정처럼 작성됨). 다시 시도해 주세요.');
  }

  const correctOption = question.options.find((option) => option.id === question.answerOptionId);
  if (containsAnswerLeak(hint, correctOption?.text)) {
    throw new HintGenerationError('AI가 생성한 힌트에 정답이 노출되어 저장하지 않았습니다. 다시 시도해 주세요.');
  }

  return hint;
}

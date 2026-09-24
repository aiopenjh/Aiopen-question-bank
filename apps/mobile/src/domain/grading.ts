/**
 * 주관식(단답형/서술형/빈칸형) 채점 파이프라인
 * Reference: claude/subjective-input-feature-design-notes.md (합의된 설계)
 *
 * - short_answer/essay: AI 재호출로 모범답안/체크리스트 대비 사용자 답안을 객관적으로 판정.
 *   "논리적 일관성" 같은 주관적 기준은 쓰지 않고, 핵심 요소 포함 여부만 판정. 실패 시 자동
 *   재시도하지 않고 호출 측에서 로컬에 "채점 미완료" 상태로 보존, 사용자가 수동 재요청.
 * - cloze(빈칸형): AI 재호출 없이 로컬에서 정규화 후 정확 일치로 즉시 판정(짧고 이산적인
 *   답이라 AI보다 빠르고 비용이 없으며 Law #2 로컬 우선 원칙에 더 부합).
 */

import { ClozeBlank, QuestionRevision } from '../contracts/types';
import { getGeminiApiKey } from '../data/db';
import { callUniversalAiCompletion, parseAiJsonResponse } from './ai_client';
import { normalizeComparableText } from './generator_validation';

export interface SubjectiveGradingResult {
  gradingStatus: 'graded' | 'failed';
  gradingScore?: number; // 0~100
  gradingChecklistResult?: { id: string; met: boolean }[];
  gradingFailedReason?: string;
}

function buildGradingPrompt(question: QuestionRevision, answerText: string): string {
  if (question.questionType === 'essay' && question.gradingChecklist && question.gradingChecklist.length > 0) {
    const checklistLines = question.gradingChecklist
      .map((item, idx) => `${idx + 1}. [id: ${item.id}] ${item.criterion} (배점 ${item.points}점)`)
      .join('\n');
    return `당신은 서술형 답안 채점자입니다. 아래 체크리스트 각 항목의 핵심 요소가 학습자 답안에 실제로 포함되어 있는지만 객관적으로 판정하세요.
"논리적 일관성"이나 "문장력" 같은 주관적 기준은 절대 사용하지 말고, 오직 체크리스트 항목의 핵심 요소가 답안에 있는지 여부만 봅니다.
판정 기준:
- 괄호, 부연 설명, 예시 안에 쓴 내용도 답안의 일부로 보고 판정합니다.
- 표현이 달라도 핵심 의미가 같으면 충족으로 봅니다.
- 학습자가 여러 환경이나 기준(예: Win32 화면 좌표와 DirectX 좌표)을 구분해 설명한 경우, 문제와 모범답안이 기준으로 삼는 환경에 대한 설명이 항목을 충족하면 met: true입니다. 다른 환경을 함께 설명했다는 이유만으로 미충족 처리하지 마세요.
- 기준 환경에 대해 사실과 반대로 설명했거나 항목의 핵심 요소가 답안 어디에도 없을 때만 met: false입니다.

[문제]
${question.stem}

[모범답안]
${question.modelAnswer || ''}

[채점 체크리스트]
${checklistLines}

[학습자 답안]
${answerText}

[출력 JSON] (다른 텍스트 없이 이 형식만 출력)
{
  "checklistResult": [
    { "id": "항목의 id 그대로", "met": true }
  ]
}`;
  }

  // short_answer: 모범답안과 핵심 의미가 일치하는지 이진 판정
  return `당신은 단답형 답안 채점자입니다. 학습자 답안이 모범답안과 핵심 의미가 일치하면 correct: true, 아니면 false로만 판정하세요. 표현이 달라도 핵심 개념이 같으면 정답으로 인정합니다.
괄호나 부연 설명 안의 내용도 답안의 일부로 봅니다. 학습자가 여러 환경이나 기준을 구분해 답했고 문제와 모범답안이 기준으로 삼는 환경에 대한 답이 모범답안과 일치하면 정답으로 인정합니다.

[문제]
${question.stem}

[모범답안]
${question.modelAnswer || ''}

[학습자 답안]
${answerText}

[출력 JSON] (다른 텍스트 없이 이 형식만 출력)
{ "correct": true }`;
}

const INVALID_RESPONSE_REASON = 'AI 채점 응답 형식을 확인할 수 없습니다.';

/**
 * 서술형 체크리스트 응답 검증: 모든 항목 ID가 정확히 한 번씩 있고 met이 boolean이어야 한다.
 * 누락·중복·알 수 없는 ID·잘못된 타입이 하나라도 있으면 null(채점 실패)을 돌려준다.
 */
function readChecklistResult(
  checklist: NonNullable<QuestionRevision['gradingChecklist']>,
  raw: unknown
): { id: string; met: boolean }[] | null {
  if (!Array.isArray(raw) || raw.length !== checklist.length) return null;
  const expectedIds = new Set(checklist.map((item) => item.id));
  const metById = new Map<string, boolean>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const { id, met } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || !expectedIds.has(id) || metById.has(id) || typeof met !== 'boolean') return null;
    metById.set(id, met);
  }
  return checklist.map((item) => ({ id: item.id, met: metById.get(item.id) === true }));
}

/**
 * 서술형/단답형 답안 채점. 재시도는 하지 않으며 실패 시 failed 상태를 반환합니다.
 * AI 응답 형식이 올바르지 않으면 0점이 아니라 채점 실패로 처리합니다(AGENTS.md §2-A-4).
 */
export async function gradeSubjectiveAnswer(
  question: QuestionRevision,
  answerText: string
): Promise<SubjectiveGradingResult> {
  const trimmedAnswer = (answerText || '').trim();
  if (!trimmedAnswer) {
    return { gradingStatus: 'failed', gradingFailedReason: '답안이 비어 있어 채점할 수 없습니다.' };
  }

  try {
    const apiKey = await getGeminiApiKey();
    if (!apiKey || apiKey.trim().length < 8) {
      return {
        gradingStatus: 'failed',
        gradingFailedReason: 'AI 채점을 위한 연결이 필요합니다. 설정 탭에서 AI 연결을 완료해 주세요.',
      };
    }

    const prompt = buildGradingPrompt(question, trimmedAnswer);
    const completion = await callUniversalAiCompletion(apiKey.trim(), prompt);
    const parsed = parseAiJsonResponse<Record<string, unknown>>(completion.text);

    const response = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;

    if (question.questionType === 'essay' && question.gradingChecklist) {
      const checklistResult = readChecklistResult(question.gradingChecklist, response?.checklistResult);
      if (!checklistResult) {
        return { gradingStatus: 'failed', gradingFailedReason: INVALID_RESPONSE_REASON };
      }
      const score = question.gradingChecklist.reduce((sum, item, idx) => {
        return sum + (checklistResult[idx].met ? item.points : 0);
      }, 0);
      return { gradingStatus: 'graded', gradingScore: Math.round(score), gradingChecklistResult: checklistResult };
    }

    // short_answer: correct가 실제 boolean일 때만 채점 완료
    if (typeof response?.correct !== 'boolean') {
      return { gradingStatus: 'failed', gradingFailedReason: INVALID_RESPONSE_REASON };
    }
    return { gradingStatus: 'graded', gradingScore: response.correct ? 100 : 0 };
  } catch (err: any) {
    // 제공자/네트워크 예외 원문에는 키·요청 정보가 섞일 수 있으므로 사용자 기록에 보존하지 않는다.
    return {
      gradingStatus: 'failed',
      gradingFailedReason: err?.name === 'GenerationCancelledError'
        ? 'AI 전송 안내에서 취소하여 채점 요청을 보내지 않았습니다.'
        : 'AI 채점 요청을 완료하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
    };
  }
}

/**
 * 빈칸형(cloze) 답안 채점. AI 호출 없이 로컬에서 즉시 정확 일치로 판정한다(항상 성공).
 * submittedAnswers는 blanks와 배열 순서로 대응한다.
 */
export function gradeClozeAnswers(
  blanks: ClozeBlank[],
  submittedAnswers: string[]
): SubjectiveGradingResult {
  const checklistResult = blanks.map((blank, idx) => {
    const submitted = normalizeComparableText(submittedAnswers[idx] || '');
    const met = submitted.length > 0 && blank.correctAnswers.some((a) => normalizeComparableText(a) === submitted);
    return { id: blank.id, met };
  });
  const metCount = checklistResult.filter((r) => r.met).length;
  const gradingScore = blanks.length > 0 ? Math.round((metCount / blanks.length) * 100) : 0;
  return { gradingStatus: 'graded', gradingScore, gradingChecklistResult: checklistResult };
}

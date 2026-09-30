/**
 * Intent Scoping & Fact-Based Question Generator Engine
 * Reference: AGENTS.md & CogniQuest_개발명세_v1
 * 
 * 원칙: 하드코딩 배제, 미연동 시 정직한 상태(NEEDS_CONNECTION) 반환.
 */

import {
  AiDocumentInput,
  LearningSpec,
  QuestionRevision,
  ValidationRecord,
  UUID,
} from '../contracts/types';
import { generateUUID, getCurrentISOTime, getGeminiApiKey, getAttempts } from '../data/db';
import { CHALLENGE_START_LEVEL, getChallengeGenerationError, getUnlockedChallengeLevel } from './challenge_progress';
import { buildQuestionGenerationPrompt } from './prompts';
import { createQuestionTypePlan, matchesQuestionTypePlan } from './question_type_plan';
import { callUniversalAiCompletion, parseAiJsonResponse } from './ai_client';
import {
  ScopedIntent,
  StudyIntentDecision,
  StudyIntentStatus,
  analyzeUserIntent,
  detectObviousInvalidStudyInput,
  extractDomainFromText,
} from './intent';
import { distributeQuestionAnswersRandomly } from './question_distribution';
import { GeneratedUnitItem, generateCurriculumUnits } from './curriculum_generator';
import {
  buildCurrentInformationInstruction,
  getKoreanReferenceDate,
  requiresCurrentOfficialSources,
} from './current_information';
import { MAX_ESSAY_ANSWER_LENGTH, findContradictoryAnswerKey, readOptionalText, validateGeneratedQuestions } from './generator_validation';
import type { GeneratedQuestionInput } from './generator_validation';
import { findUnverifiableSubjective } from './subjective_suitability';
import { describeRateLimit } from './ai_usage';

// 100% 하위 호환성을 위한 re-export
export {
  ScopedIntent,
  analyzeUserIntent,
  extractDomainFromText,
  callUniversalAiCompletion,
  parseAiJsonResponse,
  distributeQuestionAnswersRandomly,
  GeneratedUnitItem,
  generateCurriculumUnits,
  validateGeneratedQuestions,
};

export type GenerationOutcome =
  | {
      status: 'READY';
      spec: LearningSpec;
      questions: QuestionRevision[];
      validations: ValidationRecord[];
    }
  | {
      status: 'NEEDS_CONNECTION';
      provider: string;
      message: string;
      requiredAction: string;
    }
  | {
      status: 'NEEDS_CLARIFICATION';
      message: string;
      clarificationChoices: string[];
    }
  | {
      status: 'REJECTED';
      message: string;
      clarificationChoices: string[];
    }
  | {
      status: 'FAILED';
      message: string;
    };

type GenerationParams = {
  intent: ScopedIntent;
  ownerId: UUID;
  topicId: UUID;
  topicName?: string;
  category?: string;
  unitId?: UUID;
  unitTitle?: string;
  customContext?: string;
  /** 과목에 저장된 레벨 구간별 내용 기준. 없으면 공통 기준만 사용한다. */
  difficultyLadder?: string[];
  documentInput?: AiDocumentInput;
  signal?: AbortSignal;
};

/**
 * 앱이 직접 만든 문항 검증 안내만 사용자 화면에 전달한다.
 * 네트워크/SDK/JSON 해독 예외 원문은 이 타입이 아니므로 화면과 로그에 노출하지 않는다.
 */
class GenerationContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerationContentError';
  }
}

// 응답 형식 검사에 걸린 세부 사유(예: 힌트 길이)는 내부 검사용이라 화면에는 요청 실패와 재요청 안내만 보인다.
const INVALID_RESPONSE_MESSAGE = 'AI 응답을 제대로 받지 못했습니다. 다시 요청해 주세요.';

/**
 * 형식 검사 실패 사유를 개발자 기록(콘솔)에만 남기고 화면용 오류를 만든다.
 * 사유는 앱 검사 코드가 만든 문장이며 API 키·요청 주소·공급자 응답 원문은 넣지 않는다.
 */
// Gemini 응답 종료 사유 가운데 기록해도 되는 고정 값. 그 밖의 값은 자유 문자열이므로 '알 수 없음'으로 적는다.
const KNOWN_FINISH_REASONS = new Set([
  'STOP', 'MAX_TOKENS', 'SAFETY', 'RECITATION', 'LANGUAGE', 'OTHER', 'BLOCKLIST',
  'PROHIBITED_CONTENT', 'SPII', 'MALFORMED_FUNCTION_CALL', 'FINISH_REASON_UNSPECIFIED',
]);

function describeFinishReason(reason: string | undefined): string {
  return reason && KNOWN_FINISH_REASONS.has(reason) ? reason : '알 수 없음';
}

function invalidResponse(reason: string): GenerationContentError {
  console.warn(`AI 출제 형식 검사 실패: ${reason.slice(0, 200)}`);
  return new GenerationContentError(INVALID_RESPONSE_MESSAGE);
}

const inFlightGenerations = new Map<string, Promise<GenerationOutcome>>();

function getGenerationRequestKey(params: GenerationParams): string {
  const { signal: _signal, documentInput, ...request } = params;
  return JSON.stringify({
    ...request,
    documentInput: documentInput
      ? {
          sourceId: documentInput.sourceId,
          sourceRevisionId: documentInput.sourceRevisionId,
          pageStart: documentInput.pageStart,
          pageEnd: documentInput.pageEnd,
        }
      : undefined,
  });
}

export { MAX_HINT_LENGTH, containsAnswerLeak } from './generator_validation';

function readStudyIntentDecision(value: unknown): StudyIntentDecision {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidResponse('응답이 객체 형식이 아님');
  }

  const result = value as Record<string, unknown>;
  const status = result.intentStatus;
  if (status !== 'READY' && status !== 'NEEDS_CLARIFICATION' && status !== 'REJECTED') {
    throw invalidResponse('주제 판정 상태(intentStatus)가 없거나 올바르지 않음');
  }

  const clarificationChoices = Array.isArray(result.clarificationChoices)
    ? result.clarificationChoices
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim())
        .slice(0, 3)
    : [];

  return {
    status: status as StudyIntentStatus,
    message: readOptionalText(result.message),
    clarificationChoices,
  };
}

/**
 * 문제 출제 및 무결성 검증 파이프라인
 * - API Key가 없으면 가짜 문제를 내지 않고 NEEDS_CONNECTION을 반환합니다.
 * - API Key가 있으면 실제 최신 AI API를 호출하여 정밀 4지선다 문항을 생성합니다.
 */
export function generateFactBasedQuestions(params: GenerationParams): Promise<GenerationOutcome> {
  const requestKey = getGenerationRequestKey(params);
  const existing = inFlightGenerations.get(requestKey);
  if (existing) return existing;

  const generation = generateFactBasedQuestionsOnce(params);
  inFlightGenerations.set(requestKey, generation);

  const clearInFlight = () => {
    if (inFlightGenerations.get(requestKey) === generation) {
      inFlightGenerations.delete(requestKey);
    }
  };
  void generation.then(clearInFlight, clearInFlight);

  return generation;
}

async function generateFactBasedQuestionsOnce(params: GenerationParams): Promise<GenerationOutcome> {
  const { intent, ownerId, topicId, topicName, category, unitId, unitTitle, customContext, difficultyLadder, documentInput, signal } = params;
  // 모든 출제 진입점(자유 입력·추가 학습 포함)에 동일한 순차 규칙 적용. API 호출 전에 검사한다.
  if ((intent.difficultyLevel ?? 0) >= CHALLENGE_START_LEVEL) {
    const error = getChallengeGenerationError(intent.difficultyLevel!, intent.targetCount,
      getUnlockedChallengeLevel(await getAttempts(), topicId));
    if (error) return { status: 'FAILED', message: error };
  }
  const obviousInvalid = detectObviousInvalidStudyInput(topicName || intent.domain);
  if (obviousInvalid && obviousInvalid.status !== 'READY') {
    return {
      status: obviousInvalid.status,
      message: obviousInvalid.message || '학습할 주제를 조금 더 구체적으로 입력해 주세요.',
      clarificationChoices: [],
    };
  }

  const apiKey = await getGeminiApiKey();

  // API Key 미연동 시: 가짜 문제를 억지로 내지 않고 솔직한 통로 안내 반환
  if (!apiKey || apiKey.trim().length < 8) {
    return {
      status: 'NEEDS_CONNECTION',
      provider: 'AI_PROVIDER',
      message: 'AI 출제 엔진 통로가 미연동 상태입니다. (하드코딩된 가짜 문제를 일절 배제합니다)',
      requiredAction: '설정 탭에서 AI 연결을 완료해 주세요.',
    };
  }

  try {
    const generated = await generateViaUniversalAiApi({
      apiKey: apiKey.trim(),
      intent,
      ownerId,
      topicId,
      topicName,
      category,
      unitId,
      unitTitle,
      customContext,
      difficultyLadder,
      documentInput,
      signal,
    });

    if (generated.status !== 'READY') {
      return generated;
    }

    return {
      status: 'READY',
      spec: generated.spec,
      questions: generated.questions,
      validations: generated.validations,
    };
  } catch (err: any) {
    let safeMessage = 'API 서버와 통신할 수 없습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.';
    let failureCategory = 'connection_or_provider';
    if (err instanceof GenerationContentError) {
      safeMessage = err.message;
      failureCategory = 'generated_content_validation';
    } else if (err?.name === 'GenerationCancelledError') {
      safeMessage = '문제 출제가 취소되었습니다.';
      failureCategory = 'cancelled';
    } else if (err?.name === 'GeminiRateLimitError') {
      safeMessage = describeRateLimit(err.quotaScope);
      failureCategory = 'rate_limited';
    }
    // 원본 예외에는 API 키, 요청 URL, 제공자 응답 등이 섞일 수 있어 기록하지 않는다.
    console.warn(`AI 출제 실패 범주: ${failureCategory}`);
    return {
      status: 'FAILED',
      message: `${safeMessage}\n\n기존 문제와 학습 데이터는 그대로 유지됩니다.`,
    };
  }
}

/**
 * 범용 최신 AI 통신 엔진
 */
async function generateViaUniversalAiApi(params: {
  apiKey: string;
  intent: ScopedIntent;
  ownerId: UUID;
  topicId: UUID;
  topicName?: string;
  category?: string;
  unitId?: UUID;
  unitTitle?: string;
  customContext?: string;
  difficultyLadder?: string[];
  documentInput?: AiDocumentInput;
  signal?: AbortSignal;
}): Promise<
  | {
      status: 'READY';
      spec: LearningSpec;
      questions: QuestionRevision[];
      validations: ValidationRecord[];
    }
  | {
      status: 'NEEDS_CLARIFICATION';
      message: string;
      clarificationChoices: string[];
    }
  | {
      status: 'REJECTED';
      message: string;
      clarificationChoices: string[];
    }
> {
  const { apiKey, intent, ownerId, topicId, topicName, category, unitId, unitTitle, customContext, difficultyLadder, documentInput, signal } = params;

  const specId = generateUUID();
  const spec: LearningSpec = {
    id: specId,
    revision: 1,
    ownerId,
    topicId,
    sourceRevisionIds: documentInput?.sourceRevisionId ? [documentInput.sourceRevisionId] : [],
    unitIds: unitId ? [unitId] : [],
    level: intent.level,
    difficultyLevel: intent.difficultyLevel,
    questionCount: intent.targetCount,
    createdAt: getCurrentISOTime(),
  };

  const resolvedDomain = (topicName && topicName.trim().length > 0)
    ? topicName.trim()
    : intent.domain;

  const currentInformationRequired = !documentInput && requiresCurrentOfficialSources({
    category,
    texts: [resolvedDomain, category, unitTitle, intent.focusConcepts.join(' ')],
  });
  const referenceDate = currentInformationRequired ? getKoreanReferenceDate() : undefined;

  const questionTypePlan = createQuestionTypePlan(intent.targetCount, undefined, intent.questionTypeMode);
  const prompt = buildQuestionGenerationPrompt({
    questionTypePlan,
    intent,
    resolvedDomain,
    category,
    unitTitle,
    customContext,
    difficultyLadder,
    currentInformationInstruction: referenceDate
      ? buildCurrentInformationInstruction(referenceDate)
      : undefined,
  });

  const documentPrompt = documentInput
    ? `${prompt}\n\n첨부된 PDF의 ${documentInput.pageStart}~${documentInput.pageEnd}페이지를 문제의 최우선 근거로 사용하십시오. PDF 밖의 내용을 임의로 섞지 마십시오.`
    : prompt;
  let generatedQuestions: GeneratedQuestionInput[] = [];
  // 객관적으로 채점하기 어려운 주관식이 섞이면 저장하지 않고 같은 유형 계획으로 한 번 더 요청한다.
  // 그래도 안 되면 다른 유형으로 바꾸지 않고 이유를 알린다.
  for (let attempt = 1; ; attempt++) {
    const completion = await callUniversalAiCompletion(
      apiKey,
      documentPrompt,
      signal,
      documentInput,
      { enableGoogleSearch: currentInformationRequired }
    );
    let parsed: unknown;
    try {
      parsed = parseAiJsonResponse<unknown>(completion.text);
    } catch {
      // 원인 구분용 진단은 고정 범주·응답 길이(숫자)·허용 목록 안의 종료 사유만 남긴다.
      // 해석 오류 메시지에는 응답 조각이 섞이므로 기록하지 않는다.
      throw invalidResponse(
        `JSON 해석 실패(종료 사유 ${describeFinishReason(completion.finishReason)}, 응답 길이 ${completion.text.length}자)`
      );
    }
    const intentDecision = readStudyIntentDecision(parsed);
    if (intentDecision.status !== 'READY') {
      return {
        status: intentDecision.status,
        message:
          intentDecision.message ||
          (intentDecision.status === 'NEEDS_CLARIFICATION'
            ? '학습하려는 주제의 관계나 범위를 조금 더 구체적으로 알려 주세요.'
            : '입력한 내용에서 학습 주제를 확인하기 어렵습니다.'),
        clarificationChoices: intentDecision.clarificationChoices || [],
      };
    }
    try {
      generatedQuestions = validateGeneratedQuestions(
        parsed,
        intent.targetCount,
        currentInformationRequired,
        referenceDate,
        completion.groundingSources.length > 0,
        true
      );
    } catch (validationError: any) {
      throw invalidResponse(typeof validationError?.message === 'string' ? validationError.message : '문항 검사 실패');
    }
    if (!matchesQuestionTypePlan(generatedQuestions, questionTypePlan)) {
      throw invalidResponse('추첨된 문제 유형 계획과 응답 유형이 다름');
    }
    // 정답 번호와 보기 설명이 어긋난 응답은 정답 키를 믿을 수 없어 저장하지 않고 같은 계획으로 한 번 더 요청한다.
    const contradictoryAnswerKey = findContradictoryAnswerKey(generatedQuestions);
    const unsuitable = findUnverifiableSubjective(generatedQuestions);
    if (contradictoryAnswerKey === null && unsuitable === null) break;
    if (attempt >= 2) {
      if (contradictoryAnswerKey !== null) {
        throw invalidResponse(`${contradictoryAnswerKey}번 문제 정답 번호와 보기 설명 불일치(재요청 후에도 반복)`);
      }
      throw invalidResponse(`${unsuitable}번 주관식 문제가 의견·가치판단형이거나 채점 기준이 주관적임(재요청 후에도 반복)`);
    }
  }
  const questions: QuestionRevision[] = [];
  const validations: ValidationRecord[] = [];

  for (const item of generatedQuestions) {
    const qId = generateUUID();

    let opts: QuestionRevision['options'] = [];
    let answerId = '';
    let maxAnswerLength: number | undefined;
    let clozeBlanks: QuestionRevision['clozeBlanks'];

    if (item.questionType === 'multiple_choice') {
      opts = item.options.map((o) => ({
        id: generateUUID(),
        text: o.text,
        isDistractor: true,
        distractorRationale: o.distractorRationale,
      }));

      const correctIdx = item.correctOptionNumber - 1;

      opts.forEach((o: any, idx: number) => {
        o.isDistractor = idx !== correctIdx;
        if (!o.isDistractor) {
          delete o.distractorRationale;
        }
      });

      answerId = opts[correctIdx].id;

      // 셔플: 정답이 1번에 고정되지 않도록 4지선다 보기를 무작위로 섞음 (answerId가 정답 보기를 계속 추적)
      for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
    } else if (item.questionType === 'essay') {
      maxAnswerLength = MAX_ESSAY_ANSWER_LENGTH;
    } else if (item.questionType === 'cloze') {
      clozeBlanks = item.clozeBlanks?.map((b) => ({ id: generateUUID(), correctAnswers: b.correctAnswers }));
    }

    const q: QuestionRevision = {
      id: qId,
      questionId: generateUUID(),
      revision: 1,
      specId,
      topicId,
      unitId: unitId || undefined,
      difficultyLevel: intent.difficultyLevel,
      questionType: item.questionType,
      stem: item.stem,
      conceptDefinition: item.conceptDefinition,
      options: opts,
      answerOptionId: answerId,
      modelAnswer: item.modelAnswer,
      gradingChecklist: item.gradingChecklist,
      maxAnswerLength,
      clozeBlanks,
      explanation: item.explanation,
      deepReasoningHint: item.deepReasoningHint,
      currentReference: item.currentReference,
      status: 'ready_personal',
      createdAt: getCurrentISOTime(),
    };
    questions.push(q);

    validations.push({
      id: generateUUID(),
      questionRevisionId: qId,
      checkType: 'syntax_integrity',
      result: 'pass',
      reviewerKind: 'rule_engine',
      reason: '문항 수, 지문, 보기/모범답안, 정답 형식, 해설 형식 검사 통과',
      createdAt: getCurrentISOTime(),
    });
  }

  // 정답 위치 균등 무작위 분산 강제 적용 (4지선다 문항에만 적용. 서술형/단답형은 options가 없어 대상 아님)
  const mcQuestions = questions.filter((q) => q.questionType === 'multiple_choice');
  const distributedMc = distributeQuestionAnswersRandomly(mcQuestions);
  let mcCursor = 0;
  const distributedQuestions = questions.map((q) =>
    q.questionType === 'multiple_choice' ? distributedMc[mcCursor++] : q
  );

  // 문항 순서 무작위 셔플: AI가 프롬프트 지침에도 불구하고 questionType별로 뭉쳐서
  // 반환하는 경우(예: multiple_choice를 앞에, short_answer/essay를 뒤에)를 시스템 코드
  // 레벨에서 강제로 방지한다(AGENTS.md 6번 법칙과 동일한 원칙: 지침 + 코드 이중 안전장치).
  for (let i = distributedQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [distributedQuestions[i], distributedQuestions[j]] = [distributedQuestions[j], distributedQuestions[i]];
  }

  return { status: 'READY', spec, questions: distributedQuestions, validations };
}

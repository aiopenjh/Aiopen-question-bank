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
import { generateUUID, getCurrentISOTime, getGeminiApiKey } from '../data/db';
import { buildQuestionGenerationPrompt } from './prompts';
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
  CurrentInformationReference,
  getKoreanReferenceDate,
  isTrustedOfficialSourceUrl,
  requiresCurrentOfficialSources,
} from './current_information';

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
  documentInput?: AiDocumentInput;
  signal?: AbortSignal;
};

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

interface GeneratedQuestionInput {
  stem: string;
  conceptDefinition?: string;
  options: Array<{
    text: string;
    distractorRationale?: string;
  }>;
  correctOptionNumber: number;
  explanation: string;
  deepReasoningHint?: string;
  currentReference?: CurrentInformationReference;
}

function normalizeComparableText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function readOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readStudyIntentDecision(value: unknown): StudyIntentDecision {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('AI 응답 형식을 확인할 수 없습니다. 다시 시도해 주세요.');
  }

  const result = value as Record<string, unknown>;
  const status = result.intentStatus;
  if (status !== 'READY' && status !== 'NEEDS_CLARIFICATION' && status !== 'REJECTED') {
    throw new Error('AI가 주제 판정 상태를 올바르게 반환하지 않았습니다. 다시 시도해 주세요.');
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

export function validateGeneratedQuestions(
  value: unknown,
  expectedCount: number,
  currentInformationRequired = false,
  expectedReferenceDate?: string,
  groundingWasUsed = false
): GeneratedQuestionInput[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('AI 응답 형식을 확인할 수 없습니다. 다시 시도해 주세요.');
  }

  const questions = (value as { questions?: unknown }).questions;
  if (!Array.isArray(questions) || questions.length !== expectedCount) {
    throw new Error(
      `AI가 요청한 ${expectedCount}문항을 완전하게 반환하지 않았습니다. 다시 시도해 주세요.`
    );
  }

  const knownStems = new Set<string>();

  if (currentInformationRequired && !groundingWasUsed) {
    throw new Error('최신 공식 자료 검색 결과를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }

  return questions.map((rawQuestion, questionIndex) => {
    const number = questionIndex + 1;
    if (typeof rawQuestion !== 'object' || rawQuestion === null || Array.isArray(rawQuestion)) {
      throw new Error(`AI 응답의 ${number}번 문제 형식이 올바르지 않습니다. 다시 시도해 주세요.`);
    }

    const question = rawQuestion as Record<string, unknown>;
    const stem = typeof question.stem === 'string' ? question.stem.trim() : '';
    if (!stem) {
      throw new Error(`AI 응답의 ${number}번 문제 지문이 비어 있습니다. 다시 시도해 주세요.`);
    }

    const normalizedStem = normalizeComparableText(stem);
    if (knownStems.has(normalizedStem)) {
      throw new Error(`AI 응답에 동일한 문제 지문이 반복되었습니다. 다시 시도해 주세요.`);
    }
    knownStems.add(normalizedStem);

    if (!Array.isArray(question.options) || question.options.length !== 4) {
      throw new Error(`AI 응답의 ${number}번 문제 보기가 4개가 아닙니다. 다시 시도해 주세요.`);
    }

    const knownOptions = new Set<string>();
    const options = question.options.map((rawOption, optionIndex) => {
      if (typeof rawOption !== 'object' || rawOption === null || Array.isArray(rawOption)) {
        throw new Error(
          `AI 응답의 ${number}번 문제 ${optionIndex + 1}번 보기 형식이 올바르지 않습니다. 다시 시도해 주세요.`
        );
      }

      const option = rawOption as Record<string, unknown>;
      const text = typeof option.text === 'string' ? option.text.trim() : '';
      if (!text) {
        throw new Error(
          `AI 응답의 ${number}번 문제 ${optionIndex + 1}번 보기가 비어 있습니다. 다시 시도해 주세요.`
        );
      }

      const normalizedOption = normalizeComparableText(text);
      if (knownOptions.has(normalizedOption)) {
        throw new Error(`AI 응답의 ${number}번 문제에 중복 보기가 있습니다. 다시 시도해 주세요.`);
      }
      knownOptions.add(normalizedOption);

      return {
        text,
        distractorRationale: readOptionalText(option.distractorRationale),
      };
    });

    if (
      typeof question.correctOptionNumber !== 'number' ||
      !Number.isInteger(question.correctOptionNumber) ||
      question.correctOptionNumber < 1 ||
      question.correctOptionNumber > options.length
    ) {
      throw new Error(`AI 응답의 ${number}번 문제 정답 번호가 올바르지 않습니다. 다시 시도해 주세요.`);
    }

    const explanation =
      typeof question.explanation === 'string' ? question.explanation.trim() : '';
    if (!explanation) {
      throw new Error(`AI 응답의 ${number}번 문제 해설이 비어 있습니다. 다시 시도해 주세요.`);
    }

    let currentReference: CurrentInformationReference | undefined;
    if (currentInformationRequired) {
      const rawReference = question.currentReference;
      if (typeof rawReference !== 'object' || rawReference === null || Array.isArray(rawReference)) {
        throw new Error(`AI가 ${number}번 문제의 최신 공식 출처를 확인하지 못했습니다. 다시 시도해 주세요.`);
      }
      const reference = rawReference as Record<string, unknown>;
      const referenceDate = readOptionalText(reference.referenceDate);
      const sourceAgency = readOptionalText(reference.sourceAgency);
      const sourceTitle = readOptionalText(reference.sourceTitle);
      const sourceUrl = readOptionalText(reference.sourceUrl);
      if (
        !referenceDate ||
        referenceDate !== expectedReferenceDate ||
        reference.effectiveStatus !== 'currently_effective' ||
        !sourceAgency ||
        !sourceTitle ||
        !sourceUrl ||
        !isTrustedOfficialSourceUrl(sourceUrl)
      ) {
        throw new Error(`AI가 ${number}번 문제에 현재 시행 중인 공식 근거를 제시하지 못했습니다. 다시 시도해 주세요.`);
      }
      currentReference = {
        referenceDate,
        effectiveStatus: 'currently_effective',
        sourceAgency,
        sourceTitle,
        sourceUrl,
      };
    }

    return {
      stem,
      conceptDefinition: readOptionalText(question.conceptDefinition),
      options,
      correctOptionNumber: question.correctOptionNumber,
      explanation,
      deepReasoningHint: readOptionalText(question.deepReasoningHint),
      currentReference,
    };
  });
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
  const { intent, ownerId, topicId, topicName, category, unitId, unitTitle, customContext, documentInput, signal } = params;
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
      requiredAction: '설정 탭에서 사용할 AI API Key를 등록해 주세요.',
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
    console.error('AI 출제 API 통신 실패:', err);
    const detail = typeof err?.message === 'string' && err.message.trim().length > 0
      ? `\n\n${err.message.trim()}`
      : '';
    return {
      status: 'FAILED',
      message: `[AI 출제 실패]\n요청한 문제를 안전하게 생성하지 못했습니다.${detail}\n\n기존 문제와 학습 데이터는 그대로 유지됩니다.`,
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
  const { apiKey, intent, ownerId, topicId, topicName, category, unitId, unitTitle, customContext, documentInput, signal } = params;

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

  const currentInformationRequired = !documentInput && requiresCurrentOfficialSources(
    resolvedDomain,
    category,
    unitTitle,
    intent.focusConcepts.join(' ')
  );
  const referenceDate = currentInformationRequired ? getKoreanReferenceDate() : undefined;

  const prompt = buildQuestionGenerationPrompt({
    intent,
    resolvedDomain,
    category,
    unitTitle,
    customContext,
    currentInformationInstruction: referenceDate
      ? buildCurrentInformationInstruction(referenceDate)
      : undefined,
  });

  const documentPrompt = documentInput
    ? `${prompt}\n\n첨부된 PDF의 ${documentInput.pageStart}~${documentInput.pageEnd}페이지를 문제의 최우선 근거로 사용하십시오. PDF 밖의 내용을 임의로 섞지 마십시오.`
    : prompt;
  const completion = await callUniversalAiCompletion(
    apiKey,
    documentPrompt,
    signal,
    documentInput,
    { enableGoogleSearch: currentInformationRequired }
  );
  const parsed = parseAiJsonResponse<unknown>(completion.text);
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
  const generatedQuestions = validateGeneratedQuestions(
    parsed,
    intent.targetCount,
    currentInformationRequired,
    referenceDate,
    completion.groundingSources.length > 0
  );
  const questions: QuestionRevision[] = [];
  const validations: ValidationRecord[] = [];

  for (const item of generatedQuestions) {
    const qId = generateUUID();
    const opts = item.options.map((o) => ({
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

    const answerId = opts[correctIdx].id;

    // 셔플: 정답이 1번에 고정되지 않도록 4지선다 보기를 무작위로 섞음 (answerId가 정답 보기를 계속 추적)
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }

    const q: QuestionRevision = {
      id: qId,
      questionId: generateUUID(),
      revision: 1,
      specId,
      topicId,
      unitId: unitId || undefined,
      difficultyLevel: intent.difficultyLevel,
      stem: item.stem,
      conceptDefinition: item.conceptDefinition,
      options: opts,
      answerOptionId: answerId,
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
      reason: '문항 수, 지문, 보기, 정답 번호, 해설 형식 검사 통과',
      createdAt: getCurrentISOTime(),
    });
  }

  // 정답 위치 균등 무작위 분산 강제 적용
  const distributedQuestions = distributeQuestionAnswersRandomly(questions);
  return { status: 'READY', spec, questions: distributedQuestions, validations };
}

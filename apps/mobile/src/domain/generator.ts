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
import { buildQuestionGenerationPrompt, isSubjectiveEligible } from './prompts';
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
import { MAX_ESSAY_ANSWER_LENGTH, readOptionalText, validateGeneratedQuestions } from './generator_validation';

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
    completion.groundingSources.length > 0,
    isSubjectiveEligible(intent)
  );
  const questions: QuestionRevision[] = [];
  const validations: ValidationRecord[] = [];

  for (const item of generatedQuestions) {
    const qId = generateUUID();

    let opts: QuestionRevision['options'] = [];
    let answerId = '';
    let maxAnswerLength: number | undefined;

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
  return { status: 'READY', spec, questions: distributedQuestions, validations };
}

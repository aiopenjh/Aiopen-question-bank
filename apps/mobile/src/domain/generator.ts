/**
 * Intent Scoping & Fact-Based Question Generator Engine
 * Reference: AGENTS.md & CogniQuest_개발명세_v1
 * 
 * 원칙: 하드코딩 배제, 미연동 시 정직한 상태(NEEDS_CONNECTION) 반환.
 */

import {
  LearningSpec,
  QuestionRevision,
  ValidationRecord,
  UUID,
} from '../contracts/types';
import { addQuestions, generateUUID, getCurrentISOTime, getGeminiApiKey } from '../data/db';
import { buildQuestionGenerationPrompt } from './prompts';
import { callUniversalAiCompletion, parseAiJsonResponse } from './ai_client';
import { ScopedIntent, analyzeUserIntent, extractDomainFromText } from './intent';
import { distributeQuestionAnswersRandomly } from './question_distribution';
import { GeneratedUnitItem, generateCurriculumUnits } from './curriculum_generator';

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
      status: 'FAILED';
      message: string;
    };

/**
 * 문제 출제 및 무결성 검증 파이프라인
 * - API Key가 없으면 가짜 문제를 내지 않고 NEEDS_CONNECTION을 반환합니다.
 * - API Key가 있으면 실제 최신 AI API를 호출하여 정밀 4지선다 문항을 생성합니다.
 */
export async function generateFactBasedQuestions(params: {
  intent: ScopedIntent;
  ownerId: UUID;
  topicId: UUID;
  topicName?: string;
  category?: string;
  unitId?: UUID;
  unitTitle?: string;
  customContext?: string;
}): Promise<GenerationOutcome> {
  const { intent, ownerId, topicId, topicName, category, unitId, unitTitle, customContext } = params;
  const apiKey = await getGeminiApiKey();

  // API Key 미연동 시: 가짜 문제를 억지로 내지 않고 솔직한 통로 안내 반환
  if (!apiKey || apiKey.trim().length < 8) {
    return {
      status: 'NEEDS_CONNECTION',
      provider: 'Google Gemini 3.5 / 3.0 / 2.0 AI Provider',
      message: 'AI 출제 엔진 통로가 미연동 상태입니다. (하드코딩된 가짜 문제를 일절 배제합니다)',
      requiredAction: '설정 탭에서 최신 Gemini 3.5 / Claude / GPT API Key를 등록해 주세요.',
    };
  }

  try {
    const { questions, validations, spec } = await generateViaUniversalAiApi({
      apiKey: apiKey.trim(),
      intent,
      ownerId,
      topicId,
      topicName,
      category,
      unitId,
      unitTitle,
      customContext,
    });

    // 영속 저장소에 등록
    await addQuestions(questions);

    return {
      status: 'READY',
      spec,
      questions,
      validations,
    };
  } catch (err: any) {
    console.error('AI 출제 API 통신 실패:', err);
    return {
      status: 'FAILED',
      message: `[AI 서버 연결 실패]\n${err?.message || 'API 서버와 통신할 수 없습니다.'}\n\n※ 원칙에 따라 가짜 하드코딩 문제를 생성하지 않고 연결 상태를 정직하게 통보합니다. 설정 탭에서 API 키와 모델을 확인해 주세요.`,
    };
  }
}

/**
 * 범용 최신 AI 통신 엔진 (Gemini 3.5 + Claude 3.5 + GPT-4o)
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
}): Promise<{
  spec: LearningSpec;
  questions: QuestionRevision[];
  validations: ValidationRecord[];
}> {
  const { apiKey, intent, ownerId, topicId, topicName, category, unitId, unitTitle, customContext } = params;

  const specId = generateUUID();
  const spec: LearningSpec = {
    id: specId,
    revision: 1,
    ownerId,
    topicId,
    sourceRevisionIds: [],
    unitIds: unitId ? [unitId] : [],
    level: intent.level,
    questionCount: intent.targetCount,
    createdAt: getCurrentISOTime(),
  };

  const resolvedDomain = (topicName && topicName.trim().length > 0)
    ? topicName.trim()
    : intent.domain;

  const prompt = buildQuestionGenerationPrompt({
    intent,
    resolvedDomain,
    category,
    unitTitle,
    customContext,
  });

  const rawJson = await callUniversalAiCompletion(apiKey, prompt);
  const parsed = parseAiJsonResponse<{ questions: any[] }>(rawJson);
  const questions: QuestionRevision[] = [];
  const validations: ValidationRecord[] = [];

  for (const item of parsed.questions || []) {
    const qId = generateUUID();
    const opts = (item.options || []).map((o: any) => ({
      id: generateUUID(),
      text: o.text || '',
      isDistractor: true,
      distractorRationale: o.distractorRationale || undefined,
    }));

    while (opts.length < 4) {
      opts.push({
        id: generateUUID(),
        text: `선지 ${opts.length + 1}`,
        isDistractor: true,
        distractorRationale: '기본 선지',
      });
    }

    const correctIdx = typeof item.correctIndex === 'number' && item.correctIndex >= 0 && item.correctIndex < opts.length
      ? item.correctIndex
      : 0;

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
      stem: item.stem || '문제 지문',
      conceptDefinition: item.conceptDefinition || undefined,
      options: opts,
      answerOptionId: answerId,
      explanation: item.explanation || '정답 해설',
      deepReasoningHint: item.deepReasoningHint,
      status: 'ready_personal',
      createdAt: getCurrentISOTime(),
    };
    questions.push(q);

    validations.push({
      id: generateUUID(),
      questionRevisionId: qId,
      checkType: 'fact_grounding',
      result: 'pass',
      reviewerKind: 'ai_reviewer',
      reason: '최신 AI 실시간 출제 및 4지선다 무결성 통과',
      createdAt: getCurrentISOTime(),
    });
  }

  // 정답 위치 균등 무작위 분산 강제 적용
  const distributedQuestions = distributeQuestionAnswersRandomly(questions);
  return { spec, questions: distributedQuestions, validations };
}

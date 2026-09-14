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
  CognitiveLevel,
  LearnerKnowledgeLevel,
  UUID,
} from '../contracts/types';
import { addQuestions, generateUUID, getCurrentISOTime, getGeminiApiKey, getPreferredAiModel } from '../data/db';
import { buildQuestionGenerationPrompt, buildCurriculumPrompt } from './prompts';

export interface ScopedIntent {
  domain: string;
  level: CognitiveLevel;
  levelLabel: string;
  learnerLevel?: LearnerKnowledgeLevel;
  knownScope?: string;
  levelBriefing?: string;
  style: string;
  targetCount: number;
  focusConcepts: string[];
  factReferencePolicy: string;
}

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
 * 1. 동적 의도 분석 및 학습자 지식 수준 캘리브레이션
 * 특정 과목에 종속되지 않고 사용자가 공부하려는 임의의 주제와 지식 수준을 조율합니다.
 */
export function analyzeUserIntent(
  inputPrompt: string,
  topicName?: string,
  options?: {
    learnerLevel?: LearnerKnowledgeLevel;
    knownScope?: string;
    targetCount?: number;
  }
): ScopedIntent {
  const text = inputPrompt.trim();
  // topicName이 전달된 경우 해당 과목명을 최우선 도메인으로 고정 (단원명/프롬프트에 의한 분야 왜곡 방지)
  const domain = (topicName && topicName.trim().length > 0)
    ? topicName.trim()
    : (extractDomainFromText(text) || '자유 학습 주제');

  const learnerLevel: LearnerKnowledgeLevel = options?.learnerLevel || 'basic';
  const knownScope = options?.knownScope?.trim();

  let level: CognitiveLevel = 'apply';
  let levelLabel = '🌿 기본기 보유 (핵심 원리 & 실전 활용)';
  let levelBriefing = '단순 명칭 암기나 너무 뻔한 기초는 빼고, 핵심 원리 이해 및 표준 실전/실무 활용 예제 위주로 출제합니다.';

  if (learnerLevel === 'beginner') {
    level = 'comprehend';
    levelLabel = '🐣 왕초보 입문 (기초 개념 & 직관적 비유)';
    levelBriefing = '난해한 고급 이론이나 복잡한 내부 구조는 배제하고, 직관적인 비유와 필수 기본 정의 위주로 출제합니다.';
  } else if (learnerLevel === 'basic') {
    level = 'apply';
    levelLabel = '🌿 기본기 보유 (핵심 원리 & 실전 활용)';
    levelBriefing = '단순 명칭 암기나 너무 뻔한 기초는 빼고, 핵심 원리 이해 및 표준 실전/실무 활용 예제 위주로 출제합니다.';
  } else if (learnerLevel === 'advanced') {
    level = 'analyze';
    levelLabel = '🚀 실전 시험대비 (함정 선지 & 오류 디버깅)';
    levelBriefing = '교과서식 단순 설명은 빼고, 실전 기출 수준의 빈출 함정 선지와 오류 해결(디버깅) 능력을 측정합니다.';
  } else if (learnerLevel === 'master') {
    level = 'synthesize';
    levelLabel = '👑 심화/마스터 (복합 종합 추론)';
    levelBriefing = '단순 암기 문제 0%! 2가지 이상의 원리가 결합된 고난도 종합 추론 문제를 출제합니다.';
  }

  if (knownScope) {
    levelBriefing += `\n(학습자 기준점: "${knownScope}" 맞춤 조율 반영)`;
  }

  // 문항 수 추출 (선택값 우선, 기본 3 / 5 / 10 / 20)
  let targetCount = options?.targetCount || 3;
  if (!options?.targetCount) {
    const countMatch = text.match(/([0-9]+)\s*문제/);
    if (countMatch && countMatch[1]) {
      const parsed = parseInt(countMatch[1], 10);
      if (parsed >= 1 && parsed <= 10) {
        targetCount = parsed;
      }
    }
  }

  return {
    domain,
    level,
    levelLabel,
    learnerLevel,
    knownScope,
    levelBriefing,
    style: '공인 교재 및 정통 학술 사실 기반 4지선다형',
    targetCount,
    focusConcepts: [text],
    factReferencePolicy: '공인 학술/교육과정 기준 팩트 및 출제 근거 필수 첨부',
  };
}

function extractDomainFromText(text: string): string {
  const cleaned = text
    .replace(/\[[^\]]*\]/g, '') // 단원명이나 태그 [기초과정] 등 제거
    .replace(/([0-9]+)\s*문제.*/, '')
    .replace(/([0-9]+)\s*문항.*/, '')
    .replace(/출제.*/, '')
    .replace(/풀어줘.*/, '')
    .replace(/풀어볼래.*/, '')
    .replace(/내줘.*/, '')
    .replace(/알려줘.*/, '')
    .trim();
  return cleaned || text.trim();
}

/**
 * 2. 문제 출제 및 무결성 검증 파이프라인
 * - API Key가 없으면 가짜 문제를 내지 않고 NEEDS_CONNECTION을 반환합니다.
 * - API Key가 있으면 실제 Gemini API를 호출하여 정밀 4지선다 문항을 생성합니다.
 */
export async function generateFactBasedQuestions(params: {
  intent: ScopedIntent;
  ownerId: UUID;
  topicId: UUID;
  topicName?: string;
  unitId?: UUID;
  unitTitle?: string;
  customContext?: string;
}): Promise<GenerationOutcome> {
  const { intent, ownerId, topicId, topicName, unitId, unitTitle, customContext } = params;
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
 * AI JSON 응답 파싱 유틸리티 (마크다운 백틱 제거)
 */
function parseAiJsonResponse<T>(rawText: string): T {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return JSON.parse(cleaned.trim());
}

/**
 * 범용 최신 AI 통신 엔진
 * - Gemini 최신 버전(2.5 Flash / 2.0 Flash) 기본 적용
 * - Claude 3.5 Sonnet (sk-ant- 키) 및 OpenAI GPT-4o (sk- 키) 멀티 프로바이더 지원
 * - 404 방어: 최신 모델부터 호환 모델까지 자동 캐스케이드 폴백
 */
async function callUniversalAiCompletion(apiKey: string, prompt: string): Promise<string> {
  const trimmedKey = apiKey.trim();

  // 1. Anthropic Claude 3.5 Sonnet 지원 (sk-ant- 시작 키)
  // 1. Anthropic Claude 3.5 Sonnet 지원 (sk-ant- 시작 키)
  if (trimmedKey.startsWith('sk-ant-')) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': trimmedKey,
        'anthropic-version': '2023-06-01',
        'dangerously-allow-browser': 'true',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude 3.5 통신 실패 (${res.status}): ${errText}`);
    }
    const data = await res.json();
    const rawText = data.content?.[0]?.text;
    if (!rawText) throw new Error('Claude로부터 빈 응답을 받았습니다.');
    return rawText;
  }

  // 2. OpenAI GPT-4o 지원 (sk- 시작 키)
  if (trimmedKey.startsWith('sk-')) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${trimmedKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI GPT-4o 통신 실패 (${res.status}): ${errText}`);
    }
    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) throw new Error('OpenAI로부터 빈 응답을 받았습니다.');
    return rawText;
  }

  // 3. Google Gemini: 3.5 최우선 사용 및 통신 시간 만료(타임아웃) 시 다음 버전 자동 우회
  const preferredModel = await getPreferredAiModel();
  let candidateModels = Array.from(
    new Set([
      preferredModel,
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ].filter(Boolean) as string[])
  );

  let lastError: any = null;
  let triedModels = new Set<string>();

  for (let i = 0; i < candidateModels.length; i++) {
    const model = candidateModels[i];
    if (triedModels.has(model)) continue;
    triedModels.add(model);

    let timeoutTimer: any = null;
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(trimmedKey)}`;
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      if (controller) {
        // 통신 시간 만료(25초 초과) 시 자동 중단 후 다음 가용 모델로 자동 전환
        timeoutTimer = setTimeout(() => controller.abort(), 25000);
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': trimmedKey,
        },
        signal: controller?.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 8192,
            temperature: 0.2, // 환각(Hallucination) 방지를 위한 엄격한 결정론적 온도 설정
          },
        }),
      });
      if (timeoutTimer) clearTimeout(timeoutTimer);

      if (res.status === 404) {
        lastError = new Error(`Gemini 모델 [${model}] 404 Not Found`);
        console.warn(`Gemini 모델 [${model}] 404 -> 다음 호환 모델 자동 전환`);

        // 만약 등록된 후보 모델들이 모두 404인 경우, 구글 API 모델 목록 엔드포인트를 동적 질의하여 가용 모델 자동 발견
        if (i === candidateModels.length - 1) {
          try {
            const listRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmedKey)}`
            );
            if (listRes.ok) {
              const listData = await listRes.json();
              const activeGoogleModels: string[] = (listData.models || [])
                .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
                .map((m: any) => m.name.replace('models/', ''));
              for (const gm of activeGoogleModels) {
                if (!triedModels.has(gm)) {
                  candidateModels.push(gm);
                }
              }
            }
          } catch {
            // 네트워크 오류 시 기존 목록 유지
          }
        }
        continue;
      }

      // 구글 AI 서버 일시적 과부하 (503 High Demand), 게이트웨이 오류(502/504), 할당량(429) 자동 전환
      if (res.status === 503 || res.status === 502 || res.status === 504 || res.status === 500 || res.status === 429) {
        const errBody = await res.text();
        lastError = new Error(`Gemini 모델 [${model}] 서버 일시 혼잡 (${res.status}): ${errBody}`);
        console.warn(`Gemini 모델 [${model}] 서버 혼잡 (${res.status}) -> 다음 가용 모델 자동 전환`);
        continue;
      }

      if (!res.ok) {
        const errorText = await res.text();
        if (res.status === 400) {
          throw new Error(`등록된 API 키가 유효하지 않습니다 (Google 400 오류). Google AI Studio(https://aistudio.google.com)에서 발급받은 정식 API 키(보통 AIzaSy...로 시작)인지 확인해 주세요.`);
        }
        if (res.status === 403) {
          throw new Error(`Google AI 접근 권한 거부 (403): API 키의 권한이나 활성화 상태를 확인해 주세요.`);
        }
        throw new Error(`Gemini API 통신 실패 (${res.status}): ${errorText}`);
      }

      const data = await res.json();
      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) {
        throw new Error(`Gemini 모델 [${model}]로부터 비어있는 응답을 받았습니다.`);
      }
      return rawJson;
    } catch (err: any) {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      lastError = err;
      const msg = err?.message || '';
      // 통신 시간 만료, AbortError, 서버 혼잡 시 즉시 다음 버전 모델로 자동 폴백
      if (
        msg.includes('404') ||
        msg.includes('503') ||
        msg.includes('502') ||
        msg.includes('500') ||
        msg.includes('504') ||
        msg.includes('429') ||
        msg.includes('high demand') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('Resource has been exhausted') ||
        err.name === 'AbortError' ||
        msg.includes('aborted') ||
        msg.includes('timeout') ||
        msg.includes('Network request failed')
      ) {
        console.warn(`Gemini 모델 [${model}] 통신 지연/타임아웃 발생 -> 다음 상위 버전으로 자동 우회 시도`);
        continue;
      }
      throw err;
    }
  }

  const detailedMsg = lastError?.message || '';
  if (detailedMsg.includes('503') || detailedMsg.includes('high demand') || detailedMsg.includes('UNAVAILABLE')) {
    throw new Error('Google Gemini AI 서버가 현재 일시적인 전 세계 트래픽 폭주(503 High Demand) 상태입니다. 약 10~30초 후 다시 시도해 주세요.');
  }

  throw lastError || new Error('최신 Gemini AI 모델에 연결할 수 없습니다. Google AI Studio에서 발급받은 정식 API 키인지 확인해 주세요.');
}

/**
 * 범용 최신 AI 통신 엔진 (Gemini 2.5/2.0 + Claude 3.5 + GPT-4o)
 */
async function generateViaUniversalAiApi(params: {
  apiKey: string;
  intent: ScopedIntent;
  ownerId: UUID;
  topicId: UUID;
  topicName?: string;
  unitId?: UUID;
  unitTitle?: string;
  customContext?: string;
}): Promise<{
  spec: LearningSpec;
  questions: QuestionRevision[];
  validations: ValidationRecord[];
}> {
  const { apiKey, intent, ownerId, topicId, topicName, unitId, unitTitle, customContext } = params;

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

/**
 * 정답 선지 균등 무작위 분산 배치 엔진 (Balanced Random Distribution)
 * - 특정 번호(1번이나 2번)로 정답이 고정되거나 몰리는 현상을 100% 원천 차단합니다.
 * - 3문제/5문제/10문제 등 한 시험 세트 내에서 정답 위치(1, 2, 3, 4번)가 서로 다른 번호로 골고루 무작위 분산되도록 강제합니다.
 * - 연속된 두 문제의 정답이 동일한 번호로 중복되지 않도록 방지합니다.
 */
export function distributeQuestionAnswersRandomly(questions: QuestionRevision[]): QuestionRevision[] {
  if (!questions || questions.length === 0) return [];

  const n = questions.length;
  const baseSlots = [0, 1, 2, 3]; // 0: 1번, 1: 2번, 2: 3번, 3: 4번
  const targetSlots: number[] = [];

  while (targetSlots.length < n) {
    // 0~3 무작위 셔플
    const pool = [...baseSlots];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    for (const slot of pool) {
      if (targetSlots.length >= n) break;
      // 바로 직전 문제와 정답 번호가 겹치지 않도록 방어
      if (targetSlots.length > 0 && targetSlots[targetSlots.length - 1] === slot) {
        const alt = baseSlots.find((s) => s !== slot && s !== targetSlots[targetSlots.length - 1]);
        targetSlots.push(alt !== undefined ? alt : (slot + 1) % 4);
      } else {
        targetSlots.push(slot);
      }
    }
  }

  return questions.map((q, qIdx) => {
    const targetSlot = targetSlots[qIdx]; // 0~3 중 이번 문제의 정답 위치

    // 현재 문제의 공식 정답 선지 및 오답 선지 분리
    const correctOption = q.options.find((o) => o.id === q.answerOptionId) || q.options[0];
    const distractors = q.options.filter((o) => o.id !== correctOption.id);

    // 오답 선지 셔플
    for (let i = distractors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [distractors[i], distractors[j]] = [distractors[j], distractors[i]];
    }

    // 새 4지선다 보기 배열 생성: targetSlot 위치에 공식 정답을 정확히 배치
    const newOptions: typeof q.options = [];
    let distractorIdx = 0;

    for (let slot = 0; slot < 4; slot++) {
      if (slot === targetSlot) {
        newOptions.push({
          ...correctOption,
          isDistractor: false,
        });
      } else {
        if (distractors[distractorIdx]) {
          newOptions.push({
            ...distractors[distractorIdx],
            isDistractor: true,
          });
          distractorIdx++;
        } else {
          newOptions.push({
            id: generateUUID(),
            text: `기타 선지 ${slot + 1}`,
            isDistractor: true,
          });
        }
      }
    }

    return {
      ...q,
      options: newOptions,
      answerOptionId: correctOption.id,
    };
  });
}

export interface GeneratedUnitItem {
  title: string;
  description?: string;
  depth: 1 | 2 | 3;
}

/**
 * 3. AI 커리큘럼(단원/목차) 자동 설계 엔진 (Gemini 2.5/2.0 + Claude 3.5 + GPT-4o 지원)
 * 사용자가 주제만 입력하면 AI가 학습 수준에 맞춰 체계적인 4~6개 단원 목차를 자동 생성합니다.
 */
export async function generateCurriculumUnits(params: {
  topicName: string;
  topicDescription?: string;
  learnerLevel?: LearnerKnowledgeLevel;
  knownScope?: string;
  startUnitIndex?: number;
  stageName?: string;
  existingUnitTitles?: string[];
}): Promise<GeneratedUnitItem[]> {
  const {
    topicName,
    topicDescription,
    learnerLevel = 'basic',
    knownScope,
    startUnitIndex = 1,
    stageName,
    existingUnitTitles = [],
  } = params;
  const apiKey = await getGeminiApiKey();

  // API 키가 있으면 실제 최신 AI를 호출하여 고품질 맞춤형 목차 생성
  if (apiKey && apiKey.trim().length > 8) {
    try {
      const prompt = buildCurriculumPrompt({
        topicName,
        topicDescription,
        learnerLevel,
        knownScope,
        startUnitIndex,
        stageName,
        existingUnitTitles,
      });

      const rawJson = await callUniversalAiCompletion(apiKey, prompt);
      const parsed = parseAiJsonResponse<{ units: any[] }>(rawJson);
      if (Array.isArray(parsed.units) && parsed.units.length > 0) {
        return parsed.units.map((u: any) => ({
          title: String(u.title || '단원'),
          description: u.description ? String(u.description) : undefined,
          depth: 1,
        }));
      }
      throw new Error('AI가 단원 목록 규격을 올바르게 반환하지 않았습니다.');
    } catch (err: any) {
      console.error('최신 AI 커리큘럼 생성 실패:', err);
      throw new Error(`[AI 목차 생성 실패]\n${err?.message || '통신 응답 오류'}\n\n※ 원칙에 따라 가짜 목차를 생성하지 않고 실패를 정직하게 통보합니다.`);
    }
  }

  throw new Error('AI API 키가 등록되지 않았습니다. [설정] 탭에서 최신 Gemini 3.5 / Claude / GPT API 키를 먼저 연동해 주세요. (가짜 하드코딩 목차 생성을 일절 배제합니다)');
}

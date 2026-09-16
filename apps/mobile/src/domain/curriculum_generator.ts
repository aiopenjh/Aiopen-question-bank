/**
 * AI Curriculum / Unit Outline Auto-Generation Engine
 * Reference: CogniQuest_개발명세_v1
 */

import { LearnerKnowledgeLevel } from '../contracts/types';
import { getGeminiApiKey } from '../data/db';
import { buildCurriculumPrompt } from './prompts';
import { callUniversalAiCompletion, parseAiJsonResponse } from './ai_client';
import {
  detectObviousInvalidStudyInput,
  StudyIntentResolutionError,
  StudyIntentStatus,
} from './intent';

export interface GeneratedUnitItem {
  title: string;
  description?: string;
  depth: 1 | 2 | 3;
}

function readIntentStatus(value: Record<string, unknown>): StudyIntentStatus {
  if (
    value.intentStatus === 'READY' ||
    value.intentStatus === 'NEEDS_CLARIFICATION' ||
    value.intentStatus === 'REJECTED'
  ) {
    return value.intentStatus;
  }
  throw new Error('AI가 주제 판정 상태를 올바르게 반환하지 않았습니다.');
}

function readClarificationChoices(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 3);
}

/**
 * AI 커리큘럼(단원/목차) 자동 설계 엔진
 * 사용자가 주제만 입력하면 AI가 학습 수준에 맞춰 체계적인 4~6개 단원 목차를 자동 생성합니다.
 */
export async function generateCurriculumUnits(params: {
  topicName: string;
  topicDescription?: string;
  category?: string;
  learnerLevel?: LearnerKnowledgeLevel;
  difficultyLevel?: number;
  knownScope?: string;
  startUnitIndex?: number;
  stageName?: string;
  existingUnitTitles?: string[];
  signal?: AbortSignal;
}): Promise<GeneratedUnitItem[]> {
  const {
    topicName,
    topicDescription,
    category,
    learnerLevel = 'basic',
    difficultyLevel,
    knownScope,
    startUnitIndex = 1,
    stageName,
    existingUnitTitles = [],
    signal,
  } = params;
  const apiKey = await getGeminiApiKey();
  const obviousInvalid = detectObviousInvalidStudyInput(topicName);
  if (obviousInvalid && obviousInvalid.status !== 'READY') {
    throw new StudyIntentResolutionError(
      obviousInvalid.status,
      obviousInvalid.message || '학습할 주제를 조금 더 구체적으로 입력해 주세요.'
    );
  }

  // API 키가 있으면 실제 최신 AI를 호출하여 고품질 맞춤형 목차 생성
  if (apiKey && apiKey.trim().length > 8) {
    try {
      const prompt = buildCurriculumPrompt({
        topicName,
        topicDescription,
        category,
        learnerLevel,
        difficultyLevel,
        knownScope,
        startUnitIndex,
        stageName,
        existingUnitTitles,
      });

      const rawJson = await callUniversalAiCompletion(apiKey, prompt, signal);
      const parsed = parseAiJsonResponse<unknown>(rawJson);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('AI가 목차 응답 형식을 올바르게 반환하지 않았습니다.');
      }

      const result = parsed as Record<string, unknown>;
      const status = readIntentStatus(result);
      if (status !== 'READY') {
        const choices = readClarificationChoices(result.clarificationChoices);
        const message =
          typeof result.message === 'string' && result.message.trim()
            ? result.message.trim()
            : status === 'NEEDS_CLARIFICATION'
              ? '학습하려는 주제의 관계나 범위를 조금 더 구체적으로 알려 주세요.'
              : '입력한 내용에서 학습 주제를 확인하기 어렵습니다.';
        throw new StudyIntentResolutionError(status, message, choices);
      }

      if (!Array.isArray(result.units) || result.units.length !== 5) {
        throw new Error('AI가 요청한 5개 단원을 완전하게 반환하지 않았습니다.');
      }

      const knownTitles = new Set<string>();
      return result.units.map((rawUnit, index) => {
        if (typeof rawUnit !== 'object' || rawUnit === null || Array.isArray(rawUnit)) {
          throw new Error(`AI 응답의 ${index + 1}번째 단원 형식이 올바르지 않습니다.`);
        }
        const unit = rawUnit as Record<string, unknown>;
        const title = typeof unit.title === 'string' ? unit.title.trim() : '';
        if (!title) {
          throw new Error(`AI 응답의 ${index + 1}번째 단원 제목이 비어 있습니다.`);
        }
        const normalizedTitle = title.replace(/\s+/g, '').toLowerCase();
        if (knownTitles.has(normalizedTitle)) {
          throw new Error('AI 응답에 동일한 단원 제목이 반복되었습니다.');
        }
        knownTitles.add(normalizedTitle);

        return {
          title,
          description:
            typeof unit.description === 'string' && unit.description.trim()
              ? unit.description.trim()
              : undefined,
          depth: 1,
        };
      });
    } catch (err: any) {
      if (err instanceof StudyIntentResolutionError) {
        throw err;
      }
      console.error('최신 AI 커리큘럼 생성 실패:', err);
      throw new Error(`[AI 목차 생성 실패]\n${err?.message || '통신 응답 오류'}\n\n※ 원칙에 따라 가짜 목차를 생성하지 않고 실패를 정직하게 통보합니다.`);
    }
  }

  throw new Error('AI API 키가 등록되지 않았습니다. [설정] 탭에서 사용할 API 키를 먼저 등록해 주세요. (가짜 하드코딩 목차 생성을 일절 배제합니다)');
}

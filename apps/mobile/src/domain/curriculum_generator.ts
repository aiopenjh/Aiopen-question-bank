/**
 * AI Curriculum / Unit Outline Auto-Generation Engine
 * Reference: CogniQuest_개발명세_v1
 */

import { LearnerKnowledgeLevel } from '../contracts/types';
import { getGeminiApiKey } from '../data/db';
import { buildCurriculumPrompt } from './prompts';
import { callUniversalAiCompletion, parseAiJsonResponse } from './ai_client';

export interface GeneratedUnitItem {
  title: string;
  description?: string;
  depth: 1 | 2 | 3;
}

/**
 * AI 커리큘럼(단원/목차) 자동 설계 엔진 (Gemini 3.5 + Claude 3.5 + GPT-4o 지원)
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

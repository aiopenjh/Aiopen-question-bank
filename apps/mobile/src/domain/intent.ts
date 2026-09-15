/**
 * Dynamic Intent Scoping & Knowledge Level Calibration
 * Reference: AGENTS.md & CogniQuest_개발명세_v1
 */

import { CognitiveLevel, LearnerKnowledgeLevel } from '../contracts/types';

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

/**
 * 동적 의도 분석 및 학습자 지식 수준 캘리브레이션
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

export function extractDomainFromText(text: string): string {
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

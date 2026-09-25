/**
 * Dynamic Intent Scoping & Knowledge Level Calibration
 * Reference: AGENTS.md & CogniQuest_개발명세_v1
 */

import { CognitiveLevel, LearnerKnowledgeLevel } from '../contracts/types';
import type { QuestionTypeMode } from './question_type_plan';
import {
  getDifficultyProfile,
  legacyLevelToDifficulty,
  normalizeDifficultyLevel,
} from './difficulty';

export type StudyIntentStatus = 'READY' | 'NEEDS_CLARIFICATION' | 'REJECTED';

export interface StudyIntentDecision {
  status: StudyIntentStatus;
  message?: string;
  clarificationChoices?: string[];
}

export class StudyIntentResolutionError extends Error {
  status: Exclude<StudyIntentStatus, 'READY'>;
  clarificationChoices: string[];

  constructor(
    status: Exclude<StudyIntentStatus, 'READY'>,
    message: string,
    clarificationChoices: string[] = []
  ) {
    super(message);
    this.name = 'StudyIntentResolutionError';
    this.status = status;
    this.clarificationChoices = clarificationChoices;
  }
}

/**
 * 의미 해석이 필요 없는 명백한 빈 입력/자모 나열만 로컬에서 차단합니다.
 * 희귀 주제나 처음 보는 단어는 여기서 거부하지 않고 AI 의미 판정으로 넘깁니다.
 */
export function detectObviousInvalidStudyInput(input: string): StudyIntentDecision | null {
  const compact = input.trim().replace(/[\s\p{P}\p{S}]/gu, '');
  if (!compact) {
    return { status: 'REJECTED', message: '학습할 주제를 한 글자 이상 입력해 주세요.' };
  }

  if (/^[ㄱ-ㅎㅏ-ㅣ]+$/u.test(compact)) {
    return {
      status: 'REJECTED',
      message: '입력한 내용에서 학습 주제를 확인하기 어렵습니다. 원하는 주제를 조금 더 구체적으로 적어 주세요.',
    };
  }

  // 정상 단어와 섞인 독립 자모도 조용히 버리지 않고 사용자에게 의미 확인을 요청합니다.
  if (/[ㄱ-ㅎㅏ-ㅣ]/u.test(input)) {
    return {
      status: 'NEEDS_CLARIFICATION',
      message:
        '입력에 의미를 확정하기 어려운 독립 자모가 포함되어 있습니다. 해당 문자가 주제의 일부인지 확인해 주세요.',
    };
  }

  return null;
}

export interface ScopedIntent {
  domain: string;
  level: CognitiveLevel;
  levelLabel: string;
  learnerLevel?: LearnerKnowledgeLevel;
  difficultyLevel: number;
  knownScope?: string;
  levelBriefing?: string;
  style: string;
  targetCount: number;
  questionTypeMode?: QuestionTypeMode;
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
    difficultyLevel?: number;
    knownScope?: string;
    targetCount?: number;
    questionTypeMode?: QuestionTypeMode;
  }
): ScopedIntent {
  const text = inputPrompt.trim();
  // topicName이 전달된 경우 해당 과목명을 최우선 도메인으로 고정 (단원명/프롬프트에 의한 분야 왜곡 방지)
  const domain = (topicName && topicName.trim().length > 0)
    ? topicName.trim()
    : (extractDomainFromText(text) || '자유 학습 주제');

  const difficultyLevel = normalizeDifficultyLevel(
    options?.difficultyLevel,
    legacyLevelToDifficulty(options?.learnerLevel)
  );
  const difficultyProfile = getDifficultyProfile(difficultyLevel);
  const learnerLevel: LearnerKnowledgeLevel = options?.learnerLevel || difficultyProfile.legacyLevel;
  const knownScope = options?.knownScope?.trim();

  const level: CognitiveLevel = difficultyProfile.cognitiveLevel;
  const levelLabel = `레벨 ${difficultyLevel} · ${difficultyProfile.bandLabel}`;
  let levelBriefing = difficultyProfile.briefing;

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
    difficultyLevel,
    knownScope,
    levelBriefing,
    style: '사용자가 지정한 주제의 검증 가능한 사실 기반 4지선다형',
    targetCount,
    ...(options?.questionTypeMode ? { questionTypeMode: options.questionTypeMode } : {}),
    focusConcepts: [text],
    factReferencePolicy: '주제에 적합한 신뢰 가능한 지식과 사용자 제공 자료 우선',
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

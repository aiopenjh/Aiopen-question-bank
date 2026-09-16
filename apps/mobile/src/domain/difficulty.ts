import { CognitiveLevel, LearnerKnowledgeLevel } from '../contracts/types';

export interface DifficultyProfile {
  level: number;
  bandLabel: string;
  cognitiveLevel: CognitiveLevel;
  legacyLevel: LearnerKnowledgeLevel;
  briefing: string;
}

function addMicroStep(level: number, base: string): string {
  const position = ((Math.max(1, level) - 1) % 5) + 1;
  const stepGuides = [
    '이 구간의 첫 레벨이므로 직접적인 표현과 한 가지 핵심 기준을 사용합니다.',
    '바로 전 레벨에 인접 개념 한 가지를 더해 구별하도록 합니다.',
    '핵심 기준을 짧은 사례 하나에 적용하도록 합니다.',
    '조건 한 가지를 추가하여 판단 이유를 확인합니다.',
    '다음 구간으로 넘어가기 전 두 기준을 연결하되 급격한 선행지식 증가는 피합니다.',
  ];
  return `${base} ${stepGuides[position - 1]}`;
}

export function normalizeDifficultyLevel(value: unknown, fallback = 10): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : Math.max(1, Math.round(fallback));
}

export function legacyLevelToDifficulty(level?: LearnerKnowledgeLevel): number {
  if (level === 'beginner') return 3;
  if (level === 'advanced') return 20;
  if (level === 'master') return 30;
  return 10;
}

export function difficultyToLegacyLevel(level: number): LearnerKnowledgeLevel {
  const normalized = normalizeDifficultyLevel(level);
  if (normalized <= 6) return 'beginner';
  if (normalized <= 15) return 'basic';
  if (normalized <= 24) return 'advanced';
  return 'master';
}

export function getDifficultyProfile(level: number): DifficultyProfile {
  const normalized = normalizeDifficultyLevel(level);
  const legacyLevel = difficultyToLegacyLevel(normalized);

  if (normalized <= 5) {
    return {
      level: normalized,
      bandLabel: '입문 기초',
      cognitiveLevel: normalized <= 2 ? 'recall' : 'comprehend',
      legacyLevel,
      briefing: addMicroStep(normalized, '처음 접하는 학습자도 풀 수 있도록 필수 용어, 관찰 가능한 특징, 가장 기본적인 구분부터 다룹니다.'),
    };
  }
  if (normalized <= 10) {
    return {
      level: normalized,
      bandLabel: '핵심 이해',
      cognitiveLevel: 'comprehend',
      legacyLevel,
      briefing: addMicroStep(normalized, '핵심 개념의 뜻과 서로 다른 개념의 차이를 이해했는지 확인합니다.'),
    };
  }
  if (normalized <= 15) {
    return {
      level: normalized,
      bandLabel: '기본 적용',
      cognitiveLevel: 'apply',
      legacyLevel,
      briefing: addMicroStep(normalized, '배운 원리를 짧고 명확한 사례에 적용하는 문제를 중심으로 구성합니다.'),
    };
  }
  if (normalized <= 20) {
    return {
      level: normalized,
      bandLabel: '응용 판단',
      cognitiveLevel: 'analyze',
      legacyLevel,
      briefing: addMicroStep(normalized, '비슷한 개념을 구분하고 실제 상황에서 알맞은 판단을 고르는 문제를 구성합니다.'),
    };
  }
  if (normalized <= 25) {
    return {
      level: normalized,
      bandLabel: '실전 분석',
      cognitiveLevel: 'analyze',
      legacyLevel,
      briefing: addMicroStep(normalized, '세부 조건과 흔한 오개념을 함께 제시하여 정확한 분석과 오류 판별 능력을 확인합니다.'),
    };
  }
  if (normalized <= 30) {
    return {
      level: normalized,
      bandLabel: '종합 심화',
      cognitiveLevel: 'synthesize',
      legacyLevel,
      briefing: addMicroStep(normalized, '두 가지 이상의 관련 개념을 연결하되, 주제 범위 안에서 검증 가능한 종합 추론 문제를 구성합니다.'),
    };
  }

  return {
    level: normalized,
    bandLabel: '확장 학습',
    cognitiveLevel: 'synthesize',
    legacyLevel,
    briefing: addMicroStep(normalized, '난이도만 무한히 높이지 않고 새로운 사례, 관점, 비교 대상과 활용 범위로 학습을 확장합니다.'),
  };
}

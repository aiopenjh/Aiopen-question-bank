import { CognitiveLevel, LearnerKnowledgeLevel, QuestionType } from '../contracts/types';

/**
 * 레벨 구간표. 1~30은 3레벨씩 10구간, 31부터는 3레벨씩 올라가는 도전 구간이며 46부터는
 * 난이도를 더 올리지 않고 새로운 사례로만 변화를 준다. 레벨은 과목 안에서의 상대 위치다
 * (1 = 그 주제 범위의 가장 쉬운 입구, 30 = 주제가 목표로 하는 수준, 31+ = 목표를 넘는 도전).
 * 같은 구간 안에서도 레벨이 1 오를 때마다 조금씩 어려워지도록 구간 안 단계(첫·중간·마지막)를 둔다.
 * 구간 마지막 레벨은 다음 구간 요소를 한 문항에만 미리 섞는다.
 * 채점 기준은 레벨과 무관하게 같으며 여기서는 "무엇을, 얼마나 묻는가"만 정한다.
 */

export type QuestionTypeGuides = Record<QuestionType, string>;

export interface DifficultyBand {
  start: number;
  end: number | null; // null이면 이후 모든 레벨
  label: string; // AI 지시문 전용. 화면에는 레벨 숫자만 표시한다.
  learner: string;
  load: string;
  typeGuides: QuestionTypeGuides;
}

export interface DifficultyProfile {
  level: number;
  bandLabel: string;
  bandStart: number;
  bandEnd: number | null;
  /** 과목별 레벨 기준(difficultyLadder)에서 이 레벨이 가리키는 항목 번호(0부터). */
  ladderIndex: number;
  isChallenge: boolean;
  cognitiveLevel: CognitiveLevel;
  legacyLevel: LearnerKnowledgeLevel;
  learner: string;
  load: string;
  typeGuides: QuestionTypeGuides;
  briefing: string;
  /** 구간 안 단계. 끝이 정해지지 않은 마지막 도전 구간(46+)에는 없다. */
  bandStep?: { position: number; total: number; guide: string };
  /** 구간 마지막 레벨일 때만: 다음 구간의 풀이 부담. */
  nextBandLoad?: string;
}

const BAND_STEP_GUIDES = {
  first: '구간의 첫 단계이므로 이 구간 기준을 가장 쉬운 형태로 적용합니다(직접적인 표현, 충분한 단서).',
  middle: '구간의 중간 단계이므로 이 구간 기준을 그대로 적용합니다.',
  last: '구간의 마지막 단계이므로 이 구간 기준을 조금 더 까다롭게 적용합니다.',
};

function getBandStep(band: DifficultyBand, level: number): DifficultyProfile['bandStep'] {
  if (band.end === null) return undefined;
  const total = band.end - band.start + 1;
  const position = level - band.start + 1;
  const guide = position === 1 ? BAND_STEP_GUIDES.first
    : position === total ? BAND_STEP_GUIDES.last
      : BAND_STEP_GUIDES.middle;
  return { position, total, guide };
}

export const CHALLENGE_BAND_START = 31;

const CHALLENGE_TYPE_GUIDES: QuestionTypeGuides = {
  multiple_choice: '오답 보기는 숙련자도 헷갈리는 함정으로 만듭니다.',
  short_answer: '레벨 30 수준에 이 구간의 추가 요소를 모두 거쳐야 나오는 답을 묻습니다.',
  essay: '채점 요소 5개, 예외까지 다루는 답안을 요구합니다.',
  cloze: '빈칸 3개, 이 구간의 추가 요소를 반영합니다.',
};

const CHALLENGE_LEARNER = '과목의 목표 수준을 이미 넘어선 학습자';

export const DIFFICULTY_BANDS: readonly DifficultyBand[] = [
  {
    start: 1, end: 3, label: '첫걸음',
    learner: '이 분야를 처음 접하는 학습자. 전문 용어를 쓰면 지문에서 뜻을 풀어 씁니다',
    load: '사실 하나를 알아보는 문제. 지문은 1~2문장으로 짧게 씁니다',
    typeGuides: {
      multiple_choice: '오답 보기는 누가 봐도 정답과 다른 내용으로 만듭니다.',
      short_answer: '용어나 이름 하나를 답하게 합니다.',
      essay: '1~2문장 답안, 채점 요소 2개(정의 중심).',
      cloze: '빈칸 1개, 문장 안에 답을 떠올릴 단서를 충분히 둡니다.',
    },
  },
  {
    start: 4, end: 6, label: '기초 용어',
    learner: '가장 기본적인 용어를 아는 학습자',
    load: '두 개념 중 맞는 것을 구별하는 문제',
    typeGuides: {
      multiple_choice: '오답 보기는 관련은 있지만 분명히 다른 개념으로 만듭니다.',
      short_answer: '두 개념 중 맞는 이름을 답하게 합니다.',
      essay: '정의와 특징, 채점 요소 2개.',
      cloze: '빈칸 1개.',
    },
  },
  {
    start: 7, end: 9, label: '개념 이해',
    learner: '기본 개념을 설명할 수 있는 학습자',
    load: '쉬운 예시를 개념과 연결하는 문제',
    typeGuides: {
      multiple_choice: '오답 보기는 같은 범주에 속한 다른 개념으로 만듭니다.',
      short_answer: '예시를 보고 개념 이름을 답하게 합니다.',
      essay: '정의와 예시, 채점 요소 3개.',
      cloze: '빈칸 1~2개.',
    },
  },
  {
    start: 10, end: 12, label: '기본 적용',
    learner: '개념과 예시를 연결할 수 있는 학습자',
    load: '짧은 사례에 개념을 한 단계 적용하는 문제',
    typeGuides: {
      multiple_choice: '오답 보기는 흔히 잘못 적용하는 경우로 만듭니다.',
      short_answer: '사례에서 결과나 값을 구하게 합니다.',
      essay: '이유 설명, 채점 요소 3개.',
      cloze: '빈칸 2개, 조건이나 수치를 묻습니다.',
    },
  },
  {
    start: 13, end: 15, label: '조건 판단',
    learner: '개념 적용에 익숙한 학습자',
    load: '조건 두 개를 함께 따져 판단하는 문제',
    typeGuides: {
      multiple_choice: '오답 보기는 헷갈리는 인접 개념으로 만듭니다.',
      short_answer: '조건을 반영한 용어를 답하게 합니다.',
      essay: '두 개념 비교, 채점 요소 3개.',
      cloze: '빈칸 2개, 단서를 줄입니다.',
    },
  },
  {
    start: 16, end: 18, label: '응용 판단',
    learner: '여러 개념을 알고 있는 학습자',
    load: '조건 두 개와 예외 하나를 따져 판단하는 문제',
    typeGuides: {
      multiple_choice: '오답 보기는 일부만 맞는 내용으로 만듭니다.',
      short_answer: '예외를 고려한 답을 요구합니다.',
      essay: '비교와 이유, 채점 요소 4개.',
      cloze: '빈칸 2개, 서로 연결된 내용을 묻습니다.',
    },
  },
  {
    start: 19, end: 21, label: '개념 연결',
    learner: '개념 사이의 관계를 이해하는 학습자',
    load: '두 개념을 함께 써서 판단하는 문제',
    typeGuides: {
      multiple_choice: '오답 보기는 두 개념을 섞은 그럴듯한 내용으로 만듭니다.',
      short_answer: '두 개념을 함께 써야 나오는 답을 묻습니다.',
      essay: '두 개념의 관계 설명, 채점 요소 4개.',
      cloze: '빈칸 2~3개, 서로 연결된 내용을 묻습니다.',
    },
  },
  {
    start: 22, end: 24, label: '실전 기초',
    learner: '시험이나 실무를 준비하는 학습자',
    load: '시험 수준의 세부 조건을 따지는 문제',
    typeGuides: {
      multiple_choice: '오답 보기는 대표적인 오개념으로 만듭니다.',
      short_answer: '세부 조건을 반영한 정확한 용어나 수치를 묻습니다.',
      essay: '적용 사례, 채점 요소 4개.',
      cloze: '빈칸 2~3개, 세부 조건을 묻습니다.',
    },
  },
  {
    start: 25, end: 27, label: '실전 분석',
    learner: '실전 문제를 풀어 본 학습자',
    load: '여러 개념을 연결해 두 단계로 추론하는 문제',
    typeGuides: {
      multiple_choice: '오답 보기는 실전에서 자주 걸리는 함정으로 만듭니다.',
      short_answer: '두 단계 추론의 결과를 묻습니다.',
      essay: '적용과 한계, 채점 요소 4개.',
      cloze: '빈칸 3개, 서로 연결된 내용을 묻습니다.',
    },
  },
  {
    start: 28, end: 30, label: '목표 완성',
    learner: '과목의 목표 수준(예: 급수 합격, 과정 수료) 직전의 학습자',
    load: '목표 수준의 종합 문제',
    typeGuides: {
      multiple_choice: '오답 보기는 실전 최고 수준의 함정으로 만듭니다.',
      short_answer: '여러 조건을 거쳐 나오는 답을 묻습니다.',
      essay: '종합 답안, 채점 요소 4~5개.',
      cloze: '빈칸 3개, 단서를 최소로 둡니다.',
    },
  },
  {
    start: 31, end: 33, label: '도전 1', learner: CHALLENGE_LEARNER,
    load: '레벨 30 수준 문제에 풀이에 꼭 필요한 조건을 하나 더합니다',
    typeGuides: CHALLENGE_TYPE_GUIDES,
  },
  {
    start: 34, end: 36, label: '도전 2', learner: CHALLENGE_LEARNER,
    load: '레벨 30 수준에 조건 하나와 풀이 단계 하나를 더합니다',
    typeGuides: CHALLENGE_TYPE_GUIDES,
  },
  {
    start: 37, end: 39, label: '도전 3', learner: CHALLENGE_LEARNER,
    load: '레벨 30 수준에 조건 하나, 풀이 단계 하나, 놓치기 쉬운 예외나 함정 하나를 더합니다',
    typeGuides: CHALLENGE_TYPE_GUIDES,
  },
  {
    start: 40, end: 42, label: '도전 4', learner: CHALLENGE_LEARNER,
    load: '도전 3의 요소(조건·풀이 단계·예외나 함정)에 같은 과목의 다른 개념 하나를 결합합니다',
    typeGuides: CHALLENGE_TYPE_GUIDES,
  },
  {
    start: 43, end: 45, label: '도전 5', learner: CHALLENGE_LEARNER,
    load: '도전 4의 요소가 서로 맞물려, 하나라도 놓치면 정답에 이르지 못하게 합니다',
    typeGuides: CHALLENGE_TYPE_GUIDES,
  },
  {
    start: 46, end: null, label: '도전 최고', learner: CHALLENGE_LEARNER,
    load: '도전 5 수준을 유지하고, 난이도를 더 올리지 않는 대신 매번 새로운 사례와 관점으로 변화를 줍니다',
    typeGuides: CHALLENGE_TYPE_GUIDES,
  },
];

/** 과목별 레벨 기준 항목 수: 1~30의 10구간 + 31 이상 도전 범위 1개. */
export const DIFFICULTY_LADDER_SIZE = 11;
const MAX_LADDER_ENTRY_LENGTH = 200;

export function formatBandRange(band: Pick<DifficultyBand, 'start' | 'end'>): string {
  return band.end === null ? `레벨 ${band.start} 이상` : `레벨 ${band.start}~${band.end}`;
}

/** 과목별 레벨 기준의 항목별 대상 구간 이름(레벨 1~3 … 레벨 28~30, 레벨 31 이상). */
export function describeLadderRanges(): string[] {
  const standard = DIFFICULTY_BANDS.filter((band) => band.start < CHALLENGE_BAND_START).map(formatBandRange);
  return [...standard, `레벨 ${CHALLENGE_BAND_START} 이상`];
}

/** 저장·응답된 과목별 레벨 기준을 검사한다. 형식이 틀리면 버리고 공통 기준만 쓴다. */
export function normalizeDifficultyLadder(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length !== DIFFICULTY_LADDER_SIZE) return undefined;
  const entries = value.map((entry) => (typeof entry === 'string' ? entry.trim() : ''));
  return entries.every((entry) => entry.length > 0 && entry.length <= MAX_LADDER_ENTRY_LENGTH)
    ? entries
    : undefined;
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

/** 학습 명세에 저장하는 인지 단계. 저장 데이터 의미가 바뀌지 않도록 기존 경계값을 유지한다. */
function toCognitiveLevel(level: number): CognitiveLevel {
  if (level <= 2) return 'recall';
  if (level <= 10) return 'comprehend';
  if (level <= 15) return 'apply';
  if (level <= 25) return 'analyze';
  return 'synthesize';
}

function findBandIndex(level: number): number {
  const index = DIFFICULTY_BANDS.findIndex((band) => band.end === null || level <= band.end);
  return index < 0 ? DIFFICULTY_BANDS.length - 1 : index;
}

export function getDifficultyProfile(level: number): DifficultyProfile {
  const normalized = normalizeDifficultyLevel(level);
  const bandIndex = findBandIndex(normalized);
  const band = DIFFICULTY_BANDS[bandIndex];
  const nextBand = band.end === normalized ? DIFFICULTY_BANDS[bandIndex + 1] : undefined;
  const isChallenge = band.start >= CHALLENGE_BAND_START;
  const bandStep = getBandStep(band, normalized);

  return {
    level: normalized,
    bandLabel: band.label,
    bandStart: band.start,
    bandEnd: band.end,
    ladderIndex: isChallenge ? DIFFICULTY_LADDER_SIZE - 1 : bandIndex,
    isChallenge,
    cognitiveLevel: toCognitiveLevel(normalized),
    legacyLevel: difficultyToLegacyLevel(normalized),
    learner: band.learner,
    load: band.load,
    typeGuides: band.typeGuides,
    briefing: `가정하는 학습자: ${band.learner}. 풀이 부담: ${band.load}.`,
    ...(bandStep ? { bandStep } : {}),
    ...(nextBand ? { nextBandLoad: nextBand.load } : {}),
  };
}

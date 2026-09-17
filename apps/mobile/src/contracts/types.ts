/**
 * CogniQuest Data & Process Contracts (v1.0)
 * Reference: CogniQuest_개발명세_v1/03_데이터와처리계약.md
 */

export type UUID = string;
export type ISODateTimeString = string; // UTC ISO 8601
export type ISODateString = string; // YYYY-MM-DD

// Cognitive Levels (Bloom's Taxonomy)
export type CognitiveLevel = 
  | 'recall'       // Lv.1 기억/정의
  | 'comprehend'   // Lv.2 이해/구별
  | 'apply'        // Lv.3 단순 적용/계산
  | 'analyze'      // Lv.4 분석/오류 디버깅
  | 'synthesize';  // Lv.5 심화 종합 추론

// Learner Knowledge Calibration Level (학습자 사전 지식 수준)
export type LearnerKnowledgeLevel =
  | 'beginner'   // 🐣 왕초보/입문자: 어려운 학술이론 배제, 일상 비유와 기초 개념 위주
  | 'basic'      // 🌿 기본기 보유: 단순 사칙연산 배제, 표준 공식 적용 및 계산 문제
  | 'advanced'   // 🚀 실전 시험대비: 기출 난이도, 함정 선지 및 오류 분석
  | 'master';    // 👑 심화/킬러문항: 복합 융합 추론, 최고난도 킬러 문제

// Provider & Capability Status (For honest interface boundaries)
export type ConnectionStatus = 'READY' | 'NEEDS_CONNECTION' | 'NOT_IMPLEMENTED';

export interface ProviderCapability {
  name: string;
  kind: 'ai_generator' | 'ai_reviewer' | 'doc_parser' | 'web_search';
  status: ConnectionStatus;
  description: string;
  requiredAction?: string;
}

// Source visibility
export type ContentVisibility = 'private' | 'publish_candidate' | 'published';

// Source kinds
export type SourceKind = 'text' | 'pdf' | 'web' | 'docx' | 'pptx' | 'ai_search';

// Source locator structure
export interface SourceLocator {
  kind: SourceKind;
  pdfPageNumber?: number;      // 1-indexed
  printedPageLabel?: string;
  blockIndex?: number;         // 0-indexed
  slideNumber?: number;        // PPTX 1-indexed
  headingPath?: string[];      // DOCX 절 경로
  url?: string;                // Web 원본 URL
  retrievedAt?: ISODateTimeString;
}

// Extraction status
export type ExtractionStatus = 'success' | 'partial' | 'failed';

// Reading job status
export type ReadingJobStatus = 
  | 'registered'
  | 'queued'
  | 'reading'
  | 'ready'
  | 'partial'
  | 'failed'
  | 'cancel_requested'
  | 'cancelled'
  | 'interrupted';

// Question review status
export type QuestionStatus = 
  | 'draft'
  | 'validating'
  | 'ready_personal'    // 개인 학습 제공 가능 (자동 검증 통과)
  | 'rejected'          // 오류 발견으로 폐기/재생성 대상
  | 'needs_human_check' // 모호하거나 상충 기준
  | 'published';        // 공용 게시용 (별도 사람 검수 완료)

// Validation result
export type ValidationResult = 'pass' | 'fail' | 'warning';
export type ReviewerKind = 'rule_engine' | 'ai_reviewer' | 'human';

// Study session status
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

// -------------------------------------------------------------
// Core Entities
// -------------------------------------------------------------

export interface Profile {
  id: UUID;
  displayName: string;
  timezone: string; // e.g. "Asia/Seoul"
  createdAt: ISODateTimeString;
}

export interface Topic {
  id: UUID;
  ownerId: UUID;
  name: string;
  description: string;
  category?: string; // 대단위/대분류 (예: '💻 IT/개발', '📐 수학', '🌐 언어/어학', '📊 경제/경영', '📚 일반')
  learnerLevel?: LearnerKnowledgeLevel; // 과목 생성 시 기본 설정된 학습 난이도
  difficultyLevel?: number; // 1부터 시작하는 세분화 난이도. 30 이후도 확장 가능
  archivedAt: ISODateTimeString | null;
  createdAt: ISODateTimeString;
}

export interface Source {
  id: UUID;
  ownerId: UUID;
  kind: SourceKind;
  title: string;
  fileName?: string;
  fileSizeBytes?: number;
  pageCount?: number;
  fingerprint?: string;
  selectedPageStart?: number;
  selectedPageEnd?: number;
  visibility: ContentVisibility;
  allowExternalProcessing: boolean;
  archivedAt: ISODateTimeString | null;
  createdAt: ISODateTimeString;
}

export interface TopicSourceLink {
  topicId: UUID;
  sourceId: UUID;
  pageStart?: number;
  pageEnd?: number;
  lastProcessedPage?: number;
  createdAt: ISODateTimeString;
}

export interface AiDocumentInput {
  mimeType: 'application/pdf';
  base64Data: string;
  fileName: string;
  pageStart: number;
  pageEnd: number;
  sourceId: UUID;
  sourceRevisionId?: UUID;
}

export interface SourceRevision {
  id: UUID;
  sourceId: UUID;
  hash: string; // SHA-256
  provenance: string;
  originalFileRef: string | null;
  createdAt: ISODateTimeString;
}

export interface SourceChunk {
  id: UUID;
  revisionId: UUID;
  rawText: string;
  normalizedText: string;
  locator: SourceLocator;
  extractionStatus: ExtractionStatus;
}

export interface Evidence {
  id: UUID;
  chunkId: UUID;
  exactExcerpt: string;
  rangeStart?: number;
  rangeEnd?: number;
  claimType: 'source_statement' | 'definition' | 'procedure' | 'fact';
  reviewStatus: 'unreviewed' | 'verified' | 'disputed';
}

export interface Unit {
  id: UUID;
  topicId: UUID;
  parentId: UUID | null;
  depth: 1 | 2 | 3; // 1: 대단위, 2: 중단위, 3: 소단위
  title: string;
  orderIndex: number;
  allowedConcepts?: string[];
  createdAt: ISODateTimeString;
}

export interface LearningSpec {
  id: UUID;
  revision: number;
  ownerId: UUID;
  topicId: UUID;
  sourceRevisionIds: UUID[];
  unitIds: UUID[];
  level: CognitiveLevel;
  difficultyLevel?: number;
  questionCount: number;
  createdAt: ISODateTimeString;
}

export interface QuestionOption {
  id: UUID;
  text: string;
  isDistractor: boolean;
  distractorRationale?: string; // 오답인 이유
}

export interface QuestionRevision {
  id: UUID;
  questionId: UUID;
  revision: number;
  specId: UUID;
  topicId?: UUID; // 연관 주제 ID
  unitId?: UUID;  // 연관 단원(목차) ID
  difficultyLevel?: number;
  stem: string; // 문제 지문
  conceptDefinition?: string; // 핵심 개념 및 용어의 명확한 정의 (찍어서 맞춘 학습자를 위한 1분 개념 고정)
  options: QuestionOption[];
  answerOptionId: UUID; // 정답 옵션 ID
  explanation: string; // 전체 정답 해설
  deepReasoningHint?: string; // 심화 역추론 힌트 (오답 선택 시 왜 틀렸는지)
  currentReference?: {
    referenceDate: string;
    effectiveStatus: 'currently_effective';
    sourceAgency: string;
    sourceTitle: string;
    sourceUrl: string;
  }; // 세율·법령처럼 변동되는 정보의 공식 근거
  status: QuestionStatus;
  createdAt: ISODateTimeString;
}

export interface QuestionEvidence {
  questionRevisionId: UUID;
  evidenceId: UUID;
  role: 'stem_fact' | 'correct_answer_ground' | 'distractor_refutation';
}

export interface ValidationRecord {
  id: UUID;
  questionRevisionId: UUID;
  checkType: 'duplicate_options' | 'answer_mismatch' | 'fact_grounding' | 'level_boundary' | 'syntax_integrity';
  result: ValidationResult;
  reviewerKind: ReviewerKind;
  reason?: string;
  createdAt: ISODateTimeString;
}

export interface StudySession {
  id: UUID;
  ownerId: UUID;
  topicId: UUID;
  specId: UUID;
  status: SessionStatus;
  startedAt: ISODateTimeString;
  completedAt: ISODateTimeString | null;
  learningDate: ISODateString; // YYYY-MM-DD
}

export interface SessionItem {
  id: UUID;
  sessionId: UUID;
  ordinal: number; // 1, 2, 3...
  questionRevisionId: UUID;
  optionOrder: UUID[]; // 무작위 셔플된 보기 ID 배열
  draftAnswerOptionId: UUID | null;
}

export interface Attempt {
  id: UUID;
  sessionItemId: UUID;
  submissionKey: string; // 멱등 제출 키
  answerOptionId: UUID;
  isCorrect: boolean;
  submittedAt: ISODateTimeString;
}

export interface ReviewState {
  ownerId: UUID;
  questionRevisionId: UUID;
  stage: number; // 0, 1, 2, 3, 4, 5 (망각곡선 간격 단계)
  dueDate: ISODateString; // 다음 복습일 YYYY-MM-DD
  lastAttemptId: UUID;
  updatedAt: ISODateTimeString;
}

export type RoutinePreset = 'mon_wed_fri' | 'weekdays' | 'weekends' | 'daily' | 'custom';

export interface RoutineRevision {
  id: UUID;
  ownerId: UUID;
  preset: RoutinePreset;
  activeDays: number[]; // 0: 일, 1: 월, 2: 화, 3: 수, 4: 목, 5: 금, 6: 토
  preferredTime: string; // "HH:MM" e.g. "09:00"
  timezone: string;
  targetQuestionCount: number;
  effectiveDate: ISODateString;
}

export interface ManualCompletion {
  ownerId: UUID;
  unitId: UUID;
  completed: boolean;
  changedAt: ISODateTimeString;
}

// -------------------------------------------------------------
// Ranking (선택형 공동 랭킹, docs/ranking/ 참고)
// -------------------------------------------------------------

/**
 * 기기에 저장하는 랭킹 참여 자격 정보.
 * deviceToken/recoveryToken은 백업에는 포함되지만 개인 API 키와 달리
 * 화면에는 평문으로 계속 노출하지 않는다.
 */
export interface RankingProfile {
  nickname: string;
  participantId: string;
  deviceToken: string;
  recoveryToken: string;
  lastSyncedDate?: ISODateString;
  lastSyncedSolvedCount?: number;
}

/**
 * 연동 실패 시 기기에 대기시키는 요청 1건.
 * 계획서 §6: 실패한 연동 요청은 기기에 한 건만 대기시킨다.
 */
export interface RankingSyncQueueItem {
  localDate: ISODateString;
  solvedCount: number;
  queuedAt: ISODateTimeString;
}

export function detectCategoryForTopic(text: string): string {
  const lower = (text || '').toLowerCase();
  if (
    lower.includes('수학') ||
    lower.includes('미적분') ||
    lower.includes('미적') ||
    lower.includes('기하') ||
    lower.includes('확률') ||
    lower.includes('통계') ||
    lower.includes('대수') ||
    lower.includes('방정식') ||
    lower.includes('삼각함수') ||
    lower.includes('수능 수학')
  ) {
    return '📐 수학';
  }
  if (
    lower.includes('git') ||
    lower.includes('깃') ||
    lower.includes('개발') ||
    lower.includes('코딩') ||
    lower.includes('파이썬') ||
    lower.includes('자바') ||
    lower.includes('javascript') ||
    lower.includes('react') ||
    lower.includes('sql') ||
    lower.includes('알고리즘') ||
    lower.includes('컴퓨터') ||
    lower.includes('프로그래밍') ||
    lower.includes('it')
  ) {
    return '💻 IT / 개발';
  }
  if (
    lower.includes('영어') ||
    lower.includes('토익') ||
    lower.includes('토플') ||
    lower.includes('일본어') ||
    lower.includes('중국어') ||
    lower.includes('외국어') ||
    lower.includes('어학')
  ) {
    return '🌐 언어 / 어학';
  }
  if (
    lower.includes('경제') ||
    lower.includes('경영') ||
    lower.includes('주식') ||
    lower.includes('금융') ||
    lower.includes('회계') ||
    lower.includes('재무') ||
    lower.includes('마케팅')
  ) {
    return '📊 경제 / 경영';
  }
  return '📚 일반 / 교양';
}

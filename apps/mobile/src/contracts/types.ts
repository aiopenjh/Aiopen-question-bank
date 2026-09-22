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
  difficultyLevel?: number; // 단원별 저장 난이도. 미설정 단원은 과목 시작 레벨 사용
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

// 문항 유형. 기존 데이터/로직은 전부 'multiple_choice'를 가정하고 동작하므로
// short_answer/essay/cloze를 실제로 생성·렌더링하는 단계(프롬프트·UI)가 붙기 전까지는
// 이 필드가 있어도 기존 동작에 영향이 없다.
export type QuestionType = 'multiple_choice' | 'short_answer' | 'essay' | 'cloze';

// 서술형(essay) 채점용 체크리스트 항목. "논리적 일관성"류 주관적 기준은 배제하고,
// 모범답안의 핵심 요소 포함 여부만 판정해 배점을 합산한다(부분점수 = 100점 만점).
export interface GradingChecklistItem {
  id: UUID;
  criterion: string; // 판정 기준 (모범답안 핵심 요소 하나)
  points: number; // 이 항목의 배점 (전체 합 100)
}

// 밑줄/빈칸형(cloze) 빈칸 하나. stem 안의 {{1}}, {{2}}... 마커와 배열 순서(1부터)로 매칭된다.
// 채점은 AI 재호출 없이 로컬에서 정규화 후 정확 일치로 판정한다(짧고 이산적인 답이라 AI보다
// 빠르고 비용이 없으며 Law #2 로컬 우선 원칙에도 더 부합).
export interface ClozeBlank {
  id: UUID;
  correctAnswers: string[]; // 허용되는 정답 표현들(동의어·다른 표기 대비, 최소 1개)
}

export interface QuestionRevision {
  id: UUID;
  questionId: UUID;
  revision: number;
  specId: UUID;
  topicId?: UUID; // 연관 주제 ID
  unitId?: UUID;  // 연관 단원(목차) ID
  difficultyLevel?: number;
  questionType: QuestionType;
  stem: string; // 문제 지문
  conceptDefinition?: string; // 핵심 개념 및 용어의 명확한 정의 (찍어서 맞춘 학습자를 위한 1분 개념 고정)
  options: QuestionOption[]; // multiple_choice에서만 사용. short_answer/essay는 []
  answerOptionId: UUID; // multiple_choice 정답 옵션 ID. short_answer/essay는 미사용(빈 문자열)
  modelAnswer?: string; // short_answer/essay 모범답안 (정답 판정·해설의 근거)
  gradingChecklist?: GradingChecklistItem[]; // essay 부분점수 채점용, 배점 합계 100
  maxAnswerLength?: number; // essay 답안 입력 최대 글자수 (합의: 2000)
  clozeBlanks?: ClozeBlank[]; // cloze에서만 사용. stem의 {{1}},{{2}}... 순서와 배열 순서가 대응
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
  optionOrder: UUID[]; // 무작위 셔플된 보기 ID 배열. short_answer/essay는 []
  draftAnswerOptionId: UUID | null;
  draftAnswerText?: string | null; // short_answer/essay 임시 저장 답안 (타이핑 또는 터치→OCR 확정본)
}

// AI 채점 파이프라인 상태. multiple_choice는 즉시 isCorrect로 판정되므로 사용하지 않음.
// short_answer/essay: pending(요청중) -> graded 또는 failed. failed는 자동 재시도 없이
// 로컬 보존 + "채점 미완료" 표시, 사용자가 수동 재요청. cloze는 로컬 채점이라 항상 graded.
export type GradingStatus = 'pending' | 'graded' | 'failed';

export interface Attempt {
  id: UUID;
  sessionItemId: UUID;
  submissionKey: string; // 멱등 제출 키
  answerOptionId: UUID; // multiple_choice만 사용. short_answer/essay/cloze는 빈 문자열
  answerText?: string; // short_answer/essay 제출 답안 (키보드 타이핑 또는 터치 손글씨 OCR 확정본), 최대 2000자
  clozeAnswers?: string[]; // cloze 제출 답안. clozeBlanks와 배열 순서로 대응
  isCorrect: boolean; // multiple_choice 정오 판정. short_answer/essay/cloze는 채점 완료 후 gradingScore 기준으로 채움
  gradingStatus?: GradingStatus; // short_answer/essay/cloze만 사용
  gradingScore?: number; // 0~100. essay/cloze는 배점(체크리스트) 합산, short_answer는 0 또는 100
  gradingChecklistResult?: { id: UUID; met: boolean }[]; // essay 체크리스트 항목별 / cloze 빈칸별 충족 여부
  gradingFailedReason?: string; // 채점 실패 시 사용자에게 보여줄 짧은 안내
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

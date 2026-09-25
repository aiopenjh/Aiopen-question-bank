/**
 * 백업 복원 사전 검사: 항목 필드 형식, 주요 ID 유일성, 참조 무결성.
 * 저장소에 쓰기 전에 호출해 하나라도 틀리면 복원 전체를 거부한다.
 *
 * - 필수 필드는 앱 코드가 값을 전제로 읽는 필드만 둔다. 구형 백업에 없던 선택 필드는
 *   없거나 null이면 통과하고, 값이 있을 때만 형식을 검사한다.
 * - 아래 연결은 기존 기기에서도 끊긴 채 저장될 수 있어 거부하지 않는다(구형 데이터 호환).
 *   문제·학습 명세·수동 완료의 단원 ID(과거 목차 재생성·중복 정리가 단원을 새 ID로 바꿈),
 *   복습 상태·나만의 오답노트의 문제 ID(개별 문제 삭제가 정리하지 않음), 문제의 specId,
 *   Attempt.sessionItemId(SessionItem을 저장하지 않음), 마지막 학습 과목 ID.
 *   고아 정정 기록은 기존 정책대로 normalizeBackupPayload에서 조용히 제외하고, 남은 정정의 ID 중복만 거부한다.
 * - 세션은 학습 명세와 같은 과목이어야 하고, 세션 문제는 과목이 기록된 경우 세션과 같은 과목이어야 한다.
 */

import type { AppBackupPayload } from './backup_payload';

type Rule =
  | 'id'
  | 'string'
  | 'number'
  | 'boolean'
  | 'stringArray'
  | 'numberArray'
  | 'record'
  | 'recordArray'
  | readonly (string | number)[]
  /** 이 형식을 따르는 객체 */
  | { shape: Shape }
  /** 원소마다 이 형식을 따르는 객체 배열(빈 배열 허용) */
  | { each: Shape };

interface Shape {
  required: Record<string, Rule>;
  optional?: Record<string, Rule>;
}

type Item = Record<string, unknown>;

const QUESTION_TYPES = ['multiple_choice', 'short_answer', 'essay', 'cloze'] as const;
const GRADING_STATUSES = ['pending', 'graded', 'failed'] as const;
const ROUTINE_PRESETS = ['mon_wed_fri', 'weekdays', 'weekends', 'daily', 'custom'] as const;

// 문제 내부 원소는 화면·채점이 읽는 필드만 필수로 둔다. 보기 개수·정답 불일치는
// hasMissingOptions가 '보기 누락'으로 보존하므로 여기서 거부하지 않는다.
const OPTION_SHAPE: Shape = {
  required: { id: 'string', text: 'string' },
  optional: { isDistractor: 'boolean', distractorRationale: 'string' },
};
const CLOZE_BLANK_SHAPE: Shape = { required: { id: 'string', correctAnswers: 'stringArray' } };
const CHECKLIST_ITEM_SHAPE: Shape = { required: { id: 'string', criterion: 'string', points: 'number' } };
const CHECKLIST_RESULT_SHAPE: Shape = { required: { id: 'string', met: 'boolean' } };
const CHALLENGE_SHAPE: Shape = {
  required: { version: [1], runId: 'id', topicId: 'id', level: 'number', questionId: 'id', startedAt: 'string' },
};
// 앱 초기화(runMigrationClean)가 처음부터 모든 필드를 채워 저장하고 이후 전체 교체로만 갱신한다.
const PROFILE_SHAPE: Shape = {
  required: { id: 'id', displayName: 'string', timezone: 'string', createdAt: 'string' },
};
const ROUTINE_SHAPE: Shape = {
  required: {
    id: 'id', ownerId: 'id', preset: ROUTINE_PRESETS, activeDays: 'numberArray', preferredTime: 'string',
    timezone: 'string', targetQuestionCount: 'number', effectiveDate: 'string',
  },
};

const SHAPES: Record<string, Shape> = {
  topics: {
    required: { id: 'id', name: 'string' },
    optional: {
      ownerId: 'string', description: 'string', category: 'string', learnerLevel: 'string',
      difficultyLevel: 'number', archivedAt: 'string', createdAt: 'string',
    },
  },
  units: {
    required: { id: 'id', topicId: 'id', title: 'string' },
    optional: {
      parentId: 'string', depth: [1, 2, 3], orderIndex: 'number', difficultyLevel: 'number',
      allowedConcepts: 'stringArray', createdAt: 'string',
    },
  },
  learningSpecs: {
    required: { id: 'id', topicId: 'id', unitIds: 'stringArray' },
    optional: {
      ownerId: 'string', revision: 'number', sourceRevisionIds: 'stringArray', level: 'string',
      difficultyLevel: 'number', questionCount: 'number', createdAt: 'string',
    },
  },
  questions: {
    required: { id: 'id', stem: 'string' },
    optional: {
      questionId: 'id', revision: 'number', specId: 'string', topicId: 'string', unitId: 'string',
      difficultyLevel: 'number', questionType: QUESTION_TYPES, options: { each: OPTION_SHAPE },
      answerOptionId: 'string', explanation: 'string', status: 'string', createdAt: 'string',
      clozeBlanks: { each: CLOZE_BLANK_SHAPE }, gradingChecklist: { each: CHECKLIST_ITEM_SHAPE },
    },
  },
  sources: {
    required: { id: 'id', title: 'string' },
    optional: {
      ownerId: 'string', kind: 'string', fileName: 'string', fileSizeBytes: 'number',
      pageCount: 'number', visibility: 'string', allowExternalProcessing: 'boolean',
      archivedAt: 'string', createdAt: 'string',
    },
  },
  sourceRevisions: {
    required: { id: 'id', sourceId: 'id', provenance: 'string' },
    optional: { hash: 'string', originalFileRef: 'string', createdAt: 'string' },
  },
  sourceChunks: {
    required: { id: 'id', revisionId: 'id' },
    optional: { rawText: 'string', normalizedText: 'string', locator: 'record', extractionStatus: 'string' },
  },
  topicSourceLinks: {
    required: { topicId: 'id', sourceId: 'id' },
    optional: { pageStart: 'number', pageEnd: 'number', lastProcessedPage: 'number', createdAt: 'string' },
  },
  sessions: {
    required: { id: 'id', topicId: 'id', specId: 'id' },
    optional: { ownerId: 'string', status: 'string', startedAt: 'string', learningDate: 'string' },
  },
  sessionItems: {
    required: { id: 'id', sessionId: 'id', questionRevisionId: 'id' },
    optional: {
      ordinal: 'number', optionOrder: 'stringArray', draftAnswerOptionId: 'string', draftAnswerText: 'string',
    },
  },
  attempts: {
    required: { id: 'id', submissionKey: 'id', isCorrect: 'boolean', submittedAt: 'string' },
    optional: {
      sessionItemId: 'string', answerOptionId: 'string', answerText: 'string', clozeAnswers: 'stringArray',
      gradingStatus: GRADING_STATUSES, gradingScore: 'number', gradingChecklistResult: { each: CHECKLIST_RESULT_SHAPE },
      gradingFailedReason: 'string', challenge: { shape: CHALLENGE_SHAPE },
    },
  },
  reviewStates: {
    required: { questionRevisionId: 'id', stage: 'number', dueDate: 'string' },
    optional: { ownerId: 'string', lastAttemptId: 'string', updatedAt: 'string' },
  },
  manualCompletions: {
    required: { unitId: 'id', completed: 'boolean' },
    optional: { ownerId: 'string', changedAt: 'string' },
  },
};

const isRecord = (value: unknown): value is Item =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function matches(value: unknown, rule: Rule): boolean {
  if (Array.isArray(rule)) return rule.includes(value as string | number);
  if (typeof rule === 'object' && 'shape' in rule) return isRecord(value) && fitsShape(value, rule.shape);
  if (typeof rule === 'object' && 'each' in rule) {
    return Array.isArray(value) && value.every((item) => isRecord(item) && fitsShape(item, rule.each));
  }
  switch (rule) {
    case 'id': return typeof value === 'string' && value.length > 0;
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'boolean': return typeof value === 'boolean';
    case 'stringArray': return Array.isArray(value) && value.every((item) => typeof item === 'string');
    case 'numberArray': return Array.isArray(value) && value.every((item) => typeof item === 'number');
    case 'record': return isRecord(value);
    case 'recordArray': return Array.isArray(value) && value.every(isRecord);
  }
  return false;
}

/** 형식이 틀린 첫 필드와 필수 여부. 없으면 null */
function findShapeError(item: Item, shape: Shape): { field: string; required: boolean } | null {
  for (const [field, rule] of Object.entries(shape.required)) {
    if (!matches(item[field], rule)) return { field, required: true };
  }
  for (const [field, rule] of Object.entries(shape.optional ?? {})) {
    const value = item[field];
    if (value !== undefined && value !== null && !matches(value, rule)) return { field, required: false };
  }
  return null;
}

function fitsShape(item: Item, shape: Shape): boolean {
  return findShapeError(item, shape) === null;
}

function checkShape(item: Item, shape: Shape, where: string): void {
  const error = findShapeError(item, shape);
  if (!error) return;
  throw new Error(error.required
    ? `${where}의 ${error.field} 필드가 없거나 형식이 올바르지 않습니다.`
    : `${where}의 ${error.field} 필드 형식이 올바르지 않습니다.`);
}

function indexUnique(items: readonly Item[], label: string): Map<string, Item> {
  const byId = new Map<string, Item>();
  for (const item of items) {
    const id = item.id as string;
    if (byId.has(id)) throw new Error(`${label}에 같은 ID(${id})가 두 번 이상 있습니다.`);
    byId.set(id, item);
  }
  return byId;
}

function requireRef(ids: ReadonlyMap<string, unknown>, id: unknown, where: string, target: string): void {
  if (typeof id !== 'string' || !ids.has(id)) {
    throw new Error(`${where}이(가) 백업에 없는 ${target}(${String(id)})을(를) 가리킵니다.`);
  }
}

export function validateBackupPayload(payload: AppBackupPayload): void {
  const collections = payload as unknown as Record<string, Item[]>;
  for (const [label, shape] of Object.entries(SHAPES)) {
    collections[label].forEach((item, index) => checkShape(item, shape, `${label} ${index + 1}번째 항목`));
  }
  if (payload.profile) checkShape(payload.profile as unknown as Item, PROFILE_SHAPE, 'profile');
  if (payload.routine) checkShape(payload.routine as unknown as Item, ROUTINE_SHAPE, 'routine');

  const topics = indexUnique(collections.topics, 'topics');
  const units = indexUnique(collections.units, 'units');
  const specs = indexUnique(collections.learningSpecs, 'learningSpecs');
  const questions = indexUnique(collections.questions, 'questions');
  const sources = indexUnique(collections.sources, 'sources');
  const revisions = indexUnique(collections.sourceRevisions, 'sourceRevisions');
  indexUnique(collections.sourceChunks, 'sourceChunks');
  const sessions = indexUnique(collections.sessions, 'sessions');
  indexUnique(collections.sessionItems, 'sessionItems');
  indexUnique(collections.attempts, 'attempts');
  // 고아 정정은 normalize 단계에서 이미 빠졌다. 남은 정정끼리 ID가 겹치면 어느 쪽인지 고를 수 없다.
  indexUnique(collections.attemptCorrections, 'attemptCorrections');

  collections.units.forEach((unit, index) => {
    const where = `units ${index + 1}번째 항목`;
    requireRef(topics, unit.topicId, where, '과목');
    const seen = new Set<string>([unit.id as string]);
    let parentId = unit.parentId;
    while (typeof parentId === 'string' && parentId.length > 0) {
      requireRef(units, parentId, where, '상위 단원');
      const parent = units.get(parentId) as Item;
      if (parent.topicId !== unit.topicId) throw new Error(`${where}의 상위 단원이 다른 과목에 속해 있습니다.`);
      if (seen.has(parentId)) throw new Error(`${where}의 상위 단원 연결이 순환합니다.`);
      seen.add(parentId);
      parentId = parent.parentId;
    }
  });
  collections.learningSpecs.forEach((spec, index) => {
    const where = `learningSpecs ${index + 1}번째 항목`;
    requireRef(topics, spec.topicId, where, '과목');
    for (const unitId of spec.unitIds as string[]) {
      const unit = units.get(unitId);
      if (unit && unit.topicId !== spec.topicId) throw new Error(`${where}이(가) 다른 과목의 단원을 가리킵니다.`);
    }
  });
  collections.questions.forEach((question, index) => {
    const where = `questions ${index + 1}번째 항목`;
    if (question.topicId) requireRef(topics, question.topicId, where, '과목');
    const unit = question.unitId ? units.get(question.unitId as string) : undefined;
    if (unit && question.topicId && unit.topicId !== question.topicId) {
      throw new Error(`${where}이(가) 다른 과목의 단원을 가리킵니다.`);
    }
  });
  collections.sourceRevisions.forEach((revision, index) =>
    requireRef(sources, revision.sourceId, `sourceRevisions ${index + 1}번째 항목`, '학습 자료'));
  collections.sourceChunks.forEach((chunk, index) =>
    requireRef(revisions, chunk.revisionId, `sourceChunks ${index + 1}번째 항목`, '학습 자료 버전'));
  collections.topicSourceLinks.forEach((link, index) => {
    const where = `topicSourceLinks ${index + 1}번째 항목`;
    requireRef(topics, link.topicId, where, '과목');
    requireRef(sources, link.sourceId, where, '학습 자료');
  });
  collections.sessions.forEach((session, index) => {
    const where = `sessions ${index + 1}번째 항목`;
    requireRef(topics, session.topicId, where, '과목');
    requireRef(specs, session.specId, where, '학습 명세');
    if ((specs.get(session.specId as string) as Item).topicId !== session.topicId) {
      throw new Error(`${where}이(가) 다른 과목의 학습 명세를 가리킵니다.`);
    }
  });
  collections.sessionItems.forEach((item, index) => {
    const where = `sessionItems ${index + 1}번째 항목`;
    requireRef(sessions, item.sessionId, where, '학습 세션');
    requireRef(questions, item.questionRevisionId, where, '문제');
    const session = sessions.get(item.sessionId as string) as Item;
    const question = questions.get(item.questionRevisionId as string) as Item;
    if (question.topicId && question.topicId !== session.topicId) {
      throw new Error(`${where}이(가) 세션과 다른 과목의 문제를 가리킵니다.`);
    }
  });
}

/**
 * 단원 재구성·중복 정리·삭제에서 학습 기록 연결을 지키기 위한 순수 계산.
 *
 * 현재 코드 기준 실제 참조 관계:
 * - 단원 참조: QuestionRevision.unitId, LearningSpec.unitIds, ManualCompletion.unitId, Unit.parentId
 * - 풀이 → 문제: Attempt.submissionKey `sub-{문제 ID}-{시험 ID}`, Attempt.id `{시험 ID}-{순번}` (useExamSession)
 *   Attempt.sessionItemId는 저장하지 않는 SessionItem용 임의 ID라 연결 근거로 쓰지 않는다.
 * - 정정 → 풀이·문제: AttemptCorrection.attemptId, questionRevisionId
 * - 복습·오답노트 → 문제: ReviewState.questionRevisionId, 나만의 오답노트 문제 ID
 */

import type {
  Attempt,
  AttemptCorrection,
  LearningSpec,
  ManualCompletion,
  QuestionRevision,
  Unit,
  UUID,
} from '../../contracts/types';

type UnitDepth = 1 | 2 | 3;

/** 목차 재생성 대응용 제목 정규화: 유니코드 호환 형태, 공백, 대소문자 차이만 없앤다. */
export function normalizeUnitTitle(title: string): string {
  return String(title ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** 문제·학습 명세·수동 완료 기록이 가리키는 단원 ID */
export function collectReferencedUnitIds(
  questions: readonly QuestionRevision[],
  specs: readonly LearningSpec[],
  completions: readonly ManualCompletion[]
): Set<UUID> {
  const ids = new Set<UUID>();
  for (const question of questions) if (question.unitId) ids.add(question.unitId);
  for (const spec of specs) {
    if (Array.isArray(spec.unitIds)) spec.unitIds.forEach((id) => ids.add(id));
  }
  for (const completion of completions) if (completion.unitId) ids.add(completion.unitId);
  return ids;
}

/**
 * 같은 과목의 목차를 새 목록으로 바꾼다.
 * - depth와 정규화 제목이 같고 기존 쪽에서 유일한 단원만 기존 ID를 이어받는다(새 목록의 첫 항목).
 * - 대응되지 않은 기존 단원은 기록이 있거나 보존 단원의 상위 단원이면 그대로 남기고, 아니면 제거한다.
 */
export function planTopicUnitReplacement(params: {
  topicId: UUID;
  currentUnits: readonly Unit[];
  newUnits: readonly { title: string; depth?: UnitDepth }[];
  referencedUnitIds: ReadonlySet<UUID>;
  now: string;
  createId: () => UUID;
}): { replaced: Unit[]; topicUnits: Unit[] } {
  const { topicId, currentUnits, newUnits, referencedUnitIds, now, createId } = params;
  const keyOf = (title: string, depth?: number) => `${depth || 1}|${normalizeUnitTitle(title)}`;
  const oldByKey = new Map<string, Unit[]>();
  for (const unit of currentUnits) {
    const key = keyOf(unit.title, unit.depth);
    oldByKey.set(key, [...(oldByKey.get(key) ?? []), unit]);
  }

  const reused = new Set<UUID>();
  const replaced: Unit[] = newUnits.map((item, index) => {
    const depth = item.depth || 1;
    const candidates = oldByKey.get(keyOf(item.title, depth)) ?? [];
    const match = candidates.length === 1 && !reused.has(candidates[0].id) ? candidates[0] : null;
    if (match) {
      reused.add(match.id);
      // 새 목차는 평면 목록이므로 대응된 단원도 최상위로 둔다. 난이도 등 단원 설정은 유지한다.
      return { ...match, parentId: null, depth, title: item.title.trim(), orderIndex: index + 1 };
    }
    return {
      id: createId(),
      topicId,
      parentId: null,
      depth,
      title: item.title.trim(),
      orderIndex: index + 1,
      createdAt: now,
    };
  });

  const byId = new Map(currentUnits.map((unit) => [unit.id, unit]));
  const preservedIds = new Set(
    currentUnits
      .filter((unit) => !reused.has(unit.id) && referencedUnitIds.has(unit.id))
      .map((unit) => unit.id)
  );
  // 보존 단원의 상위 단원도 남겨 단원 계층과 하위 삭제 범위를 바꾸지 않는다.
  for (const id of [...preservedIds]) {
    let parentId = byId.get(id)?.parentId ?? null;
    while (parentId && byId.has(parentId) && !reused.has(parentId) && !preservedIds.has(parentId)) {
      preservedIds.add(parentId);
      parentId = byId.get(parentId)?.parentId ?? null;
    }
  }
  const preserved = currentUnits
    .filter((unit) => preservedIds.has(unit.id))
    .sort((left, right) => (left.orderIndex ?? 0) - (right.orderIndex ?? 0))
    .map((unit, index) => ({ ...unit, orderIndex: replaced.length + index + 1 }));

  return { replaced, topicUnits: [...replaced, ...preserved] };
}

/**
 * 같은 상위 단원·depth·제목(앞뒤 공백 제외)의 중복 단원을 첫 단원으로 합친다.
 * 문제·학습 명세·완료 기록·하위 단원 연결을 먼저 옮기고, 단원 설정이나 같은 소유자의 완료 상태가
 * 서로 달라 안전하게 합칠 수 없는 중복 단원은 그대로 보존한다. 완료 기록은 (ownerId, 단원 ID)마다 하나씩 남긴다.
 */
export function planUnitDeduplication(params: {
  topicUnits: readonly Unit[];
  questions: readonly QuestionRevision[];
  specs: readonly LearningSpec[];
  completions: readonly ManualCompletion[];
}): {
  topicUnits: Unit[];
  questions: QuestionRevision[];
  specs: LearningSpec[];
  completions: ManualCompletion[];
  mergedCount: number;
} {
  const { topicUnits, questions, specs, completions } = params;
  const keeperByKey = new Map<string, Unit>();
  const mergeInto = new Map<UUID, UUID>();
  // 수동 완료는 소유자별 기록이므로 (ownerId, 단원 ID) 단위로 비교·이전한다.
  const ownerOf = (item: ManualCompletion) => String(item.ownerId ?? '');
  const completionKey = (ownerId: string, unitId: UUID) => `${ownerId}|${unitId}`;
  // 합칠 단원 묶음에서 같은 소유자의 완료 상태가 서로 다르면 어느 쪽도 고를 수 없다.
  const hasOwnerConflict = (unitIds: readonly UUID[]) => {
    const stateByOwner = new Map<string, boolean>();
    for (const item of completions) {
      if (!unitIds.includes(item.unitId)) continue;
      const previous = stateByOwner.get(ownerOf(item));
      if (previous !== undefined && previous !== item.completed) return true;
      stateByOwner.set(ownerOf(item), item.completed);
    }
    return false;
  };

  for (const unit of topicUnits) {
    const key = `${unit.parentId ?? ''}|${unit.depth || 1}|${unit.title.trim()}`;
    const keeper = keeperByKey.get(key);
    if (!keeper) {
      keeperByKey.set(key, unit);
      continue;
    }
    const mergedIds = [keeper.id, ...[...mergeInto].filter(([, to]) => to === keeper.id).map(([from]) => from)];
    const sameSettings =
      keeper.difficultyLevel === unit.difficultyLevel &&
      JSON.stringify(keeper.allowedConcepts ?? null) === JSON.stringify(unit.allowedConcepts ?? null);
    if (sameSettings && !hasOwnerConflict([...mergedIds, unit.id])) mergeInto.set(unit.id, keeper.id);
  }

  if (mergeInto.size === 0) {
    return {
      topicUnits: topicUnits.map((unit, index) => ({ ...unit, orderIndex: index + 1 })),
      questions: [...questions],
      specs: [...specs],
      completions: [...completions],
      mergedCount: 0,
    };
  }

  const target = (id: UUID) => mergeInto.get(id) ?? id;
  const nextUnits = topicUnits
    .filter((unit) => !mergeInto.has(unit.id))
    .map((unit, index) => ({
      ...unit,
      parentId: unit.parentId ? target(unit.parentId) : unit.parentId,
      orderIndex: index + 1,
    }));
  const nextQuestions = questions.map((question) =>
    question.unitId && mergeInto.has(question.unitId) ? { ...question, unitId: target(question.unitId) } : question
  );
  const nextSpecs = specs.map((spec) => {
    if (!Array.isArray(spec.unitIds) || !spec.unitIds.some((id) => mergeInto.has(id))) return spec;
    return { ...spec, unitIds: Array.from(new Set(spec.unitIds.map(target))) };
  });
  const keptCompletionKeys = new Set(
    completions
      .filter((item) => !mergeInto.has(item.unitId))
      .map((item) => completionKey(ownerOf(item), item.unitId))
  );
  const nextCompletions: ManualCompletion[] = [];
  for (const completion of completions) {
    if (!mergeInto.has(completion.unitId)) {
      nextCompletions.push(completion);
      continue;
    }
    // 같은 소유자의 완료 상태가 같음을 위에서 확인했으므로, 그 소유자의 대상 단원 기록이 없을 때만 옮긴다.
    const unitId = target(completion.unitId);
    const key = completionKey(ownerOf(completion), unitId);
    if (keptCompletionKeys.has(key)) continue;
    keptCompletionKeys.add(key);
    nextCompletions.push({ ...completion, unitId });
  }
  // 하나로 합쳐진 (ownerId, 대상 단원) 기록은 합쳐진 기록 중 가장 늦은 유효한 changedAt을 남긴다.
  const newestByKey = new Map<string, string>();
  for (const completion of completions) {
    const time = Date.parse(completion.changedAt);
    if (!Number.isFinite(time)) continue;
    const key = completionKey(ownerOf(completion), target(completion.unitId));
    const previous = newestByKey.get(key);
    if (previous === undefined || time > Date.parse(previous)) newestByKey.set(key, completion.changedAt);
  }
  const mergedKeys = new Set(
    completions
      .filter((item) => mergeInto.has(item.unitId))
      .map((item) => completionKey(ownerOf(item), target(item.unitId)))
  );
  const finalCompletions = nextCompletions.map((completion) => {
    const key = completionKey(ownerOf(completion), completion.unitId);
    if (!mergedKeys.delete(key)) return completion;
    const changedAt = newestByKey.get(key);
    return changedAt && changedAt !== completion.changedAt ? { ...completion, changedAt } : completion;
  });

  return {
    topicUnits: nextUnits,
    questions: nextQuestions,
    specs: nextSpecs,
    completions: finalCompletions,
    mergedCount: mergeInto.size,
  };
}

/**
 * 삭제된 문제를 가리키는 풀이 기록 ID.
 * 현재 형식은 submissionKey에서 문제 ID를 정확히 꺼낸다. 구형 형식은 저장된 문제 ID 중
 * submissionKey에 포함된 것을 후보로 보고, 후보가 모두 삭제될 때만 지운다(다른 문제 기록 보호).
 */
export function selectAttemptIdsForQuestions(
  attempts: readonly Pick<Attempt, 'id' | 'submissionKey'>[],
  knownQuestionIds: readonly UUID[],
  removedQuestionIds: ReadonlySet<UUID>
): Set<UUID> {
  const removed = new Set<UUID>();
  if (removedQuestionIds.size === 0) return removed;
  for (const attempt of attempts) {
    const key = attempt.submissionKey;
    if (typeof key !== 'string') continue;
    const runId = typeof attempt.id === 'string' ? /^(.+)-\d+$/.exec(attempt.id)?.[1] : undefined;
    const exact =
      runId && key.startsWith('sub-') && key.endsWith(`-${runId}`) && key.length > runId.length + 5
        ? key.slice(4, key.length - runId.length - 1)
        : null;
    const candidates = exact !== null
      ? [exact]
      : knownQuestionIds.filter((id) => typeof id === 'string' && id.length > 0 && key.includes(id));
    if (candidates.length > 0 && candidates.every((id) => removedQuestionIds.has(id))) {
      removed.add(attempt.id);
    }
  }
  return removed;
}

/** 지워지는 풀이나 문제를 가리키는 정정 기록을 제외한다. 나머지 항목은 원형 그대로 둔다. */
export function filterCorrectionsAfterRemoval(
  corrections: readonly AttemptCorrection[],
  removedAttemptIds: ReadonlySet<UUID>,
  removedQuestionIds: ReadonlySet<UUID>
): AttemptCorrection[] {
  return corrections.filter(
    (item) =>
      !(item && typeof item === 'object' &&
        (removedAttemptIds.has(item.attemptId) || removedQuestionIds.has(item.questionRevisionId)))
  );
}

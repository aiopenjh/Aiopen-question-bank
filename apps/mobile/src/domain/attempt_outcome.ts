/**
 * 풀이 결과 상태 구분: 정답 / 오답 / 채점 미완료 / 사용자 정정.
 *
 * - 채점 미완료(주관식 AI 채점 실패)는 오답이 아니다(AGENTS.md §2-A-4). 오답노트·복습 일정에서
 *   오답으로 취급하지 않는다.
 * - 사용자 정정은 원래 채점(Attempt)을 바꾸지 않는 별도 기록이다. 결과 화면·오답노트·복습 일정에만
 *   정답으로 반영하고, 순차 도전(challenge_progress)과 랭킹(ranking)은 Attempt 원본만 본다.
 */

import type { Attempt, AttemptCorrection, AttemptCorrectionReason } from '../contracts/types';

export type AttemptOutcome = 'correct' | 'incorrect' | 'grading_failed' | 'corrected';

export const ATTEMPT_CORRECTION_REASONS: readonly AttemptCorrectionReason[] = [
  'ambiguous_question',
  'answer_meets_criteria',
  'other',
];

export const ATTEMPT_CORRECTION_REASON_LABELS: Record<AttemptCorrectionReason, string> = {
  ambiguous_question: '문제가 모호함',
  answer_meets_criteria: '내 답안이 기준을 충족함',
  other: '기타',
};

export function isGradingIncomplete(attempt: Pick<Attempt, 'gradingStatus'>): boolean {
  return attempt.gradingStatus !== undefined && attempt.gradingStatus !== 'graded';
}

export function correctedSubmissionKeys(corrections: readonly AttemptCorrection[]): Set<string> {
  return new Set(corrections.map((correction) => correction.submissionKey));
}

export function getAttemptOutcome(
  attempt: Pick<Attempt, 'submissionKey' | 'isCorrect' | 'gradingStatus'>,
  correctedKeys: ReadonlySet<string>
): AttemptOutcome {
  if (attempt.isCorrect) return 'correct';
  if (correctedKeys.has(attempt.submissionKey)) return 'corrected';
  if (isGradingIncomplete(attempt)) return 'grading_failed';
  return 'incorrect';
}

function isCorrectionRecord(value: unknown): value is AttemptCorrection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return ['id', 'attemptId', 'submissionKey', 'questionRevisionId', 'correctedAt'].every(
    (key) => typeof item[key] === 'string' && (item[key] as string).length > 0
  ) && ATTEMPT_CORRECTION_REASONS.includes(item.reason as AttemptCorrectionReason);
}

/** 기기 저장소에서 읽을 때: 형식이 틀린 항목만 버린다(앱 로딩을 막지 않는다). */
export function readStoredAttemptCorrections(value: unknown): AttemptCorrection[] {
  return Array.isArray(value) ? normalizeAttemptCorrections(value.filter(isCorrectionRecord)) : [];
}

/** 백업 복원 시: 형식이 틀린 항목이 있으면 오류. */
export function normalizeAttemptCorrections(value: unknown, label = 'attemptCorrections'): AttemptCorrection[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every(isCorrectionRecord)) {
    throw new Error(`${label} 필드 값이 올바르지 않습니다.`);
  }
  return value.map((item) => ({
    id: item.id,
    attemptId: item.attemptId,
    submissionKey: item.submissionKey,
    questionRevisionId: item.questionRevisionId,
    reason: item.reason,
    correctedAt: item.correctedAt,
  }));
}

/**
 * 실제 풀이 기록과 맞는 정정만 남긴다(고아 정정 제거).
 * - attemptId와 submissionKey가 모두 같은 Attempt가 있어야 한다.
 * - 정정 대상 풀이는 useExamSession이 attemptId `{시험 ID}-{문항 순번}`,
 *   submissionKey `sub-{문제 ID}-{시험 ID}`로 저장한다. attemptId에서 시험 ID를 떼어
 *   `sub-{questionRevisionId}-{시험 ID}`를 만들고 submissionKey와 글자 단위로 완전히 같아야 한다
 *   (접두사 비교가 아니므로 q1과 q1-long 같은 ID도 구분된다).
 *   SessionItem은 현재 시험에서 저장하지 않으므로 대조 근거로 쓰지 않는다.
 * - 같은 제출에 정정이 여러 개면 마지막 것만 남긴다.
 * 과목 삭제 등으로 풀이 기록이 지워지면 정정도 고아가 되므로, 백업을 막지 않고 조용히 제외한다.
 */
export function filterCorrectionsForAttempts(
  corrections: readonly AttemptCorrection[],
  attempts: readonly Pick<Attempt, 'id' | 'submissionKey'>[]
): AttemptCorrection[] {
  const attemptKeyById = new Map(attempts.map((attempt) => [attempt.id, attempt.submissionKey]));
  const bySubmission = new Map<string, AttemptCorrection>();
  for (const correction of corrections) {
    if (attemptKeyById.get(correction.attemptId) !== correction.submissionKey) continue;
    const runId = /^(.+)-\d+$/.exec(correction.attemptId)?.[1];
    if (!runId || correction.submissionKey !== `sub-${correction.questionRevisionId}-${runId}`) continue;
    bySubmission.delete(correction.submissionKey);
    bySubmission.set(correction.submissionKey, correction);
  }
  return [...bySubmission.values()];
}

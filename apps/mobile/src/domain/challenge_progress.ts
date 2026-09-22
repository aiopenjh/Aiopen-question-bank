import { Attempt } from '../contracts/types';

export const CHALLENGE_START_LEVEL = 31;
export const CHALLENGE_QUESTION_COUNT = 3;
export const CHALLENGE_PASS_COUNT = 2;

/** 삭제된 문항에 의존하지 않고 백업에 포함되는 제출 기록만으로 진도를 복원한다. */
export function getTopicChallengeLevels(attempts: Attempt[]): Map<string, number> {
  const runs = new Map<string, Attempt[]>();
  const seen = new Set<string>();
  for (const attempt of attempts) {
    const record = attempt.challenge;
    if (!record || record.version !== 1 || !record.runId || !record.topicId || !record.questionId ||
        !Number.isSafeInteger(record.level) || record.level < CHALLENGE_START_LEVEL ||
        !Number.isFinite(Date.parse(record.startedAt)) ||
        !Number.isFinite(Date.parse(attempt.submittedAt)) ||
        Date.parse(attempt.submittedAt) < Date.parse(record.startedAt)) continue;
    if (seen.has(attempt.submissionKey)) continue;
    seen.add(attempt.submissionKey);
    const run = runs.get(record.runId) ?? [];
    run.push(attempt);
    runs.set(record.runId, run);
  }
  const completedAt = (run: Attempt[]) => Math.max(...run.map(a => Date.parse(a.submittedAt)));
  const levels = new Map<string, number>();
  const clearedAt = new Map<string, number>();
  for (const run of [...runs.values()].sort((a, b) => completedAt(a) - completedAt(b))) {
    const first = run[0].challenge!;
    if (run.length !== CHALLENGE_QUESTION_COUNT ||
        new Set(run.map(a => a.challenge!.questionId)).size !== CHALLENGE_QUESTION_COUNT ||
        run.some(a => a.challenge!.topicId !== first.topicId || a.challenge!.level !== first.level ||
          a.challenge!.startedAt !== first.startedAt) ||
        run.filter(a => a.isCorrect === true).length < CHALLENGE_PASS_COUNT) continue;
    const previous = levels.get(first.topicId) ?? CHALLENGE_START_LEVEL - 1;
    // 먼저 열린 다른 시험/혼합 시험으로 다음 단계를 미리 통과할 수 없다.
    if (first.level !== previous + 1 || Date.parse(first.startedAt) < (clearedAt.get(first.topicId) ?? 0)) continue;
    levels.set(first.topicId, first.level);
    clearedAt.set(first.topicId, completedAt(run));
  }
  return levels;
}

export function getUnlockedChallengeLevel(attempts: Attempt[], topicId: string): number {
  return (getTopicChallengeLevels(attempts).get(topicId) ?? CHALLENGE_START_LEVEL - 1) + 1;
}

export function getChallengeGenerationError(level: number, count: number, unlockedLevel: number): string | null {
  if (level < CHALLENGE_START_LEVEL) return null;
  if (level > unlockedLevel) {
    return `이 과목은 레벨 ${unlockedLevel}까지 도전할 수 있습니다. 3문제 중 2문제 이상 맞히면 다음 레벨이 열립니다.`;
  }
  if (count !== CHALLENGE_QUESTION_COUNT) return '레벨 31부터는 3문제씩 도전합니다. 2문제 이상 맞히면 다음 레벨이 열립니다.';
  return null;
}

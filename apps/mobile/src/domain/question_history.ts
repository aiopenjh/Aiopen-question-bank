import type { Attempt, AttemptCorrection, QuestionRevision } from '../contracts/types';
import { correctedSubmissionKeys, getAttemptOutcome } from './attempt_outcome';

interface IdNode {
  children: Map<string, IdNode>;
  id?: string;
}

/**
 * Preserve legacy substring matching and storage order without scanning all attempts per question.
 * 채점 미완료 기록은 정오를 판정하지 않으므로 건너뛰고, 사용자 정정 기록은 정답으로 본다.
 */
export function selectIncorrectQuestions(
  questions: QuestionRevision[],
  attempts: Attempt[],
  corrections: readonly AttemptCorrection[] = []
): QuestionRevision[] {
  const correctedKeys = correctedSubmissionKeys(corrections);
  const root: IdNode = { children: new Map() };
  for (const question of questions) {
    let node = root;
    for (const character of question.id) {
      let child = node.children.get(character);
      if (!child) {
        child = { children: new Map() };
        node.children.set(character, child);
      }
      node = child;
    }
    node.id = question.id;
  }
  const latest = new Map<string, boolean>();
  for (const attempt of attempts) {
    const outcome = getAttemptOutcome(attempt, correctedKeys);
    if (outcome === 'grading_failed') continue;
    const isCorrect = outcome !== 'incorrect';
    if (root.id !== undefined) latest.set(root.id, isCorrect);
    const characters = Array.from(attempt.submissionKey);
    for (let start = 0; start < characters.length; start++) {
      let node: IdNode | undefined = root;
      for (let index = start; index < characters.length; index++) {
        node = node.children.get(characters[index]);
        if (!node) break;
        if (node.id !== undefined) latest.set(node.id, isCorrect);
      }
    }
  }
  return questions.filter(question => latest.has(question.id) && !latest.get(question.id));
}

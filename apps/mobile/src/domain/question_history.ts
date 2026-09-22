import type { Attempt, QuestionRevision } from '../contracts/types';

interface IdNode {
  children: Map<string, IdNode>;
  id?: string;
}

/** Preserve legacy substring matching and storage order without scanning all attempts per question. */
export function selectIncorrectQuestions(
  questions: QuestionRevision[],
  attempts: Attempt[]
): QuestionRevision[] {
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
    if (root.id !== undefined) latest.set(root.id, attempt.isCorrect);
    const characters = Array.from(attempt.submissionKey);
    for (let start = 0; start < characters.length; start++) {
      let node: IdNode | undefined = root;
      for (let index = start; index < characters.length; index++) {
        node = node.children.get(characters[index]);
        if (!node) break;
        if (node.id !== undefined) latest.set(node.id, attempt.isCorrect);
      }
    }
  }
  return questions.filter(question => latest.has(question.id) && !latest.get(question.id));
}

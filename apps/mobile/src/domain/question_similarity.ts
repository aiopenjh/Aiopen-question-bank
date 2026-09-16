export function normalizeQuestionStem(stem: string): string {
  return stem
    .normalize('NFKC')
    .replace(/[^0-9a-zA-Z가-힣]/g, '')
    .toLowerCase();
}

function toBigrams(value: string): Set<string> {
  const result = new Set<string>();
  for (let index = 0; index < value.length - 1; index += 1) {
    result.add(value.slice(index, index + 2));
  }
  return result;
}

export function questionStemSimilarity(left: string, right: string): number {
  const a = normalizeQuestionStem(left);
  const b = normalizeQuestionStem(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (Math.min(a.length, b.length) < 12) return 0;

  const aPairs = toBigrams(a);
  const bPairs = toBigrams(b);
  let intersection = 0;
  for (const pair of aPairs) {
    if (bPairs.has(pair)) intersection += 1;
  }
  return (2 * intersection) / (aPairs.size + bPairs.size);
}

export function areQuestionStemsTooSimilar(left: string, right: string): boolean {
  return questionStemSimilarity(left, right) >= 0.88;
}

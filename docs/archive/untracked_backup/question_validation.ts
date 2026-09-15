/** Structural validation only. This does not establish factual correctness. */
export class InvalidAiResponseError extends Error {
  constructor(message = 'AI 응답 형식이 올바르지 않습니다. 저장하지 않았습니다. 다시 출제해 주세요.') {
    super(message);
    this.name = 'InvalidAiResponseError';
  }
}

export interface ValidatedQuestion {
  stem: string;
  options: { text: string; distractorRationale?: string }[];
  correctIndex: number;
  explanation: string;
  conceptDefinition?: string;
  deepReasoningHint?: string;
}

export function parseAiJsonResponse(raw: string): unknown {
  try {
    return JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  } catch {
    throw new InvalidAiResponseError();
  }
}

const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const normalized = (value: string) => value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();

export function validateQuestionResponse(value: unknown, count: number): ValidatedQuestion[] {
  const items = (value as any)?.questions;
  if (!Number.isInteger(count) || count < 1 || count > 15 || !Array.isArray(items) || items.length !== count) {
    throw new InvalidAiResponseError('요청한 문항 수와 AI 응답이 다릅니다. 저장하지 않았습니다. 다시 출제해 주세요.');
  }
  const stems = new Set<string>();
  return items.map((item: any) => {
    if (!item || !nonempty(item.stem) || !nonempty(item.explanation) ||
        !Array.isArray(item.options) || item.options.length !== 4 ||
        !Number.isInteger(item.correctIndex) || item.correctIndex < 0 || item.correctIndex > 3) {
      throw new InvalidAiResponseError();
    }
    const stem = normalized(item.stem);
    if (stems.has(stem)) throw new InvalidAiResponseError('중복 문항이 있어 저장하지 않았습니다. 다시 출제해 주세요.');
    stems.add(stem);
    const texts = new Set<string>();
    const options = item.options.map((option: any) => {
      if (!option || !nonempty(option.text)) throw new InvalidAiResponseError();
      const text = normalized(option.text);
      if (texts.has(text)) throw new InvalidAiResponseError('중복 보기가 있어 저장하지 않았습니다. 다시 출제해 주세요.');
      texts.add(text);
      return { text: option.text.trim(), distractorRationale: nonempty(option.distractorRationale) ? option.distractorRationale.trim() : undefined };
    });
    return {
      stem: item.stem.trim(), explanation: item.explanation.trim(), options, correctIndex: item.correctIndex,
      conceptDefinition: nonempty(item.conceptDefinition) ? item.conceptDefinition.trim() : undefined,
      deepReasoningHint: nonempty(item.deepReasoningHint) ? item.deepReasoningHint.trim() : undefined,
    };
  });
}

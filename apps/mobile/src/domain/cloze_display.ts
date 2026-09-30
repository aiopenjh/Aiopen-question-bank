/**
 * 빈칸형 화면 표시 규칙. 저장된 지문의 {{n}} 표시는 그대로 두고 화면에서만 바꾼다.
 * `( 1 )`처럼 괄호로 표시하면 수식의 괄호나 숫자와 구별되지 않아 `[빈칸 1]`을 쓴다.
 */

export const CLOZE_NAME_NOTICE = '정식 명칭으로 입력하세요. 약어는 정답으로 등록된 경우에만 인정됩니다.';
export const CLOZE_VALUE_NOTICE = '각 빈칸에 들어갈 수나 식을 입력하세요.';

// 수식에 쓰는 기호를 뺀 뒤 한글·한자·가나 같은 비ASCII 글자나 두 글자 이상의 영문 단어가 남으면
// 명칭형 답으로 본다(x+1 같은 한 글자 변수식과 √2, 3×4 같은 수식은 수·식 답).
const MATH_SYMBOLS_RE = /[−×÷√π≤≥±·°²³∞∑∫]/g;
const NON_ASCII_RE = /[^\x00-\x7F]/;
const LATIN_WORD_RE = /[A-Za-z]{2,}/;

function isWordAnswer(answer: string): boolean {
  const text = answer.replace(MATH_SYMBOLS_RE, '');
  return NON_ASCII_RE.test(text) || LATIN_WORD_RE.test(text);
}

export function formatClozeStemForDisplay(stem: string): string {
  return stem.replace(/\{\{(\d+)\}\}/g, (_match, n) => `[빈칸 ${n}]`);
}

/** 정답 목록을 노출하지 않고, 답이 명칭형인지 수·식인지에 맞는 입력 안내만 고른다. */
export function getClozeAnswerNotice(blanks: { correctAnswers: string[] }[]): string {
  const valueOnly = blanks.length > 0 && blanks.every((blank) =>
    blank.correctAnswers.length > 0 && blank.correctAnswers.every((answer) => !isWordAnswer(answer))
  );
  return valueOnly ? CLOZE_VALUE_NOTICE : CLOZE_NAME_NOTICE;
}

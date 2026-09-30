/**
 * 빈칸형 화면 표시 규칙. 저장된 지문의 {{n}} 표시는 그대로 두고 화면에서만 바꾼다.
 * `( 1 )`처럼 괄호로 표시하면 수식의 괄호나 숫자와 구별되지 않아 `[빈칸 1]`을 쓴다.
 * 안내 문구만 고르며 정답 인정 범위(채점)는 바꾸지 않는다.
 */

export const CLOZE_NAME_NOTICE = '정식 명칭으로 입력하세요. 약어는 정답으로 등록된 경우에만 인정됩니다.';
export const CLOZE_VALUE_NOTICE = '각 빈칸에 들어갈 수나 식을 입력하세요.';

const MATH_SYMBOLS_RE = /[−×÷√π≤≥±·°²³∞∑∫]/g;
const LATEX_COMMAND_RE = /\\[A-Za-z]+/g;
const MATH_FUNCTION_RE = /(?:sin|cos|tan|log|ln|lim|exp)(?=[\s\d(]|$)/g;
// 숫자 바로 뒤에 붙는 단위: 영문 단위(kg, cm², km/h 등), 기호 단위, 자주 쓰는 한글 수량 단위.
const UNIT_AFTER_NUMBER_RE = /(\d)\s*(?:[A-Za-zμΩ]{1,4}(?:\/[A-Za-z]{1,3})?[²³]?|[°℃%]|개월|시간|개|명|원|번|회|초|분|일|주|년|도|배|층|쪽|장|권|마리|살|세|점|가지)/g;
const HAS_MATH_RE = /\d|\\[A-Za-z]+|[−×÷√π≤≥±∞∑∫+\-*/=^<>]/;
const NON_ASCII_RE = /[^\x00-\x7F]/;
const LATIN_WORD_RE = /[A-Za-z]{2,}/;

/**
 * 수·식 답인지 판단한다. $ 기호, LaTeX 명령, 중괄호, 숫자 뒤 단위, 수학 함수 이름, 수학 기호를 걷어낸 뒤
 * 한글·한자 같은 비ASCII 글자나 두 글자 이상의 영문 단어가 남지 않고, 원래 답에 숫자나 수식 표기가 있으면 수·식 답이다.
 * 예: 2kg, 5km/h, 3개, $\frac{1}{2}$, √2, x+1은 수·식. 山, Physical AI, 시·도경찰청장, \text{사과}는 명칭.
 */
function isValueAnswer(answer: string): boolean {
  if (!HAS_MATH_RE.test(answer)) return false;
  const rest = answer
    .replace(/\$/g, '')
    .replace(LATEX_COMMAND_RE, ' ')
    .replace(/[{}]/g, ' ')
    .replace(UNIT_AFTER_NUMBER_RE, '$1')
    .replace(MATH_FUNCTION_RE, ' ')
    .replace(MATH_SYMBOLS_RE, ' ');
  return !NON_ASCII_RE.test(rest) && !LATIN_WORD_RE.test(rest);
}

export function formatClozeStemForDisplay(stem: string): string {
  return stem.replace(/\{\{(\d+)\}\}/g, (_match, n) => `[빈칸 ${n}]`);
}

/**
 * 정답 목록을 노출하지 않고, 답이 명칭형인지 수·식인지에 맞는 입력 안내만 고른다.
 * 빈칸마다 등록된 정답 가운데 수·식 답이 있으면 수·식 빈칸으로 보고, 모든 빈칸이 수·식일 때만 수·식 안내를 보인다.
 */
export function getClozeAnswerNotice(blanks: { correctAnswers: string[] }[]): string {
  const valueOnly = blanks.length > 0 && blanks.every((blank) => blank.correctAnswers.some(isValueAnswer));
  return valueOnly ? CLOZE_VALUE_NOTICE : CLOZE_NAME_NOTICE;
}

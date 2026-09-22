/**
 * 외부 라이브러리/CDN 없이 문제 지문·보기·해설·힌트에 섞인 LaTeX 유사 수식 표기를
 * 파싱하는 순수 로직. MathText 컴포넌트가 이 결과를 RN View/Text로만 렌더링한다.
 *
 * 지원 범위: \frac{a}{b}(중첩 가능), \sqrt{x}/\sqrt x(중첩 가능), \bar{x}(윗줄),
 * ^{..}/^x(위첨자), _{..}/_x(아래첨자), 그리스 문자·시그마·적분·부등호 등 자주 쓰이는
 * 기호 명령(별칭 \le/\ge/\ne 포함). 행렬 등 그 이상의 복잡한 조판은 지원 범위 밖이며
 * 원문 그대로 남는다. $...$ 구분자는 있어도/없어도 동일하게 인식한다(기존 저장 문제 호환).
 */

export interface MathTextNode {
  type: 'text' | 'sup' | 'sub';
  value: string;
}

export type MathBlock =
  | { type: 'run'; nodes: MathTextNode[] }
  | { type: 'frac'; numerator: MathBlock[]; denominator: MathBlock[] }
  | { type: 'sqrt'; content: MathBlock[] };

// LaTeX 명령 → 유니코드 기호. 목록에 없는 명령은 원문(백슬래시 포함)을 그대로 둔다.
export const MATH_SYMBOL_MAP: Record<string, string> = {
  sigma: 'σ', Sigma: 'Σ', pi: 'π', Pi: 'Π', theta: 'θ', Theta: 'Θ',
  alpha: 'α', beta: 'β', gamma: 'γ', Gamma: 'Γ', delta: 'δ', Delta: 'Δ',
  lambda: 'λ', Lambda: 'Λ', mu: 'μ', nu: 'ν', xi: 'ξ', Xi: 'Ξ',
  rho: 'ρ', tau: 'τ', upsilon: 'υ', phi: 'φ', Phi: 'Φ', chi: 'χ',
  psi: 'ψ', Psi: 'Ψ', omega: 'ω', Omega: 'Ω', epsilon: 'ε', zeta: 'ζ',
  eta: 'η', kappa: 'κ',
  infty: '∞', sum: '∑', int: '∫', prod: '∏', partial: '∂', nabla: '∇',
  cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓',
  // \leq/\geq/\neq(정식 표기)와 \le/\ge/\ne(널리 쓰이는 줄임 표기)를 모두 인식한다.
  leq: '≤', geq: '≥', neq: '≠', le: '≤', ge: '≥', ne: '≠',
  approx: '≈', equiv: '≡',
  to: '→', gets: '←', leftrightarrow: '↔',
  cup: '∪', cap: '∩', in: '∈', notin: '∉', subset: '⊂', supset: '⊃',
  forall: '∀', exists: '∃', emptyset: '∅', sqrt: '√',
};

const SYMBOL_RE = /\\([A-Za-z]+)/g;
const BAR_RE = /\\bar\{([^{}]*)\}/g;
// 위/아래첨자 지시자: 중괄호 묶음 또는 영숫자/부호 1글자.
const SUP_SUB_RE = /\^\{([^{}]*)\}|\^([A-Za-z0-9+\-])|_\{([^{}]*)\}|_([A-Za-z0-9+\-])/g;
const COMBINING_OVERLINE = '̅';

function applySymbolsAndDollars(text: string): string {
  return text
    .replace(/\$/g, '')
    .replace(SYMBOL_RE, (whole, name: string) => MATH_SYMBOL_MAP[name] ?? whole);
}

/** \bar{X} → 각 글자 뒤에 결합 윗줄 문자를 붙여 평균 기호(X̄) 등을 표현한다. */
function withCombiningOverline(text: string): string {
  return Array.from(text)
    .map((ch) => (ch.trim().length === 0 ? ch : ch + COMBINING_OVERLINE))
    .join('');
}

function applyBar(text: string): string {
  return text.replace(BAR_RE, (whole, inner: string) => withCombiningOverline(applySymbolsAndDollars(inner)));
}

/** \frac/\sqrt 블록에 걸리지 않는 일반 구간을 위/아래첨자와 기호까지 파싱한다. */
function parseRun(rawText: string): MathTextNode[] {
  const text = applySymbolsAndDollars(applyBar(rawText));
  const nodes: MathTextNode[] = [];
  let lastIndex = 0;
  SUP_SUB_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SUP_SUB_RE.exec(text))) {
    if (m.index > lastIndex) {
      nodes.push({ type: 'text', value: text.slice(lastIndex, m.index) });
    }
    if (m[1] !== undefined) nodes.push({ type: 'sup', value: m[1] });
    else if (m[2] !== undefined) nodes.push({ type: 'sup', value: m[2] });
    else if (m[3] !== undefined) nodes.push({ type: 'sub', value: m[3] });
    else if (m[4] !== undefined) nodes.push({ type: 'sub', value: m[4] });
    lastIndex = SUP_SUB_RE.lastIndex;
  }
  if (lastIndex < text.length) nodes.push({ type: 'text', value: text.slice(lastIndex) });
  if (nodes.length === 0) nodes.push({ type: 'text', value: '' });
  return nodes;
}

/**
 * input[openBraceIndex]가 '{'라고 가정하고, 중첩된 중괄호까지 깊이를 세어 짝이 맞는
 * '}'를 찾는다. \frac{\frac{1}{2}}{3}처럼 안쪽에 또 다른 \frac/\sqrt가 있어도
 * 안쪽 중괄호에 흔들리지 않고 바깥쪽 그룹 전체를 정확히 잘라낸다.
 */
function extractBraceGroup(input: string, openBraceIndex: number): { content: string; endIndex: number } | null {
  if (input[openBraceIndex] !== '{') return null;
  let depth = 0;
  for (let i = openBraceIndex; i < input.length; i++) {
    if (input[i] === '{') depth++;
    else if (input[i] === '}') {
      depth--;
      if (depth === 0) return { content: input.slice(openBraceIndex + 1, i), endIndex: i + 1 };
    }
  }
  return null; // 짝이 맞지 않으면 블록으로 인식하지 않고 원문을 그대로 둔다.
}

/**
 * 문자열 전체를 일반 구간과 \frac/\sqrt 블록으로 나눈다. \frac/\sqrt의 내용물은
 * 재귀적으로 다시 파싱되므로 중첩된 분수·제곱근도 올바르게 트리로 표현된다.
 */
export function parseMathText(input: string): MathBlock[] {
  const blocks: MathBlock[] = [];
  let i = 0;
  let runStart = 0;

  const flushRun = (end: number) => {
    if (end > runStart) blocks.push({ type: 'run', nodes: parseRun(input.slice(runStart, end)) });
  };

  while (i < input.length) {
    if (input.startsWith('\\frac{', i)) {
      const numGroup = extractBraceGroup(input, i + 5);
      const denGroup = numGroup ? extractBraceGroup(input, numGroup.endIndex) : null;
      if (numGroup && denGroup) {
        flushRun(i);
        blocks.push({
          type: 'frac',
          numerator: parseMathText(numGroup.content),
          denominator: parseMathText(denGroup.content),
        });
        i = denGroup.endIndex;
        runStart = i;
        continue;
      }
    } else if (input.startsWith('\\sqrt{', i)) {
      const contentGroup = extractBraceGroup(input, i + 5);
      if (contentGroup) {
        flushRun(i);
        blocks.push({ type: 'sqrt', content: parseMathText(contentGroup.content) });
        i = contentGroup.endIndex;
        runStart = i;
        continue;
      }
    } else if (input.startsWith('\\sqrt', i) && /[A-Za-z0-9]/.test(input[i + 5] || '')) {
      flushRun(i);
      blocks.push({ type: 'sqrt', content: [{ type: 'run', nodes: [{ type: 'text', value: input[i + 5] }] }] });
      i += 6;
      runStart = i;
      continue;
    }
    i++;
  }
  flushRun(input.length);
  if (blocks.length === 0) blocks.push({ type: 'run', nodes: [{ type: 'text', value: '' }] });
  return blocks;
}

/**
 * 렌더링 전 빠른 판정용: 이 문자를 하나도 포함하지 않으면 수식 파싱 자체가
 * 불필요하다(순수 일반 문장). MathText가 기존 <Text> 렌더링을 그대로 쓰기 위해 사용.
 */
export function mayContainMathNotation(input: string): boolean {
  return /[\\$^_]/.test(input);
}

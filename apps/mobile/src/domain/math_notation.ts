/**
 * 외부 라이브러리/CDN 없이 문제 지문·보기·해설·힌트에 섞인 LaTeX 유사 수식 표기를
 * 파싱하는 순수 로직. MathText 컴포넌트가 이 결과를 RN View/Text로만 렌더링한다.
 *
 * 지원 범위(요청된 최소 범위): \frac{a}{b}, \sqrt{x}/\sqrt x, ^{..}/^x(위첨자),
 * _{..}/_x(아래첨자), 그리스 문자·시그마·적분 등 자주 쓰이는 기호 명령.
 * 중첩된 \frac/\sqrt, 행렬 등 복잡한 조판은 지원 범위 밖이며 원문 그대로 남는다.
 * $...$ 구분자는 있어도/없어도 동일하게 인식한다(기존 저장 문제 호환).
 */

export interface MathTextNode {
  type: 'text' | 'sup' | 'sub';
  value: string;
}

export type MathBlock =
  | { type: 'run'; nodes: MathTextNode[] }
  | { type: 'frac'; numerator: MathTextNode[]; denominator: MathTextNode[] }
  | { type: 'sqrt'; content: MathTextNode[] };

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
  leq: '≤', geq: '≥', neq: '≠', approx: '≈', equiv: '≡',
  to: '→', gets: '←', leftrightarrow: '↔',
  cup: '∪', cap: '∩', in: '∈', notin: '∉', subset: '⊂', supset: '⊃',
  forall: '∀', exists: '∃', emptyset: '∅', sqrt: '√',
};

const BLOCK_TOKEN_RE = /\\frac\{([^{}]*)\}\{([^{}]*)\}|\\sqrt\{([^{}]*)\}|\\sqrt([A-Za-z0-9])/g;
const SYMBOL_RE = /\\([A-Za-z]+)/g;
// 위/아래첨자 지시자: 중괄호 묶음 또는 영숫자/부호 1글자.
const SUP_SUB_RE = /\^\{([^{}]*)\}|\^([A-Za-z0-9+\-])|_\{([^{}]*)\}|_([A-Za-z0-9+\-])/g;

function substituteSymbolsAndDollars(text: string): string {
  return text
    .replace(/\$/g, '')
    .replace(SYMBOL_RE, (whole, name: string) => MATH_SYMBOL_MAP[name] ?? whole);
}

/** \frac/\sqrt 블록에 걸리지 않는 일반 구간을 위/아래첨자와 기호까지 파싱한다. */
function parseRun(rawText: string): MathTextNode[] {
  const text = substituteSymbolsAndDollars(rawText);
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

/** 문자열 전체를 일반 구간과 \frac/\sqrt 블록으로 나눈다. */
export function parseMathText(input: string): MathBlock[] {
  const blocks: MathBlock[] = [];
  let lastIndex = 0;
  BLOCK_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BLOCK_TOKEN_RE.exec(input))) {
    if (m.index > lastIndex) {
      const raw = input.slice(lastIndex, m.index);
      if (raw.length > 0) blocks.push({ type: 'run', nodes: parseRun(raw) });
    }
    if (m[1] !== undefined) {
      blocks.push({ type: 'frac', numerator: parseRun(m[1]), denominator: parseRun(m[2]) });
    } else if (m[3] !== undefined) {
      blocks.push({ type: 'sqrt', content: parseRun(m[3]) });
    } else if (m[4] !== undefined) {
      blocks.push({ type: 'sqrt', content: parseRun(m[4]) });
    }
    lastIndex = BLOCK_TOKEN_RE.lastIndex;
  }
  if (lastIndex < input.length) {
    const raw = input.slice(lastIndex);
    if (raw.length > 0) blocks.push({ type: 'run', nodes: parseRun(raw) });
  }
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

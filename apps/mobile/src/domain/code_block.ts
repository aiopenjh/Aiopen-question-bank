/**
 * 문제 지문·보기·해설에 섞인 마크다운 코드블록(```언어 줄바꿈 코드 ```)을 일반 문장과
 * 분리하는 순수 로직. MathText가 코드 구간은 고정폭 코드 상자로, 나머지 문장은 기존
 * 수식 파싱 경로로 렌더링한다. 짝이 맞지 않는 ```는 코드로 보지 않고 원문을 그대로 둔다.
 * 백틱 한 쌍의 인라인 코드명은 이 모듈이 아니라 math_notation.ts가 처리한다.
 */

export type CodeAwareSegment =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string; language?: string };

// 여는 ``` 뒤 같은 줄의 단어는 줄바꿈이 이어질 때만 언어 이름으로 본다(```if (x) {}``` 오인 방지).
const CODE_FENCE_RE = /```(?:([A-Za-z0-9_+#.-]*)[ \t]*\r?\n)?([\s\S]*?)```/g;
const TAB_AS_SPACES = '    ';

function normalizeCode(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, TAB_AS_SPACES)
    .replace(/^(?:[ \t]*\n)+/, '')
    .replace(/\s+$/, '');
}

export function hasCodeBlock(input: string): boolean {
  return /```[\s\S]*?```/.test(input);
}

export function splitCodeBlocks(input: string): CodeAwareSegment[] {
  const raw: CodeAwareSegment[] = [];
  let lastIndex = 0;
  CODE_FENCE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CODE_FENCE_RE.exec(input))) {
    if (m.index > lastIndex) raw.push({ type: 'text', value: input.slice(lastIndex, m.index) });
    const code = normalizeCode(m[2]);
    if (code) raw.push({ type: 'code', value: code, ...(m[1] ? { language: m[1] } : {}) });
    lastIndex = CODE_FENCE_RE.lastIndex;
  }
  if (lastIndex < input.length) raw.push({ type: 'text', value: input.slice(lastIndex) });

  // 코드 상자와 맞닿은 쪽의 줄바꿈·공백은 상자가 대신 구분하므로 걷어낸다.
  const segments: CodeAwareSegment[] = [];
  raw.forEach((segment, index) => {
    if (segment.type === 'code') {
      segments.push(segment);
      return;
    }
    let value = segment.value;
    if (raw[index - 1]?.type === 'code') value = value.replace(/^\s+/, '');
    if (raw[index + 1]?.type === 'code') value = value.replace(/\s+$/, '');
    if (value) segments.push({ type: 'text', value });
  });
  return segments;
}

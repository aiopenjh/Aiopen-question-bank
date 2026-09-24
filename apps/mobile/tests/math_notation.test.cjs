const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadMathNotation() {
  const filename = path.resolve(__dirname, '../src/domain/math_notation.ts');
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports }, { filename });
  return module.exports;
}

const mod = loadMathNotation();

// 'run' 블록의 MathTextNode[]에서 순수 텍스트만 이어붙인다.
function textOf(nodes) {
  return nodes.map((n) => n.value).join('');
}

// MathBlock[] 트리(중첩된 frac/sqrt 포함) 전체를 사람이 읽기 쉬운 문자열로 평탄화한다.
// frac은 "num/den", sqrt는 "sqrt(content)"로 표시해 구조를 테스트에서 쉽게 확인한다.
function flatten(blocks) {
  return blocks
    .map((b) => {
      if (b.type === 'run') return textOf(b.nodes);
      if (b.type === 'frac') return `${flatten(b.numerator)}/${flatten(b.denominator)}`;
      return `sqrt(${flatten(b.content)})`;
    })
    .join('');
}

test('math_notation: 일반 문장은 수식 표기로 오탐하지 않는다', () => {
  assert.equal(mod.mayContainMathNotation('오늘 날씨가 맑습니다.'), false);
  const blocks = mod.parseMathText('오늘 날씨가 맑습니다.');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'run');
  assert.equal(textOf(blocks[0].nodes), '오늘 날씨가 맑습니다.');
});

test('math_notation: \\frac{1}{2}는 분수 블록으로 파싱된다', () => {
  const blocks = mod.parseMathText('확률은 $\\frac{1}{2}$입니다.');
  const frac = blocks.find((b) => b.type === 'frac');
  assert.ok(frac, 'frac block expected');
  assert.equal(flatten(frac.numerator), '1');
  assert.equal(flatten(frac.denominator), '2');
  // $ 구분자는 렌더링에 노출되지 않는다(run 텍스트에서 제거됨).
  const runsText = blocks.filter((b) => b.type === 'run').map((b) => textOf(b.nodes)).join('');
  assert.ok(!runsText.includes('$'));
});

test('math_notation: 중첩된 \\frac{\\frac{1}{2}}{3}도 트리로 올바르게 파싱된다', () => {
  const blocks = mod.parseMathText('\\frac{\\frac{1}{2}}{3}');
  const outer = blocks.find((b) => b.type === 'frac');
  assert.ok(outer, 'outer frac expected');
  const innerFrac = outer.numerator.find((b) => b.type === 'frac');
  assert.ok(innerFrac, 'nested frac in numerator expected');
  assert.equal(flatten(innerFrac.numerator), '1');
  assert.equal(flatten(innerFrac.denominator), '2');
  assert.equal(flatten(outer.denominator), '3');
});

test('math_notation: \\sqrt{\\frac{1}{2}}처럼 제곱근 안에 분수도 중첩 가능하다', () => {
  const blocks = mod.parseMathText('\\sqrt{\\frac{1}{2}}');
  const sqrt = blocks.find((b) => b.type === 'sqrt');
  assert.ok(sqrt);
  const innerFrac = sqrt.content.find((b) => b.type === 'frac');
  assert.ok(innerFrac, 'nested frac inside sqrt expected');
  assert.equal(flatten(innerFrac.numerator), '1');
  assert.equal(flatten(innerFrac.denominator), '2');
});

test('math_notation: 그리스 문자·적분·시그마 명령이 유니코드로 치환된다', () => {
  const blocks = mod.parseMathText('\\sigma 값과 \\int, \\sum 기호');
  const text = flatten(blocks);
  assert.match(text, /σ/);
  assert.match(text, /∫/);
  assert.match(text, /∑/);
});

test('math_notation: \\le/\\ge/\\ne 줄임 표기와 \\leq/\\geq/\\neq 정식 표기가 동일하게 치환된다', () => {
  assert.match(flatten(mod.parseMathText('x \\le 5')), /≤/);
  assert.match(flatten(mod.parseMathText('x \\leq 5')), /≤/);
  assert.match(flatten(mod.parseMathText('x \\ge 5')), /≥/);
  assert.match(flatten(mod.parseMathText('x \\geq 5')), /≥/);
  assert.match(flatten(mod.parseMathText('x \\ne 5')), /≠/);
  assert.match(flatten(mod.parseMathText('x \\neq 5')), /≠/);
});

test('math_notation: \\bar{X}는 결합 윗줄 문자가 붙어 평균 기호를 표현한다', () => {
  const blocks = mod.parseMathText('표본평균 \\bar{X}는 ...');
  const text = flatten(blocks);
  assert.ok(text.includes('X̅'), '윗줄 결합문자가 X 뒤에 붙어야 한다');
});

test('math_notation: \\sqrt{x}는 sqrt 블록으로, x^2/x_i는 위/아래첨자로 파싱된다', () => {
  const sqrtBlocks = mod.parseMathText('\\sqrt{x}는 x^2와 x_i를 포함합니다.');
  const sqrt = sqrtBlocks.find((b) => b.type === 'sqrt');
  assert.ok(sqrt);
  assert.equal(flatten(sqrt.content), 'x');

  const run = sqrtBlocks.find((b) => b.type === 'run' && b.nodes.some((n) => n.type === 'sup'));
  assert.ok(run, 'superscript node expected');
  assert.ok(run.nodes.some((n) => n.type === 'sup' && n.value === '2'));

  const subRun = sqrtBlocks.find((b) => b.type === 'run' && b.nodes.some((n) => n.type === 'sub'));
  assert.ok(subRun, 'subscript node expected');
  assert.ok(subRun.nodes.some((n) => n.type === 'sub' && n.value === 'i'));
});

test('math_notation: 인식되지 않는 명령은 원문을 그대로 보존한다', () => {
  const blocks = mod.parseMathText('\\unknowncommand 그대로');
  const text = flatten(blocks);
  assert.match(text, /\\unknowncommand/);
});

test('math_notation: 백틱 코드명은 구분자를 숨기고 underscore를 아래첨자로 바꾸지 않는다', () => {
  const source = 'Python의 `asyncio`에서 `await`과 `asyncio.create_task(my.coro())`를 비교합니다.';
  const blocks = mod.parseMathText(source);
  assert.equal(
    flatten(blocks),
    'Python의 asyncio에서 await과 asyncio.create_task(my.coro())를 비교합니다.'
  );
  const nodes = blocks.flatMap((block) => block.type === 'run' ? block.nodes : []);
  assert.ok(nodes.every((node) => node.type === 'text'));
  assert.equal(mod.mayContainMathNotation(source), true);
});

test('math_notation: mayContainMathNotation은 수식 트리거 문자가 있을 때만 true', () => {
  assert.equal(mod.mayContainMathNotation('평범한 문장'), false);
  assert.equal(mod.mayContainMathNotation('x^2'), true);
  assert.equal(mod.mayContainMathNotation('$\\sigma$'), true);
});

test('math_notation: 백틱 없는 코드 이름의 밑줄은 $ 밖에서 아래첨자로 바꾸지 않는다', () => {
  for (const source of [
    'my_coroutine 함수와 asyncio.create_task를 비교합니다.',
    '__init__ 메서드와 pos_y 변수',
    '가격은 $5이고 snake_case_name을 씁니다.',
  ]) {
    const blocks = mod.parseMathText(source);
    assert.equal(flatten(blocks), source.replace('$', ''), source);
    const nodes = blocks.flatMap((block) => block.type === 'run' ? block.nodes : []);
    assert.ok(nodes.every((node) => node.type === 'text'), source);
  }
});

test('math_notation: 한 글자·중괄호 첨자와 $ 안의 첨자는 기존대로 아래첨자다', () => {
  const subs = (source) => mod.parseMathText(source)
    .flatMap((block) => block.type === 'run' ? block.nodes : [])
    .filter((node) => node.type === 'sub')
    .map((node) => node.value)
    .join(',');
  assert.equal(subs('x_i와 a_1, v_{max}'), 'i,1,max');
  assert.equal(subs('오차 제곱합 $SS_E$와 $MS_{E}$'), 'E,E');
  const frac = mod.parseMathText('$\\frac{SS_E}{df}$').find((block) => block.type === 'frac');
  assert.ok(frac.numerator[0].nodes.some((node) => node.type === 'sub' && node.value === 'E'));
});

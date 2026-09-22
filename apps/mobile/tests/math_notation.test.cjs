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

function textOf(nodes) {
  return nodes.map((n) => n.value).join('');
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
  assert.equal(textOf(frac.numerator), '1');
  assert.equal(textOf(frac.denominator), '2');
  // $ 구분자는 렌더링에 노출되지 않는다(run 텍스트에서 제거됨).
  const runsText = blocks.filter((b) => b.type === 'run').map((b) => textOf(b.nodes)).join('');
  assert.ok(!runsText.includes('$'));
});

test('math_notation: 그리스 문자·적분·시그마 명령이 유니코드로 치환된다', () => {
  const blocks = mod.parseMathText('\\sigma 값과 \\int, \\sum 기호');
  const text = blocks.map((b) => (b.type === 'run' ? textOf(b.nodes) : '')).join('');
  assert.match(text, /σ/);
  assert.match(text, /∫/);
  assert.match(text, /∑/);
});

test('math_notation: \\sqrt{x}는 sqrt 블록으로, x^2/x_i는 위/아래첨자로 파싱된다', () => {
  const sqrtBlocks = mod.parseMathText('\\sqrt{x}는 x^2와 x_i를 포함합니다.');
  const sqrt = sqrtBlocks.find((b) => b.type === 'sqrt');
  assert.ok(sqrt);
  assert.equal(textOf(sqrt.content), 'x');

  const run = sqrtBlocks.find((b) => b.type === 'run' && b.nodes.some((n) => n.type === 'sup'));
  assert.ok(run, 'superscript node expected');
  assert.ok(run.nodes.some((n) => n.type === 'sup' && n.value === '2'));

  const subRun = sqrtBlocks.find((b) => b.type === 'run' && b.nodes.some((n) => n.type === 'sub'));
  assert.ok(subRun, 'subscript node expected');
  assert.ok(subRun.nodes.some((n) => n.type === 'sub' && n.value === 'i'));
});

test('math_notation: 인식되지 않는 명령은 원문을 그대로 보존한다', () => {
  const blocks = mod.parseMathText('\\unknowncommand 그대로');
  const text = blocks.map((b) => (b.type === 'run' ? textOf(b.nodes) : '')).join('');
  assert.match(text, /\\unknowncommand/);
});

test('math_notation: mayContainMathNotation은 수식 트리거 문자가 있을 때만 true', () => {
  assert.equal(mod.mayContainMathNotation('평범한 문장'), false);
  assert.equal(mod.mayContainMathNotation('x^2'), true);
  assert.equal(mod.mayContainMathNotation('$\\sigma$'), true);
});

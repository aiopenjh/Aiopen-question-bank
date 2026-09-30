// 문제 지문·보기·해설의 마크다운 코드블록(```)을 일반 문장과 분리하고,
// 출제 프롬프트가 코드를 코드블록 형식으로 쓰도록 지시하는지 확인한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '../src/domain');
const cache = new Map();

function load(name) {
  const file = path.resolve(ROOT, `${name}.ts`);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  cache.set(file, module.exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, JSON, Math,
    require: (dep) => (dep.startsWith('./') || dep.startsWith('../')) && !dep.includes('/contracts/')
      ? load(dep.replace(/^\.\//, '').replace(/^\.\.\//, '../'))
      : new Proxy({}, { get: () => undefined }),
  }, { filename: file });
  cache.set(file, module.exports);
  return module.exports;
}

const { hasCodeBlock, splitCodeBlocks } = load('code_block');
const plain = (segments) => JSON.parse(JSON.stringify(segments));

test('code_block: 언어 이름이 있는 코드블록은 줄바꿈·들여쓰기를 보존해 분리한다', () => {
  const text = [
    '다음 코드에서 조건문 구조로 가장 적절한 것은?',
    '```csharp',
    'if (transform.position.x <= minLimitX) {',
    '    transform.position = new Vector2(minLimitX, transform.position.y);',
    '}',
    '```',
  ].join('\n');

  assert.equal(hasCodeBlock(text), true);
  assert.deepEqual(plain(splitCodeBlocks(text)), [
    { type: 'text', value: '다음 코드에서 조건문 구조로 가장 적절한 것은?' },
    {
      type: 'code',
      language: 'csharp',
      value: 'if (transform.position.x <= minLimitX) {\n    transform.position = new Vector2(minLimitX, transform.position.y);\n}',
    },
  ]);
});

test('code_block: 보기 전체가 코드블록이면 코드 구간 하나만 남는다', () => {
  const option = '```csharp\nswitch (transform.position.x) {\n    case 0: break;\n}\n```';
  assert.deepEqual(plain(splitCodeBlocks(option)), [
    { type: 'code', language: 'csharp', value: 'switch (transform.position.x) {\n    case 0: break;\n}' },
  ]);
});

test('code_block: 줄바꿈 없는 한 줄 코드블록의 첫 단어를 언어 이름으로 오인하지 않는다', () => {
  assert.deepEqual(plain(splitCodeBlocks('```if (x > 0) { y = 1; }```')), [
    { type: 'code', value: 'if (x > 0) { y = 1; }' },
  ]);
});

test('code_block: 코드블록 앞뒤 문장과 여러 코드블록을 순서대로 나누고 탭·CRLF를 정리한다', () => {
  const text = 'A 코드:\r\n```python\r\nfor i in range(3):\r\n\tprint(i)\r\n```\r\n와\n```js\nconsole.log(1)\n```\n의 차이는?';
  assert.deepEqual(plain(splitCodeBlocks(text)), [
    { type: 'text', value: 'A 코드:' },
    { type: 'code', language: 'python', value: 'for i in range(3):\n    print(i)' },
    { type: 'text', value: '와' },
    { type: 'code', language: 'js', value: 'console.log(1)' },
    { type: 'text', value: '의 차이는?' },
  ]);
});

test('code_block: 짝이 없는 ```와 인라인 백틱 코드명은 코드블록으로 보지 않는다', () => {
  assert.equal(hasCodeBlock('```csharp\nif (x) {}'), false);
  assert.equal(hasCodeBlock('`my_value` 변수의 값은?'), false);
  assert.equal(hasCodeBlock('일반 문장입니다.'), false);
  assert.deepEqual(plain(splitCodeBlocks('일반 문장입니다.')), [{ type: 'text', value: '일반 문장입니다.' }]);
});

test('code_block: 코드블록 안의 밑줄·$·^는 원문 그대로 둔다', () => {
  const [segment] = splitCodeBlocks('```python\nmy_list = [x**2 for x in a] # $5 ^ 2\n```');
  assert.equal(segment.type, 'code');
  assert.equal(segment.value, 'my_list = [x**2 for x in a] # $5 ^ 2');
});

test('prompts: 코드를 마크다운 코드블록으로 쓰도록 지시하고 힌트에는 넣지 않게 한다', () => {
  const { buildQuestionGenerationPrompt } = load('prompts');
  const prompt = buildQuestionGenerationPrompt({
    intent: {
      targetCount: 3,
      levelLabel: '레벨 4',
      levelBriefing: '기본 개념 확인',
      focusConcepts: ['조건문'],
      questionTypeMode: 'mixed',
    },
    resolvedDomain: 'Unity 2D',
    questionTypePlan: ['multiple_choice', 'multiple_choice', 'multiple_choice'],
  });

  assert.match(prompt, /프로그래밍 코드를 지문·보기·해설에 넣을 때는 마크다운 코드블록으로 씁니다/);
  assert.ok(prompt.includes('```csharp'), '언어 이름이 붙은 여는 표기 예시가 있어야 한다');
  assert.ok(prompt.includes('JSON 문자열 안의 줄바꿈은 \\n'), 'JSON 줄바꿈 표기를 안내해야 한다');
  assert.match(prompt, /보기 자체가 코드라면 그 보기의 text 전체를 하나의 코드블록으로/);
  assert.match(prompt, /힌트\(deepReasoningHint\)에는 코드블록을 넣지 않습니다/);
});

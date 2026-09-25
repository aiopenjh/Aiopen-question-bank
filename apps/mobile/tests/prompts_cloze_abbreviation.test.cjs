// 출제 프롬프트: 빈칸형이 명칭을 물을 때, 지문의 요구 형식과 correctAnswers 채점 기준이 어긋나지 않도록
// 약어 허용 여부에 따라 두 갈래(정식 명칭만 / 정식 명칭+약어)를 분명히 나눠 지시하는지 확인한다.
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

test('cloze generation rule branches on abbreviation evidence and keeps stem wording aligned with correctAnswers', () => {
  const { buildQuestionGenerationPrompt } = load('prompts');
  const prompt = buildQuestionGenerationPrompt({
    intent: {
      targetCount: 3,
      levelLabel: '레벨 3',
      levelBriefing: '기본 개념 확인',
      focusConcepts: ['핵심 용어'],
      questionTypeMode: 'mixed',
    },
    resolvedDomain: '테스트 주제',
    questionTypePlan: ['cloze', 'multiple_choice', 'short_answer'],
  });

  // 오탈자 회귀 방지: '묻을' 대신 표준어 '물을'을 쓴다.
  assert.match(prompt, /빈칸이 명칭이나 용어를 물을 때는/);
  assert.doesNotMatch(prompt, /명칭이나 용어를 묻을 때/);

  // (a) 약어를 정답으로 인정하는 경우: correctAnswers에 정식 명칭+약어를 함께 넣되,
  // 지문에는 정답 약어 자체를 쓰지 않고 '약어 허용'이라는 사실만 밝힌다.
  assert.match(prompt, /자료에 그 약어가 명확히 쓰여 있어 정답으로도 인정하는 경우, correctAnswers에 정식 명칭과 그 약어를 함께 넣고 지문에는 정답 약어 자체를 쓰지 않은 채/);
  assert.match(prompt, /정식 명칭이나 자료에 쓰인 약어로 답하세요.*약어가 허용된다는 사실만 밝힙니다/);

  // (b) 근거가 없는 경우: 지문은 정식 명칭만 요구하고 correctAnswers도 정식 명칭만 담아, 약어 허용을 지문에서 언급하지 않는다.
  assert.match(prompt, /그런 근거가 없으면 지문에 정식 명칭\(풀네임\)으로만 답하도록 명시하고 correctAnswers에도 정식 명칭만 넣습니다\(약어 허용을 언급하지 않음\)/);

  assert.match(prompt, /약어의 의미를 추정해서 확인 없이 정답 목록에 넣지 마세요/);
});

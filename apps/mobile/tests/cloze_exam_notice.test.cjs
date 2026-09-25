// 빈칸형 시험 화면: 입력 전에 정식 명칭 요구 안내를 보여주고, 저장된 정답은 노출하지 않는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');

function harness() {
  const state = [];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props: { ...(props || {}), children: [props?.children].flat(Infinity).filter(c => c !== undefined && c !== null && c !== false) } });
  const react = {
    useState(v) { const i = cursor++; if (!(i in state)) state[i] = v; return [state[i], n => { state[i] = typeof n === 'function' ? n(state[i]) : n; }]; },
    useRef(v) { const i = cursor++; if (!(i in state)) state[i] = { current: v }; return state[i]; },
    useEffect() {},
  };
  react.default = react;
  const native = new Proxy({ Platform: { OS: 'android' }, StyleSheet: { create: s => s }, Keyboard: { addListener: () => ({ remove() {} }) } }, {
    get: (t, k) => (k in t ? t[k] : String(k)),
  });
  const cache = new Map();
  const load = file => {
    if (cache.has(file)) return cache.get(file);
    const module = { exports: {} };
    cache.set(file, module.exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(code, {
      module, exports: module.exports, Array, Object, Math, Set, Map,
      require: name => {
        if (name === 'react') return react;
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
        if (name === 'react-native') return native;
        if (name.endsWith('designTokens')) return load(path.join(ROOT, 'src/styles/designTokens.ts'));
        if (name.endsWith('common/MathText')) return { MathText: (props) => jsx('Text', { children: props.text }) };
        if (name.endsWith('Styles')) return new Proxy({}, { get: () => new Proxy({}, { get: () => ({}) }) });
        return new Proxy({}, { get: (_t, k) => (k === '__esModule' ? true : String(k)) });
      },
    }, { filename: file });
    cache.set(file, module.exports);
    return module.exports;
  };
  const render = (component, props) => { cursor = 0; return component(props); };
  return { load, render };
}

const all = (tree, out = []) => {
  if (!tree || typeof tree !== 'object') return out;
  out.push(tree);
  (tree.props?.children || []).forEach(child => all(child, out));
  return out;
};
const textOf = node => all(node).flatMap(n => (n.props?.children || []).filter(c => typeof c === 'string')).join('');

const clozeQuestion = {
  id: 'rev-1', questionId: 'q-1', questionType: 'cloze',
  stem: '{{1}}은 물리 세계에서 동작하는 AI 분야이고, {{2}}는 데이터를 다루는 직무이다.',
  clozeBlanks: [
    { id: 'b1', correctAnswers: ['Physical AI'] },
    { id: 'b2', correctAnswers: ['AI 데이터 사이언티스트'] },
  ],
  explanation: 'SECRET_EXPLANATION', deepReasoningHint: 'SECRET_HINT',
};

const mcQuestion = {
  id: 'rev-2', questionId: 'q-2', questionType: 'multiple_choice',
  stem: '2+2는?', options: [{ id: 'o3', text: '3' }, { id: 'o4', text: '4' }],
};

test('cloze exam screen shows the full-name/abbreviation notice before input, without exposing saved answers', () => {
  const h = harness();
  const { ExamActiveView, CLOZE_ABBREVIATION_NOTICE } = h.load(path.join(ROOT, 'src/features/exam/ExamActiveView.tsx'));
  assert.equal(CLOZE_ABBREVIATION_NOTICE, '정식 명칭으로 입력하세요. 약어는 정답으로 등록된 경우에만 인정됩니다.');

  const tree = h.render(ExamActiveView, {
    questions: [clozeQuestion], currentIndex: 0, userAnswers: {}, userClozeAnswers: {}, isSaving: false,
    onSelectOption() {}, onAnswerTextChange() {}, onClozeAnswerChange() {}, onJumpToIndex() {},
    onPrevQuestion() {}, onNextQuestion() {}, onSubmitExam() {},
  });
  const body = textOf(tree);
  assert.ok(body.includes(CLOZE_ABBREVIATION_NOTICE), 'notice text should render before the blank inputs');
  for (const secret of ['Physical AI', 'AI 데이터 사이언티스트', 'SECRET_EXPLANATION', 'SECRET_HINT']) {
    assert.ok(!body.includes(secret), `saved answer/explanation must not leak: ${secret}`);
  }
});

test('non-cloze questions do not render the cloze abbreviation notice', () => {
  const h = harness();
  const { ExamActiveView, CLOZE_ABBREVIATION_NOTICE } = h.load(path.join(ROOT, 'src/features/exam/ExamActiveView.tsx'));
  const tree = h.render(ExamActiveView, {
    questions: [mcQuestion], currentIndex: 0, userAnswers: {}, userClozeAnswers: {}, isSaving: false,
    onSelectOption() {}, onAnswerTextChange() {}, onClozeAnswerChange() {}, onJumpToIndex() {},
    onPrevQuestion() {}, onNextQuestion() {}, onSubmitExam() {},
  });
  assert.ok(!textOf(tree).includes(CLOZE_ABBREVIATION_NOTICE));
});

test('focusing a blank scrolls that input above the Android keyboard', () => {
  const h = harness();
  const { ExamActiveView } = h.load(path.join(ROOT, 'src/features/exam/ExamActiveView.tsx'));
  const tree = h.render(ExamActiveView, {
    questions: [clozeQuestion], currentIndex: 0, userAnswers: {}, userClozeAnswers: {}, isSaving: false,
    onSelectOption() {}, onAnswerTextChange() {}, onClozeAnswerChange() {}, onJumpToIndex() {},
    onPrevQuestion() {}, onNextQuestion() {}, onSubmitExam() {},
  });
  const body = all(tree).find(n => n.type === 'ScrollView');
  const inputs = all(tree).filter(n => n.type === 'TextInput');
  const calls = [];
  body.props.ref.current = {
    scrollResponderScrollNativeHandleToKeyboard(target, offset, preventNegative) {
      calls.push([target, offset, preventNegative]);
    },
  };
  const focusedTarget = { nativeTag: 42 };
  inputs[1].props.onFocus({ target: focusedTarget });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], focusedTarget);
  assert.equal(calls[0][1], 24);
  assert.equal(calls[0][2], true);
});

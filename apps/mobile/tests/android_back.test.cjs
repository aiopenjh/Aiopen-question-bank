// Android 뒤로가기: 시험 화면(풀이공간 → 채점 중 안내 → 종료 확인 → 결과 화면 나가기),
// 일반 화면(설정 → 과목자료함 → 홈, 홈은 기본 종료), 출제 대기창(출제 취소), 웹·iOS 미등록.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');

// 함수 컴포넌트를 직접 호출해 요소 트리만 만든다(자식 컴포넌트는 렌더링하지 않는다).
function createHarness(platform) {
  const listeners = [];
  const alerts = [];
  const state = [];
  const effects = [];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props: { ...(props || {}), children: [props?.children].flat(Infinity).filter(c => c !== undefined) } });
  const jsxRuntime = { jsx, jsxs: jsx, Fragment: 'Fragment' };
  const react = {
    useState(value) { const i = cursor++; if (!(i in state)) state[i] = typeof value === 'function' ? value() : value; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
    useRef(value) { const i = cursor++; if (!(i in state)) state[i] = { current: value }; return state[i]; },
    useEffect(effect, deps) {
      const i = cursor++;
      const prev = state[i];
      if (prev && deps && deps.length === prev.deps.length && deps.every((d, k) => d === prev.deps[k])) return;
      prev?.cleanup?.();
      state[i] = { deps: deps || [], cleanup: null };
      effects.push(() => { state[i].cleanup = effect() || null; });
    },
  };
  react.default = react;
  const BackHandler = {
    addEventListener(name, fn) {
      assert.equal(name, 'hardwareBackPress');
      const entry = { fn };
      listeners.push(entry);
      return { remove() { listeners.splice(listeners.indexOf(entry), 1); } };
    },
  };
  const stubModule = new Proxy({}, { get: (_t, key) => (key === '__esModule' ? true : String(key)) });
  const overrides = new Map();
  const cache = new Map();
  const load = file => {
    if (cache.has(file)) return cache.get(file);
    const module = { exports: {} };
    cache.set(file, module.exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(code, {
      module, exports: module.exports, Promise, Array, Object, Set, Map, Math, JSON,
      require: name => {
        if (overrides.has(name)) return overrides.get(name);
        if (name === 'react') return react;
        if (name === 'react/jsx-runtime') return jsxRuntime;
        if (name === 'react-native') {
          return new Proxy({ BackHandler, Platform: { OS: platform }, StyleSheet: { create: s => s, absoluteFill: {} } }, {
            get: (target, key) => (key in target ? target[key] : String(key)),
          });
        }
        if (name.endsWith('useAndroidBackHandler')) return load(path.join(ROOT, 'src/hooks/useAndroidBackHandler.ts'));
        if (name.endsWith('utils/alert')) return { showAlert: (title, message, buttons) => alerts.push({ title, message, buttons }) };
        if (name.endsWith('Styles') || name.endsWith('examStyles') || name.endsWith('appStyles')) {
          return new Proxy({}, { get: () => new Proxy({}, { get: () => ({}) }) });
        }
        return stubModule;
      },
    }, { filename: file });
    cache.set(file, module.exports);
    return module.exports;
  };
  const flushEffects = () => { while (effects.length) effects.shift()(); };
  const render = (component, props) => { cursor = 0; const tree = component(props); flushEffects(); return tree; };
  const unmount = () => state.forEach(slot => slot?.cleanup?.());
  const back = () => {
    for (let i = listeners.length - 1; i >= 0; i--) if (listeners[i].fn()) return true;
    return false; // 기본 동작(앱 종료)
  };
  return { load, render, unmount, back, listeners, alerts, overrides };
}

function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null;
  if (predicate(tree)) return tree;
  for (const child of tree.props?.children || []) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return null;
}
const hasText = (node, text) => (node.props?.children || []).some(child => child === text || (child && typeof child === 'object' && hasText(child, text)));

test('hook registers once on Android, calls the latest handler, and removes it on unmount', () => {
  const h = createHarness('android');
  const { useAndroidBackHandler } = h.load(path.join(ROOT, 'src/hooks/useAndroidBackHandler.ts'));
  const Probe = ({ result }) => { useAndroidBackHandler(() => result); return null; };
  h.render(Probe, { result: false });
  h.render(Probe, { result: true });
  h.render(Probe, { result: true });
  assert.equal(h.listeners.length, 1);
  assert.equal(h.back(), true);
  h.unmount();
  assert.equal(h.listeners.length, 0);

  for (const platform of ['web', 'ios']) {
    const other = createHarness(platform);
    const hook = other.load(path.join(ROOT, 'src/hooks/useAndroidBackHandler.ts'));
    other.render(({}) => { hook.useAndroidBackHandler(() => true); return null; }, {});
    assert.equal(other.listeners.length, 0, platform);
  }
});

function examSession() {
  const h = createHarness('android');
  let resolveGrading;
  h.overrides.set('../../domain/exam_grading', {
    gradeExamAnswers: () => new Promise(resolve => { resolveGrading = resolve; }),
  });
  const { ExamSessionScreen } = h.load(path.join(ROOT, 'src/features/exam/ExamSessionScreen.tsx'));
  const calls = { exit: 0 };
  const props = {
    questions: [{ id: 'q1', questionType: 'multiple_choice', options: [], answerOptionId: 'a', stem: 's' }],
    onExitExam: () => { calls.exit++; },
    onCompleteExam: async () => {},
  };
  let tree = h.render(ExamSessionScreen, props);
  return {
    h, calls,
    rerender() { tree = h.render(ExamSessionScreen, props); return tree; },
    get tree() { return tree; },
    resolveGrading: results => resolveGrading(results),
  };
}

test('exam back closes only the scratchpad, then asks to confirm leaving', () => {
  const s = examSession();
  find(s.tree, node => node.type === 'TouchableOpacity' && hasText(node, '📐 풀이공간')).props.onPress();
  s.rerender();
  assert.equal(find(s.tree, node => node.type === 'ScratchpadPanel').props.visible, true);

  assert.equal(s.h.back(), true);
  s.rerender();
  assert.equal(find(s.tree, node => node.type === 'ScratchpadPanel').props.visible, false);
  assert.equal(s.h.alerts.length, 0);
  assert.equal(s.calls.exit, 0);

  assert.equal(s.h.back(), true);
  assert.equal(s.h.alerts.at(-1).title, '시험 종료');
  assert.equal(s.calls.exit, 0);
  s.h.alerts.at(-1).buttons.find(button => button.text === '나가기').onPress();
  assert.equal(s.calls.exit, 1);
});

test('exam back while grading shows the grading notice, and after submission leaves the exam', async () => {
  const s = examSession();
  find(s.tree, node => node.type === 'ExamActiveView').props.onSelectOption('a');
  s.rerender();
  const submitting = find(s.tree, node => node.type === 'ExamActiveView').props.onSubmitExam();
  await Promise.resolve();
  s.rerender();

  assert.equal(s.h.back(), true);
  assert.equal(s.h.alerts.at(-1).title, '채점 중');
  assert.equal(s.calls.exit, 0);

  s.resolveGrading([]);
  await submitting;
  s.rerender();
  assert.ok(find(s.tree, node => node.type === 'ExamResultView'));
  const alertCount = s.h.alerts.length;
  assert.equal(s.h.back(), true);
  assert.equal(s.calls.exit, 1);
  assert.equal(s.h.alerts.length, alertCount);
});

test('app back handles library detail before moving settings → library → home', () => {
  const h = createHarness('android');
  const { AppView } = h.load(path.join(ROOT, 'src/components/AppView.tsx'));
  const moves = [];
  const controller = {
    loading: false, storageError: null, currentPage: 2, examSessionActive: false,
    goToPage: (page, animated) => { moves.push([page, animated]); controller.currentPage = page; },
    containerWidth: 360,
  };
  // 나머지 화면 데이터는 빈 배열로 채운다(자식 화면은 렌더링하지 않는다).
  const render = () => h.render(AppView, { controller: new Proxy(controller, { get: (t, k) => (k in t ? t[k] : []) }) });
  render();
  assert.equal(h.back(), true);
  let tree = render();
  const library = find(tree, node => node.type === 'LibraryScreen');
  let nestedBackCount = 0;
  library.props.androidBackHandlerRef.current = () => { nestedBackCount++; return true; };
  assert.equal(h.back(), true);
  assert.equal(nestedBackCount, 1);
  assert.deepEqual(moves, [[1, true]]);

  library.props.androidBackHandlerRef.current = null;
  assert.equal(h.back(), true);
  render();
  assert.deepEqual(moves, [[1, true], [0, true]]);
  assert.equal(h.back(), false);

  controller.currentPage = 2;
  controller.examSessionActive = true;
  render();
  assert.equal(h.back(), false); // 시험 중에는 시험 화면 처리기에 넘긴다
  assert.equal(moves.length, 2);
  assert.equal(h.listeners.length, 1);
});

test('generation wait modal uses the existing cancel path on back', () => {
  const h = createHarness('android');
  const { AppModalsContainer } = h.load(path.join(ROOT, 'src/components/modals/AppModalsContainer.tsx'));
  const onCancelGeneration = () => {};
  const tree = h.render(AppModalsContainer, { generatingWaitStatus: { active: true, count: 3 }, onCancelGeneration });
  const waitModal = find(tree, node => node.type === 'UniversalModal' && find(node, child => child.type === 'LoadingWaitOverlay'));
  assert.equal(waitModal.props.onRequestClose, onCancelGeneration);
});

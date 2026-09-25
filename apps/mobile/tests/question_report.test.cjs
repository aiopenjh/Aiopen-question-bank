// 문제 신고: '신고 보내기'를 누를 때만 기존 의견 전송 경로로 문제 ID·지문·보기·사유·메모만 보낸다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');

function harness(fetchImpl) {
  const state = [];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props: { ...(props || {}), children: [props?.children].flat(Infinity).filter(c => c !== undefined && c !== null && c !== false) } });
  const react = {
    useState(v) { const i = cursor++; if (!(i in state)) state[i] = v; return [state[i], n => { state[i] = typeof n === 'function' ? n(state[i]) : n; }]; },
    useRef(v) { const i = cursor++; if (!(i in state)) state[i] = { current: v }; return state[i]; },
    useEffect() {},
  };
  react.default = react;
  const native = new Proxy({ Platform: { OS: 'android' }, StyleSheet: { create: s => s }, BackHandler: { addEventListener: () => ({ remove() {} }) } }, {
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
      module, exports: module.exports, fetch: fetchImpl, AbortController, setTimeout, clearTimeout, Promise, Error, JSON, Array, Object, Math, Set, Map,
      require: name => {
        if (name === 'react') return react;
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
        if (name === 'react-native') return native;
        if (name.endsWith('UniversalModal')) return { UniversalModal: 'UniversalModal' };
        if (name.endsWith('designTokens') || name.endsWith('QuestionReportModal') || name.endsWith('study/FeedbackCard') || name.endsWith('useAndroidBackHandler')) {
          const target = name.endsWith('designTokens') ? 'src/styles/designTokens.ts'
            : name.endsWith('QuestionReportModal') ? 'src/features/exam/QuestionReportModal.tsx'
            : name.endsWith('useAndroidBackHandler') ? 'src/hooks/useAndroidBackHandler.ts'
            : 'src/features/study/FeedbackCard.tsx';
          return load(path.join(ROOT, target));
        }
        if (name.includes('/domain/')) return load(path.resolve(path.dirname(file), `${name}.ts`));
        if (name.endsWith('Styles')) return new Proxy({}, { get: () => new Proxy({}, { get: () => ({}) }) });
        if (name.endsWith('utils/alert')) return { showAlert() {} };
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
const isType = (n, name) => n.type === name || n.type?.name === name;
const button = (tree, label) => all(tree).find(n => n.type === 'TouchableOpacity' && textOf(n).includes(label));

const question = {
  id: 'rev-1', questionId: 'q-1', questionType: 'multiple_choice', stem: '2+2는?',
  options: [
    { id: 'o3', text: '3', isDistractor: true },
    { id: 'o4', text: '4', isDistractor: false },
  ],
  answerOptionId: 'o4', explanation: 'SECRET_EXPLANATION', modelAnswer: 'SECRET_MODEL',
  clozeBlanks: [{ id: 'b', correctAnswers: ['SECRET_BLANK'] }], deepReasoningHint: 'SECRET_HINT',
};

test('payload carries only question ID, stem, shown option text, reason and memo', () => {
  const { buildQuestionReportPayload, QUESTION_REPORT_REASONS } = harness(async () => ({ ok: true }))
    .load(path.join(ROOT, 'src/features/exam/QuestionReportModal.tsx'));
  assert.ok(QUESTION_REPORT_REASONS.includes('부적절하거나 유해한 내용'));
  const payload = { ...buildQuestionReportPayload(question, '기타', '  메모  ') };
  assert.deepEqual(Object.keys(payload).sort(), ['_subject', 'memo', 'options', 'questionId', 'reason', 'stem']);
  assert.equal(payload.questionId, 'q-1'); // 개정 ID(id)가 아닌 문제 ID
  assert.equal(payload.options, '1. 3\n2. 4');
  assert.equal(payload.memo, '메모');
  const body = JSON.stringify(payload);
  for (const secret of ['rev-1', 'o4', 'isDistractor', 'SECRET_EXPLANATION', 'SECRET_MODEL', 'SECRET_BLANK', 'SECRET_HINT']) {
    assert.ok(!body.includes(secret), secret);
  }
});

test('report is sent only on 신고 보내기, keeps input on failure, and shows success', async () => {
  const calls = [];
  let respond = { ok: false, status: 500 };
  const h = harness(async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return respond; });
  const { QuestionReportModal, QUESTION_REPORT_NOTICE } = h.load(path.join(ROOT, 'src/features/exam/QuestionReportModal.tsx'));
  const props = { question, onClose() {} };
  let tree = h.render(QuestionReportModal, props);

  assert.equal(QUESTION_REPORT_NOTICE, '이 문제의 지문·보기, 신고 사유·메모가 Celueste 운영자에게 전달됩니다.');
  assert.ok(textOf(tree).includes(QUESTION_REPORT_NOTICE));
  assert.equal(button(tree, '신고 보내기').props.disabled, true);

  button(tree, '표시·형식 오류').props.onPress();
  tree = h.render(QuestionReportModal, props);
  all(tree).find(n => n.type === 'TextInput').props.onChangeText('보기가 잘립니다');
  tree = h.render(QuestionReportModal, props);
  assert.equal(calls.length, 0);

  await button(tree, '신고 보내기').props.onPress();
  tree = h.render(QuestionReportModal, props);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /formspree\.io/);
  assert.deepEqual(calls[0].body, {
    _subject: 'Celueste 문제 신고', questionId: 'q-1', stem: '2+2는?', options: '1. 3\n2. 4',
    reason: '표시·형식 오류', memo: '보기가 잘립니다',
  });
  assert.match(textOf(tree), /신고를 보내지 못했습니다/);
  assert.equal(all(tree).find(n => n.type === 'TextInput').props.value, '보기가 잘립니다');

  respond = { ok: true, status: 200 };
  await button(tree, '신고 보내기').props.onPress();
  tree = h.render(QuestionReportModal, props);
  assert.equal(calls.length, 2);
  assert.match(textOf(tree), /신고를 전달했습니다/);
});

test('header report entry targets the current question while solving, then a chosen question after submission, without touching answers or grading', async () => {
  const h = harness(async () => ({ ok: true }));
  const { ExamSessionScreen } = h.load(path.join(ROOT, 'src/features/exam/ExamSessionScreen.tsx'));
  const second = { ...question, id: 'rev-2', questionId: 'q-2' };
  const props = { questions: [question, second], onExitExam() {}, onCompleteExam: async () => {} };
  let tree = h.render(ExamSessionScreen, props);
  const active = () => all(tree).find(n => n.type === 'ExamActiveView');

  // 풀이 중: 헤더의 단일 '문제 신고' 버튼은 현재 보고 있는 문제를 바로 신고 대상으로 지정한다.
  active().props.onSelectOption('o3');
  tree = h.render(ExamSessionScreen, props);
  button(tree, '문제 신고').props.onPress();
  tree = h.render(ExamSessionScreen, props);
  let modal = all(tree).find(n => isType(n, 'QuestionReportModal'));
  assert.equal(modal.props.question.id, 'rev-1');
  assert.equal(active().props.userAnswers[0], 'o3');
  modal.props.onClose();
  tree = h.render(ExamSessionScreen, props);
  assert.equal(all(tree).find(n => isType(n, 'QuestionReportModal')), undefined);
  assert.equal(active().props.userAnswers[0], 'o3');

  // 두 번째 문제까지 답하고 제출하면 결과 화면으로 전환된다.
  active().props.onNextQuestion();
  tree = h.render(ExamSessionScreen, props);
  active().props.onSelectOption('o4');
  tree = h.render(ExamSessionScreen, props);
  await active().props.onSubmitExam();
  tree = h.render(ExamSessionScreen, props);
  const result = () => all(tree).find(n => n.type === 'ExamResultView');
  assert.ok(result(), 'switches to the result view after submission');
  assert.equal(result().props.userAnswers[0], 'o3');
  assert.equal(result().props.userAnswers[1], 'o4');
  assert.equal(result().props.results.length, 2);

  // 결과 화면: 같은 버튼을 누르면 신고할 문제를 먼저 고르는 선택 창이 뜬다.
  button(tree, '문제 신고').props.onPress();
  tree = h.render(ExamSessionScreen, props);
  const picker = all(tree).find(n => isType(n, 'QuestionReportPickerModal'));
  assert.ok(picker, 'result screen opens a question picker instead of reporting directly');
  assert.equal(picker.props.questions.length, 2);
  picker.props.onSelect(second);
  tree = h.render(ExamSessionScreen, props);
  modal = all(tree).find(n => isType(n, 'QuestionReportModal'));
  assert.equal(modal.props.question.id, 'rev-2');
  assert.equal(all(tree).find(n => isType(n, 'QuestionReportPickerModal')), undefined);
  modal.props.onClose();
  tree = h.render(ExamSessionScreen, props);
  // 신고 흐름이 채점 결과나 답안을 바꾸지 않았는지 재확인.
  assert.equal(result().props.userAnswers[0], 'o3');
  assert.equal(result().props.userAnswers[1], 'o4');
  assert.equal(result().props.results.length, 2);
});

test('exam active and result views no longer render a per-question report button', () => {
  const h = harness(async () => ({ ok: true }));
  const { ExamActiveView } = h.load(path.join(ROOT, 'src/features/exam/ExamActiveView.tsx'));
  const activeTree = h.render(ExamActiveView, {
    questions: [question], currentIndex: 0, userAnswers: {}, userClozeAnswers: {}, isSaving: false,
  });
  assert.equal(all(activeTree).find(n => isType(n, 'ReportQuestionButton')), undefined);

  const { ExamResultView } = h.load(path.join(ROOT, 'src/features/exam/ExamResultView.tsx'));
  const second = { ...question, id: 'rev-2' };
  const resultTree = h.render(ExamResultView, {
    questions: [question, second], userAnswers: { 0: 'o4', 1: 'o3' }, onExitExam() {},
  });
  assert.equal(all(resultTree).find(n => isType(n, 'ReportQuestionButton')), undefined);
});

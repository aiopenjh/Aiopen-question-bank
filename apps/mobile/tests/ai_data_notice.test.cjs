// 첫 AI 요청 전 데이터 전송 안내: 계속하기를 눌러야 진행하고, 확인한 문구 버전은 기기에 저장한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const KEY = '@celueste:ai_data_notice_version';

function setup({ failRead = false, failWrite = false } = {}) {
  const data = new Map();
  const storage = {
    getItem: async key => { if (failRead) throw new Error('read'); return data.get(key) ?? null; },
    setItem: async (key, value) => { if (failWrite) throw new Error('write'); data.set(key, value); },
  };
  const state = [];
  let cursor = 0;
  const effects = [];
  const jsx = (type, props) => ({ type, props: { ...(props || {}), children: [props?.children].flat(Infinity).filter(c => c != null && c !== false) } });
  const react = {
    useState(v) { const i = cursor++; if (!(i in state)) state[i] = v; return [state[i], n => { state[i] = typeof n === 'function' ? n(state[i]) : n; }]; },
    useEffect(effect) { const i = cursor++; if (!(i in state)) { state[i] = true; effects.push(effect); } },
  };
  const cache = new Map();
  const load = file => {
    if (cache.has(file)) return cache.get(file);
    const module = { exports: {} };
    cache.set(file, module.exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(code, {
      module, exports: module.exports, Promise, Error,
      require: name => {
        if (name === '../data/app_storage') return { default: storage, __esModule: true };
        if (name === 'react') return react;
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
        if (name === 'react-native') return new Proxy({ StyleSheet: { create: s => s } }, { get: (t, k) => (k in t ? t[k] : String(k)) });
        if (name.endsWith('UniversalModal')) return { UniversalModal: 'UniversalModal' };
        if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts${name.endsWith('Modal') ? 'x' : ''}`));
        throw new Error(`Unexpected dependency ${name}`);
      },
    }, { filename: file });
    cache.set(file, module.exports);
    return module.exports;
  };
  const notice = load(path.join(ROOT, 'src/domain/ai_data_notice.ts'));
  return { data, notice, load, render: (C) => { cursor = 0; const tree = C({}); while (effects.length) effects.shift()(); return tree; } };
}

test('without the notice screen no request is allowed and nothing is saved', async () => {
  const { notice, data } = setup();
  assert.equal(await notice.ensureAiDataNoticeAccepted(), false);
  assert.equal(data.size, 0);
});

test('concurrent requests share one prompt; accepting saves the version and later requests skip it', async () => {
  const { notice, data } = setup();
  const prompts = [];
  notice.registerAiDataNoticeListener(answer => prompts.push(answer));
  const first = notice.ensureAiDataNoticeAccepted();
  const second = notice.ensureAiDataNoticeAccepted();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(prompts.length, 1);
  prompts[0](true);
  assert.deepEqual([await first, await second], [true, true]);
  assert.equal(data.get(KEY), notice.AI_DATA_NOTICE_VERSION);
  assert.equal(await notice.ensureAiDataNoticeAccepted(), true);
  assert.equal(prompts.length, 1);
});

test('cancelling saves nothing and asks again; a new notice version asks again', async () => {
  const { notice, data } = setup();
  const prompts = [];
  notice.registerAiDataNoticeListener(answer => prompts.push(answer));
  const declined = notice.ensureAiDataNoticeAccepted();
  await new Promise(resolve => setImmediate(resolve));
  prompts[0](false);
  assert.equal(await declined, false);
  assert.equal(data.has(KEY), false);

  data.set(KEY, 'older-version');
  const again = notice.ensureAiDataNoticeAccepted();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(prompts.length, 2);
  prompts[1](true);
  assert.equal(await again, true);
});

test('storage failures fall back to asking and never block an accepted request', async () => {
  const { notice } = setup({ failRead: true, failWrite: true });
  notice.registerAiDataNoticeListener(answer => answer(true));
  assert.equal(await notice.ensureAiDataNoticeAccepted(), true);
});

test('notice screen lists what is sent without naming an AI product, and only 계속하기 proceeds', async () => {
  const s = setup();
  const { AiDataNoticeModal, AI_DATA_NOTICE_MESSAGE } = s.load(path.join(ROOT, 'src/components/modals/AiDataNoticeModal.tsx'));
  assert.equal(s.render(AiDataNoticeModal), null);
  for (const item of ['출제 요청', '선택한 페이지', '답안', 'API 키', '제공자와 요금제']) assert.ok(AI_DATA_NOTICE_MESSAGE.includes(item), item);
  assert.doesNotMatch(AI_DATA_NOTICE_MESSAGE, /Gemini|Google|Claude|Anthropic|OpenAI|GPT|구글|제미나이/i);

  const all = (n, out = []) => { if (n && typeof n === 'object') { out.push(n); n.props.children.forEach(c => all(c, out)); } return out; };
  const press = (tree, label) => all(tree).find(n => n.type === 'TouchableOpacity' && all(n).some(c => c.props.children.includes(label))).props.onPress();

  const accepted = s.notice.ensureAiDataNoticeAccepted();
  await new Promise(resolve => setImmediate(resolve));
  press(s.render(AiDataNoticeModal), '계속하기');
  assert.equal(await accepted, true);

  s.data.clear();
  const backed = s.notice.ensureAiDataNoticeAccepted();
  await new Promise(resolve => setImmediate(resolve));
  s.render(AiDataNoticeModal).props.onRequestClose(); // Android 뒤로가기 = 취소
  assert.equal(await backed, false);
  assert.equal(s.data.size, 0);
});

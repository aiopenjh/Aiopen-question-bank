const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const jsx = (type, props) => ({
  type,
  props: { ...(props || {}), children: [props?.children].flat(Infinity).filter(child => child != null && child !== false) },
});
const all = (node, out = []) => {
  if (!node || typeof node !== 'object') return out;
  out.push(node);
  (node.props?.children || []).forEach(child => all(child, out));
  return out;
};

function harness() {
  const state = [];
  let cursor = 0;
  const listeners = {};
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index];
    },
    useEffect(callback) { callback(); },
  };
  react.default = react;
  const native = new Proxy({
    Platform: { OS: 'android' },
    Keyboard: { addListener(name, callback) {
      listeners[name] = callback;
      return { remove() { delete listeners[name]; } };
    } },
  }, { get: (target, key) => key in target ? target[key] : String(key) });
  const load = file => {
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(code, {
      module, exports: module.exports, Array, Object, Math,
      setTimeout(callback) { callback(); return 1; }, clearTimeout() {},
      require(name) {
        if (name === 'react') return react;
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
        if (name === 'react-native') return native;
        if (name.endsWith('.png')) return 1;
        if (name.endsWith('usePullToRefresh')) return { usePullToRefresh: () => ({ pullDistance: 0, handleScroll() {}, touchHandlers: {} }) };
        if (name.endsWith('notifications')) return { DEFAULT_ALARM_CONFIG: {} };
        if (name.endsWith('daily_goal')) return { DAILY_GOAL_DEFAULT: 3 };
        if (name.endsWith('buildInfo')) return { PRIVACY_POLICY_URL: '' };
        if (name.endsWith('settingsStyles')) return { styles: new Proxy({}, { get: () => ({}) }) };
        if (name.endsWith('utils/alert')) return { showAlert() {} };
        return new Proxy({}, { get: (_target, key) => key === '__esModule' ? true : String(key) });
      },
    }, { filename: file });
    return module.exports;
  };
  return {
    load,
    render(component, props) { cursor = 0; return component(props); },
    showKeyboard(event) { listeners.keyboardDidShow(event); },
  };
}

test('API key input forwards its native ref when focused', () => {
  const h = harness();
  const { ApiKeySection } = h.load(path.join(ROOT, 'src/features/settings/ApiKeySection.tsx'));
  let focused = null;
  const tree = h.render(ApiKeySection, {
    apiKey: '', onChangeApiKey() {}, onSaveApiKey: async () => {}, onInputFocus(input) { focused = input; },
  });
  const input = all(tree).find(node => node.type === 'TextInput');
  const nativeInput = { measureInWindow() {} };
  input.props.ref.current = nativeInput;
  input.props.onFocus();
  assert.equal(focused, nativeInput);
});

test('settings scrolls the API key field by its actual keyboard overlap', () => {
  const h = harness();
  const { SettingsScreen } = h.load(path.join(ROOT, 'src/features/settings/SettingsScreen.tsx'));
  const tree = h.render(SettingsScreen, {
    apiKey: '', onChangeApiKey() {}, onSaveApiKey: async () => {},
    onExportBackup: async () => {}, onOpenRestoreModal() {}, onResetAllData() {},
  });
  const scroll = all(tree).find(node => node.type === 'ScrollView');
  const api = all(tree).find(node => node.type === 'ApiKeySection');
  const calls = [];
  scroll.props.ref.current = { scrollTo(options) { calls.push(options); } };
  api.props.onInputFocus({ measureInWindow(callback) { callback(0, 190, 300, 48); } });
  h.showKeyboard({ endCoordinates: { screenY: 205, height: 300 } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].y, 57);
  assert.equal(calls[0].animated, true);
});

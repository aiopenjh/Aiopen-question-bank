const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Run actual component handlers; fake only React rendering and network/timer boundaries.
function feedback(fetchImpl) {
  const state = [], timers = new Map();
  let cursor = 0, timerId = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: initial => {
      const i = cursor++;
      if (!(i in state)) state[i] = initial;
      return [state[i], value => { state[i] = value; }];
    },
    useRef: initial => {
      const i = cursor++;
      if (!(i in state)) state[i] = { current: initial };
      return state[i];
    },
    useEffect() {},
  };
  class AnimatedValue {
    constructor(value) { this.value = value; }
    setValue(value) { this.value = value; }
  }
  const native = {
    StyleSheet: { create: x => x },
    Platform: { OS: 'web' },
    Animated: {
      Value: AnimatedValue,
      timing: () => ({ start() {} }),
      View: 'AnimatedView',
    },
  };
  for (const name of ['ActivityIndicator', 'KeyboardAvoidingView', 'ScrollView', 'Text', 'TextInput', 'TouchableOpacity', 'View']) native[name] = name;
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/features/study/FeedbackCard.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    exports, AbortController, Error, fetch: fetchImpl,
    setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; },
    clearTimeout: id => timers.delete(id),
    require: name => name === 'react' ? react : name === 'react-native' ? native :
      name.includes('UniversalModal') ? { UniversalModal: 'Modal' } :
      { colors: {}, radius: {}, spacing: {}, shadows: { soft: {} } },
  });
  const flatten = node => !node || typeof node !== 'object' ? [] :
    [node, ...(node.children || []).flat(Infinity).flatMap(flatten)];
  const render = () => { cursor = 0; return flatten(exports.FeedbackModal({ visible: true, onClose() {} })); };
  const button = text => render().find(n => n.type === 'TouchableOpacity' &&
    n.children.some(child => child?.type === 'Text' && child.children.includes(text)));
  const input = () => render().find(n => n.type === 'TextInput');
  return { render, button, input, timers, state, exports };
}

test('feedback trigger delegates opening to the screen-level modal host', () => {
  const f = feedback(async () => ({ ok: true }));
  let opened = false;
  const trigger = f.exports.FeedbackCard({ compact: true, onOpen: () => { opened = true; } });
  trigger.props.onPress();
  assert.equal(opened, true);
});

test('feedback blocks empty input and duplicate sends before render and after success', async () => {
  const calls = []; let resolve;
  const f = feedback((url, options) => { calls.push({ url, options }); return new Promise(r => { resolve = r; }); });
  await f.button('보내기').props.onPress();
  assert.equal(calls.length, 0);
  f.input().props.onChangeText('  test message  ');
  const send = f.button('보내기').props.onPress;
  const pending = send();
  await send();
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(calls[0].options.body).message, 'test message');
  resolve({ ok: true });
  await pending;
  await send();
  assert.equal(calls.length, 1);
  assert.equal(f.timers.size, 0);
  assert.ok(f.button('확인'));
});

test('feedback opens without forcing the mobile keyboard', () => {
  const f = feedback(async () => ({ ok: true }));
  assert.equal(f.input().props.autoFocus, undefined);
  assert.equal(f.input().props.style.fontSize, 16);
});
test('feedback timeout releases the dialog and keeps draft; stale success cannot erase a retry', async () => {
  const calls = [];
  const f = feedback((url, options) => new Promise(resolve => calls.push({ options, resolve })));
  f.input().props.onChangeText('keep this draft');
  const pending = f.button('보내기').props.onPress();
  const timer = [...f.timers.values()][0];
  assert.equal(timer.ms, 20000);
  timer.fn();
  await pending;
  assert.equal(calls[0].options.signal.aborted, true);
  assert.equal(f.input().props.value, 'keep this draft');
  assert.equal(f.button('취소').props.disabled, false);
  const retry = f.button('보내기').props.onPress();
  calls[0].resolve({ ok: true });
  await Promise.resolve();
  assert.equal(f.input().props.value, 'keep this draft');
  calls[1].resolve({ ok: true });
  await retry;
  assert.ok(f.button('확인'));
});

test('feedback quota errors preserve text and allow closing without automatic retry', async () => {
  let calls = 0;
  const f = feedback(async () => { calls++; return { ok: false, status: 429 }; });
  f.input().props.onChangeText('draft');
  await f.button('보내기').props.onPress();
  assert.equal(calls, 1);
  assert.equal(f.input().props.value, 'draft');
  assert.equal(f.button('취소').props.disabled, false);
  assert.ok(f.render().some(n => n.type === 'Text' && n.children.some(c => typeof c === 'string' && c.includes('접수 한도'))));
});

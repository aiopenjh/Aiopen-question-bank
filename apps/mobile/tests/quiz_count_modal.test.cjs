const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setupModal(overrides = {}) {
  const state = [];
  const alerts = [];
  const saved = [];
  const selected = [];
  let cursor = 0;

  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: initial => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = value; }];
    },
    useRef: initial => {
      const index = cursor++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index];
    },
    useEffect() {},
  };
  const native = {};
  for (const name of ['Pressable', 'ScrollView', 'Text', 'TouchableOpacity', 'View']) native[name] = name;
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/components/modals/QuizCountModal.tsx'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;

  vm.runInNewContext(code, {
    exports,
    require: name => {
      if (name === 'react') return react;
      if (name === 'react-native') return native;
      if (name.includes('UniversalModal')) return { UniversalModal: 'Modal' };
      if (name.includes('DifficultyLevelControl')) return { DifficultyLevelControl: 'DifficultyLevelControl' };
      if (name.includes('QuizCountModal.styles')) return { quizCountModalStyles: {} };
      if (name.includes('../../utils/alert')) return { showAlert: (...args) => alerts.push(args) };
      if (name.includes('../../domain/challenge_progress')) return { CHALLENGE_START_LEVEL: 31 };
      if (name.includes('../../domain/difficulty')) return {
        difficultyToLegacyLevel: () => 'basic',
        getDifficultyProfile: level => ({ bandLabel: `band-${level}` }),
        legacyLevelToDifficulty: () => 1,
      };
      if (name.includes('../../styles/designTokens')) return { colors: {} };
      return {};
    },
  });

  const props = {
    visible: true,
    unitTitle: '테스트 단원',
    topicName: '테스트 과목',
    existingCount: 1,
    initialDifficultyLevel: 2,
    onClose() {},
    onSaveDifficulty: async level => { saved.push(level); },
    onSelectCount: (count, options) => { selected.push({ count, options }); },
    ...overrides,
  };
  const flatten = node => !node || typeof node !== 'object'
    ? []
    : [node, ...(node.children || []).flat(Infinity).flatMap(flatten)];
  const textOf = node => !node || typeof node !== 'object'
    ? String(node ?? '')
    : (node.children || []).flat(Infinity).map(textOf).join('');
  const render = () => {
    cursor = 0;
    return flatten(exports.QuizCountModal(props));
  };
  const pressCount = label => {
    const button = render().find(node => node.type === 'TouchableOpacity' && textOf(node).includes(label));
    assert.ok(button, `${label} button missing`);
    button.props.onPress();
  };
  const changeLevel = level => {
    const control = render().find(node => node.type === 'DifficultyLevelControl');
    assert.ok(control, 'difficulty control missing');
    control.props.onChange(level);
  };
  return { alerts, changeLevel, pressCount, render, saved, selected, textOf };
}

test('level buttons only change the pending selection; count button opens the confirmation', async () => {
  const modal = setupModal();
  modal.changeLevel(3);
  modal.changeLevel(4);
  assert.equal(modal.alerts.length, 0);

  modal.pressCount('3문제');
  assert.equal(modal.alerts.length, 1);
  const [, , buttons] = modal.alerts[0];
  assert.deepEqual(Array.from(buttons, button => button.text), [
    '취소',
    '기존문제유지 + 레벨변경',
    '기존문제삭제 + 레벨변경',
  ]);

  buttons[1].onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(modal.saved, [4]);
  assert.equal(modal.selected[0].count, 3);
  assert.equal(modal.selected[0].options.shouldReplaceExisting, false);
});

test('delete choice applies only after count selection and old status copy is absent', async () => {
  const modal = setupModal();
  assert.equal(modal.render().some(node => modal.textOf(node).includes('기존 1문제 기존 문제 유지')), false);
  modal.changeLevel(5);
  modal.pressCount('5문제');
  const buttons = modal.alerts[0][2];
  buttons[2].onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(modal.saved, [5]);
  assert.equal(modal.selected[0].count, 5);
  assert.equal(modal.selected[0].options.shouldReplaceExisting, true);
});

test('challenge selection shows only 3 questions; normal selection restores 5 without saving', () => {
  const modal = setupModal({ initialDifficultyLevel: 31 });
  const countButtons = () => modal.render().filter(node => node.type === 'TouchableOpacity')
    .map(modal.textOf).filter(text => text.includes('3문제') || text.includes('5문제'));
  assert.equal(countButtons().length, 1);
  assert.ok(countButtons()[0].includes('3문제'));
  assert.equal(modal.render().find(node => node.type === 'DifficultyLevelControl').props.maxLevel, 31);
  modal.changeLevel(30);
  assert.equal(countButtons().length, 2);
  assert.equal(modal.saved.length, 0);
});

test('old level 50 is preserved with explanation while first sequential challenge offers 31', () => {
  const modal = setupModal({ initialDifficultyLevel: 50 });
  assert.equal(modal.render().find(node => node.type === 'DifficultyLevelControl').props.value, 31);
  assert.ok(modal.render().some(node => modal.textOf(node).includes('저장된 레벨 50은 유지됩니다')));
  modal.pressCount('3문제');
  assert.equal(modal.selected[0].options.difficultyLevel, 31);
  assert.equal(modal.selected[0].options.shouldReplaceExisting, false);
  assert.equal(modal.saved.length, 0);
});

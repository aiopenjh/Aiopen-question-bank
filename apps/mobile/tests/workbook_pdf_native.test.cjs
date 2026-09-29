// 네이티브(Android) 문제집 PDF 저장: DOM Canvas 없이 HTML을 그대로 expo-print로 변환하고
// expo-sharing으로 공유/저장한다. PDF가 캐시에만 남는 상태를 성공으로 안내하지 않는지도 확인한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');

function setupSection(overrides = {}) {
  const state = [];
  let cursor = 0;
  const alerts = [];
  const printCalls = [];
  const shareCalls = [];
  let shareAvailable = true;
  let htmlSeen = null;
  const printResult = { uri: 'file:///cache/Celueste_Workbook.pdf' };

  const jsx = (type, props) => ({
    type,
    props: { ...(props || {}), children: [props?.children].flat(Infinity).filter((c) => c !== undefined && c !== null && c !== false) },
  });
  const react = {
    useState(v) {
      const i = cursor++;
      if (!(i in state)) state[i] = v;
      return [state[i], (n) => { state[i] = typeof n === 'function' ? n(state[i]) : n; }];
    },
  };
  react.default = react;

  const native = new Proxy(
    {
      Platform: { OS: 'android' },
      StyleSheet: { create: (s) => s },
      Image: { resolveAssetSource: () => ({ uri: 'asset://watermark.png' }) },
    },
    { get: (t, k) => (k in t ? t[k] : String(k)) }
  );

  const file = path.join(ROOT, 'src/features/settings/DataBackupSection.tsx');
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;

  vm.runInNewContext(
    code,
    {
      module,
      exports: module.exports,
      require: (name) => {
        if (name === 'react') return react;
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
        if (name === 'react-native') return native;
        if (name.endsWith('UniversalModal')) return { UniversalModal: 'Modal' };
        if (name.endsWith('ViewportPopupLayer')) return { ViewportPopupLayer: 'ViewportPopupLayer' };
        if (name.endsWith('workbookHtml')) {
          return {
            generateWorkbookHtml: (...args) => {
              htmlSeen = args;
              return '<html>fake-workbook</html>';
            },
          };
        }
        if (name.endsWith('utils/alert')) {
          return { showAlert: (title, message, buttons) => alerts.push({ title, message, buttons }) };
        }
        if (name.endsWith('designTokens')) return { colors: {}, radius: {}, shadows: {}, spacing: {} };
        if (name.endsWith('settingsStyles')) return { styles: new Proxy({}, { get: () => ({}) }) };
        if (name === 'expo-print') {
          return {
            printToFileAsync: async ({ html }) => {
              printCalls.push(html);
              return printResult;
            },
          };
        }
        if (name === 'expo-sharing') {
          return {
            isAvailableAsync: async () => shareAvailable,
            shareAsync: async (uri, opts) => { shareCalls.push({ uri, opts }); },
          };
        }
        if (name.includes('assets/')) return { uri: 'asset-module-uri' };
        return new Proxy({}, { get: (_t, k) => (k === '__esModule' ? true : String(k)) });
      },
    },
    { filename: file }
  );

  const topics = [{ id: 't1', name: '수학' }];
  const units = [{ id: 'u1', topicId: 't1', title: '1단원', orderIndex: 0 }];
  const questions = [
    { id: 'q1', topicId: 't1', unitId: 'u1', questionType: 'multiple_choice', stem: '1+1=?', options: [] },
  ];

  const props = {
    onExportBackup: async () => {},
    onOpenRestoreModal() {},
    onResetAllData() {},
    topics,
    units,
    questions,
    ...overrides,
  };

  const all = (tree, out = []) => {
    if (!tree || typeof tree !== 'object') return out;
    out.push(tree);
    (tree.props?.children || []).forEach((child) => all(child, out));
    return out;
  };
  const textOf = (node) => all(node).flatMap((n) => (n.props?.children || []).filter((c) => typeof c === 'string')).join('');
  const render = () => { cursor = 0; return module.exports.DataBackupSection(props); };
  const button = (tree, label) => {
    const found = all(tree).find((n) => n.type === 'TouchableOpacity' && textOf(n).includes(label));
    assert.ok(found, `"${label}" 버튼을 찾지 못함`);
    return found;
  };

  return {
    alerts,
    printCalls,
    shareCalls,
    render,
    button,
    getHtmlSeen: () => htmlSeen,
    setShareAvailable: (v) => { shareAvailable = v; },
  };
}

test('선택한 과목이 없으면 안내만 하고 PDF를 만들지 않는다', async () => {
  const s = setupSection();
  const tree = s.render();
  await s.button(tree, 'PDF 만들고 저장하기').props.onPress();
  assert.equal(s.printCalls.length, 0);
  assert.equal(s.alerts.length, 1);
  assert.equal(s.alerts[0].title, '과목 선택');
});

test('네이티브에서 HTML을 실제 PDF로 변환하고 공유 시트로 저장한다', async () => {
  const s = setupSection();
  let tree = s.render();
  s.button(tree, '수학').props.onPress(); // 과목 선택 체크박스
  tree = s.render();
  await s.button(tree, 'PDF 만들고 저장하기').props.onPress();

  assert.equal(s.printCalls.length, 1, 'expo-print로 실제 변환을 시도해야 한다');
  assert.match(s.printCalls[0], /fake-workbook|<html/);
  assert.equal(s.shareCalls.length, 1, 'expo-sharing으로 공유/저장 시트를 열어야 한다');
  assert.equal(s.shareCalls[0].uri, 'file:///cache/Celueste_Workbook.pdf');
  assert.equal(s.shareCalls[0].opts.mimeType, 'application/pdf');
  // 성공 시에는 별도 성공 안내를 덧붙이지 않는다(OS 공유 시트 자체가 확인 UI).
  assert.equal(s.alerts.length, 0);
});

test('미리보기 전용 닫기 링크 URL을 네이티브 PDF에 넣지 않는다', async () => {
  const s = setupSection();
  let tree = s.render();
  s.button(tree, '수학').props.onPress();
  tree = s.render();
  await s.button(tree, 'PDF 만들고 저장하기').props.onPress();

  const args = s.getHtmlSeen();
  assert.ok(args, 'generateWorkbookHtml가 호출되어야 한다');
  assert.equal(args[5], '', 'returnUrl(닫기 링크)은 네이티브에서 빈 문자열이어야 한다');
});

test('공유 기능이 없는 기기에서는 성공으로 포장하지 않고 파일 위치를 안내한다', async () => {
  const s = setupSection();
  s.setShareAvailable(false);
  let tree = s.render();
  s.button(tree, '수학').props.onPress();
  tree = s.render();
  await s.button(tree, 'PDF 만들고 저장하기').props.onPress();

  assert.equal(s.shareCalls.length, 0);
  assert.equal(s.alerts.length, 1);
  assert.equal(s.alerts[0].title, 'PDF 저장');
  assert.match(s.alerts[0].message, /공유 기능을 사용할 수 없습니다/);
  assert.match(s.alerts[0].message, /file:\/\/\/cache\/Celueste_Workbook\.pdf/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('겹친 화면의 알림 구독이 해제되면 기존 화면 알림으로 복귀한다', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/utils/alert.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  let nativeAlerts = 0;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require(name) {
      if (name === 'react-native') return {
        Platform: { OS: 'android' },
        Alert: { alert() { nativeAlerts++; } },
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });

  const { registerAlertListener, showAlert } = module.exports;
  const mainAlerts = [];
  const rankingAlerts = [];
  const removeMain = registerAlertListener(data => mainAlerts.push(data?.title));
  const removeRanking = registerAlertListener(data => rankingAlerts.push(data?.title));

  showAlert('랭킹 창');
  assert.deepEqual(rankingAlerts, ['랭킹 창']);
  removeRanking();
  showAlert('과목 등록');
  assert.deepEqual(mainAlerts, ['과목 등록']);
  assert.equal(nativeAlerts, 0);
  removeMain();
});

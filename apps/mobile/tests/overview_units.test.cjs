const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/hooks/quizGenerationContext.ts', 'utf8');
const contextExports = {};
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: contextExports, require: () => ({}) });

test('overview samples distinct units before repeating and preserves the requested count', () => {
  const selected = contextExports.pickOverviewUnitTitles(['회계원리', '재무제표', '원가계산'], 5, () => 0);
  assert.equal(selected.length, 5);
  assert.equal(new Set(selected.slice(0, 3)).size, 3);
  assert.deepEqual(Array.from(selected.slice(3)), Array.from(selected.slice(0, 2)));
  assert.equal(contextExports.pickOverviewUnitTitles([], 3).length, 0);
});

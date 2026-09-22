const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function drawing() {
  const queued = [];
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/features/exam/scratchpadDrawing.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: () => ({
    useRef: current => ({ current }),
    useState: initial => [initial, next => queued.push(next)],
  }) });
  return { ...module.exports.useScratchpadDrawing(), queued };
}

test('releasing a stroke before React flushes does not erase or alter its queued snapshots', () => {
  const d = drawing();
  d.onStart({ x: 10, y: 10 });
  d.onMove({ x: 30, y: 30 });
  d.onMove({ x: 50, y: 60 });
  d.onEnd();
  assert.equal(d.queued[0][0].length, 1);
  assert.equal(d.queued[1][0].length, 2);
  assert.equal(d.queued[2][0].length, 3);
  d.onMove({ x: 70, y: 80 });
  assert.equal(d.queued.length, 3);
  d.onStart({ x: 90, y: 90 });
  d.onEnd();
  assert.equal(d.queued.at(-1).length, 2);
  assert.equal(d.queued.at(-1)[0].length, 3);
});

test('undo removes exactly one complete stroke; clear and a fresh problem start empty', () => {
  const d = drawing();
  for (let i = 0; i < 3; i++) { d.onStart({ x: i, y: i }); d.onEnd(); }
  d.undo();
  assert.equal(d.queued.at(-1).length, 2);
  d.clear();
  assert.equal(d.queued.at(-1).length, 0);
  d.onMove({ x: 100, y: 100 });
  assert.equal(d.queued.at(-1).length, 0);
  assert.equal(drawing().strokes.length, 0);
});

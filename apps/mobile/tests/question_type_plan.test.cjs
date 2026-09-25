const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/domain/question_type_plan.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: moduleUnderTest, exports: moduleUnderTest.exports });
const { createQuestionTypePlan, matchesQuestionTypePlan } = moduleUnderTest.exports;

test('all three questions may be the same type, including short answer, essay and cloze', () => {
  for (const [values, type] of [
    [[0], 'multiple_choice'], [[0.45, 0.1], 'short_answer'],
    [[0.45, 0.8], 'essay'], [[0.99], 'cloze'],
  ]) {
    let i = 0;
    assert.deepEqual(Array.from(createQuestionTypePlan(3, () => values[i++ % values.length])), Array(3).fill(type));
  }
});

test('independent category draws have equal intervals and do not enforce a quota', () => {
  const values = [0.1, 0.5, 0.1, 0.9, 0.5, 0.9];
  let i = 0;
  assert.deepEqual(Array.from(createQuestionTypePlan(4, () => values[i++])),
    ['multiple_choice', 'short_answer', 'cloze', 'essay']);
  assert.equal(i, values.length);
});

test('provider type substitutions or missing questions fail the drawn plan', () => {
  const plan = ['cloze', 'short_answer', 'essay'];
  assert.equal(matchesQuestionTypePlan(plan.map(questionType => ({ questionType })), plan), true);
  assert.equal(matchesQuestionTypePlan([{ questionType: 'multiple_choice' }], plan), false);
  assert.equal(matchesQuestionTypePlan(['cloze', 'essay', 'short_answer'].map(questionType => ({ questionType })), plan), false);
});

test('question type modes: multiple choice only, or short answer and essay only without cloze', () => {
  assert.deepEqual(Array.from(createQuestionTypePlan(4, () => 0.99, 'multiple_choice')), Array(4).fill('multiple_choice'));
  const values = [0.1, 0.9, 0.49, 0.5];
  let i = 0;
  assert.deepEqual(Array.from(createQuestionTypePlan(4, () => values[i++], 'subjective')),
    ['short_answer', 'essay', 'short_answer', 'essay']);
  for (const draw of [0, 0.4, 0.7, 0.99]) {
    const plan = Array.from(createQuestionTypePlan(5, () => draw, 'subjective'));
    assert.ok(plan.every(type => type === 'short_answer' || type === 'essay'), String(draw));
  }
  let j = 0;
  const mixed = [0.1, 0.5, 0.1, 0.9, 0.5, 0.9];
  assert.deepEqual(Array.from(createQuestionTypePlan(4, () => mixed[j++], 'mixed')),
    ['multiple_choice', 'short_answer', 'cloze', 'essay']);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(name, dependencies = {}) {
  const filename = path.join(__dirname, '../src/domain', `${name}.ts`);
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: key => {
    if (!(key in dependencies)) throw Error(`Unexpected dependency: ${key}`);
    return dependencies[key];
  } });
  return module.exports;
}

test('history indexing preserves legacy substring matches, overlap and last stored attempt', () => {
  const { selectIncorrectQuestions } = load('question_history');
  const questions = ['', 'q', 'q1', 'q10', 'missing', '한글'].map(id => ({ id }));
  const attempts = [
    { submissionKey: 'submit-q10-once', isCorrect: false },
    { submissionKey: 'sub-q1-run', isCorrect: true },
    { submissionKey: 'old-한글-record', isCorrect: false },
  ];
  const expected = questions.filter(q => {
    const matches = attempts.filter(a => a.submissionKey.includes(q.id));
    return matches.length && !matches.at(-1).isCorrect;
  });
  assert.deepEqual(Array.from(selectIncorrectQuestions(questions, attempts)), expected);
  assert.equal(selectIncorrectQuestions(questions, []).length, 0);
});

test('history indexing agrees with legacy calculation across a growing question bank', () => {
  const { selectIncorrectQuestions } = load('question_history');
  const questions = Array.from({ length: 500 }, (_, i) => ({ id: `question-${i}` }));
  const attempts = Array.from({ length: 2500 }, (_, i) => ({
    submissionKey: `sub-question-${i % 500}-run-${i}`, isCorrect: i % 3 === 0,
  }));
  const expected = questions.filter(q => {
    const matches = attempts.filter(a => a.submissionKey.includes(q.id));
    return matches.length && !matches.at(-1).isCorrect;
  });
  assert.deepEqual(Array.from(selectIncorrectQuestions(questions, attempts)), expected);
});

test('mixed exam grading bounds concurrent requests and retains answers, failure and order', async () => {
  let active = 0, peak = 0;
  const { gradeExamAnswers } = load('exam_grading', {
    './grading': {
      gradeSubjectiveAnswer: async (q, answer) => {
        active++; peak = Math.max(peak, active);
        await new Promise(resolve => setTimeout(resolve, q.id === 'slow' ? 15 : 1));
        active--;
        return q.id === 'fail'
          ? { gradingStatus: 'failed', gradingFailedReason: 'offline' }
          : { gradingStatus: 'graded', gradingScore: answer === 'correct' ? 100 : 50 };
      },
      gradeClozeAnswers: () => ({ gradingStatus: 'graded', gradingScore: 50 }),
    },
  });
  const questions = [
    { id: 'slow', questionType: 'essay' },
    { id: 'fast', questionType: 'short_answer' },
    { id: 'mc', questionType: 'multiple_choice', answerOptionId: 'A' },
    { id: 'cloze', questionType: 'cloze', clozeBlanks: [] },
    { id: 'fail', questionType: 'essay' },
  ];
  const results = await gradeExamAnswers(questions, { 0: 'correct', 1: 'partial', 2: 'A', 4: 'saved' }, { 3: ['x', 'y'] });
  assert.equal(peak, 2);
  assert.deepEqual(Array.from(results, r => r.question.id), questions.map(q => q.id));
  assert.equal(results[0].isCorrect, true);
  assert.equal(results[1].gradingScore, 50);
  assert.equal(results[2].isCorrect, true);
  assert.equal(results[3].clozeAnswers[1], 'y');
  assert.equal(results[4].answerText, 'saved');
  assert.equal(results[4].gradingStatus, 'failed');
  assert.equal((await gradeExamAnswers([], {}, {})).length, 0);
});

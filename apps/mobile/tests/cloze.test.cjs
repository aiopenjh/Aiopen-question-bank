const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function compile(file, requireImpl) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module, exports: module.exports, require: requireImpl,
  }, { filename: file });
  return module.exports;
}

let id = 0;
const validationFile = path.resolve(__dirname, '../src/domain/generator_validation.ts');
const validation = compile(validationFile, name => {
  if (name === '../data/db') return { generateUUID: () => `id-${++id}` };
  if (name === './current_information') {
    return { isTrustedOfficialSourceUrl: url => /^https:\/\//.test(url) };
  }
  return {};
});

const gradingFile = path.resolve(__dirname, '../src/domain/grading.ts');
const grading = compile(gradingFile, name => {
  if (name === '../data/db') return { getGeminiApiKey: async () => 'unused-test-key' };
  if (name === './ai_client') {
    return {
      callUniversalAiCompletion: async () => { throw new Error('should-not-call-provider'); },
      parseAiJsonResponse: JSON.parse,
    };
  }
  if (name === './generator_validation') return validation;
  return {};
});

function multipleChoice(overrides = {}) {
  return {
    stem: '2 + 2는?',
    options: ['3', '4', '5', '6'].map(text => ({ text })),
    correctOptionNumber: 2,
    explanation: '정답은 4입니다.',
    deepReasoningHint: '두 수를 직접 더해 보세요.',
    ...overrides,
  };
}

test('legacy response without questionType remains a multiple-choice question', () => {
  const [question] = validation.validateGeneratedQuestions({ questions: [multipleChoice()] }, 1);
  assert.equal(question.questionType, 'multiple_choice');
  assert.equal(question.options.length, 4);
  assert.equal(question.correctOptionNumber, 2);
});

test('cloze is allowed at every difficulty and validates consecutive 1-3 markers', () => {
  const [question] = validation.validateGeneratedQuestions({ questions: [{
    questionType: 'cloze',
    stem: '{{1}}은 대한민국의 수도이고 정부 수립 연도는 {{2}}년이다.',
    blanks: [
      { correctAnswers: ['서울', 'Seoul'] },
      { correctAnswers: ['1948'] },
    ],
    explanation: '서울과 1948년을 확인합니다.',
    deepReasoningHint: '수도와 정부 수립 연도를 각각 떠올려 보세요.',
  }] }, 1, false, undefined, false, false);
  assert.equal(question.questionType, 'cloze');
  assert.deepEqual(Array.from(question.clozeBlanks, blank => Array.from(blank.correctAnswers)), [
    ['서울', 'Seoul'], ['1948'],
  ]);

  assert.throws(() => validation.validateGeneratedQuestions({ questions: [{
    questionType: 'cloze', stem: '{{1}} 다음은 {{3}}',
    blanks: [{ correctAnswers: ['A'] }, { correctAnswers: ['B'] }], explanation: '설명',
  }] }, 1), /\{\{2\}\}/);
  assert.throws(() => validation.validateGeneratedQuestions({ questions: [{
    questionType: 'cloze', stem: '{{1}} {{2}} {{3}} {{4}}',
    blanks: [1, 2, 3, 4].map(value => ({ correctAnswers: [String(value)] })), explanation: '설명',
  }] }, 1), /1~3개/);
});

test('cloze grading is local, normalized, supports accepted variants and partial scores', () => {
  const blanks = [
    { id: 'b1', correctAnswers: ['서울', 'seoul'] },
    { id: 'b2', correctAnswers: ['1948', '1948년'] },
  ];
  const full = grading.gradeClozeAnswers(blanks, ['  SEOUL ', '1948년']);
  assert.equal(full.gradingStatus, 'graded');
  assert.equal(full.gradingScore, 100);
  assert.deepEqual(Array.from(full.gradingChecklistResult, item => item.met), [true, true]);

  const partial = grading.gradeClozeAnswers(blanks, ['서울', '1950']);
  assert.equal(partial.gradingScore, 50);
  assert.deepEqual(Array.from(partial.gradingChecklistResult, item => item.met), [true, false]);
});

test('cloze grading never accepts an abbreviation by guessed meaning, only when explicitly listed', () => {
  // 사용자 실기기 사례: 'Pa'/'Ds' 같은 2글자 약어는 뜻이 비슷해 보여도 정답 목록에 없으면 오답이다.
  const blanks = [
    { id: 'b1', correctAnswers: ['Physical AI'] },
    { id: 'b2', correctAnswers: ['AI 데이터 사이언티스트'] },
  ];
  const guessed = grading.gradeClozeAnswers(blanks, ['Pa', 'Ds']);
  assert.equal(guessed.gradingScore, 0);
  assert.deepEqual(Array.from(guessed.gradingChecklistResult, item => item.met), [false, false]);

  // 출제 시 자료 근거로 약어를 정답 목록에 명시적으로 포함했다면 그 약어는 인정된다.
  const withApprovedAbbreviation = [
    { id: 'b1', correctAnswers: ['Physical AI', 'PAI'] },
  ];
  const accepted = grading.gradeClozeAnswers(withApprovedAbbreviation, ['PAI']);
  assert.equal(accepted.gradingScore, 100);
  assert.equal(accepted.gradingChecklistResult[0].met, true);
});

test('subjective grading never stores a raw provider exception', async () => {
  const result = await grading.gradeSubjectiveAnswer({ questionType: 'short_answer' }, '답');
  assert.equal(result.gradingStatus, 'failed');
  assert.ok(!result.gradingFailedReason.includes('should-not-call-provider'));
  assert.match(result.gradingFailedReason, /AI 채점 요청을 완료하지 못했습니다/);
});

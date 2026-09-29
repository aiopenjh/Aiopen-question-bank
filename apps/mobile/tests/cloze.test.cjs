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

test('cloze grading accepts a duplicated suffix only when it is adjacent to the blank in the stem', () => {
  // 사용자 실기기 사례: 지문 `{{1}}종`/`{{2}}종`에 `1종`·`2종`을 입력했다.
  const stem = '운전면허는 {{1}}종 보통면허와 {{2}}종 보통면허로 구분한다.';
  const blanks = [
    { id: 'b1', correctAnswers: ['1', '제1'] },
    { id: 'b2', correctAnswers: ['2', '제2'] },
  ];
  const suffixed = grading.gradeClozeAnswers(blanks, ['1종', '2 종'], stem);
  assert.equal(suffixed.gradingScore, 100);
  assert.equal(grading.gradeClozeAnswers(blanks, ['제1종', '2'], stem).gradingScore, 100);

  // 다른 값·접미 글자 단독·순서가 바뀐 값·이중 접미는 계속 오답이다.
  const wrong = grading.gradeClozeAnswers(blanks, ['3종', '종'], stem);
  assert.deepEqual(Array.from(wrong.gradingChecklistResult, item => item.met), [false, false]);
  assert.equal(grading.gradeClozeAnswers(blanks, ['2종', '1종'], stem).gradingScore, 0);
  assert.equal(grading.gradeClozeAnswers(blanks, ['1종종', '2'], stem).gradingScore, 50);

  // 지문에 인접 접미가 없거나 지문을 넘기지 않으면 전역 정규화로 인정하지 않는다.
  const noSuffixStem = '운전면허는 {{1}} 종류와 {{2}} 종류가 있다.';
  assert.equal(grading.gradeClozeAnswers(blanks, ['1종', '2종'], noSuffixStem).gradingScore, 0);
  assert.equal(grading.gradeClozeAnswers(blanks, ['1종', '2종']).gradingScore, 0);
});

test('cloze grading rejects a partial prefix of a longer adjacent suffix', () => {
  // `{{1}}종류`의 인접 접미는 `종류` 전체다. 앞부분 `종`만 붙인 입력은 인정하지 않는다.
  const stem = '첫째는 {{1}}종류, 둘째는 {{2}}종류.';
  const blanks = [
    { id: 'b1', correctAnswers: ['1'] },
    { id: 'b2', correctAnswers: ['2'] },
  ];
  assert.equal(grading.gradeClozeAnswers(blanks, ['1종', '2종'], stem).gradingScore, 0);
  assert.equal(grading.gradeClozeAnswers(blanks, ['1종류', '2 종류'], stem).gradingScore, 100);
});

test('cloze grading keeps rejecting a different institution name and guessed abbreviations with a stem', () => {
  // 현행 도로교통법 제80조의 면허 발급 주체와 다른 기관명은 정답이 아니다.
  const stem = '운전면허는 {{1}}이 발급한다.';
  const blanks = [{ id: 'b1', correctAnswers: ['시·도경찰청장', '시도경찰청장'] }];
  assert.equal(grading.gradeClozeAnswers(blanks, ['경찰서'], stem).gradingScore, 0);
  assert.equal(grading.gradeClozeAnswers(blanks, ['경찰서이'], stem).gradingScore, 0);
  assert.equal(grading.gradeClozeAnswers(blanks, ['시·도경찰청장이'], stem).gradingScore, 100);

  const abbrStem = '{{1}}는 로봇 분야, {{2}}는 데이터 분석 직무다.';
  const abbrBlanks = [
    { id: 'b1', correctAnswers: ['Physical AI'] },
    { id: 'b2', correctAnswers: ['AI 데이터 사이언티스트'] },
  ];
  assert.equal(grading.gradeClozeAnswers(abbrBlanks, ['Pa', 'Ds'], abbrStem).gradingScore, 0);
  assert.equal(grading.gradeClozeAnswers(abbrBlanks, ['Pa는', 'Ds는'], abbrStem).gradingScore, 0);
});

test('subjective grading never stores a raw provider exception', async () => {
  const result = await grading.gradeSubjectiveAnswer({ questionType: 'short_answer' }, '답');
  assert.equal(result.gradingStatus, 'failed');
  assert.ok(!result.gradingFailedReason.includes('should-not-call-provider'));
  assert.match(result.gradingFailedReason, /AI 채점 요청을 완료하지 못했습니다/);
});

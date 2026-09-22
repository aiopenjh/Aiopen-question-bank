const test = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports,
    require: name => load(path.resolve(path.dirname(file), name + '.ts')),
  });
  return exports;
}
const { countTodayCompletedQuestions, isConsistencyQualified, getMaxQualifiedKillerLevel } =
  load(path.resolve(__dirname, '../src/domain/ranking.ts'));
const { getTopicChallengeLevels, getUnlockedChallengeLevel, getChallengeGenerationError } =
  load(path.resolve(__dirname, '../src/domain/challenge_progress.ts'));

test('countTodayCompletedQuestions: 오늘 제출만 센다', () => {
  const today = '2026-09-16';
  const attempts = [
    { submissionKey: 'a', submittedAt: new Date(2026, 8, 16, 0, 1).toISOString() },
    { submissionKey: 'b', submittedAt: new Date(2026, 8, 15, 23, 59).toISOString() },
  ];
  assert.equal(countTodayCompletedQuestions(attempts, today), 1);
});

test('countTodayCompletedQuestions: 같은 submissionKey는 한 번만 센다', () => {
  const today = '2026-09-16';
  const attempts = [
    { submissionKey: 'sub-q1-2026-09-16-abc', submittedAt: '2026-09-16T01:00:00.000Z' },
    { submissionKey: 'sub-q1-2026-09-16-abc', submittedAt: '2026-09-16T01:00:05.000Z' },
  ];
  assert.equal(countTodayCompletedQuestions(attempts, today), 1);
});

test('isConsistencyQualified: 경계값 2/3/4문제', () => {
  assert.equal(isConsistencyQualified(2), false);
  assert.equal(isConsistencyQualified(3), true);
  assert.equal(isConsistencyQualified(4), true);
});

function run(id, level, minute, correct = 2, topicId = 'A') {
  return [0, 1, 2].map(index => ({
    submissionKey: `${id}-${index}`, isCorrect: index < correct,
    submittedAt: new Date(2026, 8, 22, 12, minute, 30).toISOString(),
    challenge: {
      version: 1, runId: id, topicId, level, questionId: `${id}-q${index}`,
      startedAt: new Date(2026, 8, 22, 12, minute).toISOString(),
    },
  }));
}

test('31 starts unlocked; failure, retry and sequential clears are per topic', () => {
  const records = [...run('fail', 31, 0, 1), ...run('pass', 31, 1), ...run('next', 32, 2)];
  assert.equal(getUnlockedChallengeLevel([], 'A'), 31);
  assert.equal(getMaxQualifiedKillerLevel(run('fail', 31, 0, 1)), 0);
  assert.equal(getUnlockedChallengeLevel(records, 'A'), 33);
  assert.equal(getUnlockedChallengeLevel(records, 'B'), 31);
  assert.equal(getMaxQualifiedKillerLevel([...records, ...run('b', 31, 3, 3, 'B')]), 32);
});

test('skipped, incomplete, duplicate-question and mixed-topic runs never unlock a level', () => {
  assert.equal(getMaxQualifiedKillerLevel(run('skip', 50, 0, 3)), 0);
  assert.equal(getMaxQualifiedKillerLevel(run('partial', 31, 0).slice(0, 2)), 0);
  const duplicate = run('duplicate', 31, 0);
  duplicate[1].challenge.questionId = duplicate[0].challenge.questionId;
  assert.equal(getMaxQualifiedKillerLevel(duplicate), 0);
  const mixed = run('mixed', 31, 0);
  mixed[1].challenge.topicId = 'B';
  assert.equal(getMaxQualifiedKillerLevel(mixed), 0);
});

test('old attempts do not grant progress; replay and JSON backup retain earned progress', () => {
  const records = run('first', 31, 0);
  records.push(...records.map(a => ({ ...a })), { submissionKey: 'old-50', isCorrect: true });
  assert.equal(getMaxQualifiedKillerLevel(JSON.parse(JSON.stringify(records))), 31);
  assert.equal(getTopicChallengeLevels(records).size, 1);
});

test('a next-level exam opened before the previous clear cannot qualify retrospectively', () => {
  const earlier = run('earlier', 32, 0);
  earlier.forEach(a => { a.submittedAt = new Date(2026, 8, 22, 12, 3).toISOString(); });
  assert.equal(getMaxQualifiedKillerLevel([...earlier, ...run('first', 31, 1)]), 31);
  assert.equal(getMaxQualifiedKillerLevel([...run('tooEarly', 32, 0), ...run('first', 31, 1)]), 31);
});

test('generation preserves normal counts and gates challenge level and count', () => {
  assert.equal(getChallengeGenerationError(30, 5, 31), null);
  assert.equal(getChallengeGenerationError(31, 3, 31), null);
  assert.ok(getChallengeGenerationError(32, 3, 31));
  assert.ok(getChallengeGenerationError(31, 5, 31));
});

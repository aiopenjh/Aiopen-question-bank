const test = require('node:test');
const assert = require('node:assert/strict');

// domain/ranking.ts의 로직을 그대로 재현해 검증한다 (기존 테스트 컨벤션, generator.test.cjs 참고).
const CONSISTENCY_MIN_QUESTIONS = 3;

function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function countTodayCompletedQuestions(attempts, today) {
  const solvedKeys = new Set();
  for (const attempt of attempts) {
    if (getLocalDateString(new Date(attempt.submittedAt)) !== today) continue;
    solvedKeys.add(attempt.submissionKey);
  }
  return solvedKeys.size;
}

function isConsistencyQualified(solvedCount) {
  return solvedCount >= CONSISTENCY_MIN_QUESTIONS;
}

test('countTodayCompletedQuestions: 오늘 제출만 센다', () => {
  const today = '2026-09-16';
  const attempts = [
    { submissionKey: 'a', submittedAt: '2026-09-16T01:00:00.000Z' },
    { submissionKey: 'b', submittedAt: '2026-09-15T23:00:00.000Z' },
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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateNickname, todaySeoul } from '../src/util.mjs';

test('validateNickname: 2~12자 정상 닉네임 통과', () => {
  assert.equal(validateNickname('공부별').ok, true);
});

test('validateNickname: 1자는 거부', () => {
  assert.equal(validateNickname('공').ok, false);
});

test('validateNickname: 13자는 거부', () => {
  assert.equal(validateNickname('가'.repeat(13)).ok, false);
});

test('validateNickname: 공백만 있는 값은 거부', () => {
  assert.equal(validateNickname('   ').ok, false);
});

test('validateNickname: 운영자 사칭 표현 거부', () => {
  assert.equal(validateNickname('admin').ok, false);
  assert.equal(validateNickname('운영자입니다').ok, false);
});

test('todaySeoul: UTC 자정 직후에도 서울 날짜(다음날)를 반환', () => {
  // 2026-09-16T00:30:00Z → 서울(UTC+9) 기준 2026-09-16 09:30
  const result = todaySeoul(new Date('2026-09-16T00:30:00Z'));
  assert.equal(result, '2026-09-16');
});

test('todaySeoul: UTC 오후 늦게는 서울 기준 다음날', () => {
  // 2026-09-16T16:00:00Z → 서울 기준 2026-09-17 01:00
  const result = todaySeoul(new Date('2026-09-16T16:00:00Z'));
  assert.equal(result, '2026-09-17');
});

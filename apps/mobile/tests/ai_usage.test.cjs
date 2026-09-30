// 하루 AI 요청 사용량 규칙: 태평양 자정 기준 날짜, 90% 경고(모델 이름 없이 횟수만),
// 429 본문의 하루/분당 한도 구분과 안내 문구를 확인한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/domain/ai_usage.ts');
const module_ = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText, { module: module_, exports: module_.exports, JSON, Math, Date }, { filename });
const usage = module_.exports;

const at = (iso) => new Date(iso);
const usageFor = (day, counts) => ({ day, counts });

test('ai_usage: 하루 기준 날짜는 태평양 자정(서머타임 반영)에 바뀐다', () => {
  assert.equal(usage.getAiQuotaDay(at('2026-09-30T06:59:00Z')), '2026-09-29');
  assert.equal(usage.getAiQuotaDay(at('2026-09-30T07:00:00Z')), '2026-09-30');
  assert.equal(usage.getAiQuotaDay(at('2026-12-01T07:59:00Z')), '2026-11-30');
  assert.equal(usage.getAiQuotaDay(at('2026-12-01T08:00:00Z')), '2026-12-01');
  // 2026년 서머타임: 3월 8일 10:00Z 시작, 11월 1일 09:00Z 종료
  assert.equal(usage.getPacificUtcOffsetHours(at('2026-03-08T09:59:00Z')), -8);
  assert.equal(usage.getPacificUtcOffsetHours(at('2026-03-08T10:00:00Z')), -7);
  assert.equal(usage.getPacificUtcOffsetHours(at('2026-11-01T08:59:00Z')), -7);
  assert.equal(usage.getPacificUtcOffsetHours(at('2026-11-01T09:00:00Z')), -8);
  assert.equal(usage.getQuotaResetKoreanHour(at('2026-09-30T03:00:00Z')), 16);
  assert.equal(usage.getQuotaResetKoreanHour(at('2026-12-15T03:00:00Z')), 17);
});

test('ai_usage: 모델 순서와 하루 한도는 사용자 AI Studio 무료 등급 화면과 같다', () => {
  assert.deepEqual(Array.from(usage.GEMINI_MODEL_ORDER), [
    'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.8-flash',
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(usage.GEMINI_DAILY_REQUEST_LIMITS)), {
    'gemini-3.5-flash-lite': 500, 'gemini-3.5-flash': 20, 'gemini-3.6-flash': 20,
    'gemini-3.7-flash': 20, 'gemini-3.8-flash': 20,
  });
});

test('ai_usage: 다음에 쓸 모델이 90%에 닿을 때만 오늘 요청 횟수를 모델 이름 없이 알린다', () => {
  const now = at('2026-09-30T03:00:00Z'); // 태평양 9월 29일
  const day = '2026-09-29';
  assert.equal(usage.getAiUsageWarning(null, now), null);
  assert.equal(usage.getAiUsageWarning(usageFor(day, { 'gemini-3.5-flash-lite': 449 }), now), null);
  const liteWarning = usage.getAiUsageWarning(usageFor(day, { 'gemini-3.5-flash-lite': 450 }), now);
  assert.equal(liteWarning, '오늘 AI 요청을 450회 사용했습니다. 무료 한도에 가까워 곧 문제 생성이 제한될 수 있습니다.');
  // Flash-Lite를 다 쓰면 다음 모델(한도 20회)을 기준으로 18회부터 알린다.
  assert.equal(usage.getAiUsageWarning(usageFor(day, { 'gemini-3.5-flash-lite': 500, 'gemini-3.5-flash': 17 }), now), null);
  const flashWarning = usage.getAiUsageWarning(usageFor(day, { 'gemini-3.5-flash-lite': 500, 'gemini-3.5-flash': 18 }), now);
  assert.match(flashWarning, /오늘 AI 요청을 518회 사용했습니다/);
  assert.ok(!/gemini|flash|lite/i.test(flashWarning), '모델 이름은 보여주지 않는다');
  const allUsed = Object.fromEntries(Object.entries(usage.GEMINI_DAILY_REQUEST_LIMITS));
  assert.match(usage.getAiUsageWarning(usageFor(day, allUsed), now), /580회 사용했습니다/);
  // 날짜가 바뀐 기록은 오늘 사용량으로 보지 않는다.
  assert.equal(usage.getAiUsageWarning(usageFor('2026-09-28', { 'gemini-3.5-flash-lite': 499 }), now), null);
});

test('ai_usage: 429 본문으로 하루 한도와 분당 한도를 구분하고 공급자 정보 없이 안내한다', () => {
  const body = (quotaId) => ({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', details: [{ violations: [{ quotaId }] }] } });
  assert.equal(usage.readGeminiQuotaScope(body('GenerateRequestsPerDayPerProjectPerModel-FreeTier')), 'daily');
  assert.equal(usage.readGeminiQuotaScope(body('GenerateRequestsPerMinutePerProjectPerModel-FreeTier')), 'minute');
  assert.equal(usage.readGeminiQuotaScope(null), 'unknown');
  const daily = usage.describeRateLimit('daily', at('2026-09-30T03:00:00Z'));
  assert.equal(daily, '오늘 AI 요청 한도를 모두 사용했습니다. 한국 시간 오후 4시에 초기화됩니다.');
  assert.match(usage.describeRateLimit('daily', at('2026-12-15T03:00:00Z')), /오후 5시/);
  assert.match(usage.describeRateLimit('minute'), /1분쯤 기다린 뒤/);
  assert.match(usage.describeRateLimit(undefined), /AI 호출에 실패했습니다/);
  for (const message of [daily, usage.describeRateLimit('minute')]) assert.ok(!/Gemini|429|Google/.test(message));
});

test('ai_usage: 기록 함수가 실패해도 AI 요청 흐름에 예외를 내지 않는다', async () => {
  usage.setAiRequestListener(() => { throw new Error('disk full'); });
  assert.doesNotThrow(() => usage.reportAiRequest({ model: 'gemini-3.5-flash-lite', outcome: 'processed' }));
  usage.setAiRequestListener(() => Promise.reject(new Error('disk full')));
  assert.doesNotThrow(() => usage.reportAiRequest({ model: 'gemini-3.5-flash-lite', outcome: 'processed' }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  usage.setAiRequestListener(null);
});

test('ai_usage: 한도 소진 모델은 건너뛰고, 안내 횟수는 실제로 보낸 요청 수만 센다', () => {
  const now = at('2026-09-30T03:00:00Z');
  const day = '2026-09-29';
  const exhaustedLite = (flashCount) => ({ day, counts: { 'gemini-3.5-flash-lite': 10, 'gemini-3.5-flash': flashCount }, exhausted: ['gemini-3.5-flash-lite'] });
  assert.equal(usage.getAiUsageWarning(exhaustedLite(0), now), null);
  assert.equal(usage.getAiUsageWarning(exhaustedLite(18), now),
    '오늘 AI 요청을 28회 사용했습니다. 무료 한도에 가까워 곧 문제 생성이 제한될 수 있습니다.');
  const allExhausted = { day, counts: { 'gemini-3.5-flash-lite': 3 }, exhausted: Array.from(usage.GEMINI_MODEL_ORDER) };
  assert.match(usage.getAiUsageWarning(allExhausted, now), /오늘 AI 요청을 3회 사용했습니다/);
});

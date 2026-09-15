const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/utils/notifications.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
function fixture() {
  const store = new Map();
  const schedules = new Map([['unrelated', {identifier: 'unrelated', content: { data: {} }}]]);
  const events = [];
  let granted = true, failAt = null, callback, lastResponse = null;
  const mock = {
    AndroidImportance: { HIGH: 4, NONE: 0 }, SchedulableTriggerInputTypes: { WEEKLY: 'weekly' },
    setNotificationHandler() {},
    async setNotificationChannelAsync() { events.push('channel'); },
    async getNotificationChannelAsync() { return {importance: 4}; },
    async getPermissionsAsync() { return { granted, status: granted ? 'granted' : 'denied', canAskAgain: true }; },
    async requestPermissionsAsync() { events.push('permission'); return {granted, status: granted ? 'granted' : 'denied'}; },
    async getAllScheduledNotificationsAsync() { return [...schedules.values()]; },
    async cancelScheduledNotificationAsync(id) { schedules.delete(id); },
    async scheduleNotificationAsync(request) {
      if (failAt === request.identifier) throw new Error('native failure');
      schedules.set(request.identifier, request); return request.identifier;
    },
    addNotificationResponseReceivedListener(fn) { callback = fn; return {remove() {}}; },
    async getLastNotificationResponseAsync() { return lastResponse; },
    async clearLastNotificationResponseAsync() { lastResponse = null; },
  };
  const module = {exports: {}};
  vm.runInNewContext(code, { module, exports: module.exports, require(id) {
    if (id === 'react-native') return {Platform: {OS: 'android'}};
    if (id === 'expo-notifications') return mock;
    if (id === '@react-native-async-storage/async-storage') return {
      async getItem(key) { return store.get(key) ?? null; },
      async setItem(key, value) { store.set(key, value); },
    };
    throw new Error(id);
  }, Date: class extends Date { constructor(...args) { super(...(args.length ? args : ['2026-09-14T08:10:00'])); } }});
  return { api: module.exports, schedules, events, store,
    deny() { granted = false; }, fail(id) { failAt = id; },
    response(value) { lastResponse = value; }, tap(value) { callback(value); }, };
}
(async () => {
  let f = fixture();
  let result = await f.api.syncStudyAlarms([1,3,5]);
  assert.equal(result.enabled, false);
  assert.equal(f.events.includes('permission'), false, 'launch must never prompt');
  result = await f.api.setStudyAlarmsEnabled(true);
  assert.equal(result.scheduledCount, 14, 'schedules all 7 days x 2 times = 14 daily alarms');
  assert.equal(f.schedules.get('celueste-study-v1-0-8').trigger.weekday, 1);
  await Promise.all([f.api.syncStudyAlarms(), f.api.syncStudyAlarms()]);
  assert.equal(f.schedules.size, 15, 'no duplicate schedules (14 study + 1 unrelated)');
  result = await f.api.syncStudyAlarms([2]);
  assert.equal(result.scheduledCount, 14, 'schedules every day regardless of routine');
  result = await f.api.setStudyAlarmsEnabled(false);
  assert.equal(result.scheduledCount, 0);
  assert.ok(f.schedules.has('unrelated'), 'unrelated notifications preserved');
  let prompts = 0;
  await f.api.checkInAppScheduledAlarm(() => prompts++);
  assert.equal(prompts, 0, 'disabled in-app prompt suppressed');
  await f.api.setStudyAlarmsEnabled(true);
  await f.api.checkInAppScheduledAlarm(() => prompts++);
  assert.equal(prompts, 1, 'in-app alarm prompts daily at scheduled time');
  await Promise.all([f.api.checkInAppScheduledAlarm(() => prompts++), f.api.checkInAppScheduledAlarm(() => prompts++)]);
  assert.equal(prompts, 1, 'same-slot prompt deduplicated');
  f = fixture(); f.deny();
  result = await f.api.setStudyAlarmsEnabled(true);
  assert.ok(result.error);
  assert.equal(result.scheduledCount, 0);
  assert.ok(f.events.indexOf('channel') < f.events.indexOf('permission'), 'channel before permission');
  f = fixture(); f.fail('celueste-study-v1-1-20');
  result = await f.api.setStudyAlarmsEnabled(true);
  assert.equal(result.scheduledCount, 3);
  assert.ok(result.error, 'partial native failure not reported as success');
  f.fail(null); result = await f.api.syncStudyAlarms();
  assert.equal(result.scheduledCount, 14);
  assert.equal(result.error, undefined);
  const response = {notification: {date: 123, request: {identifier: 'study', content: {data: {action: 'START_EXAM'}}}}};
  f.response(response);
  assert.equal(await f.api.consumeInitialStudyNotification(), true);
  let starts = 0;
  f.api.registerNotificationResponseListener(() => starts++);
  f.tap(response);
  assert.equal(starts, 0, 'cold and warm tap deduplicated');
  console.log('PASS notification scheduling, permissions, cancellation, partial failure, in-app routine and tap tests (mock native API; no notification sent)');
})().catch(error => {console.error(error); process.exitCode = 1;});

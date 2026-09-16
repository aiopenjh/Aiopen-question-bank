const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

const ALARM_CONFIG_KEY = '@celueste:alarm_config_v2';

function fixture() {
  const store = new Map();
  const schedules = new Map([
    ['unrelated', { identifier: 'unrelated', content: { data: {} } }],
  ]);
  const events = [];
  let granted = true;
  let callback;
  let lastResponse = null;
  let scheduleSequence = 0;

  const notifications = {
    AndroidImportance: { MAX: 5 },
    SchedulableTriggerInputTypes: { WEEKLY: 'weekly' },
    setNotificationHandler() {},
    async setNotificationChannelAsync() { events.push('channel'); },
    async getPermissionsAsync() {
      return { granted, status: granted ? 'granted' : 'denied', canAskAgain: true };
    },
    async requestPermissionsAsync() {
      events.push('permission');
      return { granted, status: granted ? 'granted' : 'denied' };
    },
    async cancelAllScheduledNotificationsAsync() {
      events.push('cancel-all');
      schedules.clear();
    },
    async scheduleNotificationAsync(request) {
      const identifier = `scheduled-${++scheduleSequence}`;
      schedules.set(identifier, { identifier, ...request });
      return identifier;
    },
    addNotificationResponseReceivedListener(fn) {
      callback = fn;
      return { remove() {} };
    },
    async getLastNotificationResponseAsync() { return lastResponse; },
    async clearLastNotificationResponseAsync() {
      events.push('clear-last-response');
      lastResponse = null;
    },
  };

  const source = fs.readFileSync(
    path.join(__dirname, '../src/utils/notifications.ts'),
    'utf8'
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    console,
    require(id) {
      if (id === 'react-native') return { Platform: { OS: 'android' } };
      if (id === 'expo-notifications') return notifications;
      if (id === '@react-native-async-storage/async-storage' || id === '../data/app_storage') {
        return {
          async getItem(key) { return store.get(key) ?? null; },
          async setItem(key, value) { store.set(key, value); },
        };
      }
      if (id === '../data/storage_keys') {
        return { STORAGE_KEYS: { ALARM_CONFIG: ALARM_CONFIG_KEY } };
      }
      throw new Error(`Unexpected dependency ${id}`);
    },
    Date: class extends Date {
      constructor(...args) {
        super(...(args.length ? args : ['2026-09-14T08:10:00']));
      }
    },
  });

  return {
    api: module.exports,
    schedules,
    events,
    store,
    deny() { granted = false; },
    response(value) { lastResponse = value; },
    tap(value) { callback(value); },
  };
}

test('selected weekdays and enabled time slots are persisted and scheduled', async () => {
  const f = fixture();
  const config = {
    morningEnabled: true,
    morningHour: 9,
    eveningEnabled: true,
    eveningHour: 21,
    selectedDays: ['월', '수', '금'],
  };

  await f.api.saveAlarmConfig(config);

  assert.deepEqual(JSON.parse(f.store.get(ALARM_CONFIG_KEY)), config);
  assert.equal(f.schedules.size, 6);
  assert.ok(!f.schedules.has('unrelated'), 'the native schedule is rebuilt from saved alarm settings');
  assert.ok(f.events.indexOf('channel') < f.events.indexOf('cancel-all'));

  const scheduled = [...f.schedules.values()];
  assert.deepEqual(
    [...new Set(scheduled.map(item => item.trigger.weekday))],
    [2, 4, 6]
  );
  assert.deepEqual(
    scheduled.map(item => item.trigger.hour),
    [9, 21, 9, 21, 9, 21]
  );
  assert.ok(scheduled.every(item => item.trigger.type === 'weekly' && item.trigger.repeats));
  assert.deepEqual(
    scheduled.map(item => item.content.data.timeSlot),
    ['morning', 'evening', 'morning', 'evening', 'morning', 'evening']
  );
});

test('disabled alarms clear the queue while permission denial leaves it unchanged', async () => {
  let f = fixture();
  await f.api.scheduleWeekdayStudyAlarms({
    morningEnabled: false,
    morningHour: 8,
    eveningEnabled: false,
    eveningHour: 20,
    selectedDays: ['월'],
  });
  assert.equal(f.schedules.size, 0);
  assert.equal(f.events.includes('permission'), false);

  f = fixture();
  f.deny();
  await f.api.scheduleWeekdayStudyAlarms({
    morningEnabled: true,
    morningHour: 8,
    eveningEnabled: false,
    eveningHour: 20,
    selectedDays: ['월'],
  });
  assert.equal(f.schedules.size, 1, 'permission denial does not replace the existing native queue');
  assert.equal(f.events.includes('permission'), true);
  assert.equal(f.events.includes('cancel-all'), false);
  assert.ok(f.events.indexOf('channel') < f.events.indexOf('permission'));
});

test('in-app alarm respects the saved weekday and suppresses a repeated slot', async () => {
  const f = fixture();
  f.store.set(ALARM_CONFIG_KEY, JSON.stringify({
    morningEnabled: true,
    morningHour: 8,
    eveningEnabled: false,
    eveningHour: 20,
    selectedDays: ['월'],
  }));
  const prompts = [];

  await f.api.checkInAppScheduledAlarm(label => prompts.push(label));
  await f.api.checkInAppScheduledAlarm(label => prompts.push(label));

  assert.deepEqual(prompts, ['오전 8시']);
});

test('cold-start and warm notification responses open study once per identifier', async () => {
  const f = fixture();
  const response = identifier => ({
    notification: {
      request: {
        identifier,
        content: { data: { action: 'START_STUDY' } },
      },
    },
  });
  f.response(response('study-1'));
  let starts = 0;

  const unsubscribe = f.api.registerNotificationResponseListener(() => starts++);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(starts, 1);
  assert.ok(f.events.includes('clear-last-response'));

  f.tap(response('study-1'));
  assert.equal(starts, 1, 'the same native response is deduplicated');
  f.tap(response('study-2'));
  assert.equal(starts, 2);
  unsubscribe();
});

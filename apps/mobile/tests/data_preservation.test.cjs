const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// 목차 재생성·단원 중복 정리·단원/과목 삭제·백업 사전 검사의 학습 기록 보존 회귀 테스트.
function setup() {
  const data = new Map();
  const cache = new Map();
  let fail = null;
  let writes = 0;
  const guard = (key, value) => {
    writes += 1;
    if (fail?.(key, value)) throw new Error('disk full');
  };
  const storage = {
    getItem: async key => data.get(key) ?? null,
    setItem: async (key, value) => { guard(key, value); data.set(key, value); },
    removeItem: async key => { guard(key, null); data.delete(key); },
    multiGet: async keys => keys.map(key => [key, data.get(key) ?? null]),
    multiSet: async entries => { for (const [key, value] of entries) { guard(key, value); data.set(key, value); } },
    multiRemove: async keys => { for (const key of keys) { guard(key, null); data.delete(key); } },
    clear: async () => { data.clear(); },
  };
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const localRequire = name => {
      if (name === '@react-native-async-storage/async-storage') return storage;
      if (name === 'react-native') return { Platform: { OS: 'web' } };
      if (name === './native_storage_migration') return { initializeNativeStorage: async () => { throw new Error('unexpected'); } };
      if (name.includes('secure_storage')) {
        return { getEncryptedApiKey: async () => null, saveEncryptedApiKey: async () => 'persistent', deleteEncryptedApiKey: async () => {} };
      }
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`));
      return require(name);
    };
    vm.runInNewContext(`(function(require,module,exports){${source}\n})`, {
      console, Date, Math, Set, Map, Promise, JSON,
    })(localRequire, module, module.exports);
    return module.exports;
  }
  return {
    data,
    db: load('src/data/db.ts'),
    load,
    setFailure: predicate => { fail = predicate; },
    writes: () => writes,
  };
}

const K = {
  topics: '@cogniquest:topics',
  units: '@cogniquest:units',
  specs: '@cogniquest:learning_specs',
  questions: '@cogniquest:questions',
  attempts: '@cogniquest:attempts',
  corrections: '@celueste:attempt_corrections',
  reviews: '@cogniquest:review_states',
  completions: '@cogniquest:manual_completions',
  notes: '@cogniquest:custom_note_questions',
};
const now = '2026-09-25T00:00:00.000Z';
const read = (s, key) => JSON.parse(s.data.get(key) ?? '[]');
const put = (s, key, value) => s.data.set(key, JSON.stringify(value));
const sorted = data => [...data].sort(([a], [b]) => a.localeCompare(b));
const unit = (id, topicId, title, extra = {}) => ({ id, topicId, parentId: null, depth: 1, title, orderIndex: 1, createdAt: now, ...extra });
const q = (id, topicId, unitId, stem) => ({
  id, questionId: id, revision: 1, specId: 'spec-default', topicId, unitId, questionType: 'multiple_choice',
  stem, options: [], answerOptionId: '', explanation: '', status: 'ready_personal', createdAt: now,
});
const attempt = (qid, run, index = 0) => ({
  id: `${run}-${index}`, sessionItemId: `random-${qid}-${run}`, submissionKey: `sub-${qid}-${run}`,
  answerOptionId: 'x', isCorrect: false, submittedAt: now,
});
const correction = a => ({
  id: `c-${a.id}`, attemptId: a.id, submissionKey: a.submissionKey,
  questionRevisionId: a.submissionKey.slice(4, a.submissionKey.length - a.id.length + 1), reason: 'other', correctedAt: now,
});

test('regenerating a curriculum keeps IDs of same-meaning units and preserves unmatched units that hold records', async () => {
  const s = setup();
  put(s, K.topics, [{ id: 'T', name: 'math' }, { id: 'O', name: 'other' }]);
  put(s, K.units, [
    unit('keep', 'T', '01. 집합과  명제 '),
    unit('spec-only', 'T', '확률', { orderIndex: 2 }),
    unit('done-only', 'T', '통계', { orderIndex: 3 }),
    unit('with-question', 'T', '함수의 극한', { orderIndex: 4, difficultyLevel: 12 }),
    unit('empty', 'T', '삭제될 빈 단원', { orderIndex: 5 }),
    unit('deep', 'T', '수열', { orderIndex: 6, depth: 2 }),
    unit('twin-a', 'T', '미분', { orderIndex: 7 }),
    unit('twin-b', 'T', '미분', { orderIndex: 8 }),
    unit('other', 'O', '01. 집합과 명제'),
  ]);
  put(s, K.questions, [q('q1', 'T', 'with-question', 'a'), q('q2', 'T', 'keep', 'b'), q('q3', 'T', 'twin-a', 'c')]);
  put(s, K.specs, [{ id: 'sp', topicId: 'T', unitIds: ['spec-only'] }]);
  put(s, K.completions, [{ ownerId: 'o', unitId: 'done-only', completed: true, changedAt: now }]);

  const result = await s.db.replaceTopicUnits('T', [
    { title: '01. 집합과 명제' },
    { title: '함수의 극한' },
    { title: '수열', depth: 1 },
    { title: '미분' },
    { title: '새 단원' },
  ]);

  const units = read(s, K.units);
  const byId = new Map(units.map(u => [u.id, u]));
  assert.equal(result[0].id, 'keep');
  assert.equal(result[0].title, '01. 집합과 명제');
  assert.equal(result[1].id, 'with-question');
  assert.equal(result[1].difficultyLevel, 12);
  assert.notEqual(result[2].id, 'deep'); // depth가 다르면 같은 단원으로 보지 않는다
  assert.ok(!['twin-a', 'twin-b'].includes(result[3].id)); // 기존 쪽이 모호하면 대응하지 않는다
  assert.deepEqual(result.map(u => u.orderIndex), [1, 2, 3, 4, 5]);
  for (const id of ['spec-only', 'done-only', 'twin-a']) assert.ok(byId.has(id), `${id} must be preserved`);
  for (const id of ['empty', 'deep', 'twin-b']) assert.ok(!byId.has(id), `${id} has no records`);
  assert.ok(byId.has('other'));
  const unitIds = new Set(units.map(u => u.id));
  assert.ok(read(s, K.questions).every(item => unitIds.has(item.unitId)));
  assert.equal(read(s, K.questions).find(item => item.id === 'q3').unitId, 'twin-a');
});

test('deduplication moves question, spec and completion links before removing a duplicate', async () => {
  const s = setup();
  put(s, K.units, [
    unit('a', 'T', 'same'),
    unit('b', 'T', 'same ', { orderIndex: 2 }),
    unit('child', 'T', 'child', { parentId: 'b', depth: 2, orderIndex: 3 }),
    unit('hard', 'T', 'same', { orderIndex: 4, difficultyLevel: 30 }),
    unit('nested', 'T', 'same', { parentId: 'a', depth: 2, orderIndex: 5 }),
    unit('x', 'T', 'done'),
    unit('y', 'T', 'done'),
  ]);
  put(s, K.questions, [q('q1', 'T', 'b', 'a'), q('q2', 'T', 'hard', 'b')]);
  put(s, K.specs, [{ id: 'sp', topicId: 'T', unitIds: ['a', 'b'] }]);
  put(s, K.completions, [
    { ownerId: 'o', unitId: 'b', completed: true, changedAt: now },
    { ownerId: 'o', unitId: 'x', completed: true, changedAt: now },
    { ownerId: 'o', unitId: 'y', completed: false, changedAt: now },
  ]);

  const result = await s.db.deduplicateTopicUnits('T');
  const ids = result.map(u => u.id);
  assert.deepEqual(ids, ['a', 'child', 'hard', 'nested', 'x', 'y']);
  assert.equal(result.find(u => u.id === 'child').parentId, 'a');
  assert.equal(read(s, K.questions).find(item => item.id === 'q1').unitId, 'a');
  assert.equal(read(s, K.questions).find(item => item.id === 'q2').unitId, 'hard');
  assert.deepEqual(read(s, K.specs)[0].unitIds, ['a']);
  assert.deepEqual(read(s, K.completions).map(c => c.unitId), ['a', 'x', 'y']);

  // 기록 이전 중 저장이 실패하면 단원·문제 모두 이전 상태로 돌아간다.
  put(s, K.units, [...read(s, K.units), unit('dup', 'T', 'child', { parentId: 'a', depth: 2 })]);
  put(s, K.questions, [...read(s, K.questions), q('q3', 'T', 'dup', 'c')]);
  const withDuplicate = sorted(s.data);
  let once = true;
  s.setFailure(key => key === K.questions && once ? (once = false, true) : false);
  await assert.rejects(() => s.db.deduplicateTopicUnits('T'));
  assert.deepEqual(sorted(s.data), withDuplicate);
  s.setFailure(null);
  await s.db.deduplicateTopicUnits('T');
  assert.equal(read(s, K.questions).find(item => item.id === 'q3').unitId, 'child');
  assert.ok(!read(s, K.units).some(u => u.id === 'dup'));
});

test('deduplication keeps manual completions per owner and target unit', async () => {
  const s = setup();
  put(s, K.units, [unit('a', 'T', 'same'), unit('b', 'T', 'same', { orderIndex: 2 }), unit('c', 'T', 'same', { orderIndex: 3 })]);
  put(s, K.questions, [q('q1', 'T', 'b', 'a')]);
  put(s, K.completions, [
    { ownerId: 'A', unitId: 'a', completed: true, changedAt: now },
    { ownerId: 'B', unitId: 'b', completed: false, changedAt: now },
    { ownerId: 'A', unitId: 'c', completed: true, changedAt: '2026-09-24T00:00:00.000Z' },
    { ownerId: 'C', unitId: 'c', completed: true, changedAt: now },
  ]);

  const result = await s.db.deduplicateTopicUnits('T');
  assert.deepEqual(result.map(u => u.id), ['a']);
  assert.equal(read(s, K.questions)[0].unitId, 'a');
  // 다른 소유자의 기록은 상태가 달라도 각각 남고, 같은 소유자·대상 단원의 같은 상태 기록은 하나만 남는다.
  assert.deepEqual(read(s, K.completions), [
    { ownerId: 'A', unitId: 'a', completed: true, changedAt: now },
    { ownerId: 'B', unitId: 'a', completed: false, changedAt: now },
    { ownerId: 'C', unitId: 'a', completed: true, changedAt: now },
  ]);
});

test('deduplication keeps the newest changedAt when completions collapse into one record', async () => {
  const s = setup();
  put(s, K.units, [unit('a', 'T', 'same'), unit('b', 'T', 'same', { orderIndex: 2 }), unit('c', 'T', 'same', { orderIndex: 3 })]);
  const older = '2026-09-20T00:00:00.000Z';
  const newer = '2026-09-26T00:00:00.000Z';
  put(s, K.completions, [
    { ownerId: 'A', unitId: 'a', completed: true, changedAt: older },
    { ownerId: 'B', unitId: 'a', completed: false, changedAt: newer },
    { ownerId: 'A', unitId: 'b', completed: true, changedAt: newer },
    { ownerId: 'B', unitId: 'b', completed: false, changedAt: older },
    { ownerId: 'C', unitId: 'b', completed: true, changedAt: older },
    { ownerId: 'C', unitId: 'c', completed: true, changedAt: newer },
  ]);

  await s.db.deduplicateTopicUnits('T');
  // 중복 단원 쪽이 더 늦으면 그 시각을, 대상 단원 쪽이 더 늦으면 대상 시각을 그대로 남긴다.
  assert.deepEqual(read(s, K.completions), [
    { ownerId: 'A', unitId: 'a', completed: true, changedAt: newer },
    { ownerId: 'B', unitId: 'a', completed: false, changedAt: newer },
    { ownerId: 'C', unitId: 'a', completed: true, changedAt: newer },
  ]);
});

test('deduplication is cancelled for a unit when the same owner has conflicting completions', async () => {
  const s = setup();
  put(s, K.topics, [{ id: 'T', name: 'math' }]);
  put(s, K.units, [
    unit('a', 'T', 'same'),
    unit('b', 'T', 'same', { orderIndex: 2 }),
    unit('x', 'T', 'other', { orderIndex: 3 }),
    unit('y', 'T', 'other', { orderIndex: 4 }),
  ]);
  put(s, K.questions, [q('q1', 'T', 'b', 'a'), q('q2', 'T', 'y', 'b')]);
  put(s, K.specs, [{ id: 'sp', topicId: 'T', unitIds: ['b', 'y'] }]);
  put(s, K.completions, [
    { ownerId: 'A', unitId: 'a', completed: true, changedAt: now },
    { ownerId: 'A', unitId: 'b', completed: false, changedAt: now },
    { ownerId: 'B', unitId: 'x', completed: true, changedAt: now },
  ]);
  const before = sorted(s.data);

  // 같은 소유자 A의 a/b 상태가 달라 a·b는 합치지 않는다. x·y는 충돌이 없어 합친다.
  const result = await s.db.deduplicateTopicUnits('T');
  assert.deepEqual(result.map(u => u.id), ['a', 'b', 'x']);
  assert.deepEqual(read(s, K.questions).map(item => item.unitId), ['b', 'x']);
  assert.deepEqual(read(s, K.specs)[0].unitIds, ['b', 'x']);
  assert.deepEqual(read(s, K.completions), [
    { ownerId: 'A', unitId: 'a', completed: true, changedAt: now },
    { ownerId: 'A', unitId: 'b', completed: false, changedAt: now },
    { ownerId: 'B', unitId: 'x', completed: true, changedAt: now },
  ]);

  // 합칠 수 있는 단원이 전혀 없으면 저장 데이터가 그대로다.
  const onlyConflict = setup();
  for (const [key, value] of before) onlyConflict.data.set(key, value);
  put(onlyConflict, K.units, read(onlyConflict, K.units).slice(0, 2));
  const conflictBefore = sorted(onlyConflict.data);
  const kept = await onlyConflict.db.deduplicateTopicUnits('T');
  assert.deepEqual(kept.map(u => u.id), ['a', 'b']);
  assert.deepEqual(sorted(onlyConflict.data), conflictBefore);
});

test('unit deletion removes the related attempts and corrections without touching other questions', async () => {
  const s = setup();
  put(s, K.topics, [{ id: 'T', name: 'math' }]);
  put(s, K.units, [unit('u1', 'T', 'one'), unit('u2', 'T', 'two')]);
  put(s, K.questions, [q('q1', 'T', 'u1', 'a'), q('q1-long', 'T', 'u2', 'b')]);
  const run = '3f2a9c1e-7b4d-4e0a-9c1f-5d6e7f8a9b0c';
  const removed = attempt('q1', run, 0);
  const kept = attempt('q1-long', run, 1);
  const legacyRemoved = { ...attempt('q1', 'x'), id: 'legacy-a', submissionKey: 'sub-q1-2026-09-16-fixed' };
  const legacyAmbiguous = { ...attempt('q1', 'y'), id: 'legacy-b', submissionKey: 'sub-q1-long-2026-09-16-fixed' };
  put(s, K.attempts, [removed, kept, legacyRemoved, legacyAmbiguous]);
  put(s, K.corrections, [correction(removed), correction(kept)]);
  put(s, K.reviews, [
    { ownerId: 'o', questionRevisionId: 'q1', stage: 1, dueDate: '2026-09-26', lastAttemptId: removed.id, updatedAt: now },
    { ownerId: 'o', questionRevisionId: 'q1-long', stage: 1, dueDate: '2026-09-26', lastAttemptId: kept.id, updatedAt: now },
  ]);
  put(s, K.notes, ['q1', 'q1-long']);
  put(s, K.completions, [{ ownerId: 'o', unitId: 'u1', completed: true, changedAt: now }]);
  put(s, K.specs, [
    { id: 'no-unit', topicId: 'T', unitIds: [] },
    { id: 'only-u1', topicId: 'T', unitIds: ['u1'] },
    { id: 'both', topicId: 'T', unitIds: ['u1', 'u2'] },
  ]);

  await s.db.deleteUnit('u1');
  assert.deepEqual(read(s, K.attempts).map(a => a.id), [kept.id, 'legacy-b']);
  assert.deepEqual(read(s, K.corrections).map(c => c.attemptId), [kept.id]);
  assert.deepEqual(read(s, K.reviews).map(r => r.questionRevisionId), ['q1-long']);
  assert.deepEqual(read(s, K.notes), ['q1-long']);
  assert.deepEqual(read(s, K.completions), []);
  assert.deepEqual(read(s, K.specs).map(sp => [sp.id, sp.unitIds]), [['no-unit', []], ['both', ['u2']]]);
});

test('topic deletion removes its corrections and keeps attempts of other topics with overlapping IDs', async () => {
  const s = setup();
  put(s, K.topics, [{ id: 'T', name: 'math' }, { id: 'O', name: 'other' }]);
  put(s, K.units, [unit('u1', 'T', 'one'), unit('u2', 'O', 'two')]);
  put(s, K.questions, [q('q1', 'T', 'u1', 'a'), q('q10', 'O', 'u2', 'b')]);
  const mine = attempt('q1', 'run-a');
  const other = attempt('q10', 'run-b');
  put(s, K.attempts, [mine, other]);
  put(s, K.corrections, [correction(mine), correction(other)]);

  await s.db.deleteTopic('T');
  assert.deepEqual(read(s, K.attempts).map(a => a.id), [other.id]);
  assert.deepEqual(read(s, K.corrections).map(c => c.attemptId), [other.id]);
  assert.deepEqual(read(s, K.questions).map(item => item.id), ['q10']);
});

async function fullBackup() {
  const s = setup();
  await s.db.initializeDatabase();
  const payload = JSON.parse(await s.db.exportBackupJSON('full'));
  return { s, payload };
}

test('backup pre-check rejects bad items, duplicate IDs and broken references before any storage write', async () => {
  const cases = {
    'invalid json': () => '{"version":',
    'unit without title': p => { p.units[0].title = 42; },
    'question without stem': p => { delete p.questions[0].stem; },
    'unknown question type': p => { p.questions[0].questionType = 'riddle'; },
    'attempt without submissionKey': p => { p.attempts = [{ id: 'a-0', isCorrect: true, submittedAt: now }]; },
    'malformed challenge': p => { p.attempts = [{ ...attempt('q', 'r'), challenge: { version: 1, runId: 'r', topicId: 'T', level: '31', questionId: 'q', startedAt: now } }]; },
    'review state without due date': p => { p.reviewStates = [{ questionRevisionId: 'q', stage: 1 }]; },
    'duplicate question id': p => { p.questions.push({ ...p.questions[0] }); },
    'duplicate unit id': p => { p.units.push({ ...p.units[0], title: 'copy' }); },
    'unit of missing topic': p => { p.units[0].topicId = 'missing'; },
    'missing parent unit': p => { p.units[0].parentId = 'missing'; },
    'question of missing topic': p => { p.questions[0].topicId = 'missing'; },
    'question in another topic unit': p => {
      p.topics.push({ id: 'other', name: 'other' });
      p.questions[0].topicId = 'other';
    },
    'chunk without revision': p => { p.sourceChunks = [{ id: 'c', revisionId: 'missing' }]; },
    'link to missing source': p => { p.topicSourceLinks = [{ topicId: p.topics[0].id, sourceId: 'missing', createdAt: now }]; },
    'session item of missing question': p => {
      p.learningSpecs = [{ id: 'sp', topicId: p.topics[0].id, unitIds: [] }];
      p.sessions = [{ id: 's', topicId: p.topics[0].id, specId: 'sp' }];
      p.sessionItems = [{ id: 'i', sessionId: 's', questionRevisionId: 'missing' }];
    },
    'session with a spec of another topic': p => {
      p.topics.push({ id: 'other', name: 'other' });
      p.learningSpecs = [{ id: 'sp', topicId: 'other', unitIds: [] }];
      p.sessions = [{ id: 's', topicId: p.topics[0].id, specId: 'sp' }];
    },
    'session item with a question of another topic': p => {
      p.topics.push({ id: 'other', name: 'other' });
      p.learningSpecs = [{ id: 'sp', topicId: 'other', unitIds: [] }];
      p.sessions = [{ id: 's', topicId: 'other', specId: 'sp' }];
      p.sessionItems = [{ id: 'i', sessionId: 's', questionRevisionId: p.questions[0].id }];
    },
    'duplicate surviving correction id': p => {
      const a1 = attempt('q', 'run', 0);
      const a2 = attempt('p', 'run', 1);
      p.attempts = [a1, a2];
      p.attemptCorrections = [correction(a1), { ...correction(a2), id: correction(a1).id }];
    },
    'option text is not a string': p => { p.questions[0].options[0].text = 5; },
    'option without id': p => { delete p.questions[0].options[1].id; },
    'cloze blank with non-string answers': p => { p.questions[0].clozeBlanks = [{ id: 'b', correctAnswers: [1] }]; },
    'cloze blank without answers': p => { p.questions[0].clozeBlanks = [{ id: 'b' }]; },
    'checklist item without points': p => { p.questions[0].gradingChecklist = [{ id: 'g', criterion: 'c' }]; },
    'checklist result without met flag': p => { p.attempts = [{ ...attempt('q', 'r'), gradingChecklistResult: [{ id: 'g' }] }]; },
    'profile without displayName': p => { delete p.profile.displayName; },
    'profile with numeric timezone': p => { p.profile.timezone = 9; },
    'routine with unknown preset': p => { p.routine.preset = 'hourly'; },
    'routine without targetQuestionCount': p => { delete p.routine.targetQuestionCount; },
    'routine with non-numeric activeDays': p => { p.routine.activeDays = ['mon']; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const { s, payload } = await fullBackup();
    const json = mutate(payload) ?? JSON.stringify(payload);
    const before = sorted(s.data);
    const writesBefore = s.writes();
    const result = await s.db.restoreBackupJSON(json);
    assert.equal(result.success, false, name);
    assert.match(result.message, /기존 데이터는 변경되지 않았습니다/, name);
    assert.equal(s.writes(), writesBefore, name);
    assert.deepEqual(sorted(s.data), before, name);
    assert.throws(() => s.db.inspectBackupJSON(json), error => typeof error?.message === 'string', name);
  }
});

test('backup pre-check accepts same-topic sessions, orphan duplicate corrections and intentionally empty question fields', async () => {
  const { s, payload } = await fullBackup();
  const topicId = payload.topics[0].id;
  const base = payload.questions[0];
  assert.equal(base.topicId, topicId);
  payload.learningSpecs = [{ id: 'sp', topicId, unitIds: [] }];
  payload.sessions = [{ id: 's', topicId, specId: 'sp' }];
  payload.questions.push(
    // 보기 누락(hasMissingOptions)으로 보존되는 문제와 구형 형식 보기
    { ...base, id: 'missing-options', questionId: 'missing-options', options: [] },
    { ...base, id: 'three-options', questionId: 'three-options', options: base.options.slice(0, 3).map(({ id, text }) => ({ id, text })) },
    { ...base, id: 'essay', questionId: 'essay', questionType: 'essay', options: [], answerOptionId: '', gradingChecklist: [] },
    { ...base, id: 'cloze', questionId: 'cloze', questionType: 'cloze', options: [], answerOptionId: '', clozeBlanks: [{ id: 'b', correctAnswers: [] }] },
    { id: 'no-topic', stem: '과목 정보가 없는 구형 문제' },
  );
  payload.sessionItems = [
    { id: 'i1', sessionId: 's', questionRevisionId: base.id },
    { id: 'i2', sessionId: 's', questionRevisionId: 'no-topic' },
  ];
  const a1 = attempt(base.id, 'run', 0);
  payload.attempts = [{ ...a1, gradingChecklistResult: [{ id: 'g', met: true }] }];
  // 고아 정정은 ID가 겹쳐도 먼저 제외되므로 복원을 막지 않는다.
  payload.attemptCorrections = [correction(a1), { ...correction(attempt('gone', 'run', 1)), id: correction(a1).id }];
  delete payload.routine;

  assert.equal(s.db.inspectBackupJSON(JSON.stringify(payload)).backupKind, 'full');
  const result = await s.db.restoreBackupJSON(JSON.stringify(payload));
  assert.equal(result.success, true, result.message);
  assert.deepEqual(read(s, K.corrections).map(c => c.attemptId), [a1.id]);
  assert.deepEqual(read(s, K.questions).map(item => item.id).slice(-5), ['missing-options', 'three-options', 'essay', 'cloze', 'no-topic']);
  assert.deepEqual(read(s, '@cogniquest:session_items').map(item => item.id), ['i1', 'i2']);
  assert.equal(s.data.has('@cogniquest:routine'), false);
});

test('question-bank backup with a broken reference is also rejected without writes', async () => {
  const s = setup();
  await s.db.initializeDatabase();
  const payload = JSON.parse(await s.db.exportBackupJSON('question-bank'));
  payload.units[0].topicId = 'missing';
  const before = sorted(s.data);
  assert.equal((await s.db.restoreBackupJSON(JSON.stringify(payload))).success, false);
  assert.deepEqual(sorted(s.data), before);
});

test('old backups without optional fields and with legacy dangling links still restore', async () => {
  const s = setup();
  await s.db.initializeDatabase();
  const legacy = {
    version: 1,
    topics: [{ id: 'T', name: '구형 과목' }],
    questions: [
      { id: 'legacy-q', questionId: 'legacy-q', revision: 1, specId: 'spec', topicId: 'T', stem: '구형 문제', answerOptionId: 'a', explanation: '', status: 'ready_personal', createdAt: now },
      { id: 'orphan-unit-q', stem: '예전 목차 재생성으로 단원 연결이 끊긴 문제', topicId: 'T', unitId: 'regenerated-away' },
    ],
    units: [{ id: 'U', topicId: 'T', title: '단원' }],
    attempts: [{ id: 'legacy-attempt', sessionItemId: 'never-saved', submissionKey: 'sub-legacy-q-2026-01-01', answerOptionId: 'a', isCorrect: true, submittedAt: now }],
    reviewStates: [{ questionRevisionId: 'deleted-question', stage: 2, dueDate: '2026-01-02' }],
    manualCompletions: [{ unitId: 'regenerated-away', completed: true }],
    learningSpecs: [{ id: 'sp', topicId: 'T', unitIds: ['regenerated-away'] }],
    customNoteQuestionIds: ['deleted-question'],
    lastStudiedTopic: 'deleted-topic',
    profile: null,
  };
  const result = await s.db.restoreBackupJSON(JSON.stringify(legacy));
  assert.equal(result.success, true, result.message);
  assert.deepEqual(read(s, K.questions).map(item => item.questionType), ['multiple_choice', 'multiple_choice']);
  assert.equal(read(s, K.attempts)[0].id, 'legacy-attempt');
  assert.equal(read(s, K.reviews)[0].questionRevisionId, 'deleted-question');
});

test('split backup_payload module applies the pre-check and a current Android full backup still round-trips', async () => {
  const s = setup();
  await s.db.initializeDatabase();
  const { topic, units } = await s.db.createTopicWithUnits({ name: '인공지능', difficultyLevel: 3, units: [{ title: 'A' }, { title: 'B' }] });
  await s.db.updateUnitDifficulty(topic.id, units[0].id, 20);
  const cloze = {
    ...q('cz', topic.id, units[0].id, '{{1}}은 로봇에 적용된 AI이고 {{2}}는 데이터를 분석하는 직무다.'),
    questionType: 'cloze',
    clozeBlanks: [{ id: 'b1', correctAnswers: ['Physical AI', '피지컬 AI'] }, { id: 'b2', correctAnswers: ['AI 데이터 사이언티스트'] }],
  };
  const essay = {
    ...q('es', topic.id, units[1].id, '지도학습과 비지도학습의 차이를 설명하시오.'),
    questionType: 'essay', modelAnswer: '정답 레이블 유무', gradingChecklist: [{ id: 'g1', criterion: '레이블', points: 100 }],
  };
  await s.db.addQuestions([cloze, essay]);
  await s.db.updateQuestionHint('cz', '두 빈칸 모두 정식 명칭을 떠올려 보세요.');
  await s.db.saveAttempt({
    id: 'a-cz', sessionItemId: 'random-cz-r', submissionKey: 'sub-cz-r', answerOptionId: '', isCorrect: false,
    clozeAnswers: ['Pa', 'Ds'], gradingStatus: 'graded', gradingScore: 0, gradingChecklistResult: [{ id: 'b1', met: false }, { id: 'b2', met: false }],
    submittedAt: now,
  });

  const json = await s.db.exportBackupJSON('full');
  // 백업 형식 모듈 단독으로도 사전 검사가 동작해야 복원 미리보기와 실제 복원이 같은 기준을 쓴다.
  const payloadModule = s.load('src/data/repositories/backup_payload.ts');
  assert.equal(payloadModule.normalizeBackupPayload(JSON.parse(json)).questions.some(item => item.id === 'cz'), true);
  const broken = JSON.parse(json);
  broken.questions.find(item => item.id === 'es').topicId = 'missing-topic';
  assert.throws(() => payloadModule.normalizeBackupPayload(broken));
  assert.throws(() => s.db.inspectBackupJSON(JSON.stringify(broken)));

  const restored = setup();
  await restored.db.initializeDatabase();
  const before = sorted(restored.data);
  assert.equal((await restored.db.restoreBackupJSON(JSON.stringify(broken))).success, false);
  assert.deepEqual(sorted(restored.data), before);

  const result = await restored.db.restoreBackupJSON(json);
  assert.equal(result.success, true, result.message);
  const saved = new Map(read(restored, K.questions).map(item => [item.id, item]));
  assert.deepEqual(saved.get('cz').clozeBlanks, cloze.clozeBlanks);
  assert.equal(saved.get('cz').deepReasoningHint, '두 빈칸 모두 정식 명칭을 떠올려 보세요.');
  assert.deepEqual(saved.get('es').gradingChecklist, essay.gradingChecklist);
  assert.equal(read(restored, K.units).find(u => u.id === units[0].id).difficultyLevel, 20);
  assert.deepEqual(read(restored, K.attempts).find(a => a.id === 'a-cz').clozeAnswers, ['Pa', 'Ds']);
});

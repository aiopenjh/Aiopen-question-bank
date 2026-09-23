const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup(existing = new Map()) {
  const data = existing;
  const cache = new Map();
  let fail = null;
  let secureFailure = false;

  const shouldFail = (key, value) => fail?.(key, value) === true;
  const storage = {
    getItem: async key => data.get(key) ?? null,
    setItem: async (key, value) => {
      if (shouldFail(key, value)) throw new Error('disk full');
      data.set(key, value);
    },
    removeItem: async key => {
      if (shouldFail(key, null)) throw new Error('disk full');
      data.delete(key);
    },
    multiGet: async keys => keys.map(key => [key, data.get(key) ?? null]),
    multiSet: async entries => {
      for (const [key, value] of entries) {
        if (shouldFail(key, value)) throw new Error('disk full');
        data.set(key, value);
      }
    },
    multiRemove: async keys => {
      for (const key of keys) {
        if (shouldFail(key, null)) throw new Error('disk full');
        data.delete(key);
      }
    },
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
      // 저장소 경계 아래를 키-값 Map으로 두고 리포지토리 동작을 검증한다(IndexedDB 없는 웹 경로).
      // 네이티브 SQLite 백엔드는 native_sqlite_storage.test.cjs에서 검증한다.
      if (name === 'react-native') return { Platform: { OS: 'web' } };
      if (name === './native_storage_migration') {
        return {
          initializeNativeStorage: async () => {
            throw new Error('Unexpected native storage initialization');
          },
        };
      }
      if (name.includes('secure_storage')) {
        return {
          getEncryptedApiKey: async () => null,
          saveEncryptedApiKey: async () => 'persistent',
          deleteEncryptedApiKey: async () => {
            if (secureFailure) throw new Error('secure failure');
            data.delete('@cogniquest:secure_vault_v1');
          },
        };
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
    setFailure: predicate => { fail = predicate; },
    setSecureFailure: value => { secureFailure = value; },
  };
}

const key = name => `@cogniquest:${name}`;
const sortedEntries = data => [...data].sort(([left], [right]) => left.localeCompare(right));
const now = '2026-09-16T00:00:00.000Z';
const question = {
  id: 'q1',
  questionId: 'q1',
  revision: 1,
  specId: 'spec',
  stem: '2+2?',
  options: [
    { id: 'a', text: '4', isDistractor: false },
    { id: 'b', text: '5', isDistractor: true },
  ],
  answerOptionId: 'a',
  explanation: 'Addition',
  status: 'ready_personal',
  createdAt: now,
};

test('complete backup round trip contains sources, progress and settings but never secret vault', async () => {
  const session = setup();
  await session.db.initializeDatabase();
  const topic = await session.db.createTopic('math', '', 'general', 'advanced');
  assert.equal(topic.learnerLevel, 'advanced');
  await session.db.addQuestions([{ ...question, topicId: topic.id }]);
  await session.db.addSource(
    {
      id: 'src', ownerId: 'owner', kind: 'text', title: 'note', visibility: 'private',
      allowExternalProcessing: true, archivedAt: null, createdAt: now,
    },
    {
      id: 'rev', sourceId: 'src', hash: 'h', provenance: 'test',
      originalFileRef: null, createdAt: now,
    },
    [{
      id: 'chunk', revisionId: 'rev', rawText: 'hi', normalizedText: 'hi',
      locator: { kind: 'text' }, extractionStatus: 'success',
    }]
  );
  await session.db.saveAttempt({
    id: 'attempt-1', sessionItemId: 'item-1', submissionKey: 'submit-q1',
    answerOptionId: 'a', isCorrect: true, submittedAt: now,
    challenge: { version: 1, runId: 'run1', topicId: topic.id, level: 31, questionId: 'q1', startedAt: now },
  });
  await session.db.savePreferredAiModel('gemini-3.5-pro');
  session.data.set(key('secure_vault_v1'), 'SECRET');

  const backup = await session.db.exportBackupJSON('full');
  assert.ok(!backup.includes('SECRET'));
  session.data.set(key('sources'), '[]');
  session.data.set(key('attempts'), '[]');

  assert.equal((await session.db.restoreBackupJSON(backup)).success, true);
  assert.equal((await session.db.getSources()).length, 1);
  assert.equal((await session.db.getAttempts()).length, 1);
  assert.equal((await session.db.getAttempts())[0].challenge.level, 31);
  assert.equal((await session.db.getAttempts())[0].challenge.topicId, topic.id);
  assert.equal(await session.db.getPreferredAiModel(), 'gemini-3.5-pro');
  assert.equal(session.data.get(key('secure_vault_v1')), 'SECRET');
});

test('question-bank backup excludes private recovery data and preserves existing progress on restore', async () => {
  const source = setup();
  await source.db.initializeDatabase();
  const topic = await source.db.createTopic('shared math');
  await source.db.addQuestions([{ ...question, topicId: topic.id }]);
  source.data.set('@celueste:ranking_profile', JSON.stringify({
    nickname: 'private', participantId: 'participant', recoveryToken: 'SECRET_TOKEN', deviceToken: 'device',
  }));

  const backup = await source.db.exportBackupJSON();
  const payload = JSON.parse(backup);
  assert.equal(payload.backupKind, 'question-bank');
  assert.equal('attempts' in payload, false);
  assert.equal('sources' in payload, false);
  assert.equal('rankingRecoveryToken' in payload, false);
  assert.ok(!backup.includes('SECRET_TOKEN'));

  const target = setup();
  await target.db.initializeDatabase();
  target.data.set(key('attempts'), '[{"id":"keep-attempt"}]');
  target.data.set(key('sources'), '[{"id":"keep-source"}]');
  target.data.set('@celueste:ranking_profile', '{"participantId":"keep-ranking"}');

  assert.equal((await target.db.restoreBackupJSON(backup)).success, true);
  assert.equal(JSON.parse(target.data.get(key('attempts')))[0].id, 'keep-attempt');
  assert.equal(JSON.parse(target.data.get(key('sources')))[0].id, 'keep-source');
  assert.equal(JSON.parse(target.data.get('@celueste:ranking_profile')).participantId, 'keep-ranking');
  assert.ok((await target.db.getTopics()).some(item => item.name === 'shared math'));
});

test('legacy compact backup is treated as question-bank and keeps local progress and ranking', async () => {
  const source = setup();
  await source.db.initializeDatabase();
  const payload = JSON.parse(await source.db.exportBackupJSON());
  delete payload.backupKind;
  payload.rankingNickname = 'legacy';
  payload.rankingParticipantId = 'legacy-participant';
  payload.rankingRecoveryToken = 'legacy-token';

  const target = setup();
  await target.db.initializeDatabase();
  target.data.set(key('attempts'), '[{"id":"keep-attempt"}]');
  target.data.set('@celueste:ranking_profile', '{"participantId":"keep-ranking"}');

  const inspection = target.db.inspectBackupJSON(JSON.stringify(payload));
  assert.equal(inspection.backupKind, 'question-bank');
  assert.equal((await target.db.restoreBackupJSON(JSON.stringify(payload))).success, true);
  assert.equal(JSON.parse(target.data.get(key('attempts')))[0].id, 'keep-attempt');
  assert.equal(JSON.parse(target.data.get('@celueste:ranking_profile')).participantId, 'keep-ranking');
  assert.equal(target.data.has('@celueste:ranking_recovery_seed'), false);
});

test('full backup without ranking token preserves current ranking connection and pending state', async () => {
  const source = setup();
  await source.db.initializeDatabase();
  const backup = await source.db.exportBackupJSON('full');

  const target = setup();
  await target.db.initializeDatabase();
  target.data.set('@celueste:ranking_profile', '{"participantId":"keep-ranking","deviceToken":"device"}');
  target.data.set('@celueste:ranking_sync_queue', '{"requestId":"keep-queue"}');
  target.data.set('@celueste:ranking_recovery_seed', '{"participantId":"keep-seed"}');

  assert.equal((await target.db.restoreBackupJSON(backup)).success, true);
  assert.equal(JSON.parse(target.data.get('@celueste:ranking_profile')).participantId, 'keep-ranking');
  assert.equal(JSON.parse(target.data.get('@celueste:ranking_sync_queue')).requestId, 'keep-queue');
  assert.equal(JSON.parse(target.data.get('@celueste:ranking_recovery_seed')).participantId, 'keep-seed');
});

test('full backup restores legacy alarm config without selected days', async () => {
  const session = setup();
  await session.db.initializeDatabase();
  const payload = JSON.parse(await session.db.exportBackupJSON('full'));
  payload.alarmConfig = {
    enabled: true,
    hour: 9,
    minute: 30,
    weekendEnabled: false,
  };

  assert.equal((await session.db.restoreBackupJSON(JSON.stringify(payload))).success, true);
  assert.deepEqual(JSON.parse(session.data.get('@celueste:alarm_config_v2')), {
    schemaVersion: 2,
    enabled: true,
    times: [{ hour: 9, minute: 30 }],
    selectedDays: ['월', '화', '수', '목', '금'],
    weekendEnabled: false,
  });
});

test('unit difficulty survives restart and backup without changing siblings, topic or questions', async () => {
  const session = setup();
  await session.db.initializeDatabase();
  const { topic, units } = await session.db.createTopicWithUnits({ name: 'math', difficultyLevel: 3, units: [{ title: 'A' }, { title: 'B' }] });
  await session.db.addQuestions([{ ...question, topicId: topic.id, unitId: units[0].id }]);
  const beforeQuestions = JSON.stringify(await session.db.getQuestions());
  await session.db.updateUnitDifficulty(topic.id, units[0].id, 20);
  const restarted = setup(session.data);
  assert.equal((await restarted.db.getUnits()).find(u => u.id === units[0].id).difficultyLevel, 20);
  assert.equal((await restarted.db.getUnits()).find(u => u.id === units[1].id).difficultyLevel, undefined);
  assert.equal((await restarted.db.getTopics()).find(t => t.id === topic.id).difficultyLevel, 3);
  assert.equal(JSON.stringify(await restarted.db.getQuestions()), beforeQuestions);
  const backup = await restarted.db.exportBackupJSON();
  const restored = setup();
  assert.equal((await restored.db.restoreBackupJSON(backup)).success, true);
  assert.equal((await restored.db.getUnits()).find(u => u.id === units[0].id).difficultyLevel, 20);
  const before = JSON.stringify(await restored.db.getUnits());
  await assert.rejects(restored.db.updateUnitDifficulty('wrong-topic', units[0].id, 4));
  assert.equal(JSON.stringify(await restored.db.getUnits()), before);
  restored.setFailure(k => k === key('units'));
  await assert.rejects(restored.db.updateUnitDifficulty(topic.id, units[0].id, 4));
  assert.equal(JSON.stringify(await restored.db.getUnits()), before);
});

test('question replacement keeps new and other-unit questions and preserves old on failure', async () => {
  const session = setup();
  const old = { ...question, topicId: 't', unitId: 'u' };
  const other = { ...question, id: 'q2', questionId: 'q2', stem: '대한민국의 수도는?', topicId: 't', unitId: 'other' };
  const fresh = { ...question, id: 'q3', questionId: 'q3', stem: '식물의 광합성에 필요한 기체는?', topicId: 't', unitId: 'u' };
  await session.db.addQuestions([old, other]);
  assert.equal((await session.db.saveQuestionsForUnit('t', 'u', [fresh], false)).committed, true);
  assert.equal((await session.db.getQuestions()).length, 3);
  const next = { ...fresh, id: 'q4', questionId: 'q4', stem: '표준 기압에서 물의 끓는점은?' };
  session.setFailure(k => k === key('questions'));
  await assert.rejects(session.db.saveQuestionsForUnit('t', 'u', [next], true));
  assert.equal((await session.db.getQuestions()).length, 3);
  session.setFailure(null);
  assert.equal((await session.db.saveQuestionsForUnit('t', 'u', [next], true)).committed, true);
  assert.deepEqual(Array.from(await session.db.getQuestions(), q => q.id).sort(), ['q2', 'q4']);
  assert.equal((await session.db.saveQuestionsForUnit('t', 'u', [next], true)).committed, false);
  assert.equal((await session.db.getQuestions()).length, 2);
});

test('updateQuestionHint permanently saves an on-demand AI hint and only touches the target question', async () => {
  const session = setup();
  const target = { ...question, topicId: 't', unitId: 'u' };
  const other = { ...question, id: 'q2', questionId: 'q2', stem: '대한민국의 수도는?', topicId: 't', unitId: 'u' };
  await session.db.addQuestions([target, other]);

  await session.db.updateQuestionHint('q1', '분자와 분모를 각각 확인해 보세요.');
  const saved = await session.db.getQuestions();
  assert.equal(saved.find(q => q.id === 'q1').deepReasoningHint, '분자와 분모를 각각 확인해 보세요.');
  assert.equal(saved.find(q => q.id === 'q2').deepReasoningHint, undefined);

  // 이후 세션(재시작)에서도 영구 저장되어 재사용된다.
  const restarted = setup(session.data);
  assert.equal(
    (await restarted.db.getQuestions()).find(q => q.id === 'q1').deepReasoningHint,
    '분자와 분모를 각각 확인해 보세요.'
  );

  // 존재하지 않는 문제 id는 조용히 무시한다.
  await session.db.updateQuestionHint('does-not-exist', '무시되어야 함');
  assert.ok(!(await session.db.getQuestions()).some(q => q.deepReasoningHint === '무시되어야 함'));
});

test('topic-source links select only the explicitly connected material', async () => {
  const session = setup();
  await session.db.initializeDatabase();
  const topic = await session.db.createTopic('math');
  const otherTopic = await session.db.createTopic('history');

  for (const [id, text] of [['math-source', 'linked math text'], ['history-source', 'unrelated history text']]) {
    await session.db.addSource(
      {
        id, ownerId: 'owner', kind: 'text', title: id, visibility: 'private',
        allowExternalProcessing: true, archivedAt: null, createdAt: now,
      },
      {
        id: `${id}-revision`, sourceId: id, hash: `${id}-hash`, provenance: 'test',
        originalFileRef: null, createdAt: now,
      },
      [{
        id: `${id}-chunk`, revisionId: `${id}-revision`, rawText: text, normalizedText: text,
        locator: { kind: 'text' }, extractionStatus: 'success',
      }]
    );
  }

  await session.db.linkSourceToTopic({
    topicId: topic.id,
    sourceId: 'math-source',
    createdAt: now,
  });
  assert.equal(await session.db.getSourceTextForTopic(topic.id, topic.name), 'linked math text');
  assert.equal(await session.db.getSourceTextForTopic(otherTopic.id, otherTopic.name), '');
});

test('PDF backup stores metadata and topic linkage without file bytes or extracted body', async () => {
  const session = setup();
  await session.db.initializeDatabase();
  const topic = await session.db.createTopic('pdf topic');
  await session.db.addSource(
    {
      id: 'pdf-source', ownerId: 'owner', kind: 'pdf', title: 'book', fileName: 'book.pdf',
      fileSizeBytes: 1234, pageCount: 300, fingerprint: 'sha256-only', selectedPageStart: 1,
      selectedPageEnd: 20, visibility: 'private', allowExternalProcessing: true,
      archivedAt: null, createdAt: now,
    },
    {
      id: 'pdf-revision', sourceId: 'pdf-source', hash: 'sha256-only',
      provenance: 'PDF 1~20 pages, original not stored', originalFileRef: null, createdAt: now,
    },
    []
  );
  await session.db.linkSourceToTopic({
    topicId: topic.id, sourceId: 'pdf-source', pageStart: 1, pageEnd: 20, createdAt: now,
  });

  const backup = await session.db.exportBackupJSON('full');
  const payload = JSON.parse(backup);
  assert.equal(payload.sources[0].fileName, 'book.pdf');
  assert.equal(payload.sourceChunks.length, 0);
  assert.equal(payload.topicSourceLinks[0].topicId, topic.id);
  assert.ok(!backup.includes('base64Data'));
  assert.ok(!backup.includes('JVBER'));

  await session.db.deleteTopic(topic.id);
  assert.equal((await session.db.getTopicSourceLinks(topic.id)).length, 0);
});

test('malformed backup leaves every original value unchanged', async () => {
  const session = setup();
  await session.db.initializeDatabase();
  const payload = JSON.parse(await session.db.exportBackupJSON('full'));
  payload.questions = [null];
  const before = sortedEntries(session.data);

  assert.equal((await session.db.restoreBackupJSON(JSON.stringify(payload))).success, false);
  assert.deepEqual(sortedEntries(session.data), before);
});

test('mid-restore failure rolls back every modified key', async () => {
  const session = setup();
  await session.db.initializeDatabase();
  const payload = JSON.parse(await session.db.exportBackupJSON('full'));
  payload.profile.displayName = 'NEW';
  payload.topics = [{ id: 'new', ownerId: payload.profile.id, name: 'new', description: '' }];
  const before = sortedEntries(session.data);
  let once = true;
  session.setFailure(storageKey => storageKey === key('questions') && once ? (once = false, true) : false);

  assert.equal((await session.db.restoreBackupJSON(JSON.stringify(payload))).success, false);
  assert.deepEqual(sortedEntries(session.data), before);
});

test('multiRemove failure after writes rolls back every modified and removed key', async () => {
  const source = setup();
  await source.db.initializeDatabase();
  source.data.set('@celueste:ranking_profile', JSON.stringify({
    nickname: 'backup', participantId: 'backup-participant', recoveryToken: 'backup-token', deviceToken: 'backup-device',
  }));
  const backup = await source.db.exportBackupJSON('full');

  const target = setup();
  await target.db.initializeDatabase();
  target.data.set('@celueste:ranking_profile', '{"participantId":"current-ranking","deviceToken":"current-device"}');
  target.data.set('@celueste:ranking_sync_queue', '{"requestId":"current-queue"}');
  target.data.set(key('preferred_ai_model'), 'gemini-3.5-pro');
  const before = sortedEntries(target.data);
  let once = true;
  target.setFailure(storageKey =>
    storageKey === '@celueste:ranking_profile' && once ? (once = false, true) : false
  );

  assert.equal((await target.db.restoreBackupJSON(backup)).success, false);
  assert.deepEqual(sortedEntries(target.data), before);
});

test('repeated submissionKey saves only one attempt', async () => {
  const session = setup();
  await session.db.initializeDatabase();
  const attempt = {
    id: 'attempt-1', sessionItemId: 'item-1', submissionKey: 'submit-q1-once',
    answerOptionId: 'b', isCorrect: false, submittedAt: now,
  };

  await Promise.all([session.db.saveAttempt(attempt), session.db.saveAttempt(attempt)]);
  assert.equal((await session.db.getAttempts()).length, 1);
  assert.equal((await session.db.getAttempts())[0].submissionKey, attempt.submissionKey);
});

test('version 2 restoration clears absent source collections instead of mixing old data', async () => {
  const session = setup();
  await session.db.initializeDatabase();
  const payload = JSON.parse(await session.db.exportBackupJSON('full'));
  payload.version = 2;
  delete payload.backupKind;
  delete payload.sources;
  delete payload.sourceRevisions;
  delete payload.sourceChunks;
  session.data.set(key('sources'), '[{"id":"old"}]');

  assert.equal((await session.db.restoreBackupJSON(JSON.stringify(payload))).success, true);
  assert.deepEqual(JSON.parse(session.data.get(key('sources'))), []);
});

test('clear stops before local removal when secure deletion fails, then resets app data', async () => {
  const session = setup();
  await session.db.initializeDatabase();
  const topic = await session.db.createTopic('keep');
  session.data.set('unrelated', 'removed-by-platform-clear');
  session.setSecureFailure(true);

  await assert.rejects(() => session.db.clearAllData());
  assert.ok((await session.db.getTopics()).some(item => item.id === topic.id));
  assert.equal(session.data.get('unrelated'), 'removed-by-platform-clear');

  session.setSecureFailure(false);
  await session.db.clearAllData();
  assert.ok(!(await session.db.getTopics()).some(item => item.id === topic.id));
  assert.equal(session.data.has('unrelated'), false);
});

test('dedupe keeps one unit per title and preserves units from other topics', async () => {
  const session = setup();
  await session.db.initializeDatabase();
  const topic = await session.db.createTopic('math');
  const otherTopic = await session.db.createTopic('science');
  const first = await session.db.createUnit({ topicId: topic.id, title: 'same' });
  await session.db.createUnit({ topicId: topic.id, title: 'same' });
  const other = await session.db.createUnit({ topicId: otherTopic.id, title: 'same' });

  const result = await session.db.deduplicateTopicUnits(topic.id);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, first.id);
  assert.equal((await session.db.getUnits(otherTopic.id))[0].id, other.id);
});

test('delete unit removes descendants and their dependent questions', async () => {
  const session = setup();
  await session.db.initializeDatabase();
  const topic = await session.db.createTopic('math');
  const parent = await session.db.createUnit({ topicId: topic.id, title: 'parent' });
  const child = await session.db.createUnit({
    topicId: topic.id, title: 'child', parentId: parent.id, depth: 2,
  });
  const grandchild = await session.db.createUnit({
    topicId: topic.id, title: 'grandchild', parentId: child.id, depth: 3,
  });
  await session.db.addQuestions([{ ...question, topicId: topic.id, unitId: grandchild.id }]);

  await session.db.deleteUnit(parent.id);
  assert.equal((await session.db.getUnits(topic.id)).length, 0);
  assert.ok(!(await session.db.getQuestions()).some(item => item.id === question.id));
});

test('delete unit rolls back all collections when its batched write fails', async () => {
  const session = setup();
  await session.db.initializeDatabase();
  const topic = await session.db.createTopic('math');
  const unit = await session.db.createUnit({ topicId: topic.id, title: 'unit' });
  await session.db.addQuestions([{ ...question, topicId: topic.id, unitId: unit.id }]);
  const before = sortedEntries(session.data);
  let once = true;
  session.setFailure(storageKey => storageKey === key('questions') && once ? (once = false, true) : false);

  await assert.rejects(() => session.db.deleteUnit(unit.id));
  assert.deepEqual(sortedEntries(session.data), before);
});

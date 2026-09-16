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
  });
  await session.db.savePreferredAiModel('gemini-3.5-pro');
  session.data.set(key('secure_vault_v1'), 'SECRET');

  const backup = await session.db.exportBackupJSON();
  assert.ok(!backup.includes('SECRET'));
  session.data.set(key('sources'), '[]');
  session.data.set(key('attempts'), '[]');

  assert.equal((await session.db.restoreBackupJSON(backup)).success, true);
  assert.equal((await session.db.getSources()).length, 1);
  assert.equal((await session.db.getAttempts()).length, 1);
  assert.equal(await session.db.getPreferredAiModel(), 'gemini-3.5-pro');
  assert.equal(session.data.get(key('secure_vault_v1')), 'SECRET');
});

test('malformed backup leaves every original value unchanged', async () => {
  const session = setup();
  await session.db.initializeDatabase();
  const payload = JSON.parse(await session.db.exportBackupJSON());
  payload.questions = [null];
  const before = sortedEntries(session.data);

  assert.equal((await session.db.restoreBackupJSON(JSON.stringify(payload))).success, false);
  assert.deepEqual(sortedEntries(session.data), before);
});

test('mid-restore failure rolls back every modified key', async () => {
  const session = setup();
  await session.db.initializeDatabase();
  const payload = JSON.parse(await session.db.exportBackupJSON());
  payload.profile.displayName = 'NEW';
  payload.topics = [{ id: 'new', ownerId: payload.profile.id, name: 'new', description: '' }];
  const before = sortedEntries(session.data);
  let once = true;
  session.setFailure(storageKey => storageKey === key('questions') && once ? (once = false, true) : false);

  assert.equal((await session.db.restoreBackupJSON(JSON.stringify(payload))).success, false);
  assert.deepEqual(sortedEntries(session.data), before);
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
  const payload = JSON.parse(await session.db.exportBackupJSON());
  payload.version = 2;
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

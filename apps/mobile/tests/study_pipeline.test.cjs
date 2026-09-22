const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Native persistence and the AI network boundary are replaced. The generator,
// repositories, backup code, secure-storage adapter and review engine execute
// their actual source code.
function appSession({ data = new Map(), secure = new Map(), response } = {}) {
  const cache = new Map();
  const calls = [];
  const storage = {
    getItem: async key => data.get(key) ?? null,
    setItem: async (key, value) => { data.set(key, value); },
    removeItem: async key => { data.delete(key); },
    multiGet: async keys => keys.map(key => [key, data.get(key) ?? null]),
    multiSet: async entries => { entries.forEach(([key, value]) => data.set(key, value)); },
    multiRemove: async keys => { keys.forEach(key => data.delete(key)); },
    clear: async () => { data.clear(); },
  };
  const secureStore = {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when-unlocked-this-device-only',
    isAvailableAsync: async () => true,
    getItemAsync: async key => secure.get(key) ?? null,
    setItemAsync: async (key, value) => { secure.set(key, value); },
    deleteItemAsync: async key => { secure.delete(key); },
  };

  function load(filename) {
    filename = path.resolve(__dirname, '..', filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const context = {
      module,
      exports: module.exports,
      console,
      Date,
      Math,
      Set,
      Map,
      Promise,
      JSON,
      Intl,
      AbortController,
      setTimeout,
      clearTimeout,
      fetch: async (url, request) => {
        calls.push({ url, request });
        if (!response) throw Error('Network forbidden in integration tests');
        return {
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: JSON.stringify(response) }] } }],
          }),
        };
      },
      require: name => {
        if (name === '@react-native-async-storage/async-storage') return storage;
        if (name === 'react-native') return { Platform: { OS: 'android' } };
        if (name === 'expo-secure-store') return secureStore;
        if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), `${name}.ts`));
        throw Error(`Unexpected dependency ${name}`);
      },
    };
    vm.runInNewContext(code, context, { filename });
    return module.exports;
  }

  return {
    data,
    secure,
    calls,
    db: load('src/data/db.ts'),
    generator: load('src/domain/generator.ts'),
    routine: load('src/domain/routine.ts'),
    repetition: load('src/domain/spaced_repetition.ts'),
  };
}

const providerQuestions = [
  {
    stem: '2 + 2 = ?',
    options: ['3', '4', '5', '6'].map(text => ({ text })),
    correctOptionNumber: 2,
    explanation: '2에 2를 더하면 4입니다.',
    deepReasoningHint: '두 수를 순서대로 하나씩 더해 보세요.',
  },
  {
    stem: '3 + 3 = ?',
    options: ['3', '4', '5', '6'].map(text => ({ text })),
    correctOptionNumber: 4,
    explanation: '3에 3을 더하면 6입니다.',
    deepReasoningHint: '같은 수를 두 번 더하는 상황임을 떠올려 보세요.',
  },
];

async function prepare(session) {
  await session.db.initializeDatabase();
  await session.db.saveGeminiApiKey('AIza-synthetic-integration-key');
  await session.db.savePreferredAiModel('gemini-3.5-flash');
  const profile = await session.db.getProfile();
  const topic = await session.db.createTopic('덧셈', '합성 학습 자료', '수학', 'beginner');
  const unit = await session.db.createUnit({ topicId: topic.id, title: '기본 덧셈' });
  const now = new Date().toISOString();
  const source = {
    id: 'source-synthetic',
    ownerId: profile.id,
    kind: 'text',
    title: '덧셈 노트',
    visibility: 'private',
    allowExternalProcessing: true,
    archivedAt: null,
    createdAt: now,
  };
  const revision = {
    id: 'revision-synthetic',
    sourceId: source.id,
    hash: 'synthetic-hash',
    provenance: 'synthetic test note',
    originalFileRef: null,
    createdAt: now,
  };
  const chunk = {
    id: 'chunk-synthetic',
    revisionId: revision.id,
    rawText: '2+2=4. 3+3=6.',
    normalizedText: '2+2=4. 3+3=6.',
    locator: { kind: 'text' },
    extractionStatus: 'success',
  };
  await session.db.addSource(source, revision, [chunk]);
  return { profile, topic, unit, source, revision, chunk };
}

function generationArgs(session, fixture) {
  return {
    ownerId: fixture.profile.id,
    topicId: fixture.topic.id,
    topicName: fixture.topic.name,
    unitId: fixture.unit.id,
    unitTitle: fixture.unit.title,
    customContext: fixture.chunk.normalizedText,
    intent: session.generator.analyzeUserIntent('덧셈 문제', fixture.topic.name, {
      learnerLevel: fixture.topic.learnerLevel,
      targetCount: 2,
    }),
  };
}

test('actual study pipeline generates, persists, deduplicates submissions and restores a backup', async () => {
  const initial = appSession({
    response: { intentStatus: 'READY', questions: providerQuestions },
  });
  const fixture = await prepare(initial);

  const outcome = await initial.generator.generateFactBasedQuestions(
    generationArgs(initial, fixture)
  );
  assert.equal(outcome.status, 'READY');
  assert.equal(initial.calls.length, 1);
  assert.match(initial.calls[0].url, /gemini-3.5-flash/);
  assert.ok(initial.calls[0].request.body.includes(fixture.chunk.normalizedText));
  assert.equal(outcome.spec.level, 'comprehend');

  const saveResult = await initial.db.saveQuestionsForUnit(
    fixture.topic.id,
    fixture.unit.id,
    outcome.questions,
    false
  );
  assert.equal(saveResult.committed, true);
  assert.equal(saveResult.saved.length, 2);
  const duplicateSave = await initial.db.saveQuestionsForUnit(
    fixture.topic.id,
    fixture.unit.id,
    outcome.questions,
    false
  );
  assert.equal(duplicateSave.committed, false);
  assert.equal(duplicateSave.saved.length, 0);
  assert.equal((await initial.db.getQuestions(fixture.topic.id)).length, 2);

  // A fresh module graph represents process death; native stores remain.
  const restarted = appSession({ data: initial.data, secure: initial.secure });
  await restarted.db.initializeDatabase();
  assert.equal(await restarted.db.getGeminiApiKey(), 'AIza-synthetic-integration-key');
  const savedQuestions = await restarted.db.getQuestions(fixture.topic.id);

  for (const [index, question] of savedQuestions.entries()) {
    const isCorrect = index === 0;
    const attemptId = `attempt-${index}`;
    const attempt = {
      id: attemptId,
      sessionItemId: `session-item-${index}`,
      submissionKey: `sub-${question.id}-2026-09-16-fixed`,
      answerOptionId: isCorrect
        ? question.answerOptionId
        : question.options.find(option => option.id !== question.answerOptionId).id,
      isCorrect,
      submittedAt: '2026-09-16T10:00:00.000Z',
    };
    await restarted.db.saveAttempt(attempt);
    await restarted.db.saveAttempt(attempt);
    await restarted.db.saveReviewState(
      restarted.repetition.calculateNextReviewState({
        ownerId: fixture.profile.id,
        questionRevisionId: question.id,
        isCorrect,
        attemptId,
      })
    );
  }
  await restarted.db.markUnitAsCompleted(fixture.unit.id, fixture.profile.id);

  const attempts = await restarted.db.getAttempts();
  const reviews = await restarted.db.getReviewStates();
  assert.equal(attempts.length, 2);
  assert.equal(new Set(attempts.map(attempt => attempt.submissionKey)).size, 2);
  assert.equal(reviews.filter(review => savedQuestions.some(q => q.id === review.questionRevisionId)).length, 2);
  assert.equal(
    reviews.find(review => review.questionRevisionId === savedQuestions[1].id).dueDate,
    restarted.repetition.calculateNextDueDate(1)
  );
  assert.equal((await restarted.db.getIncorrectQuestions()).filter(q => q.topicId === fixture.topic.id).length, 1);
  assert.equal((await restarted.db.getManualCompletions())[0].unitId, fixture.unit.id);
  assert.match(restarted.routine.getLocalDateString(), /^\d{4}-\d{2}-\d{2}$/);

  const backup = await restarted.db.exportBackupJSON();
  assert.ok(!backup.includes('AIza-synthetic-integration-key'));
  const restored = appSession();
  await restored.db.initializeDatabase();
  await restored.db.saveGeminiApiKey('AIza-different-device-key');
  const restoreResult = await restored.db.restoreBackupJSON(backup);
  assert.equal(restoreResult.success, true, restoreResult.message);
  assert.equal((await restored.db.getSources())[0].id, fixture.source.id);
  assert.equal(
    JSON.parse(restored.data.get('@cogniquest:source_revisions'))[0].id,
    fixture.revision.id
  );
  assert.equal((await restored.db.getSourceChunks())[0].normalizedText, fixture.chunk.normalizedText);
  assert.equal((await restored.db.getAttempts()).length, 2);
  assert.equal((await restored.db.getReviewStates()).length, 2);
  assert.equal((await restored.db.getQuestions(fixture.topic.id)).length, 2);
  assert.equal(await restored.db.getGeminiApiKey(), 'AIza-different-device-key');
  assert.equal(restored.calls.length, 0);
});

test('malformed provider answer produces no persistent study changes or additional calls', async () => {
  const session = appSession({
    response: {
      intentStatus: 'READY',
      questions: [providerQuestions[0], { ...providerQuestions[1], correctOptionNumber: 99 }],
    },
  });
  const fixture = await prepare(session);
  const beforeData = [...session.data].sort();
  const beforeSecure = [...session.secure].sort();

  const outcome = await session.generator.generateFactBasedQuestions(
    generationArgs(session, fixture)
  );

  assert.equal(outcome.status, 'FAILED');
  assert.equal(session.calls.length, 1);
  assert.deepEqual([...session.data].sort(), beforeData);
  assert.deepEqual([...session.secure].sort(), beforeSecure);
  assert.equal((await session.db.getQuestions(fixture.topic.id)).length, 0);
});

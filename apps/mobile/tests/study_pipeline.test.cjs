const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Only native storage and the network are replaced. Domain, database, backup,
// secure-store adapter and repetition modules execute their actual source code.
function appSession({ data = new Map(), secure = new Map(), response } = {}) {
  const cache = new Map();
  const calls = [];
  const storage = {
    getItem: async key => data.get(key) ?? null,
    setItem: async (key, value) => { data.set(key, value); },
    removeItem: async key => { data.delete(key); },
    multiRemove: async keys => { keys.forEach(key => data.delete(key)); },
  };
  const secureStore = {
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
      module, exports: module.exports, console, Date, Math, Set, Map, Promise, JSON,
      Intl, AbortController, setTimeout, clearTimeout,
      fetch: async (url, request) => {
        calls.push({ url, request });
        if (!response) throw Error('Network forbidden in integration tests');
        return { ok: true, json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(response) }] } }],
        }) };
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
    data, secure, calls,
    db: load('src/data/db.ts'),
    generator: load('src/domain/generator.ts'),
    routine: load('src/domain/routine.ts'),
    repetition: load('src/domain/spaced_repetition.ts'),
  };
}

const providerQuestions = [
  { stem: '2 + 2 = ?', options: ['3', '4', '5', '6'].map(text => ({ text })), correctIndex: 1, explanation: '2에 2를 더하면 4입니다.' },
  { stem: '3 + 3 = ?', options: ['3', '4', '5', '6'].map(text => ({ text })), correctIndex: 3, explanation: '3에 3을 더하면 6입니다.' },
];

async function prepare(session) {
  await session.db.initializeDatabase();
  await session.db.saveGeminiApiKey('AIza-synthetic-integration-key');
  await session.db.savePreferredAiModel('gemini-3.5-flash');
  const profile = await session.db.getProfile();
  const topic = await session.db.createTopic('덧셈', '합성 학습 자료', '수학', 'beginner');
  const unit = await session.db.createUnit({ topicId: topic.id, title: '기본 덧셈' });
  const now = new Date().toISOString();
  const source = { id: 'source-synthetic', ownerId: profile.id, kind: 'text', title: '덧셈 노트',
    visibility: 'private', allowExternalProcessing: true, archivedAt: null, createdAt: now };
  const revision = { id: 'revision-synthetic', sourceId: source.id, hash: 'synthetic-hash',
    provenance: 'synthetic test note', originalFileRef: null, createdAt: now };
  const chunk = { id: 'chunk-synthetic', revisionId: revision.id, rawText: '2+2=4. 3+3=6.',
    normalizedText: '2+2=4. 3+3=6.', locator: { kind: 'text' }, extractionStatus: 'success' };
  await session.db.addSource(source, revision, [chunk]);
  return { profile, topic, unit, source, revision, chunk };
}

function generationArgs(session, fixture) {
  return {
    ownerId: fixture.profile.id, topicId: fixture.topic.id, unitId: fixture.unit.id,
    unitTitle: fixture.unit.title, customContext: fixture.chunk.normalizedText,
    sourceRevisionIds: [fixture.revision.id],
    intent: session.generator.analyzeUserIntent('덧셈 문제', fixture.topic.name, {
      learnerLevel: fixture.topic.learnerLevel, targetCount: 2,
    }),
  };
}

test('actual study pipeline generates, persists, resumes, submits idempotently and restores complete backup', async () => {
  const initial = appSession({ response: { questions: providerQuestions } });
  const fixture = await prepare(initial);
  const outcome = await initial.generator.generateFactBasedQuestions(generationArgs(initial, fixture));
  assert.equal(outcome.status, 'READY');
  assert.equal(initial.calls.length, 1);
  assert.match(initial.calls[0].url, /gemini-3.5-flash/);
  assert.ok(initial.calls[0].request.body.includes(fixture.chunk.normalizedText));
  assert.equal(outcome.spec.level, 'comprehend');
  const savedQuestions = await initial.db.getQuestions();
  const savedSpecs = JSON.parse(initial.data.get('@cogniquest:learning_specs'));
  assert.equal(savedQuestions.length, 2);
  assert.equal(savedSpecs.length, 1);
  assert.equal(savedSpecs[0].sourceRevisionIds[0], fixture.revision.id);
  assert.ok(savedQuestions.every(question => question.specId === savedSpecs[0].id));

  const draft = { sessionId: 'pipeline-exam', questions: savedQuestions, currentIndex: 1,
    answers: { 0: savedQuestions[0].answerOptionId,
      1: savedQuestions[1].options.find(option => option.id !== savedQuestions[1].answerOptionId).id } };
  await initial.db.saveActiveExamDraft(draft);

  // A fresh module graph represents process death; only native persisted state survives.
  const restarted = appSession({ data: initial.data, secure: initial.secure });
  await restarted.db.initializeDatabase();
  const resumed = await restarted.db.getActiveExamDraft();
  assert.equal(resumed.currentIndex, 1);
  assert.equal(resumed.answers[0], draft.answers[0]);
  assert.equal(await restarted.db.getGeminiApiKey(), 'AIza-synthetic-integration-key');
  const results = resumed.questions.map((question, index) => ({ question,
    selectedOptionId: resumed.answers[index], isCorrect: resumed.answers[index] === question.answerOptionId }));
  await Promise.all([
    restarted.db.saveExamResults(resumed.sessionId, results),
    restarted.db.saveExamResults(resumed.sessionId, results),
  ]);
  const attempts = await restarted.db.getAttempts();
  const reviews = await restarted.db.getReviewStates();
  assert.equal(attempts.length, 2);
  assert.equal(new Set(attempts.map(attempt => attempt.submissionKey)).size, 2);
  assert.equal(reviews.length, 2);
  assert.equal(reviews.find(review => review.questionRevisionId === savedQuestions[1].id).dueDate,
    restarted.repetition.calculateNextDueDate(1));
  assert.equal((await restarted.db.getIncorrectQuestions()).length, 1);
  assert.equal((await restarted.db.getManualCompletions())[0].unitId, fixture.unit.id);
  assert.equal((await restarted.db.getActiveExamDraft()).submitted, true);
  assert.match(restarted.routine.getLocalDateString(), /^\d{4}-\d{2}-\d{2}$/);

  const backup = await restarted.db.exportBackupJSON();
  assert.ok(!backup.includes('AIza-synthetic-integration-key'));
  const restored = appSession();
  await restored.db.initializeDatabase();
  await restored.db.saveGeminiApiKey('AIza-different-device-key');
  const restoreResult = await restored.db.restoreBackupJSON(backup);
  assert.equal(restoreResult.success, true, restoreResult.message);
  assert.equal((await restored.db.getSources())[0].id, fixture.source.id);
  assert.equal((await restored.db.getSourceRevisions())[0].id, fixture.revision.id);
  assert.equal((await restored.db.getSourceChunks())[0].normalizedText, fixture.chunk.normalizedText);
  assert.equal((await restored.db.getAttempts()).length, 2);
  assert.equal((await restored.db.getReviewStates()).length, 2);
  assert.equal((await restored.db.getActiveExamDraft()).answers[1], draft.answers[1]);
  assert.equal(await restored.db.getGeminiApiKey(), 'AIza-different-device-key');
  assert.equal(restored.calls.length, 0);
});

test('malformed provider answer produces no persistent study changes or additional provider calls', async () => {
  const session = appSession({ response: { questions: [providerQuestions[0], {
    ...providerQuestions[1], correctIndex: 99,
  }] } });
  const fixture = await prepare(session);
  const beforeData = [...session.data].sort();
  const beforeSecure = [...session.secure].sort();
  const outcome = await session.generator.generateFactBasedQuestions(generationArgs(session, fixture));
  assert.equal(outcome.status, 'FAILED');
  assert.equal(session.calls.length, 1);
  assert.deepEqual([...session.data].sort(), beforeData);
  assert.deepEqual([...session.secure].sort(), beforeSecure);
  assert.equal((await session.db.getQuestions()).length, 0);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function setup(existing = new Map()) {
  const data=existing, cache=new Map(); let fail=null, secureFailure=false;
  const storage={getItem:async k=>data.get(k)??null,setItem:async(k,v)=>{if(fail?.(k,v))throw Error('disk full');data.set(k,v);},removeItem:async k=>{if(fail?.(k,null))throw Error('disk full');data.delete(k);}};
  function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const localRequire=n=>{if(n==='@react-native-async-storage/async-storage')return storage;if(n.includes('secure_storage'))return {deleteEncryptedApiKey:async()=>{if(secureFailure)throw Error('secure failure');data.delete('@cogniquest:secure_vault_v1');}};if(n.startsWith('.'))return load(path.resolve(path.dirname(file),n+'.ts'));return require(n);};vm.runInNewContext('(function(require,module,exports){'+source+'\n})',{console,Date,Math,Set,Map,Promise,JSON})(localRequire,m,m.exports);return m.exports;}
  return {data, db:load('src/data/db.ts'),setFailure:f=>fail=f,setSecureFailure:v=>secureFailure=v};
}
const k=n=>'@cogniquest:'+n;
const question={id:'q1',questionId:'q1',revision:1,specId:'spec',stem:'2+2?',options:[{id:'a',text:'4',isDistractor:false},{id:'b',text:'5',isDistractor:true}],answerOptionId:'a',explanation:'Addition',status:'ready_personal',createdAt:new Date().toISOString()};
test('complete backup round trip contains sources/settings/draft but never secret vault',async()=>{
 const s=setup();await s.db.initializeDatabase();const topic=await s.db.createTopic('math','','general','advanced');assert.equal(topic.learnerLevel,'advanced');await s.db.addQuestions([question]);await s.db.addSource({id:'src',ownerId:'owner',kind:'text',title:'note',allowExternalProcessing:true},{id:'rev',sourceId:'src',hash:'h'},[{id:'chunk',revisionId:'rev',rawText:'hi',normalizedText:'hi',locator:{kind:'text'}}]);await s.db.saveActiveExamDraft({sessionId:'exam',questions:[question],currentIndex:0,answers:{0:'a'}});await s.db.savePreferredAiModel('custom');s.data.set(k('secure_vault_v1'),'SECRET');const backup=await s.db.exportBackupJSON();assert.ok(!backup.includes('SECRET'));s.data.set(k('sources'),'[]');assert.equal((await s.db.restoreBackupJSON(backup)).success,true);assert.equal((await s.db.getSources()).length,1);assert.equal((await s.db.getActiveExamDraft()).answers[0],'a');assert.equal(await s.db.getPreferredAiModel(),'custom');assert.equal(s.data.get(k('secure_vault_v1')),'SECRET');
});
test('invalid backup leaves every original value unchanged',async()=>{const s=setup();await s.db.initializeDatabase();const p=JSON.parse(await s.db.exportBackupJSON());p.questions=[{...question,answerOptionId:'missing'}];const before=[...s.data];assert.equal((await s.db.restoreBackupJSON(JSON.stringify(p))).success,false);assert.deepEqual([...s.data],before);});
test('mid-restore failure rolls back all modified keys',async()=>{const s=setup();await s.db.initializeDatabase();const p=JSON.parse(await s.db.exportBackupJSON());p.profile.displayName='NEW';p.topics=[{id:'new',ownerId:'owner',name:'new',description:''}];const before=[...s.data];let once=true;s.setFailure(key=>key===k('questions')&&once?(once=false,true):false);assert.equal((await s.db.restoreBackupJSON(JSON.stringify(p))).success,false);assert.deepEqual([...s.data].sort(),before.sort());});
test('persistent failure leaves durable journal; startup recovers original data',async()=>{const s=setup();await s.db.initializeDatabase();const p=JSON.parse(await s.db.exportBackupJSON());p.topics=[{id:'new',ownerId:'owner',name:'new',description:''}];s.setFailure(key=>key===k('questions'));assert.equal((await s.db.restoreBackupJSON(JSON.stringify(p))).success,false);assert.ok(s.data.has(k('write_journal_v1')));const restarted=setup(s.data);await restarted.db.initializeDatabase();assert.equal((await restarted.db.getTopics()).length,0);assert.ok(!s.data.has(k('write_journal_v1')));});
test('simultaneous repeated exam submission saves once and preserves submitted draft',async()=>{const s=setup();await s.db.initializeDatabase();await s.db.addQuestions([question]);const draft={sessionId:'exam',questions:[question],currentIndex:0,answers:{0:'b'}};await s.db.saveActiveExamDraft(draft);const results=[{question,selectedOptionId:'b',isCorrect:true}];await Promise.all([s.db.saveExamResults('exam',results),s.db.saveExamResults('exam',results)]);assert.equal((await s.db.getAttempts()).length,1);assert.equal((await s.db.getAttempts())[0].isCorrect,false);assert.equal((await s.db.getReviewStates())[0].stage,0);await s.db.saveActiveExamDraft(draft);assert.equal((await s.db.getActiveExamDraft()).submitted,true);});
test('version 2 restoration clears absent collections instead of mixing old sources',async()=>{const s=setup();await s.db.initializeDatabase();const p=JSON.parse(await s.db.exportBackupJSON());p.version=2;delete p.sources;delete p.sourceRevisions;delete p.sourceChunks;s.data.set(k('sources'),'[{"id":"old"}]');assert.equal((await s.db.restoreBackupJSON(JSON.stringify(p))).success,true);assert.deepEqual(JSON.parse(s.data.get(k('sources'))),[]);});
test('clear only app keys and stops before data removal if secure deletion fails',async()=>{const s=setup();await s.db.initializeDatabase();await s.db.createTopic('keep');s.data.set('unrelated','preserved');s.setSecureFailure(true);await assert.rejects(()=>s.db.clearAllData());assert.equal((await s.db.getTopics()).length,1);s.setSecureFailure(false);await s.db.clearAllData();assert.equal(s.data.get('unrelated'),'preserved');assert.equal((await s.db.getTopics()).length,0);});

test('restore then concurrent creation appends to restored collection without losing either write', async () => {
  const s = setup();
  await s.db.initializeDatabase();
  const backup = JSON.parse(await s.db.exportBackupJSON());
  backup.topics = [{ id: 'restored', ownerId: backup.profile.id, name: 'restored', description: '' }];
  const [result] = await Promise.all([
    s.db.restoreBackupJSON(JSON.stringify(backup)),
    s.db.createTopic('after restore'),
  ]);
  assert.equal(result.success, true);
  assert.deepEqual(JSON.parse(s.data.get(k('topics'))).map(t => t.name), ['restored', 'after restore']);
  await Promise.all(Array.from({ length: 8 }, (_, i) => s.db.createTopic(`parallel-${i}`)));
  assert.equal((await s.db.getTopics()).length, 10);
});

test('outline replacement preserves question and answer draft while detaching obsolete unit links', async () => {
  const s = setup();
  await s.db.initializeDatabase();
  const topic = await s.db.createTopic('math');
  const unit = await s.db.createUnit({ topicId: topic.id, title: 'old outline' });
  const q = { ...question, topicId: topic.id, unitId: unit.id };
  await s.db.addQuestions([q]);
  await s.db.markUnitAsCompleted(unit.id);
  await s.db.saveActiveExamDraft({ sessionId: 'exam', questions: [q], currentIndex: 0, answers: { 0: 'a' } });
  await s.db.replaceTopicUnits(topic.id, [{ title: 'new outline' }]);
  assert.equal((await s.db.getQuestions())[0].unitId, undefined);
  assert.equal((await s.db.getQuestions())[0].id, question.id);
  assert.equal((await s.db.getActiveExamDraft()).answers[0], 'a');
  assert.equal((await s.db.getActiveExamDraft()).questions[0].unitId, undefined);
  assert.equal((await s.db.getManualCompletions()).length, 0);
});

test('dedupe remaps questions/completions and retains latest explicit false', async () => {
  const s = setup();
  await s.db.initializeDatabase();
  const topic = await s.db.createTopic('math');
  const first = await s.db.createUnit({ topicId: topic.id, title: 'same' });
  const duplicate = await s.db.createUnit({ topicId: topic.id, title: 'same' });
  await s.db.addQuestions([{ ...question, topicId: topic.id, unitId: duplicate.id }]);
  s.data.set(k('manual_completions'), JSON.stringify([
    { ownerId: topic.ownerId, unitId: first.id, completed: true, changedAt: '2026-09-13T00:00:00.000Z' },
    { ownerId: topic.ownerId, unitId: duplicate.id, completed: false, changedAt: '2026-09-14T00:00:00.000Z' },
  ]));
  await s.db.deduplicateTopicUnits(topic.id);
  assert.equal((await s.db.getUnits()).length, 1);
  assert.equal((await s.db.getQuestions())[0].unitId, first.id);
  assert.equal((await s.db.getManualCompletions())[0].completed, false);
  assert.equal((await s.db.getManualCompletions())[0].unitId, first.id);
});

test('delete unit removes descendants and detaches surviving question reference', async () => {
  const s = setup();
  await s.db.initializeDatabase();
  const topic = await s.db.createTopic('math');
  const parent = await s.db.createUnit({ topicId: topic.id, title: 'parent' });
  const child = await s.db.createUnit({ topicId: topic.id, title: 'child', parentId: parent.id, depth: 2 });
  const grandchild = await s.db.createUnit({ topicId: topic.id, title: 'grandchild', parentId: child.id, depth: 3 });
  await s.db.addQuestions([{ ...question, topicId: topic.id, unitId: grandchild.id }]);
  await s.db.deleteUnit(parent.id);
  assert.equal((await s.db.getUnits()).length, 0);
  assert.equal((await s.db.getQuestions())[0].unitId, undefined);
});

test('source spec and generated questions roll back together when second write fails', async () => {
  const s = setup();
  await s.db.initializeDatabase();
  const topic = await s.db.createTopic('math');
  const spec = { id: 'spec', topicId: topic.id, unitIds: [], sourceRevisionIds: [] };
  let once = true;
  s.setFailure(storageKey => storageKey === k('learning_specs') && once ? (once = false, true) : false);
  await assert.rejects(() => s.db.addQuestions([{ ...question, topicId: topic.id }], spec));
  assert.equal((await s.db.getQuestions()).length, 0);
  await s.db.addQuestions([{ ...question, topicId: topic.id }], spec);
  assert.equal(JSON.parse(s.data.get(k('learning_specs')))[0].id, 'spec');
});

test('invalid profile/routine dates and duplicate draft questions are rejected without writes', async () => {
  const s = setup();
  await s.db.initializeDatabase();
  const original = await s.db.exportBackupJSON();
  for (const change of [
    p => { p.profile.createdAt = '2026-02-30T12:00:00Z'; },
    p => { p.routine.effectiveDate = '2026-13-01'; },
    p => { p.routine.ownerId = 'another-profile'; },
    p => { p.profile.id = ''; },
    p => { p.activeExam = { sessionId: 'dup', questions: [question, question], currentIndex: 0, answers: {} }; },
  ]) {
    const candidate = JSON.parse(original);
    change(candidate);
    const before = [...s.data];
    assert.equal((await s.db.restoreBackupJSON(JSON.stringify(candidate))).success, false);
    assert.deepEqual([...s.data], before);
  }
});

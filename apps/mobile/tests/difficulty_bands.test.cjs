// 레벨 구간표(1~30 10구간, 31+ 도전 6구간), 구간 안 단계, 과목별 레벨 기준,
// 출제·목차 지시문 반영과 빈칸형 화면 표시 규칙을 확인한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '../src/domain');
const cache = new Map();

function load(name) {
  const file = path.resolve(ROOT, `${name}.ts`);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  cache.set(file, module.exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, JSON, Math,
    require: (dep) => (dep.startsWith('./') || dep.startsWith('../')) && !dep.includes('/contracts/')
      ? load(dep.replace(/^\.\//, '').replace(/^\.\.\//, '../'))
      : new Proxy({}, { get: () => undefined }),
  }, { filename: file });
  cache.set(file, module.exports);
  return module.exports;
}

const difficulty = load('difficulty');
const { buildQuestionGenerationPrompt, buildCurriculumPrompt } = load('prompts');
const cloze = load('cloze_display');

const ladder = Array.from({ length: 11 }, (_, i) => `기준${i + 1}`);
const promptFor = (difficultyLevel, questionTypePlan, extra = {}) => buildQuestionGenerationPrompt({
  intent: { targetCount: questionTypePlan.length, difficultyLevel, focusConcepts: ['핵심'], questionTypeMode: 'mixed' },
  resolvedDomain: '테스트 주제',
  questionTypePlan,
  ...extra,
});

test('difficulty: 1~30은 3레벨씩 10구간, 31부터 3레벨씩 도전 구간, 46부터는 끝이 없다', () => {
  const standard = difficulty.DIFFICULTY_BANDS.filter((band) => band.start <= 30);
  assert.equal(standard.length, 10);
  standard.forEach((band, index) => {
    assert.equal(band.start, index * 3 + 1);
    assert.equal(band.end, index * 3 + 3);
  });
  const challenge = difficulty.DIFFICULTY_BANDS.filter((band) => band.start >= 31)
    .map((band) => [band.start, band.end, band.label]);
  assert.deepEqual(JSON.parse(JSON.stringify(challenge)), [
    [31, 33, '도전 1'], [34, 36, '도전 2'], [37, 39, '도전 3'],
    [40, 42, '도전 4'], [43, 45, '도전 5'], [46, null, '도전 최고'],
  ]);
  assert.equal(difficulty.getDifficultyProfile(1).bandLabel, '첫걸음');
  assert.equal(difficulty.getDifficultyProfile(30).bandLabel, '목표 완성');
  assert.equal(difficulty.getDifficultyProfile(99).bandLabel, '도전 최고');
});

test('difficulty: 구간 안 단계는 첫·중간·마지막으로 나뉘고, 46 이상은 단계 없이 유지된다', () => {
  assert.deepEqual([4, 5, 6].map((level) => difficulty.getDifficultyProfile(level).bandStep.position), [1, 2, 3]);
  assert.equal(difficulty.getDifficultyProfile(4).bandStep.total, 3);
  assert.match(difficulty.getDifficultyProfile(4).bandStep.guide, /가장 쉬운 형태/);
  assert.match(difficulty.getDifficultyProfile(5).bandStep.guide, /그대로 적용/);
  assert.match(difficulty.getDifficultyProfile(6).bandStep.guide, /조금 더 까다롭게/);
  assert.equal(difficulty.getDifficultyProfile(46).bandStep, undefined);
  assert.equal(difficulty.getDifficultyProfile(60).bandStep, undefined);
});

test('difficulty: 구간 마지막 레벨만 다음 구간 요소를 미리 가진다', () => {
  assert.equal(difficulty.getDifficultyProfile(2).nextBandLoad, undefined);
  assert.equal(difficulty.getDifficultyProfile(3).nextBandLoad, difficulty.getDifficultyProfile(4).load);
  assert.equal(difficulty.getDifficultyProfile(30).nextBandLoad, difficulty.getDifficultyProfile(31).load);
  assert.equal(difficulty.getDifficultyProfile(45).nextBandLoad, difficulty.getDifficultyProfile(46).load);
  assert.equal(difficulty.getDifficultyProfile(46).nextBandLoad, undefined);
});

test('difficulty: 과목별 기준 항목 번호와 저장용 인지 단계·기존 수준 매핑은 유지된다', () => {
  assert.deepEqual([1, 3, 4, 28, 30, 31, 50].map((level) => difficulty.getDifficultyProfile(level).ladderIndex), [0, 0, 1, 9, 9, 10, 10]);
  assert.deepEqual([2, 3, 10, 11, 16, 26].map((level) => difficulty.getDifficultyProfile(level).cognitiveLevel),
    ['recall', 'comprehend', 'comprehend', 'apply', 'analyze', 'synthesize']);
  assert.deepEqual([6, 7, 15, 16, 24, 25].map(difficulty.difficultyToLegacyLevel),
    ['beginner', 'basic', 'basic', 'advanced', 'advanced', 'master']);
});

test('difficulty: 과목별 레벨 기준은 11개의 비어 있지 않은 짧은 문장일 때만 인정한다', () => {
  assert.deepEqual(difficulty.normalizeDifficultyLadder(ladder.map((entry) => ` ${entry} `)), ladder);
  assert.equal(difficulty.normalizeDifficultyLadder(ladder.slice(0, 10)), undefined);
  assert.equal(difficulty.normalizeDifficultyLadder([...ladder.slice(0, 10), '  ']), undefined);
  assert.equal(difficulty.normalizeDifficultyLadder([...ladder.slice(0, 10), 'a'.repeat(201)]), undefined);
  assert.equal(difficulty.normalizeDifficultyLadder('기준'), undefined);
});

test('prompts: 난이도 기준에 레벨 의미·구간 단계·출제 유형별 기준만 넣고 채점 범위는 넓히지 않는다', () => {
  const prompt = promptFor(2, ['multiple_choice', 'cloze']);
  assert.match(prompt, /\[난이도 기준\]/);
  assert.match(prompt, /레벨 2 · 첫걸음 \(레벨 1~3 구간\)/);
  assert.match(prompt, /레벨 30은 원문 주제가 목표로 하는 수준/);
  assert.match(prompt, /3단계 중 2단계/);
  assert.match(prompt, /레벨이 1 오를 때마다 선행지식과 사고 부담을 조금씩만 높입니다/);
  assert.match(prompt, /  - 객관식: 오답 보기는 누가 봐도/);
  assert.match(prompt, /  - 빈칸형: 빈칸 1개/);
  assert.ok(!/  - 서술형:/.test(prompt), '출제하지 않는 유형 기준은 넣지 않는다');
  assert.ok(!/  - 단답형:/.test(prompt));
  assert.match(prompt, /정답 인정 범위를 넓히지 않습니다/);
  assert.ok(!prompt.includes('다음 구간 요소를 가볍게 섞습니다'), '구간 중간 레벨은 미리보기가 없다');
});

test('prompts: 구간 마지막 레벨은 다음 구간 요소를 한 문항에만 섞고, 도전 레벨은 정답 유일성을 지킨다', () => {
  assert.match(promptFor(3, ['essay']), /문항 하나에만 다음 구간 요소를 가볍게 섞습니다: 두 개념 중 맞는 것을 구별하는 문제/);
  const challenge = promptFor(31, ['multiple_choice', 'multiple_choice', 'multiple_choice']);
  assert.match(challenge, /레벨 31 · 도전 1 \(레벨 31~33 구간\)/);
  assert.match(challenge, /정답이 하나로 정해져야/);
  assert.ok(!challenge.includes('난이도만 무한히'), '도전 레벨에 난이도 상승을 막는 옛 문구가 없어야 한다');
  assert.match(promptFor(50, ['cloze']), /레벨 46 이상 구간/);
});

test('prompts: 과목별 레벨 기준이 있으면 해당 구간 문장을 넣고, 형식이 틀리면 공통 기준만 쓴다', () => {
  assert.match(promptFor(5, ['cloze'], { difficultyLadder: ladder }), /이 과목의 레벨 4~6 내용 기준: 기준2/);
  assert.match(promptFor(35, ['cloze'], { difficultyLadder: ladder }), /이 과목의 레벨 31 이상 내용 기준: 기준11/);
  assert.ok(!promptFor(5, ['cloze'], { difficultyLadder: ['짧음'] }).includes('내용 기준:'));
  assert.ok(!promptFor(5, ['cloze']).includes('내용 기준:'));
});

test('prompts: 빈칸형은 채울 대상과 수·식 답의 형식, 같은 값의 다른 표기를 요구한다', () => {
  const prompt = promptFor(10, ['cloze']);
  assert.match(prompt, /빈칸에 무엇을 채워야 하는지 드러나게/);
  assert.match(prompt, /답의 형식\(예: 정수, 기약분수\)/);
  assert.match(prompt, /3\/2와 1\.5/);
});

test('prompts: 목차 지시문은 요청할 때만 11개 과목별 레벨 기준을 함께 받는다', () => {
  const base = { topicName: '한문 3급', difficultyLevel: 1 };
  const without = buildCurriculumPrompt(base);
  assert.ok(!without.includes('difficultyLadder'));
  assert.match(without, /시작 난이도: 레벨 1 · 첫걸음 \(레벨 1~3 구간\)/);
  const withLadder = buildCurriculumPrompt({ ...base, includeDifficultyLadder: true });
  assert.match(withLadder, /정확히 11개 문자열/);
  assert.match(withLadder, /1\) 레벨 1~3, .*10\) 레벨 28~30, 11\) 레벨 31 이상/);
  const example = withLadder.match(/"difficultyLadder": (\[[^\]]*\])/);
  assert.ok(example, 'JSON 예시에 difficultyLadder가 있어야 한다');
  assert.equal(JSON.parse(example[1]).length, 11);
});

test('cloze_display: 빈칸은 [빈칸 n]으로 보여 수식 괄호와 구별된다', () => {
  assert.equal(cloze.formatClozeStemForDisplay('3P({{1}}) = {{2}}임을'), '3P([빈칸 1]) = [빈칸 2]임을');
  assert.equal(cloze.formatClozeStemForDisplay('빈칸 없는 문장'), '빈칸 없는 문장');
});

test('cloze_display: 수·식 답만 있으면 수·식 안내, 명칭형 답이 하나라도 있으면 정식 명칭 안내', () => {
  const blanks = (...answers) => answers.map((list) => ({ correctAnswers: list }));
  assert.equal(cloze.getClozeAnswerNotice(blanks(['10'])), cloze.CLOZE_VALUE_NOTICE);
  assert.equal(cloze.getClozeAnswerNotice(blanks(['2'], ['15', '15.0'])), cloze.CLOZE_VALUE_NOTICE);
  assert.equal(cloze.getClozeAnswerNotice(blanks(['x+1'], ['3/2', '1.5'])), cloze.CLOZE_VALUE_NOTICE);
  assert.equal(cloze.getClozeAnswerNotice(blanks(['Physical AI'])), cloze.CLOZE_NAME_NOTICE);
  assert.equal(cloze.getClozeAnswerNotice(blanks(['2'], ['시·도경찰청장'])), cloze.CLOZE_NAME_NOTICE);
  assert.equal(cloze.getClozeAnswerNotice([]), cloze.CLOZE_NAME_NOTICE);
});

test('prompts: 레벨 16부터 내용 깊이 규칙과 극단 표현 오답 금지를 넣고, 검산 규칙은 모든 레벨에 넣는다', () => {
  const low = promptFor(15, ['multiple_choice', 'short_answer']);
  assert.ok(!low.includes('지문을 길게 늘이거나'));
  assert.ok(!low.includes('극단적인 표현'));

  const high = promptFor(30, ['multiple_choice', 'short_answer']);
  assert.match(high, /지문을 길게 늘이거나 표현만 어렵게 바꾸는 방식으로 난이도를 올리지 않습니다/);
  assert.match(high, /기초 용어 하나만 묻는 문제는 내지 않습니다/);
  assert.match(high, /'항상', '절대', '반드시', '모든', '예외 없는'/);
  // 객관식을 출제하지 않으면 오답 보기 규칙은 넣지 않는다.
  assert.ok(!promptFor(30, ['essay']).includes('극단적인 표현'));

  for (const level of [1, 16, 31]) {
    assert.match(promptFor(level, ['short_answer']), /16\. 계산이나 여러 단계 풀이가 필요한 문제는 정답.*다시 계산해 검산/);
  }
});

test('difficulty: 서술형 채점 요소 개수는 레벨별 숫자로 정하고, 출력 예시도 그 개수를 따른다', () => {
  const guide = (level) => difficulty.getDifficultyProfile(level).typeGuides.essay;
  assert.match(guide(1), /gradingChecklist는 정확히 2개로 씁니다/);
  assert.match(guide(9), /정확히 3개/);
  assert.match(guide(16), /3~4개/);
  assert.match(guide(30), /정확히 4개/);
  assert.match(guide(31), /4~5개/);
  assert.match(guide(60), /4~5개/);
  for (const band of difficulty.DIFFICULTY_BANDS) {
    const [min, max] = band.essayChecklist;
    assert.ok(min >= 2 && max <= 5 && min <= max, `${band.label}: 검증 범위 2~5 안이어야 한다`);
  }

  const checklistOf = (prompt) => {
    const block = prompt.match(/"gradingChecklist": \[([\s\S]*?)\]/)[1];
    return JSON.parse(`[${block}]`);
  };
  const low = checklistOf(promptFor(2, ['essay']));
  assert.equal(low.length, 2);
  const high = checklistOf(promptFor(30, ['essay']));
  assert.equal(high.length, 4);
  for (const list of [low, high, checklistOf(promptFor(9, ['essay']))]) {
    assert.equal(list.reduce((sum, item) => sum + item.points, 0), 100);
  }
});

test('cloze_display·ladder: 한자만 있는 답은 명칭형으로, 수식 기호 답은 수·식으로 보고, 예시 문구를 베낀 기준은 버린다', () => {
  const blanks = (...answers) => answers.map((list) => ({ correctAnswers: list }));
  assert.equal(cloze.getClozeAnswerNotice(blanks(['山'])), cloze.CLOZE_NAME_NOTICE);
  assert.equal(cloze.getClozeAnswerNotice(blanks(['√2', '2√3'])), cloze.CLOZE_VALUE_NOTICE);
  assert.equal(cloze.getClozeAnswerNotice(blanks(['3×4'])), cloze.CLOZE_VALUE_NOTICE);

  const copied = difficulty.describeLadderRanges().map((range) => `${range} 기준 한 문장`);
  assert.equal(difficulty.normalizeDifficultyLadder(copied), undefined);
  assert.deepEqual(difficulty.normalizeDifficultyLadder(ladder), ladder);
});

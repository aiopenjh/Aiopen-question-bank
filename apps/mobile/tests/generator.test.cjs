const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

function isSupportedGeminiModel(model) {
  const match = String(model).trim().toLowerCase().match(/^gemini-(\d+)(?:\.(\d+))?(?:-|$)/);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2] || 0);
  return major > 3 || (major === 3 && minor >= 5);
}

function harness(fetchImpl = async () => { throw new Error('unexpected provider call'); }, options = {}) {
  const { model = '', key = 'AIza-synthetic-key' } = options;
  const cache = {};
  let id = 0;

  function load(relative) {
    const filename = path.resolve(__dirname, '../src/domain', `${relative}.ts`);
    if (cache[filename]) return cache[filename].exports;

    const module = { exports: {} };
    cache[filename] = module;
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText;

    vm.runInNewContext(code, {
      module,
      exports: module.exports,
      AbortController,
      // 기존 객관식 fixture와 일치하는 추첨을 재현한다. 다른 추첨은 별도 케이스로 검증한다.
      Math: filename.endsWith('question_type_plan.ts')
        ? Object.assign(Object.create(Math), { random: options.planRandom || (() => 0) }) : Math,
      clearTimeout,
      console: {
        error: (...args) => options.logs?.push(args.join(' ')),
        log: (...args) => options.logs?.push(args.join(' ')),
        warn: (...args) => options.logs?.push(args.join(' ')),
      },
      fetch: fetchImpl,
      setTimeout,
      require: (name) => name === '../data/db'
        ? {
            DEFAULT_GEMINI_MODEL,
            generateUUID: () => String(++id),
            getCurrentISOTime: () => '2026-09-14T00:00:00.000Z',
            getGeminiApiKey: async () => key,
            getAttempts: async () => options.attempts || [],
            getPreferredAiModel: async () => model,
            isSupportedGeminiModel,
          }
        : load(name),
    }, { filename });

    return module.exports;
  }

  return load('generator');
}

function question(overrides = {}) {
  return {
    stem: '2 + 2 = ?',
    explanation: '2에 2를 더하면 4입니다.',
    correctOptionNumber: 2,
    options: ['3', '4', '5', '6'].map((text) => ({ text })),
    deepReasoningHint: '두 수를 순서대로 하나씩 더해 보세요.',
    ...overrides,
  };
}

test('all generation calls gate locked challenge levels and 5-question challenges before provider access', async () => {
  const generator = harness(); // unexpected provider calls throw
  for (const [difficultyLevel, targetCount] of [[50, 3], [32, 3], [31, 5]]) {
    const params = args(generator, targetCount);
    params.intent = generator.analyzeUserIntent('덧셈', undefined, { difficultyLevel, targetCount });
    const outcome = await generator.generateFactBasedQuestions(params);
    assert.equal(outcome.status, 'FAILED');
    assert.match(outcome.message, /3문제/);
  }
});

function args(generator, targetCount = 1) {
  return {
    ownerId: 'synthetic',
    topicId: 'math',
    topicName: '덧셈',
    intent: generator.analyzeUserIntent('덧셈', undefined, { targetCount }),
  };
}

function providerPayload(questions = [question()]) {
  return { intentStatus: 'READY', questions };
}

function response(value) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }],
    }),
  };
}

test('rejects incomplete, duplicate, and invalid generated questions', () => {
  const generator = harness();
  const variants = [
    () => null,
    () => ({ questions: [] }),
    () => ({ questions: [question({ stem: '' })] }),
    () => ({ questions: [question({ explanation: ' ' })] }),
    () => ({ questions: [question({ options: question().options.slice(0, 3) })] }),
    () => ({ questions: [question({ options: [...question().options, { text: '7' }] })] }),
    () => ({ questions: [question({ options: [{ text: '' }, ...question().options.slice(1)] })] }),
    () => ({ questions: [question({ options: [{ text: ' 4 ' }, ...question().options.slice(1)] })] }),
    () => ({ questions: [question({ correctOptionNumber: 1.5 })] }),
    () => ({ questions: [question({ correctOptionNumber: 0 })] }),
    () => ({ questions: [question({ correctOptionNumber: 5 })] }),
    () => ({ questions: [{ ...question(), correctOptionNumber: undefined }] }),
    () => ({ questions: [question({ deepReasoningHint: undefined })] }),
    () => ({ questions: [question({ deepReasoningHint: '   ' })] }),
    () => ({ questions: [question({ deepReasoningHint: 'x'.repeat(201) })] }),
    () => ({ questions: [question({ deepReasoningHint: '정답은 2번입니다.' })] }),
    () => ({
      questions: [
        question({
          options: ['덧셈', '뺄셈', '곱셈', '나눗셈'].map((text) => ({ text })),
          correctOptionNumber: 1,
          deepReasoningHint: '핵심 연산 개념은 덧셈과 관련됩니다.',
        }),
      ],
    }),
  ];

  for (const makeValue of variants) {
    assert.throws(() => generator.validateGeneratedQuestions(makeValue(), 1));
  }

  assert.throws(() => generator.validateGeneratedQuestions({
    questions: [question(), question({ stem: '  2 + 2 = ?  ' })],
  }, 2), /동일한 문제/);
  assert.throws(() => generator.parseAiJsonResponse('{broken'));
});

test('valid generation preserves all four options, the correct answer, and structural validation', async () => {
  const generator = harness(async () => response(providerPayload()));
  const result = await generator.generateFactBasedQuestions(args(generator));

  assert.equal(result.status, 'READY');
  assert.equal(result.spec.sourceRevisionIds.length, 0);
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].options.length, 4);
  assert.deepEqual(
    Array.from(result.questions[0].options, (option) => option.text).sort(),
    ['3', '4', '5', '6']
  );
  assert.equal(
    result.questions[0].options.find((option) => option.id === result.questions[0].answerOptionId).text,
    '4'
  );
  assert.equal(result.validations[0].checkType, 'syntax_integrity');
  assert.equal(result.validations[0].reviewerKind, 'rule_engine');
});

test('PDF pages are attached only to the Gemini generation request', async () => {
  let requestBody;
  const generator = harness(async (_url, request) => {
    requestBody = JSON.parse(request.body);
    return response(providerPayload());
  });
  const result = await generator.generateFactBasedQuestions({
    ...args(generator),
    documentInput: {
      mimeType: 'application/pdf',
      base64Data: 'JVBERi0xLjQK',
      fileName: 'study.pdf',
      pageStart: 1,
      pageEnd: 5,
      sourceId: 'pdf-source',
      sourceRevisionId: 'pdf-revision',
    },
  });

  assert.equal(result.status, 'READY');
  assert.deepEqual(Array.from(result.spec.sourceRevisionIds), ['pdf-revision']);
  assert.equal(requestBody.contents[0].parts[1].inlineData.mimeType, 'application/pdf');
  assert.equal(requestBody.contents[0].parts[1].inlineData.data, 'JVBERi0xLjQK');
  assert.match(requestBody.contents[0].parts[0].text, /1~5페이지/);
});

test('generation follows all-subjective or all-cloze draws even at entry difficulty', async () => {
  for (const [draws, type] of [
    [[0.45, 0.1], 'short_answer'], [[0.45, 0.8], 'essay'], [[0.9], 'cloze'],
  ]) {
    let cursor = 0;
    let sentPrompt;
    const questions = Array.from({ length: 3 }, (_, i) => ({
      questionType: type,
      stem: type === 'cloze' ? `수도 ${i + 1}: {{1}}` : `수도 문제 ${i + 1}`,
      modelAnswer: '서울',
      blanks: [{ correctAnswers: ['서울'] }],
      gradingChecklist: [{ criterion: '국가 식별', points: 50 }, { criterion: '도시 식별', points: 50 }],
      explanation: '대한민국의 수도는 서울입니다.',
      deepReasoningHint: '나라의 행정 중심지를 떠올려 보세요.',
    }));
    const generator = harness(async (_url, request) => {
      sentPrompt = JSON.parse(request.body).contents[0].parts[0].text;
      return response(providerPayload(questions));
    }, { planRandom: () => draws[cursor++ % draws.length] });
    const params = args(generator, 3);
    params.intent = generator.analyzeUserIntent('덧셈', undefined, { difficultyLevel: 1, targetCount: 3 });
    const result = await generator.generateFactBasedQuestions(params);
    assert.equal(result.status, 'READY', result.message);
    assert.deepEqual(Array.from(result.questions, question => question.questionType), Array(3).fill(type));
    assert.ok(sentPrompt.includes(JSON.stringify(Array(3).fill(type))));
    assert.ok(!sentPrompt.includes('30%'));
  }
});

test('generation rejects an AI response replacing the drawn cloze type with multiple choice', async () => {
  const generator = harness(async () => response(providerPayload()), { planRandom: () => 0.9 });
  const result = await generator.generateFactBasedQuestions(args(generator));
  assert.equal(result.status, 'FAILED');
  assert.match(result.message, /추첨된 문제 유형/);
});

test('provider HTTP failures expose neither the API key nor the provider response body', async () => {
  const providerSecret = 'secret-provider-body';
  const apiKey = 'AIza-secret-synthetic-key';
  let bodyRead = false;
  let calls = 0;
  const generator = harness(async (url, request) => {
    calls += 1;
    assert.ok(!url.includes(apiKey));
    assert.equal(request.headers['x-goog-api-key'], apiKey);
    return {
      ok: false,
      status: 418,
      text: async () => { bodyRead = true; return providerSecret; },
    };
  }, { key: apiKey });

  const result = await generator.generateFactBasedQuestions(args(generator));
  assert.equal(result.status, 'FAILED');
  assert.equal(calls, 1);
  assert.equal(bodyRead, false);
  assert.ok(!result.message.includes(apiKey));
  assert.ok(!result.message.includes(providerSecret));
});

test('Gemini model selection never falls below the 3.5 baseline', async () => {
  for (const [preferred, expected] of [
    ['', 'gemini-3.5-flash-lite'],
    ['gemini-2.5-flash', 'gemini-3.5-flash-lite'],
    ['gpt-4o-mini', 'gemini-3.5-flash-lite'],
    ['gemini-3.5-flash', 'gemini-3.5-flash-lite'],
    ['gemini-3.7-flash', 'gemini-3.5-flash-lite'],
  ]) {
    const requestedModels = [];
    const generator = harness(async (url) => {
      requestedModels.push(url.match(/models\/([^:]+):/)[1]);
      return response(providerPayload());
    }, { model: preferred });

    const result = await generator.generateFactBasedQuestions(args(generator));
    assert.equal(result.status, 'READY');
    assert.deepEqual(requestedModels, [expected]);
    assert.ok(isSupportedGeminiModel(requestedModels[0]));
  }
});

test('exhausted Gemini candidates return safe quota guidance without provider details', async () => {
  let calls = 0;
  const generator = harness(async () => {
    calls++;
    return { ok: false, status: 429, headers: { get: () => '30' } };
  });
  const result = await generator.generateFactBasedQuestions(args(generator));
  assert.equal(result.status, 'FAILED');
  assert.equal(calls, 5);
  assert.match(result.message, /AI 호출에 실패했습니다/);
  assert.doesNotMatch(result.message, /Gemini|429|Google AI Studio/);
  assert.doesNotMatch(result.message, /\[AI 출제 실패\]/);
  assert.match(result.message, /기존 문제와 학습 데이터는 그대로 유지/);
});

test('malformed and semantically rejected provider responses never become READY', async () => {
  const values = [
    { intentStatus: 'READY', questions: [] },
    { intentStatus: 'READY' },
    {},
    null,
    { intentStatus: 'UNKNOWN', questions: [question()] },
  ];

  for (const value of values) {
    const generator = harness(async () => response(value));
    assert.equal((await generator.generateFactBasedQuestions(args(generator))).status, 'FAILED');
  }

  const generator = harness(async () => response({
    intentStatus: 'REJECTED',
    message: '학습 주제를 확인할 수 없습니다.',
    clarificationChoices: [],
  }));
  assert.equal((await generator.generateFactBasedQuestions(args(generator))).status, 'REJECTED');
});

test('validated questions retain trimmed optional explanations and hints', async () => {
  const item = question({
    conceptDefinition: ' 덧셈은 수량을 합칩니다. ',
    deepReasoningHint: ' 하나씩 세어 보세요. ',
  });
  const generator = harness(async () => response(providerPayload([item])));
  const result = await generator.generateFactBasedQuestions(args(generator));

  assert.equal(result.status, 'READY');
  assert.equal(result.questions[0].conceptDefinition, '덧셈은 수량을 합칩니다.');
  assert.equal(result.questions[0].deepReasoningHint, '하나씩 세어 보세요.');
});

test('transport and JSON decoder exceptions do not expose raw provider secrets', async () => {
  const cases = [
    {
      secret: 'secret-transport-detail',
      fetchImpl: async () => { throw new Error('secret-transport-detail'); },
    },
    {
      secret: 'secret-decoder-detail',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => { throw new Error('secret-decoder-detail'); },
      }),
    },
  ];

  for (const { secret, fetchImpl } of cases) {
    const logs = [];
    const generator = harness(fetchImpl, { logs });
    const result = await generator.generateFactBasedQuestions(args(generator));

    assert.equal(result.status, 'FAILED');
    assert.ok(!result.message.includes(secret));
    assert.ok(!logs.join('\n').includes(secret));
    assert.match(result.message, /API 서버와 통신할 수 없습니다/);
    assert.match(logs.join('\n'), /connection_or_provider/);
  }
});

test('concurrent identical generation requests share one in-flight provider call', async () => {
  let calls = 0;
  const generator = harness(async () => {
    calls += 1;
    return response(providerPayload());
  });

  const params = args(generator);
  const first = generator.generateFactBasedQuestions(params);
  const second = generator.generateFactBasedQuestions(params);
  assert.equal(first, second);

  const results = await Promise.all([first, second]);

  assert.deepEqual(Array.from(results, (result) => result.status), ['READY', 'READY']);
  assert.equal(calls, 1);

  assert.equal((await generator.generateFactBasedQuestions(params)).status, 'READY');
  assert.equal(calls, 2);
});

test('question type mode drives the plan, the prompt and response validation', async () => {
  const subjective = (type, i) => ({
    questionType: type, stem: `수도 문제 ${i + 1}`, modelAnswer: '서울',
    gradingChecklist: [{ criterion: '국가 식별', points: 50 }, { criterion: '도시 식별', points: 50 }],
    explanation: '대한민국의 수도는 서울입니다.', deepReasoningHint: '나라의 행정 중심지를 떠올려 보세요.',
  });
  const run = async (mode, draw, questions) => {
    let sentPrompt;
    const generator = harness(async (_url, request) => {
      sentPrompt = JSON.parse(request.body).contents[0].parts[0].text;
      return response(providerPayload(questions));
    }, { planRandom: () => draw });
    const params = args(generator, 3);
    params.intent = generator.analyzeUserIntent('덧셈', undefined, { difficultyLevel: 1, targetCount: 3, questionTypeMode: mode });
    return { result: await generator.generateFactBasedQuestions(params), sentPrompt };
  };

  // 객관식만: 혼합이었다면 빈칸형이 뽑히는 값이어도 전부 객관식
  const mcQuestions = [1, 2, 3].map((n) => question({ questionType: 'multiple_choice', stem: `${n} + ${n} = ?` }));
  const mc = await run('multiple_choice', 0.9, mcQuestions);
  assert.equal(mc.result.status, 'READY', mc.result.message);
  assert.deepEqual(Array.from(mc.result.questions, q => q.questionType), Array(3).fill('multiple_choice'));
  assert.ok(mc.sentPrompt.includes(JSON.stringify(Array(3).fill('multiple_choice'))));

  // 주관식만: 혼합이었다면 객관식이 뽑히는 값이어도 단답형·서술형만, 객관식 응답은 거부
  const short = await run('subjective', 0, [0, 1, 2].map(i => subjective('short_answer', i)));
  assert.equal(short.result.status, 'READY', short.result.message);
  assert.deepEqual(Array.from(short.result.questions, q => q.questionType), Array(3).fill('short_answer'));
  assert.ok(short.sentPrompt.includes(JSON.stringify(Array(3).fill('short_answer'))));
  const rejected = await run('subjective', 0, mcQuestions);
  assert.equal(rejected.result.status, 'FAILED');
  assert.match(rejected.result.message, /문제 유형/);
});

test('opinion-type subjective output is not saved: regenerate once with the same plan, then explain instead of switching type', async () => {
  const subjective = (stem, i) => ({
    questionType: 'essay', stem: `${stem} (${i + 1})`, modelAnswer: '정언명령은 조건 없이 따라야 하는 도덕 법칙이다.',
    gradingChecklist: [{ criterion: '무조건적 명령임을 설명함', points: 50 }, { criterion: '보편화 가능성을 설명함', points: 50 }],
    explanation: '칸트 윤리학의 핵심 개념입니다.', deepReasoningHint: '가언명령과 비교해 보세요.',
  });
  const opinion = [0, 1, 2].map(i => subjective('의무론과 공리주의 중 어떤 윤리관이 더 옳은가', i));
  const objective = [0, 1, 2].map(i => subjective('칸트의 정언명령 개념을 설명하시오', i));
  const run = async (responses) => {
    const prompts = [];
    const generator = harness(async (_url, request) => {
      prompts.push(JSON.parse(request.body).contents[0].parts[0].text);
      return response(providerPayload(responses[Math.min(prompts.length - 1, responses.length - 1)]));
    }, { planRandom: () => 0.9 });
    const params = args(generator, 3);
    params.intent = generator.analyzeUserIntent('윤리', undefined, { difficultyLevel: 1, targetCount: 3, questionTypeMode: 'subjective' });
    return { result: await generator.generateFactBasedQuestions(params), prompts };
  };

  const retried = await run([opinion, objective]);
  assert.equal(retried.result.status, 'READY', retried.result.message);
  assert.equal(retried.prompts.length, 2);
  assert.equal(retried.prompts[0], retried.prompts[1]); // 같은 유형 계획으로 다시 요청
  assert.ok(retried.result.questions.every(q => q.questionType === 'essay' && q.stem.startsWith('칸트')));
  assert.match(retried.prompts[0], /14\. 단답형·서술형은 정의·원리·사실·절차처럼 객관적으로 확인할 수 있는/);
  assert.match(retried.prompts[0], /13\. 좌표계의 축 방향·원점 위치/);

  const failed = await run([opinion]);
  assert.equal(failed.prompts.length, 2);
  assert.equal(failed.result.status, 'FAILED');
  assert.match(failed.result.message, /객관적으로 채점할 수 있는 주관식 문제를 만들지 못했습니다\(1번/);
  assert.equal(failed.result.questions, undefined);
});

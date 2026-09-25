// "맞았는데 계속 50점" 회귀 테스트(고객 좌표계 사례).
// A. 문항별 50점: 서술형 체크리스트 2항목(각 50점) 중 1개만 충족으로 처리되는 경로
// B. 시험 전체 50점: 부분점수를 합산하지 않고 '100점 문항 수 / 전체 문항 수'로 계산하던 문제
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');

function compile(file, requireImpl, extra = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, require: requireImpl, ...extra }, { filename: file });
  return module.exports;
}

// 고객 사례(좌표계 문항)와 같은 구조의 서술형
const essay = {
  id: 'q-essay', questionId: 'q-essay', questionType: 'essay', options: [], answerOptionId: '',
  stem: '게임 화면에서 원점이 보통 어디에 있는지, 원점에서 X축과 Y축 값이 어떻게 변하는지 서술하시오.',
  modelAnswer: '원점은 화면 왼쪽 위(0,0)이며 오른쪽으로 갈수록 X, 아래쪽으로 갈수록 Y가 커진다.',
  gradingChecklist: [
    { id: 'c1', criterion: '원점이 화면 왼쪽 위(0,0)라고 설명함', points: 50 },
    { id: 'c2', criterion: 'X는 오른쪽, Y는 아래쪽으로 갈수록 커진다고 설명함', points: 50 },
  ],
  explanation: '화면 좌표계 설명',
};
const answer = 'Win32의 경우 왼쪽위가 원점 dx의경우 중앙이 원점 x+는 오른쪽 y+는 위쪽(win32는 y+가 아래쪽)';

function gradingWith(responseText) {
  const prompts = [];
  const grading = compile(path.join(ROOT, 'src/domain/grading.ts'), name => {
    if (name === '../data/db') return { getGeminiApiKey: async () => 'test-key-123456' };
    if (name === './ai_client') {
      return {
        callUniversalAiCompletion: async (_key, prompt) => { prompts.push(prompt); return { text: responseText }; },
        parseAiJsonResponse: JSON.parse,
      };
    }
    if (name === './generator_validation') return { normalizeComparableText: text => text };
    throw new Error(`Unexpected dependency ${name}`);
  });
  return { grading, prompts };
}

test('A1: AI가 두 번째 항목을 미충족으로 판정하면 판정대로 50점, 채점 지시문에는 괄호·여러 환경 판정 기준이 있다', async () => {
  const { grading, prompts } = gradingWith(JSON.stringify({ checklistResult: [{ id: 'c1', met: true }, { id: 'c2', met: false }] }));
  const result = await grading.gradeSubjectiveAnswer(essay, answer);
  assert.equal(result.gradingStatus, 'graded');
  assert.equal(result.gradingScore, 50);
  assert.match(prompts[0], /괄호, 부연 설명, 예시 안에 쓴 내용도 답안의 일부/);
  assert.match(prompts[0], /여러 환경이나 기준\(예: Win32 화면 좌표와 DirectX 좌표\)/);
  assert.match(prompts[0], /사실과 반대로 설명했거나 항목의 핵심 요소가 답안 어디에도 없을 때만 met: false/);
  const both = await gradingWith(JSON.stringify({ checklistResult: [{ id: 'c1', met: true }, { id: 'c2', met: true }] }))
    .grading.gradeSubjectiveAnswer(essay, answer);
  assert.equal(both.gradingScore, 100);
});

test('A2: AI 응답에서 항목이 빠지거나 형식이 틀리면 50점이 아니라 채점 실패', async () => {
  for (const checklistResult of [
    [{ id: 'c1', met: true }], // c2 누락
    [{ id: 'c1', met: true }, { id: 'c2', met: 'true' }], // 문자열 true
    [{ id: 'c1', met: true }, { id: 'C2', met: true }], // 알 수 없는 ID
    [{ id: 'c1', met: true }, { id: 'c1', met: false }], // 중복
  ]) {
    const result = await gradingWith(JSON.stringify({ checklistResult })).grading.gradeSubjectiveAnswer(essay, answer);
    assert.equal(result.gradingStatus, 'failed', JSON.stringify(checklistResult));
    assert.equal(result.gradingScore, undefined, JSON.stringify(checklistResult));
  }
  const shortAnswer = { ...essay, questionType: 'short_answer', gradingChecklist: undefined };
  for (const text of ['{"correct":"true"}', '{}', '{"correct":1}']) {
    const result = await gradingWith(text).grading.gradeSubjectiveAnswer(shortAnswer, answer);
    assert.equal(result.gradingStatus, 'failed', text);
  }
});

function renderResultView(questions, userAnswers, results) {
  const react = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }), useState: v => [v, () => {}] };
  react.default = react;
  const view = compile(path.join(ROOT, 'src/features/exam/ExamResultView.tsx'), name => {
    if (name === 'react') return react;
    if (name === 'react-native') return new Proxy({}, { get: (_t, k) => String(k) });
    if (name.endsWith('examStyles')) return { styles: new Proxy({}, { get: () => ({}) }) };
    if (name.endsWith('designTokens')) return { colors: new Proxy({}, { get: () => '#000' }) };
    return new Proxy({}, { get: (_t, k) => (k === '__esModule' ? true : String(k)) });
  });
  const tree = view.ExamResultView({ questions, userAnswers, results, onExitExam() {} });
  const text = node => (!node || typeof node !== 'object' ? String(node ?? '') : node.children.flat(Infinity).map(text).join(''));
  return text(tree);
}

const mc = {
  id: 'q-mc', questionId: 'q-mc', questionType: 'multiple_choice', stem: '1+1?', explanation: '2',
  options: [{ id: 'a', text: '2' }, { id: 'b', text: '3' }, { id: 'c', text: '4' }, { id: 'd', text: '5' }], answerOptionId: 'a',
};
const essayResult = { question: essay, selectedOptionId: '', isCorrect: false, gradingStatus: 'graded', gradingScore: 50,
  gradingChecklistResult: [{ id: 'c1', met: true }, { id: 'c2', met: false }] };

test('B: 시험 전체 점수는 문항별 점수 평균이며 부분점수를 반영하고 채점 미완료는 제외한다', () => {
  const mcRight = { question: mc, selectedOptionId: 'a', isCorrect: true };
  // 객관식 정답 + 서술형 50점 → 75점
  const mixed = renderResultView([mc, essay], { 0: 'a' }, [mcRight, essayResult]);
  assert.match(mixed, /맞힌 문제: 1 \/ 2문항 · 점수 75점/);
  // 서술형 50점 한 문항 → 50점, 문항 배지는 부분점수 50점
  const single = renderResultView([essay], {}, [essayResult]);
  assert.match(single, /맞힌 문제: 0 \/ 1문항 · 점수 50점/);
  assert.match(single, /부분점수 50점/);
  // 채점 미완료 문항은 평균에서 빠진다
  const failed = { question: essay, selectedOptionId: '', isCorrect: false, gradingStatus: 'failed', gradingFailedReason: 'x' };
  assert.match(renderResultView([mc, essay], { 0: 'a' }, [mcRight, failed]), /점수 100점 \(채점 미완료 1문항 제외\)/);
  const none = renderResultView([essay], {}, [failed]);
  assert.match(none, /채점을 완료하지 못했습니다/);
  assert.doesNotMatch(none, /점수 \d+점/);
});

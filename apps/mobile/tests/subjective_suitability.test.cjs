// 자동 채점용 주관식 적합성: 의견·가치판단형 지문과 주관적 채점 기준을 걸러낸다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const loaded = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/domain/subjective_suitability.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: loaded, exports: loaded.exports });
const { findUnverifiableSubjective } = loaded.exports;

const essay = (stem, criteria = ['핵심 요소 A', '핵심 요소 B']) => ({
  questionType: 'essay', stem, gradingChecklist: criteria.map(criterion => ({ criterion })),
});

test('objective concept questions pass, including philosophy with fixed elements', () => {
  assert.equal(findUnverifiableSubjective([
    essay('칸트의 정언명령 개념을 설명하시오.'),
    { questionType: 'short_answer', stem: 'Win32 화면 좌표에서 원점의 위치를 쓰시오.' },
    essay('공리주의의 기본 원리를 두 가지 핵심 요소로 설명하시오.'),
  ]), null);
});

test('opinion, value judgement and experience questions are flagged by number', () => {
  for (const stem of [
    '의무론과 공리주의 중 어떤 윤리관이 더 옳은가 서술하시오.',
    '안락사에 대한 당신의 생각을 서술하시오.',
    '사형제 존폐에 대해 찬성하는지 반대하는지 쓰시오.',
    '이 정책이 바람직한가 자유롭게 서술하시오.',
    '이 문제에 대해 어떻게 생각하는지 쓰시오.',
  ]) {
    assert.equal(findUnverifiableSubjective([essay('칸트의 정언명령 개념을 설명하시오.'), essay(stem)]), 2, stem);
  }
  assert.equal(findUnverifiableSubjective([{ questionType: 'short_answer', stem: '본인의 경험을 한 문장으로 쓰시오.' }]), 1);
});

test('subjective grading criteria are flagged; multiple choice and cloze are not checked', () => {
  assert.equal(findUnverifiableSubjective([essay('정언명령을 설명하시오.', ['정의를 포함함', '논리적 일관성'])]), 1);
  assert.equal(findUnverifiableSubjective([
    { questionType: 'multiple_choice', stem: '다음 중 가장 옳은 것은?' },
    { questionType: 'cloze', stem: '당신의 생각은 {{1}}이다.' },
  ]), null);
});

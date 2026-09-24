// 최신 법령 검증 대상 판정: 법학/행정 분류, 명확한 법령 용어, 이름이 분명한 법 과목만 대상이다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const file = path.resolve(__dirname, '../src/domain/current_information.ts');
const loaded = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: loaded, exports: loaded.exports, Intl, URL }, { filename: file });
const { requiresCurrentOfficialSources } = loaded.exports;

const check = (subject, category) => requiresCurrentOfficialSources({ category, texts: [subject] });

test('law category always requires current official sources', () => {
  assert.equal(check('행정학 개론', '법학/행정'), true);
  assert.equal(check('행정학 개론', ' 법학/행정 '), true);
  assert.equal(check('행정학 개론', '교양/자격증'), false);
});

test('clearly named law subjects are detected even with one-syllable prefixes', () => {
  for (const subject of ['민법', '형법총칙', '상법 회사편', '헌법', '대한민국 헌법', '민사소송법', '근로기준법 기초', '세법 개론']) {
    assert.equal(check(subject), true, subject);
  }
});

test('ordinary subjects ending in 법 are not treated as law', () => {
  for (const subject of ['영문법', '영어 문법', '문법', '기법', '요리법', '최소제곱법', '연상법 암기', '방법론', '파이썬 코딩 기법']) {
    assert.equal(check(subject, '언어/어학'), false, subject);
  }
});

test('explicit legal and tax terms still require verification', () => {
  for (const subject of ['소득세 계산', '개정 법령', '대법원 판례', '시행령 해설', '부동산 정책']) {
    assert.equal(check(subject), true, subject);
  }
});

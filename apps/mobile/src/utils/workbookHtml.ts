import type { QuestionRevision, Topic, Unit } from '../contracts/types';
import { escapeHtml, NUMBER_CIRCLES } from './examSheetExportShared';

/** Browser print view: Save as PDF keeps Korean text selectable and paginates on A4. */
export function generateWorkbookHtml(
  topics: Topic[],
  units: Unit[],
  questions: QuestionRevision[],
  includeExplanations: boolean,
  rankingNickname = '',
  watermarkImageUrl = '',
  returnUrl = ''
): string {
  const date = new Date().toLocaleDateString('ko-KR');
  const watermark = `<div class="page-watermark" aria-hidden="true">
    <div class="watermark-letters">${Array.from('Celueste').map((letter, index) =>
      `<span style="transform:translateY(${(index - 3.5) * 19}mm)">${letter}</span>`).join('')}</div>
  </div>`;
  const topicSections = topics.map((topic) => {
    const topicQuestions = questions.filter((q) => q.topicId === topic.id);
    const topicUnits = units
      .filter((unit) => unit.topicId === topic.id && topicQuestions.some((q) => q.unitId === unit.id))
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const sections: { title: string; items: QuestionRevision[] }[] = topicUnits.map((unit) => ({
      title: unit.title,
      items: topicQuestions.filter((q) => q.unitId === unit.id),
    }));
    const unclassified = topicQuestions.filter((q) => !topicUnits.some((unit) => unit.id === q.unitId));
    if (unclassified.length) sections.push({ title: '단원 미분류', items: unclassified });

    let questionNumber = 0;
    const numberedSections = sections.map((section) => ({
      ...section,
      items: section.items.map((question) => ({ question, number: ++questionNumber })),
    }));
    const questionPages = numberedSections.map((section) => `
      <section class="unit-page">
        ${watermark}
        <header><p class="eyebrow">CELUESTE · ${escapeHtml(topic.name)}</p>
          <h1>${escapeHtml(section.title)}</h1>
          <p class="meta">${escapeHtml(topic.name)} · ${section.items.length}문항 · ${escapeHtml(date)}${rankingNickname ? ` · 닉네임 ${escapeHtml(rankingNickname)}` : ''}</p>
        </header>
        <div class="columns">${section.items.map(({ question, number }) => `
          <article class="question">
            <div class="stem"><b>${number}.</b> ${escapeHtml(question.stem)}</div>
            ${question.questionType === 'multiple_choice'
              ? `<div class="options">${question.options.map((option, index) => `
                  <div>${NUMBER_CIRCLES[index] || `(${index + 1})`} ${escapeHtml(option.text)}</div>`).join('')}</div>`
              : '<div class="answer-space" aria-label="주관식 답안 작성란"><div></div><div></div></div>'}
          </article>`).join('')}</div>
      </section>`).join('');
    const answers = includeExplanations ? `
      <section class="answer-page">
        ${watermark}
        <p class="eyebrow">CELUESTE · ANSWER KEY</p><h1>${escapeHtml(topic.name)} 정답과 해설</h1>
        ${numberedSections.map((section) => `
          <h2>${escapeHtml(section.title)}</h2>
          ${section.items.map(({ question, number }) => {
            const optionIndex = question.options.findIndex((option) => option.id === question.answerOptionId);
            const option = question.options[optionIndex];
            const answer = question.questionType === 'multiple_choice'
              ? (option ? `${NUMBER_CIRCLES[optionIndex] || optionIndex + 1} ${option.text}` : '정답 정보 없음')
              : (question.modelAnswer || '모범답안 없음');
            return `<article class="solution"><b>${number}. 정답: ${escapeHtml(String(answer))}</b>
              ${question.explanation ? `<p>${escapeHtml(question.explanation)}</p>` : ''}</article>`;
          }).join('')}`).join('')}
      </section>` : '';
    return questionPages + answers;
  }).join('');

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Celueste 내 문제집</title><style>
    @page { size: A4; margin: 14mm 12mm 20mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #22212a; background: #f5f1f3; font: 10pt/1.55 "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; }
    .toolbar { position: sticky; top: 0; z-index: 2; padding: 12px; text-align: center; background: #6e4053; color: white; }
    .toolbar button, .toolbar a { display: inline-block; border: 0; border-radius: 8px; padding: 8px 18px; background: white; color: #6e4053; font: inherit; font-weight: 700; text-decoration: none; cursor: pointer; }
    main { max-width: 210mm; margin: 20px auto; background: white; padding: 14mm 12mm; }
    .unit-page, .answer-page { position: relative; isolation: isolate; break-before: page; min-height: 260mm; display: flex; flex-direction: column; }
    main > section:first-child { break-before: auto; }
    .page-watermark { position: absolute; z-index: 0; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(185mm, 100%); height: 190mm; pointer-events: none; }
    .page-watermark::before { content: ""; position: absolute; inset: 0; opacity: 0.025; background: center / min(180mm, 100%) auto no-repeat url("${escapeHtml(watermarkImageUrl)}"); }
    .watermark-letters { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); display: flex; justify-content: space-between; font-size: clamp(50pt, 10vw, 80pt); font-weight: 900; color: #172550; opacity: 0.03; }
    .unit-page > :not(.page-watermark), .answer-page > :not(.page-watermark) { position: relative; z-index: 1; }
    header { border-bottom: 2px solid #75495c; padding-bottom: 9px; margin-bottom: 18px; }
    .eyebrow { margin: 0; color: #9f657b; font-size: 8pt; font-weight: 700; letter-spacing: 1px; }
    h1 { margin: 5px 0; font-size: 14pt; line-height: 1.35; color: #302832; }
    h2 { margin: 20px 0 7px; font-size: 12pt; border-bottom: 1px solid #ddd2d8; }
    .meta { color: #756b70; margin: 0 0 9px; }
    .columns { column-count: 2; column-gap: 9mm; column-rule: 1px solid #e2dce0; }
    .question { break-inside: avoid; margin: 0 0 17px; }
    .stem { font-weight: 700; white-space: pre-wrap; }
    .stem b { color: #9f657b; margin-right: 3px; }
    .options { margin: 7px 0 0 3px; }
    .options div { margin-bottom: 4px; white-space: pre-wrap; }
    .answer-space { margin-top: 9px; }
    .answer-space div { height: 24px; border-bottom: 1px solid #d8d3d6; }
    .solution { break-inside: avoid; padding: 8px 0; border-bottom: 1px dotted #d5cbd0; white-space: pre-wrap; }
    .solution p { margin: 4px 0 0; }
    .print-footer { display: none; }
    @media print { body { background: white; } .toolbar { display: none; } main { margin: 0; padding: 0; max-width: none; } .watermark-letters { font-size: 80pt; }
      .print-footer { display: block; position: fixed; bottom: 0; left: 0; width: 100%; text-align: right; color: #9a9096; font: 8pt "Malgun Gothic", sans-serif; }
      .print-footer hr { border: 0; border-top: 1px solid #c9c2c7; margin: 0 0 5px; } }
    </style></head><body>
    <div class="toolbar"><a href="${escapeHtml(returnUrl)}">앱으로 돌아가기</a> PDF로 저장하려면 <button onclick="window.print()">인쇄 · PDF 저장</button>을 누르고 대상에서 PDF 저장을 선택하세요. 인쇄가 안 열리면 앱에서 [PDF 파일 바로 저장]을 사용하세요.</div>
    <main>${topicSections}</main><footer class="print-footer"><hr>Celueste로 만든 나만의 문제집</footer></body></html>`;
}

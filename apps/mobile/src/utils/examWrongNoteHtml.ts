import { Attempt, QuestionRevision, ReviewState, Topic, Unit } from '../contracts/types';
import { escapeHtml, NUMBER_CIRCLES } from './examSheetExportShared';

/**
 * 3. 사용자가 직접 저장한 문제만 모은 A4 인쇄/PDF용 오답노트 생성
 * 자동 복습 일정과 최근 오답은 앱의 복습 예정 기능에서 별도로 관리한다.
 */
export function generateWrongNoteHtml(
  topics: Topic[] = [],
  units: Unit[] = [],
  questions: QuestionRevision[] = [],
  _attempts: Attempt[] = [],
  _reviewStates: ReviewState[] = [],
  customNoteQuestionIds: string[] = [],
  exportDate: string = new Date().toISOString().slice(0, 10)
): string {
  const topicMap = new Map(topics.map((topic) => [topic.id, topic.name]));
  const unitMap = new Map(units.map((unit) => [unit.id, unit.title]));
  const customQuestionIds = new Set(customNoteQuestionIds);

  const selectedQuestions = questions.filter((question) => customQuestionIds.has(question.id));

  const primaryTopicName = topics.length > 0 ? topics[0].name : '나만의 문제집';

  const questionCardsHtml = selectedQuestions
    .map((question, index) => {
      const topicName = (question.topicId && topicMap.get(question.topicId)) || '종합';
      const unitName = (question.unitId && unitMap.get(question.unitId)) || '미분류 단원';
      const optionsHtml = question.options
        .map((option, optionIndex) => {
          const marker = NUMBER_CIRCLES[optionIndex] || `(${optionIndex + 1})`;
          return `<li><span class="option-marker">${marker}</span><span>${escapeHtml(option.text)}</span></li>`;
        })
        .join('');

      return `
        <article class="note-card">
          <div class="card-meta">
            <span class="path">${escapeHtml(topicName)} <span aria-hidden="true">›</span> ${escapeHtml(unitName)}</span>
            <span class="reasons"><span class="reason-badge">직접 저장</span></span>
          </div>
          <h2><span class="question-number">${index + 1}.</span> ${escapeHtml(question.stem)}</h2>
          <ol class="options">${optionsHtml}</ol>
          <div class="answer-line">내 답: <span></span></div>
          <div class="work-space" aria-label="손으로 풀이를 적는 공간">
            <div class="work-label">나의 풀이와 틀린 이유</div>
            <div class="writing-lines"></div>
          </div>
          <div class="review-checks">
            <span>재복습</span>
            <label>□ 1회</label><label>□ 2회</label><label>□ 3회</label>
            <label class="date-check">확인일:　　　　년　　월　　일</label>
          </div>
        </article>`;
    })
    .join('');

  const solutionsHtml = selectedQuestions
    .map((question, index) => {
      const topicName = (question.topicId && topicMap.get(question.topicId)) || '종합';
      const unitName = (question.unitId && unitMap.get(question.unitId)) || '미분류 단원';
      const correctOptionIndex = question.options.findIndex(
        (option) => option.id === question.answerOptionId
      );
      const answerMarker =
        NUMBER_CIRCLES[correctOptionIndex] ||
        (correctOptionIndex >= 0 ? `(${correctOptionIndex + 1})` : '정답 정보 없음');
      const correctOption = question.options.find(
        (option) => option.id === question.answerOptionId
      );

      return `
        <article class="solution-card">
          <div class="solution-path">${escapeHtml(topicName)} · ${escapeHtml(unitName)}</div>
          <h3>${index + 1}. ${escapeHtml(question.stem)}</h3>
          <div class="correct-answer">
            정답 <strong>${answerMarker}</strong>${correctOption ? ` · ${escapeHtml(correctOption.text)}` : ''}
          </div>
          <div class="explanation">
            <span>해설</span>
            <p>${escapeHtml(question.explanation || '저장된 해설이 없습니다.')}</p>
          </div>
        </article>`;
    })
    .join('');

  const emptyHtml = `
    <div class="empty-state">
      <div class="empty-symbol">◇</div>
      <h2>아직 정리할 문제가 없습니다</h2>
      <p>문제 보관함에서 필요한 문제를 오답노트에 저장하면 이곳에 모입니다.</p>
    </div>`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[나만의 오답노트] ${escapeHtml(primaryTopicName)}</title>
  <style>
    @page { size: A4; margin: 14mm 13mm 16mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      color: #253047;
      background: #f8f6f3;
      font-family: -apple-system, BlinkMacSystemFont, "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", sans-serif;
      font-size: 10pt;
      line-height: 1.55;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-toolbar {
      position: sticky; top: 0; z-index: 10;
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 12px 20px; color: #fff; background: #253047;
      box-shadow: 0 3px 14px rgba(37,48,71,.18);
    }
    .print-toolbar p { margin: 0; }
    .print-toolbar button {
      flex: 0 0 auto; border: 0; border-radius: 8px; padding: 9px 16px;
      color: #fff; background: #c94f6d; font: inherit; font-weight: 800; cursor: pointer;
    }
    main { width: min(900px, 100%); margin: 0 auto; padding: 28px 24px 40px; }
    .cover { border-bottom: 2px solid #253047; padding: 4px 0 18px; margin-bottom: 20px; }
    .brand { color: #c94f6d; font-size: 8.5pt; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
    .cover h1 { margin: 5px 0 4px; font-size: 23pt; line-height: 1.2; letter-spacing: -.04em; }
    .cover p { margin: 0; color: #6b7280; }
    .meta-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px;
      margin-top: 14px; overflow: hidden; border: 1px solid #e9e2df; border-radius: 8px; background: #e9e2df;
    }
    .meta-grid div { padding: 8px 10px; background: #fff; }
    .meta-grid span { display: block; color: #6b7280; font-size: 7.5pt; }
    .meta-grid strong { font-size: 9.5pt; }
    .note-card {
      break-inside: avoid; page-break-inside: avoid;
      margin: 0 0 16px; padding: 15px 16px 13px;
      border: 1px solid #e9e2df; border-radius: 10px; background: #fff;
    }
    .card-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
    .path { color: #6b7280; font-size: 8pt; font-weight: 700; }
    .reasons { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
    .reason-badge { border-radius: 999px; padding: 2px 7px; color: #ad3f5b; background: #f8e8ed; font-size: 7pt; font-weight: 800; }
    .note-card h2 { margin: 0 0 10px; font-size: 10.5pt; line-height: 1.55; }
    .question-number { color: #c94f6d; }
    .options { list-style: none; margin: 0; padding: 0 0 0 3px; }
    .options li { display: flex; align-items: flex-start; gap: 7px; margin: 4px 0; }
    .option-marker { min-width: 17px; color: #59647a; font-weight: 800; }
    .answer-line { display: flex; align-items: flex-end; gap: 8px; margin: 12px 0 8px; color: #59647a; font-size: 8.5pt; font-weight: 700; }
    .answer-line span { width: 76px; height: 15px; border-bottom: 1px solid #9aa2b1; }
    .work-space { border: 1px solid #ddd6d1; border-radius: 7px; overflow: hidden; }
    .work-label { padding: 5px 8px; color: #59647a; background: #f4f1ee; font-size: 7.5pt; font-weight: 800; }
    .writing-lines {
      height: 78px;
      background: repeating-linear-gradient(to bottom, #fff 0, #fff 25px, #e9e2df 26px);
    }
    .review-checks { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 9px; color: #59647a; font-size: 8pt; }
    .review-checks > span { color: #253047; font-weight: 800; }
    .date-check { margin-left: auto; }
    .solution-section { break-before: page; page-break-before: always; padding-top: 4px; }
    .section-heading { border-bottom: 2px solid #253047; padding-bottom: 10px; margin: 0 0 16px; }
    .section-heading h2 { margin: 0; font-size: 18pt; }
    .section-heading p { margin: 3px 0 0; color: #6b7280; }
    .solution-card {
      break-inside: avoid; page-break-inside: avoid;
      margin-bottom: 12px; padding: 13px 14px; border: 1px solid #e9e2df; border-radius: 9px; background: #fff;
    }
    .solution-path { color: #6b7280; font-size: 7.5pt; font-weight: 700; }
    .solution-card h3 { margin: 4px 0 8px; font-size: 10pt; }
    .correct-answer { display: inline-block; margin-bottom: 8px; border-radius: 6px; padding: 4px 9px; color: #ad3f5b; background: #f8e8ed; }
    .explanation { border-left: 3px solid #c94f6d; padding: 7px 10px; background: #f8f6f3; }
    .explanation span { color: #ad3f5b; font-size: 8pt; font-weight: 800; }
    .explanation p { margin: 2px 0 0; white-space: pre-line; }
    .empty-state { padding: 70px 20px; border: 1px dashed #cfc6c1; border-radius: 10px; text-align: center; background: #fff; }
    .empty-symbol { color: #c94f6d; font-size: 28pt; }
    .empty-state h2 { margin: 8px 0 4px; font-size: 15pt; }
    .empty-state p { margin: 0; color: #6b7280; }
    @media print {
      body { background: #fff; }
      .print-toolbar { display: none !important; }
      main { width: 100%; padding: 0; }
      .note-card, .solution-card { border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <p><strong>나만의 오답노트</strong> · 브라우저의 인쇄 메뉴에서 A4 또는 PDF 저장을 선택하세요.</p>
    <button type="button" onclick="window.print()">인쇄 / PDF 저장</button>
  </div>
  <main>
    <header class="cover">
      <div class="brand">Celueste Study Archive</div>
      <h1>${escapeHtml(primaryTopicName)} 오답노트</h1>
      <p>틀린 이유를 직접 적고, 다시 풀며 내 것으로 만드는 개인 학습 기록입니다.</p>
      <div class="meta-grid">
        <div><span>발행일</span><strong>${escapeHtml(exportDate)}</strong></div>
        <div><span>수록 문제</span><strong>${selectedQuestions.length}문항</strong></div>
        <div><span>이름</span><strong>　　　　　　　　　</strong></div>
      </div>
    </header>

    <section aria-label="오답 문제와 필기 공간">
      ${selectedQuestions.length > 0 ? questionCardsHtml : emptyHtml}
    </section>

    ${
      selectedQuestions.length > 0
        ? `<section class="solution-section" aria-label="정답과 해설">
            <header class="section-heading">
              <h2>정답과 해설</h2>
              <p>직접 다시 푼 뒤 확인하세요.</p>
            </header>
            ${solutionsHtml}
          </section>`
        : ''
    }
  </main>
</body>
</html>`;
}


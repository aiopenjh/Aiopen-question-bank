import { Topic, Unit, QuestionRevision } from '../contracts/types';

/**
 * 인쇄 및 PDF 출력용 HTML/TXT 시험지 변환기
 * - A4 용지 규격에 최적화된 고화질 2단 시험지 스타일
 * - 브라우저에서 열고 Ctrl + P 누르면 즉시 PDF 저장 또는 프린터 출력 가능
 */

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const NUMBER_CIRCLES = ['①', '②', '③', '④', '⑤'];

/**
 * 1. 문제풀이용 A4 인쇄/PDF용 HTML 시험지 생성 (정답/해설 제외)
 */
export function generateExamSheetHtml(
  topics: Topic[] = [],
  units: Unit[] = [],
  questions: QuestionRevision[] = [],
  exportDate: string = new Date().toISOString().slice(0, 10)
): string {
  const topicMap = new Map(topics.map((t) => [t.id, t.name]));
  const primaryTopicName = topics.length > 0 ? topics[0].name : 'CBT 핵심 문제집';
  const totalCount = questions.length;

  let questionsHtml = '';
  questions.forEach((q, idx) => {
    const qNum = idx + 1;
    const tName = (q.topicId ? topicMap.get(q.topicId) : null) || '종합';
    const optionsHtml = q.options
      .map((opt, oIdx) => {
        const circle = NUMBER_CIRCLES[oIdx] || `(${oIdx + 1})`;
        return `<div class="option-item"><span class="opt-num">${circle}</span> <span class="opt-text">${escapeHtml(opt.text)}</span></div>`;
      })
      .join('');

    questionsHtml += `
      <div class="question-card">
        <div class="question-header">
          <span class="q-number">${qNum}.</span>
          <span class="q-topic-tag">[${escapeHtml(tName)}]</span>
          <span class="q-stem">${escapeHtml(q.stem)}</span>
        </div>
        <div class="options-container">
          ${optionsHtml}
        </div>
      </div>
    `;
  });

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[시험지] ${escapeHtml(primaryTopicName)} - 실전 문제집</title>
  <style>
    @page {
      size: A4;
      margin: 15mm 12mm 15mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", sans-serif;
      color: #111827;
      background: #ffffff;
      line-height: 1.5;
      font-size: 10pt;
    }
    .no-print-bar {
      background: #881337;
      color: #ffffff;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .no-print-bar button {
      background: #f43f5e;
      color: white;
      border: none;
      padding: 8px 18px;
      font-size: 14px;
      font-weight: bold;
      border-radius: 6px;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    .no-print-bar button:hover {
      background: #e11d48;
    }
    .page-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px 20px;
    }
    .exam-title-header {
      border-bottom: 3px double #881337;
      padding-bottom: 12px;
      margin-bottom: 16px;
      text-align: center;
    }
    .exam-title-main {
      font-size: 20pt;
      font-weight: 800;
      color: #881337;
      letter-spacing: -0.5px;
    }
    .exam-title-sub {
      font-size: 11pt;
      color: #4b5563;
      margin-top: 4px;
    }
    .meta-box {
      border: 1px solid #9ca3af;
      padding: 8px 14px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      font-size: 9.5pt;
      background: #f9fafb;
    }
    .meta-item {
      font-weight: 600;
    }
    .columns-wrapper {
      column-count: 2;
      column-gap: 20px;
      column-rule: 1px dashed #d1d5db;
    }
    .question-card {
      break-inside: avoid;
      page-break-inside: avoid;
      margin-bottom: 18px;
      padding-bottom: 12px;
      border-bottom: 1px dotted #e5e7eb;
    }
    .question-header {
      font-size: 10pt;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 8px;
      line-height: 1.45;
    }
    .q-number {
      color: #881337;
      font-weight: 800;
      margin-right: 4px;
    }
    .q-topic-tag {
      color: #6b7280;
      font-size: 8.5pt;
      font-weight: 600;
      margin-right: 4px;
    }
    .options-container {
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding-left: 4px;
    }
    .option-item {
      font-size: 9.5pt;
      color: #374151;
      display: flex;
      align-items: flex-start;
      gap: 6px;
    }
    .opt-num {
      font-weight: 700;
      color: #4b5563;
      min-width: 16px;
    }
    .opt-text {
      flex: 1;
    }
    .exam-footer {
      border-top: 1px solid #9ca3af;
      margin-top: 24px;
      padding-top: 8px;
      text-align: center;
      font-size: 8pt;
      color: #6b7280;
    }
    @media print {
      .no-print-bar {
        display: none !important;
      }
      .page-container {
        max-width: 100%;
        padding: 0;
      }
      body {
        font-size: 9.5pt;
      }
      .question-card {
        margin-bottom: 14px;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div>
      <strong>📄 [인쇄 / PDF 저장 안내]</strong> 아래 버튼을 누르거나 키보드에서 <strong>Ctrl + P</strong>를 누르시면 A4 시험지 인쇄 또는 PDF 저장이 가능합니다.
    </div>
    <button onclick="window.print()">🖨️ PDF로 저장 / 종이 인쇄</button>
  </div>

  <div class="page-container">
    <div class="exam-title-header">
      <h1 class="exam-title-main">${escapeHtml(primaryTopicName)} 실전 문제집</h1>
      <p class="exam-title-sub">Celueste AI CBT 고난도 핵심 문제 모음집</p>
    </div>

    <div class="meta-box">
      <span class="meta-item">시험 일자: ${escapeHtml(exportDate)}</span>
      <span class="meta-item">문항 수: 총 ${totalCount}문항</span>
      <span class="meta-item">수험번호: _________________</span>
      <span class="meta-item">성명: _____________</span>
      <span class="meta-item">득점: ______ / 100</span>
    </div>

    <div class="columns-wrapper">
      ${questionsHtml}
    </div>

    <div class="exam-footer">
      Celueste AI 맞춤형 CBT 학습 엔진 · 정답 및 해설은 함께 압축된 [정답및해설집.html]을 참고하세요.
    </div>
  </div>
</body>
</html>`;
}

/**
 * 2. 정답 및 심층 해설집 A4 인쇄/PDF용 HTML 생성
 */
export function generateAnswerSheetHtml(
  topics: Topic[] = [],
  units: Unit[] = [],
  questions: QuestionRevision[] = [],
  exportDate: string = new Date().toISOString().slice(0, 10)
): string {
  const topicMap = new Map(topics.map((t) => [t.id, t.name]));
  const primaryTopicName = topics.length > 0 ? topics[0].name : 'CBT 정답집';

  // 1. 빠른 정답표 테이블 (5개씩 가로 배열)
  let quickTableRows = '';
  for (let i = 0; i < questions.length; i += 5) {
    const chunk = questions.slice(i, i + 5);
    const cells = chunk
      .map((q, idx) => {
        const qNum = i + idx + 1;
        const optIdx = q.options.findIndex((o) => o.id === q.answerOptionId);
        const ansCircle = NUMBER_CIRCLES[optIdx] || (optIdx !== -1 ? String(optIdx + 1) : '-');
        return `<td><strong>${qNum}</strong> : <span class="ans-circle">${ansCircle}</span></td>`;
      })
      .join('');
    quickTableRows += `<tr>${cells}</tr>`;
  }

  // 2. 문항별 상세 해설 카드
  let detailSolutionsHtml = '';
  questions.forEach((q, idx) => {
    const qNum = idx + 1;
    const tName = (q.topicId ? topicMap.get(q.topicId) : null) || '종합';
    const optIdx = q.options.findIndex((o) => o.id === q.answerOptionId);
    const ansCircle = NUMBER_CIRCLES[optIdx] || String(optIdx + 1);
    const correctOpt = q.options.find((o) => o.id === q.answerOptionId);

    detailSolutionsHtml += `
      <div class="solution-card">
        <div class="sol-q-title">
          <span class="sol-num">[제 ${qNum} 번]</span>
          <span class="sol-topic">[${escapeHtml(tName)}]</span>
          <span>${escapeHtml(q.stem)}</span>
        </div>
        <div class="sol-answer-badge">
          ✅ 정답: <strong>${ansCircle}번</strong> ${correctOpt ? `(${escapeHtml(correctOpt.text)})` : ''}
        </div>
        <div class="sol-desc-box">
          <div class="sol-desc-title">💡 핵심 해설 및 풀이:</div>
          <div class="sol-desc-text">${escapeHtml(q.explanation || '핵심 원리에 따른 정답입니다.')}</div>
        </div>
      </div>
    `;
  });

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[정답 및 해설집] ${escapeHtml(primaryTopicName)}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm 12mm 15mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", sans-serif;
      color: #111827;
      background: #ffffff;
      line-height: 1.5;
      font-size: 10pt;
    }
    .no-print-bar {
      background: #065f46;
      color: #ffffff;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .no-print-bar button {
      background: #10b981;
      color: white;
      border: none;
      padding: 8px 18px;
      font-size: 14px;
      font-weight: bold;
      border-radius: 6px;
      cursor: pointer;
    }
    .no-print-bar button:hover {
      background: #059669;
    }
    .page-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px 20px;
    }
    .title-header {
      border-bottom: 3px double #065f46;
      padding-bottom: 12px;
      margin-bottom: 16px;
      text-align: center;
    }
    .title-main {
      font-size: 20pt;
      font-weight: 800;
      color: #065f46;
    }
    .quick-table-section {
      margin-bottom: 24px;
      background: #f0fdf4;
      border: 1.5px solid #a7f3d0;
      border-radius: 8px;
      padding: 14px;
    }
    .quick-table-title {
      font-size: 11pt;
      font-weight: 800;
      color: #065f46;
      margin-bottom: 10px;
      text-align: center;
    }
    .quick-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      text-align: center;
    }
    .quick-table td {
      border: 1px solid #bbf7d0;
      padding: 6px 8px;
      background: #ffffff;
    }
    .ans-circle {
      color: #059669;
      font-weight: 800;
      font-size: 11pt;
    }
    .solution-card {
      break-inside: avoid;
      page-break-inside: avoid;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 14px;
      background: #ffffff;
    }
    .sol-q-title {
      font-weight: 700;
      font-size: 10pt;
      color: #1f2937;
      margin-bottom: 8px;
    }
    .sol-num {
      color: #065f46;
      font-weight: 800;
      margin-right: 4px;
    }
    .sol-topic {
      color: #6b7280;
      font-size: 8.5pt;
      margin-right: 6px;
    }
    .sol-answer-badge {
      display: inline-block;
      background: #ecfdf5;
      color: #065f46;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid #a7f3d0;
      font-size: 9.5pt;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .sol-desc-box {
      background: #f9fafb;
      border-left: 3px solid #059669;
      padding: 8px 12px;
      font-size: 9.5pt;
      color: #374151;
    }
    .sol-desc-title {
      font-weight: 700;
      color: #065f46;
      margin-bottom: 4px;
      font-size: 9pt;
    }
    .sol-desc-text {
      line-height: 1.5;
    }
    @media print {
      .no-print-bar {
        display: none !important;
      }
      .page-container {
        max-width: 100%;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div>
      <strong>📗 [정답 및 해설집 안내]</strong> 인쇄 시 <strong>Ctrl + P</strong>를 눌러 간직하시거나 화면에서 편하게 확인하세요.
    </div>
    <button onclick="window.print()">🖨️ 해설집 인쇄 / PDF 저장</button>
  </div>

  <div class="page-container">
    <div class="title-header">
      <h1 class="title-main">${escapeHtml(primaryTopicName)} 정답 및 해설집</h1>
      <p style="font-size: 10pt; color: #4b5563; margin-top: 4px;">발행일: ${escapeHtml(exportDate)} · 총 ${questions.length}문항</p>
    </div>

    <!-- 빠른 정답표 -->
    <div class="quick-table-section">
      <div class="quick-table-title">⚡ 빠른 정답 체크표</div>
      <table class="quick-table">
        <tbody>
          ${quickTableRows}
        </tbody>
      </table>
    </div>

    <!-- 상세 해설 목록 -->
    <div>
      ${detailSolutionsHtml}
    </div>
  </div>
</body>
</html>`;
}

/**
 * 3. 한글(HWP)/워드 복사용 텍스트 시험지 생성
 */
export function generateExamSheetTxt(
  topics: Topic[] = [],
  units: Unit[] = [],
  questions: QuestionRevision[] = [],
  exportDate: string = new Date().toISOString().slice(0, 10)
): string {
  const topicMap = new Map(topics.map((t) => [t.id, t.name]));
  const primaryTopicName = topics.length > 0 ? topics[0].name : 'CBT 문제집';

  let txt = `========================================================================\n`;
  txt += `       [Celueste AI 실전 문제집 및 정답지]       \n`;
  txt += `과목명: ${primaryTopicName}\n`;
  txt += `발행일: ${exportDate}\n`;
  txt += `문항수: 총 ${questions.length}문항\n`;
  txt += `※ 본 텍스트는 한글(HWP) 및 MS Word에 복사하여 자유롭게 편집할 수 있습니다.\n`;
  txt += `========================================================================\n\n`;

  txt += `[ 제 1 부 : 실전 시험 문제 ]\n`;
  txt += `------------------------------------------------------------------------\n\n`;

  questions.forEach((q, idx) => {
    const qNum = idx + 1;
    const tName = (q.topicId ? topicMap.get(q.topicId) : null) || '종합';
    txt += `[문 ${qNum}] [${tName}] ${q.stem}\n`;
    q.options.forEach((opt, oIdx) => {
      const circle = NUMBER_CIRCLES[oIdx] || `(${oIdx + 1})`;
      txt += `  ${circle} ${opt.text}\n`;
    });
    txt += `\n`;
  });

  txt += `\n========================================================================\n`;
  txt += `[ 제 2 부 : 정답 및 심층 해설 ]\n`;
  txt += `========================================================================\n\n`;

  questions.forEach((q, idx) => {
    const qNum = idx + 1;
    const optIdx = q.options.findIndex((o) => o.id === q.answerOptionId);
    const ansCircle = NUMBER_CIRCLES[optIdx] || String(optIdx + 1);
    const correctOpt = q.options.find((o) => o.id === q.answerOptionId);

    txt += `[문 ${qNum} 정답 및 해설]\n`;
    txt += `▶ 정답: ${ansCircle}번 ${correctOpt ? `(${correctOpt.text})` : ''}\n`;
    txt += `▶ 해설: ${q.explanation || '핵심 원리에 따른 정답입니다.'}\n\n`;
  });

  return txt;
}

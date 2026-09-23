import { QuestionRevision, Topic } from '../contracts/types';
import { escapeHtml, NUMBER_CIRCLES } from './examSheetExportShared';

/**
 * 1. 문제풀이용 A4 인쇄/PDF용 HTML 시험지 생성 (정답/해설 제외)
 */
export function generateExamSheetHtml(
  topics: Topic[] = [],
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


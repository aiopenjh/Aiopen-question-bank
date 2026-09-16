import { Attempt, QuestionRevision, ReviewState, Topic, Unit } from '../contracts/types';
import { escapeHtml, NUMBER_CIRCLES } from './examSheetExportShared';

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


import { Attempt, QuestionRevision, ReviewState, Topic, Unit } from '../contracts/types';
import { escapeHtml, NUMBER_CIRCLES } from './examSheetExportShared';

/**
 * 4. 한글(HWP)/워드 복사용 텍스트 시험지 생성
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


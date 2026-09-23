import type { QuestionRevision, Topic, Unit } from '../contracts/types';
import { NUMBER_CIRCLES } from './examSheetExportShared';

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const MARGIN = 34;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const COLUMN_GAP = 27;
const COLUMN_WIDTH = (CONTENT_WIDTH - COLUMN_GAP) / 2;
const BOTTOM = 1040;
const FONT = '"Noto Serif KR", "Noto Serif CJK KR", "Batang", "AppleMyungjo", serif';

function wrappedLines(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const result: string[] = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const character of Array.from(paragraph)) {
      if (line && ctx.measureText(line + character).width > width) {
        result.push(line.trimEnd());
        line = character;
      } else {
        line += character;
      }
    }
    result.push(line.trimEnd());
  }
  return result;
}

async function loadWatermark(url: string): Promise<HTMLImageElement | null> {
  if (!url) return null;
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function createPage(watermark: HTMLImageElement | null): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_WIDTH * 2;
  canvas.height = PAGE_HEIGHT * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PDF 그림판을 열 수 없습니다.');
  ctx.scale(2, 2);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

  if (watermark) {
    ctx.save();
    ctx.globalAlpha = 0.025;
    ctx.drawImage(watermark, 57, 221, 680, 680);
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = '#172550';
  ctx.font = `900 106px ${FONT}`;
  const letters = Array.from('Celueste');
  const widths = letters.map((letter) => ctx.measureText(letter).width);
  const gap = Math.max(0, (CONTENT_WIDTH - widths.reduce((sum, width) => sum + width, 0)) / (letters.length - 1));
  let x = MARGIN;
  letters.forEach((letter, index) => {
    ctx.fillText(letter, x, 600 + (index - 3.5) * 72);
    x += widths[index] + gap;
  });
  ctx.restore();

  ctx.strokeStyle = '#c9c2c7';
  ctx.beginPath();
  ctx.moveTo(MARGIN, 1064);
  ctx.lineTo(PAGE_WIDTH - MARGIN, 1064);
  ctx.stroke();
  ctx.fillStyle = '#8190b2';
  ctx.font = `8px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('CELUESTE로 만든 나만의 문제집', PAGE_WIDTH / 2, 1081);
  ctx.textAlign = 'left';
  return { canvas, ctx };
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  topic: string,
  title: string,
  continuation = false
): number {
  ctx.fillStyle = '#9f657b';
  ctx.font = `700 11px ${FONT}`;
  ctx.fillText(`CELUESTE · ${topic}`, MARGIN, 54);
  ctx.fillStyle = '#302832';
  ctx.font = `700 19px ${FONT}`;
  const lines = wrappedLines(ctx, continuation ? `${title} (계속)` : title, CONTENT_WIDTH);
  let y = 82;
  for (const line of lines) {
    ctx.fillText(line, MARGIN, y);
    y += 26;
  }
  ctx.strokeStyle = '#75495c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN, y - 8);
  ctx.lineTo(PAGE_WIDTH - MARGIN, y - 8);
  ctx.stroke();
  return y + 18;
}

export async function createWorkbookPdf(
  topics: Topic[],
  units: Unit[],
  questions: QuestionRevision[],
  includeExplanations: boolean,
  watermarkImageUrl: string
): Promise<Uint8Array> {
  const watermark = await loadWatermark(watermarkImageUrl);
  const canvases: HTMLCanvasElement[] = [];
  const startPage = (topic: string, title: string, continuation = false, columns = false) => {
    const page = createPage(watermark);
    canvases.push(page.canvas);
    const y = drawHeader(page.ctx, topic, title, continuation);
    if (columns) {
      page.ctx.strokeStyle = '#bdb2b8';
      page.ctx.lineWidth = 1;
      page.ctx.beginPath();
      page.ctx.moveTo(PAGE_WIDTH / 2, y - 5);
      page.ctx.lineTo(PAGE_WIDTH / 2, BOTTOM + 14);
      page.ctx.stroke();
    }
    return { ctx: page.ctx, y };
  };

  for (const topic of topics) {
    const topicQuestions = questions.filter((question) => question.topicId === topic.id);
    const topicUnits = units.filter((unit) => unit.topicId === topic.id &&
      topicQuestions.some((question) => question.unitId === unit.id))
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const sections = topicUnits.map((unit) => ({
      title: unit.title,
      items: topicQuestions.filter((question) => question.unitId === unit.id),
    }));
    const unclassified = topicQuestions.filter((question) => !topicUnits.some((unit) => unit.id === question.unitId));
    if (unclassified.length) sections.push({ title: '단원 미분류', items: unclassified });
    for (const section of sections) {
      let number = 0;
      let page = startPage(topic.name, section.title, false, true);
      let column = 0;
      let y = page.y;
      const nextColumn = () => {
        if (column === 0) {
          column = 1;
          y = page.y;
        } else {
          page = startPage(topic.name, section.title, true, true);
          column = 0;
          y = page.y;
        }
      };
      const ensureSpace = (height: number) => {
        if (y + height > BOTTOM) nextColumn();
      };
      const writeLines = (lines: string[], font: string, color: string, lineHeight: number, indent = 0) => {
        for (const line of lines) {
          ensureSpace(lineHeight);
          page.ctx.fillStyle = color;
          page.ctx.font = font;
          page.ctx.fillText(line, MARGIN + column * (COLUMN_WIDTH + COLUMN_GAP) + indent, y);
          y += lineHeight;
        }
      };

      for (const question of section.items) {
        number++;
        page.ctx.font = `700 9px ${FONT}`;
        const stem = wrappedLines(page.ctx, `${number}. ${question.stem}`, COLUMN_WIDTH);
        page.ctx.font = `9px ${FONT}`;
        const options = question.questionType === 'multiple_choice'
          ? question.options.map((option, index) => wrappedLines(page.ctx,
            `${NUMBER_CIRCLES[index] || `(${index + 1})`} ${option.text}`, COLUMN_WIDTH - 10)) : [];
        const height = stem.length * 14 + options.reduce((sum, lines) => sum + lines.length * 14 + 3, 0)
          + (options.length ? 0 : 64) + 17;
        if (height <= BOTTOM - page.y) ensureSpace(height);
        writeLines(stem, `700 9px ${FONT}`, '#22212a', 14);
        y += 4;
        if (options.length) {
          for (const lines of options) {
            writeLines(lines, `9px ${FONT}`, '#22212a', 14, 10);
            y += 3;
          }
        } else {
          ensureSpace(64);
          y += 64;
        }
        y += 12;
      }
    }

    if (includeExplanations) {
      const title = `${topic.name} 정답과 해설`;
      let page = startPage(topic.name, title);
      let y = page.y;
      const writeAnswer = (text: string, font: string, color: string, lineHeight: number) => {
        page.ctx.font = font;
        const lines = wrappedLines(page.ctx, text, CONTENT_WIDTH);
        for (const line of lines) {
          if (y + lineHeight > BOTTOM) {
            page = startPage(topic.name, title, true);
            y = page.y;
          }
          page.ctx.fillStyle = color;
          page.ctx.font = font;
          page.ctx.fillText(line, MARGIN, y);
          y += lineHeight;
        }
      };
      for (const section of sections) {
        let answerNumber = 0;
        if (y + 45 > BOTTOM) {
          page = startPage(topic.name, title, true);
          y = page.y;
        }
        y += 9;
        writeAnswer(section.title, `700 17px ${FONT}`, '#302832', 24);
        y += 7;
        for (const question of section.items) {
          answerNumber++;
          const optionIndex = question.options.findIndex((option) => option.id === question.answerOptionId);
          const option = question.options[optionIndex];
          const answer = question.questionType === 'multiple_choice'
            ? (option ? `${NUMBER_CIRCLES[optionIndex] || optionIndex + 1} ${option.text}` : '정답 정보 없음')
            : (question.modelAnswer || '모범답안 없음');
          writeAnswer(`${answerNumber}. 정답: ${answer}`, `700 14px ${FONT}`, '#22212a', 20);
          if (question.explanation) writeAnswer(question.explanation, `13px ${FONT}`, '#333039', 19);
          y += 15;
        }
      }
    }
  }

  const { PDFDocument } = await import('pdf-lib/dist/pdf-lib.esm.js');
  const pdf = await PDFDocument.create();
  for (const canvas of canvases) {
    const image = await pdf.embedPng(canvas.toDataURL('image/png'));
    const page = pdf.addPage([595.28, 841.89]);
    page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }
  return pdf.save();
}

import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
export { zipSync, unzipSync, strToU8, strFromU8 };

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Uint8Array to Base64 (pure JS, safe in Hermes and all JS environments)
 */
export function u8ToBase64(bytes: Uint8Array): string {
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    result += chars[b0 >> 2];
    result += chars[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < len ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    result += i + 2 < len ? chars[b2 & 63] : '=';
  }
  return result;
}

/**
 * Base64 to Uint8Array (pure JS)
 */
export function base64ToU8(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = clean.length;
  const bytes = new Uint8Array((len * 3) >> 2);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const c0 = chars.indexOf(clean[i]);
    const c1 = chars.indexOf(clean[i + 1]);
    const c2 = chars.indexOf(clean[i + 2]);
    const c3 = chars.indexOf(clean[i + 3]);
    bytes[p++] = (c0 << 2) | (c1 >> 4);
    if (c2 !== -1) bytes[p++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (c3 !== -1) bytes[p++] = ((c2 & 3) << 6) | c3;
  }
  return bytes.subarray(0, p);
}

import {
  generateExamSheetHtml,
  generateAnswerSheetHtml,
  generateWrongNoteHtml,
  generateExamSheetTxt,
} from './examSheetExport';

/**
 * JSON 문자열을 85~90% 압축된 .zip 아카이브 바이너리(Uint8Array)로 변환
 * - 앱 복원용 원본(backup_data.json) 100% 보존
 * - PC에서 A4 인쇄 및 PDF 저장이 가능한 예쁜 HTML 시험지/해설지 및 텍스트 파일 함께 동봉
 */
export function compressBackupToZip(jsonString: string): Uint8Array {
  const dateStr = new Date().toISOString().slice(0, 10);

  let topics: any[] = [];
  let units: any[] = [];
  let questions: any[] = [];
  let attempts: any[] = [];
  let reviewStates: any[] = [];
  let customNoteQuestionIds: string[] = [];
  let backupVersion = 1;
  let exportedAt = new Date().toISOString();

  try {
    const parsed = JSON.parse(jsonString);
    topics = parsed.topics || [];
    units = parsed.units || [];
    questions = parsed.questions || [];
    attempts = parsed.attempts || [];
    reviewStates = parsed.reviewStates || [];
    customNoteQuestionIds = parsed.customNoteQuestionIds || [];
    backupVersion = Number.isInteger(parsed.version) ? parsed.version : 1;
    exportedAt = typeof parsed.exportedAt === 'string' ? parsed.exportedAt : exportedAt;
  } catch {
    // JSON 파싱 실패 시 원본만 패키징
  }

  const zipEntries: Record<string, Uint8Array> = {
    'backup_data.json': strToU8(jsonString),
  };

  zipEntries['manifest.json'] = strToU8(
    JSON.stringify(
      {
        format: 'celueste-portable-backup',
        version: backupVersion,
        exportedAt,
        counts: {
          topics: topics.length,
          units: units.length,
          questions: questions.length,
          reviewItems: reviewStates.length,
          customNoteItems: customNoteQuestionIds.length,
        },
        excludedSecrets: ['apiKey'],
      },
      null,
      2
    )
  );

  // 문제 데이터가 보관되어 있는 경우: 인쇄/PDF용 실전 시험지와 해설지, 텍스트본 생성하여 함께 압축
  if (questions.length > 0) {
    const examHtml = generateExamSheetHtml(topics, questions, dateStr);
    const answerHtml = generateAnswerSheetHtml(topics, questions, dateStr);
    const wrongNoteHtml = generateWrongNoteHtml(
      topics,
      units,
      questions,
      attempts,
      reviewStates,
      customNoteQuestionIds,
      dateStr
    );
    const examTxt = generateExamSheetTxt(topics, questions, dateStr);

    zipEntries['인쇄용/1. 전체 문제지.html'] = strToU8(examHtml);
    zipEntries['인쇄용/2. 정답과 해설.html'] = strToU8(answerHtml);
    zipEntries['인쇄용/3. 나만의 오답노트.html'] = strToU8(wrongNoteHtml);
    zipEntries['기타/문제집 편집용.txt'] = strToU8(examTxt);
  }

  const topicSummary = topics.map((t: any) => t.name).join(', ') || '전체';
  const readmeText = `========================================================================
[ Celueste AI 학습 데이터 백업 & 실전 문제집 올인원 패키지 ]
========================================================================
생성 일자: ${dateStr}
보관 문항수: 총 ${questions.length}문항 (과목: ${topicSummary})

[ 📂 내부 파일 안내 및 활용법 ]
1. "인쇄용/1. 전체 문제지.html"
   - 컴퓨터에서 더블클릭하면 크롬/엣지 브라우저에서 실제 시험지 양식으로 열립니다.
   - 키보드의 'Ctrl + P'를 누르시면 A4 용지로 바로 인쇄하거나 [PDF로 저장]할 수 있습니다!
   - 정답과 해설이 가려져 있어 실제 시험처럼 종이에 풀어볼 수 있습니다.

2. "인쇄용/2. 정답과 해설.html"
   - 빠른 정답 확인표 및 각 문항별 심층 해설이 깔끔하게 정리되어 있습니다.
   - 역시 'Ctrl + P'로 해설집 PDF 저장 및 인쇄가 가능합니다.

3. "인쇄용/3. 나만의 오답노트.html"
   - 사용자가 직접 저장한 문제만 모아 손필기 공간과 재복습 체크란을 제공합니다.

4. "기타/문제집 편집용.txt"
   - 필요할 때만 한글(HWP)이나 MS Word에서 편집하는 보조 파일입니다.

5. "backup_data.json"
   - Celueste 앱의 원본 데이터베이스입니다.
   - 이 ZIP 파일 자체를 앱의 [설정 ➔ 복원]에서 선택하시면 1초 만에 스마트폰 앱으로 복원됩니다.

※ API 키는 보안상 이 백업에 포함되지 않습니다. 새 기기에서는 직접 다시 등록해 주세요.
========================================================================`;

  zipEntries['README.txt'] = strToU8(readmeText);

  return zipSync(zipEntries);
}

/**
 * 전달받은 바이너리(Uint8Array) 또는 텍스트가 ZIP 압축 파일인지 확인하고 JSON 문자열로 압축 해제
 * - ZIP 파일일 경우: 압축을 풀어 내부 backup_data.json 추출
 * - 일반 JSON 텍스트일 경우: 그대로 반환 (하위 호환 100% 보장)
 */
export function decompressBackupPayload(data: Uint8Array | string): string {
  // 이미 문자열로 전달된 경우
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return trimmed;
    }
    // Base64 인코딩된 ZIP일 가능성 검사
    try {
      const u8 = base64ToU8(trimmed);
      if (u8.length >= 4 && u8[0] === 0x50 && u8[1] === 0x4b) {
        return extractJsonFromZipU8(u8);
      }
    } catch {
      // 일반 문자열로 처리
    }
    return trimmed;
  }

  // Uint8Array 바이너리인 경우: ZIP 매직 넘버(PK\x03\x04 또는 0x50, 0x4b) 확인
  if (data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b) {
    return extractJsonFromZipU8(data);
  }

  // 일반 UTF-8 JSON 바이너리
  return strFromU8(data);
}

function extractJsonFromZipU8(zipBytes: Uint8Array): string {
  const unzipped = unzipSync(zipBytes);
  // 1. backup_data.json 탐색
  if (unzipped['backup_data.json']) {
    return strFromU8(unzipped['backup_data.json']);
  }

  // 2. 폴더 안에 보관된 backup_data.json 탐색
  const nestedBackupName = Object.keys(unzipped).find((filename) =>
    filename.replace(/\\/g, '/').endsWith('/backup_data.json')
  );
  if (nestedBackupName) {
    return strFromU8(unzipped[nestedBackupName]);
  }

  // 3. 구버전 호환: 실제 백업 스키마를 가진 .json만 탐색
  for (const filename of Object.keys(unzipped)) {
    if (filename.toLowerCase().endsWith('.json')) {
      const candidate = strFromU8(unzipped[filename]);
      try {
        const parsed = JSON.parse(candidate);
        if (
          parsed &&
          Number.isInteger(parsed.version) &&
          Array.isArray(parsed.topics) &&
          Array.isArray(parsed.questions)
        ) {
          return candidate;
        }
      } catch {
        // manifest 등 복원 데이터가 아닌 JSON은 건너뛴다.
      }
    }
  }

  throw new Error('압축 파일 내에 유효한 백업 데이터(backup_data.json)를 찾을 수 없습니다.');
}

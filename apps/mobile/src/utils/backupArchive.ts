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

/**
 * 앱 복원용 JSON을 ZIP으로 보관한다. 인쇄용 문제집은 별도 기능에서 만든다.
 */
export function compressBackupToZip(jsonString: string): Uint8Array {
  const dateStr = new Date().toISOString().slice(0, 10);

  let topics: any[] = [];
  let questions: any[] = [];
  let reviewStates: any[] = [];
  let customNoteQuestionIds: string[] = [];
  let backupVersion = 1;
  let exportedAt = new Date().toISOString();

  try {
    const parsed = JSON.parse(jsonString);
    topics = parsed.topics || [];
    questions = parsed.questions || [];
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

  const topicSummary = topics.map((t: any) => t.name).join(', ') || '전체';
  const readmeText = `========================================================================
[ Celueste 학습 데이터 복원용 백업 ]
========================================================================
생성 일자: ${dateStr}
보관 문항수: 총 ${questions.length}문항 (과목: ${topicSummary})

[ 파일 안내 ]
backup_data.json: 앱에서 다시 불러올 학습 데이터와 랭킹 복구 정보
manifest.json: 백업 생성 시각과 데이터 개수

앱의 [설정 → 데이터 관리 → 복원]에서 이 ZIP 파일을 선택하세요.
인쇄용 PDF 문제집은 [내 문제집 내보내기]에서 따로 만듭니다.

※ API 키는 보안상 이 백업에 포함되지 않습니다. 새 기기에서는 직접 다시 등록해 주세요.
※ 랭킹 복구 정보가 포함될 수 있으니 파일을 안전하게 보관하세요.
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

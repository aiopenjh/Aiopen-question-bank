import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';

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
 * JSON 문자열을 85~90% 압축된 .zip 아카이브 바이너리(Uint8Array)로 변환
 */
export function compressBackupToZip(jsonString: string): Uint8Array {
  const dateStr = new Date().toISOString().slice(0, 10);
  const readmeText = `[Celueste AI 문제은행 안전 백업 아카이브]
생성 일자: ${dateStr}
포맷: ZIP 압축 아카이브 (앱에서 파일 선택 시 자동으로 압축이 풀려 복원됩니다.)
내부 파일: backup_data.json`;

  return zipSync({
    'backup_data.json': strToU8(jsonString),
    'README.txt': strToU8(readmeText),
  });
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

  // 2. .json 확장자를 가진 임의의 파일 탐색
  for (const filename of Object.keys(unzipped)) {
    if (filename.toLowerCase().endsWith('.json')) {
      return strFromU8(unzipped[filename]);
    }
  }

  throw new Error('압축 파일 내에 유효한 백업 데이터(backup_data.json)를 찾을 수 없습니다.');
}

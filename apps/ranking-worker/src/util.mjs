// 공용 유틸: 토큰 생성/해시, 한국 날짜, JSON 응답, CORS
// Reference: docs/ranking/RANKING_API_SPEC.md §1, §5

export function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(origin),
    },
  });
}

export function errorResponse(code, message, status, origin) {
  return jsonResponse({ error: { code, message } }, status, origin);
}

export function corsHeaders(origin) {
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    Vary: 'Origin',
  };
}

/** 요청 Origin이 허용 목록에 있으면 그 값을, 아니면 null을 반환한다. */
export function resolveAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim());
  return allowed.includes(origin) ? origin : null;
}

/** 무작위 토큰: participantId(pt_), deviceToken(dt_), recoveryToken(rt_) 공용 */
export function randomToken(prefix) {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}

/** 토큰 원문을 SHA-256 해시로. 서버 DB에는 해시만 저장한다 (API_SPEC §1). */
export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 서버 기준 Asia/Seoul 오늘 날짜 (YYYY-MM-DD). 기기 시각을 신뢰하지 않는다. */
export function todaySeoul(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isoNow() {
  return new Date().toISOString();
}

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 12;
const BLOCKED_NICKNAME_PATTERNS = [
  // 운영자 및 서비스 사칭
  /admin/i,
  /운영자/,
  /관리자/,
  /celueste/i,
  // 한글 욕설과 자모 축약형
  /씨발|시발|씨바|시바|씨빨|씹|ㅅㅂ|ㅆㅂ/,
  /병신|븅신|ㅂㅅ/,
  /좆|존나|ㅈㄴ|개새끼|개색끼|개쉐끼|새끼|ㅅㄲ/,
  /미친놈|미친년|닥쳐|꺼져|엿먹/,
  // 성적·음란 표현
  /섹스|쎅스|ㅅㅅ|야동|포르노|자위|딸딸이|성기|자지|보지|음란|강간|성폭행|성매매|매춘|페니스|딜도|오르가즘/,
  // 대표적인 영문 욕설·성적 표현
  /fuck|fuk|shit|bitch|cunt|porn|sex|hentai|pussy|dick|cock/i,
];

export function validateNickname(raw) {
  if (typeof raw !== 'string') return { ok: false, reason: 'INVALID_INPUT' };
  const nickname = raw.normalize('NFC').trim();
  if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) {
    return { ok: false, reason: 'INVALID_INPUT' };
  }
  // 전각 문자와 대소문자를 통일하고 공백·기호를 제거해 "관 리 자", "s.e.x" 같은 우회를 막는다.
  const filterText = nickname
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/[\p{P}\p{S}\s_]+/gu, '');
  if (!filterText || BLOCKED_NICKNAME_PATTERNS.some((pattern) => pattern.test(filterText))) {
    return { ok: false, reason: 'INVALID_INPUT' };
  }
  return { ok: true, nickname };
}

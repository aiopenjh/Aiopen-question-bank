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
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
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
// 최소한의 금칙어/운영자 사칭 차단. 실제 운영 전 목록을 확장한다.
const BLOCKED_NICKNAME_PATTERNS = [/admin/i, /운영자/, /관리자/, /celueste/i, /^\s*$/];

export function validateNickname(raw) {
  if (typeof raw !== 'string') return { ok: false, reason: 'INVALID_INPUT' };
  const nickname = raw.normalize('NFC').trim();
  if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) {
    return { ok: false, reason: 'INVALID_INPUT' };
  }
  if (BLOCKED_NICKNAME_PATTERNS.some((pattern) => pattern.test(nickname))) {
    return { ok: false, reason: 'INVALID_INPUT' };
  }
  return { ok: true, nickname };
}

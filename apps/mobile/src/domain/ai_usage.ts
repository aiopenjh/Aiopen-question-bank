/**
 * 하루 AI 요청 사용량 규칙. 무료 한도에 가까워지면 안내만 하고 요청을 막지 않는다.
 * Gemini 한도는 프로젝트·모델별로 적용되고 하루 요청 수(RPD)는 태평양 시간 자정에 초기화된다
 * (공식 rate limits 문서). 공식 문서는 숫자를 공개하지 않아 아래 수치는 2026-09-30 사용자
 * AI Studio 무료 등급 화면 기준이며, 등급이나 정책이 바뀌면 이 표만 고친다.
 * 같은 키를 다른 기기나 AI Studio에서 쓴 요청은 셀 수 없으므로 사용량은 이 기기 기준 추정치다.
 */

// ai_client가 시도하는 순서와 같다(3.5 Flash-Lite부터).
export const GEMINI_MODEL_ORDER = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
] as const;

export const GEMINI_DAILY_REQUEST_LIMITS: Readonly<Record<string, number>> = {
  'gemini-3.5-flash-lite': 500,
  'gemini-3.5-flash': 20,
  'gemini-3.6-flash': 20,
  'gemini-3.7-flash': 20,
  'gemini-3.8-flash': 20,
};

export const AI_USAGE_WARNING_RATIO = 0.9;

export interface AiRequestUsage {
  day: string; // 태평양 시간 기준 YYYY-MM-DD
  counts: Record<string, number>;
}

/** processed: 서버가 요청을 처리함(한도에 포함). daily_exhausted: 서버가 오늘 한도 소진(429)을 알림. */
export type AiRequestEvent = { model: string; outcome: 'processed' | 'daily_exhausted' };

export type GeminiQuotaScope = 'daily' | 'minute' | 'unknown';

type AiRequestListener = (event: AiRequestEvent) => unknown;
let requestListener: AiRequestListener | null = null;

/** 앱 시작 시 저장소 기록 함수를 연결한다. 연결 전(테스트 등)에는 아무것도 기록하지 않는다. */
export function setAiRequestListener(listener: AiRequestListener | null): void {
  requestListener = listener;
}

/** 기록 실패가 AI 요청 결과를 바꾸지 않도록 예외를 삼킨다. */
export function reportAiRequest(event: AiRequestEvent): void {
  try {
    const pending = requestListener?.(event);
    if (pending && typeof (pending as Promise<unknown>).catch === 'function') {
      (pending as Promise<unknown>).catch(() => {});
    }
  } catch {
    // 사용량 기록은 안내용이므로 실패해도 요청을 막지 않는다.
  }
}

function nthSundayOfMonth(year: number, month: number, n: number): number {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return 1 + ((7 - firstWeekday) % 7) + 7 * (n - 1);
}

/** 미국 태평양 시간의 UTC 차이(서머타임 -7, 표준시 -8). 3월 둘째 일요일 ~ 11월 첫째 일요일 02:00(현지). */
export function getPacificUtcOffsetHours(now: Date = new Date()): number {
  const year = now.getUTCFullYear();
  const dstStart = Date.UTC(year, 2, nthSundayOfMonth(year, 2, 2), 10);
  const dstEnd = Date.UTC(year, 10, nthSundayOfMonth(year, 10, 1), 9);
  const time = now.getTime();
  return time >= dstStart && time < dstEnd ? -7 : -8;
}

export function getAiQuotaDay(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + getPacificUtcOffsetHours(now) * 3600 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** 태평양 자정을 한국 시간(UTC+9)으로 옮긴 시각: 서머타임이면 16시, 표준시면 17시. */
export function getQuotaResetKoreanHour(now: Date = new Date()): number {
  return 9 - getPacificUtcOffsetHours(now);
}

export function getTodayCounts(usage: AiRequestUsage | null, now: Date = new Date()): Record<string, number> {
  return usage && usage.day === getAiQuotaDay(now) ? usage.counts : {};
}

/**
 * 다음에 쓰일 모델(한도가 남은 첫 모델)이 90% 이상 찼거나 모든 모델이 한도에 닿았으면 안내 문구를 돌려준다.
 * 모델 이름은 보여주지 않고 오늘 요청 횟수만 알린다.
 */
export function getAiUsageWarning(usage: AiRequestUsage | null, now: Date = new Date()): string | null {
  const counts = getTodayCounts(usage, now);
  const total = Object.values(counts).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const next = GEMINI_MODEL_ORDER.find((model) => (counts[model] ?? 0) < GEMINI_DAILY_REQUEST_LIMITS[model]);
  if (next && (counts[next] ?? 0) < Math.ceil(GEMINI_DAILY_REQUEST_LIMITS[next] * AI_USAGE_WARNING_RATIO)) {
    return null;
  }
  return `오늘 AI 요청을 ${total}회 사용했습니다. 무료 한도에 가까워 곧 문제 생성이 제한될 수 있습니다.`;
}

/** 429 응답 본문에서 하루 한도인지 분당 한도인지 읽는다. 본문이 없거나 알 수 없으면 unknown. */
export function readGeminiQuotaScope(body: unknown): GeminiQuotaScope {
  let text = '';
  try {
    text = typeof body === 'string' ? body : JSON.stringify(body ?? '');
  } catch {
    return 'unknown';
  }
  if (/PerDay/i.test(text)) return 'daily';
  if (/PerMinute/i.test(text)) return 'minute';
  return 'unknown';
}

export function describeRateLimit(scope: GeminiQuotaScope | undefined, now: Date = new Date()): string {
  if (scope === 'daily') {
    return `오늘 AI 요청 한도를 모두 사용했습니다. 한국 시간 오후 ${getQuotaResetKoreanHour(now) - 12}시에 초기화됩니다.`;
  }
  if (scope === 'minute') {
    return '짧은 시간에 요청이 많아 잠시 제한되었습니다. 1분쯤 기다린 뒤 다시 시도해 주세요.';
  }
  return 'AI 호출에 실패했습니다. 잠시 기다린 뒤 다시 시도해 주세요.';
}

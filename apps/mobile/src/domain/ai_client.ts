/**
 * Universal AI Completion & Communication Engine
 * Supports Google Gemini (with smart timeout fallback and cascade), Anthropic Claude, and OpenAI GPT.
 */

import { DEFAULT_GEMINI_MODEL } from '../data/db';
import { AiDocumentInput } from '../contracts/types';
import { ensureAiDataNoticeAccepted } from './ai_data_notice';

// 키와 모델별 단기 대기 상태. 메모리에만 보관하며 저장하거나 로그로 출력하지 않는다.
const geminiRateLimits = new Map<string, Map<string, number>>();
// 2026-09-23 공식 정식 모델 목록 확인. 3.5 Flash-Lite부터 시도한다.
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  DEFAULT_GEMINI_MODEL,
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
];

export type AiCompletionResult = {
  text: string;
  groundingSources: Array<{ title: string; uri: string }>;
};

function getRetryAfterSeconds(headerValue: string | null): number {
  if (!headerValue) return 30;
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
  const retryDate = Date.parse(headerValue);
  if (Number.isFinite(retryDate)) {
    return Math.max(1, Math.ceil((retryDate - Date.now()) / 1000));
  }
  return 30;
}

function createGeminiRateLimitError(waitSeconds: number): Error {
  const error = new Error(
    `AI 호출에 실패했습니다. 약 ${waitSeconds}초 기다린 뒤 다시 시도해 주세요.`
  );
  error.name = 'GeminiRateLimitError';
  return error;
}

function createGenerationCancelledError(): Error {
  const error = new Error('사용자가 문제 출제를 취소했습니다.');
  error.name = 'GenerationCancelledError';
  return error;
}

// 출제 경로는 취소와 같은 이름으로 처리한다(기존 '문제 출제가 취소되었습니다' 안내).
function createAiDataNoticeDeclinedError(): Error {
  const error = new Error('AI 전송 안내를 확인하지 않아 요청을 보내지 않았습니다.');
  error.name = 'GenerationCancelledError';
  return error;
}

/**
 * AI JSON 응답 파싱 유틸리티 (마크다운 백틱 제거)
 */
export function parseAiJsonResponse<T>(rawText: string): T {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return JSON.parse(cleaned.trim());
}

/**
 * 범용 최신 AI 통신 엔진
 * - Gemini 3.5 Flash-Lite부터 최신 정식 모델까지 순서대로 시도
 * - Claude Sonnet 4.6 (sk-ant- 키) 및 OpenAI GPT-4o (sk- 키) 멀티 프로바이더 지원
 * - Gemini는 3.5 이상 모델 안에서만 자동 전환
 */
export async function callUniversalAiCompletion(
  apiKey: string,
  prompt: string,
  signal?: AbortSignal,
  documentInput?: AiDocumentInput,
  options?: { enableGoogleSearch?: boolean }
): Promise<AiCompletionResult> {
  const trimmedKey = apiKey.trim();
  if (signal?.aborted) throw createGenerationCancelledError();
  // 데이터 전송 안내를 확인하지 않으면 네트워크 요청을 보내지 않는다.
  if (!(await ensureAiDataNoticeAccepted())) throw createAiDataNoticeDeclinedError();
  if (signal?.aborted) throw createGenerationCancelledError();

  // 1. Anthropic Claude Sonnet 4.6 지원 (sk-ant- 시작 키)
  if (trimmedKey.startsWith('sk-ant-')) {
    if (options?.enableGoogleSearch) {
      throw new Error('최신 정보 확인 기능을 지원하는 AI 연결이 필요합니다.');
    }
    if (documentInput) throw new Error('PDF 분석을 지원하는 AI 연결이 필요합니다.');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': trimmedKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true', // 웹(브라우저) 직접 호출 CORS 허용 헤더
      },
      signal,
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Claude Sonnet 4.6 통신 실패 (${res.status})`);
    }
    const data = await res.json();
    const rawText = data.content?.[0]?.text;
    if (!rawText) throw new Error('Claude로부터 빈 응답을 받았습니다.');
    return { text: rawText, groundingSources: [] };
  }

  // 2. OpenAI GPT-4o 지원 (sk- 시작 키)
  if (trimmedKey.startsWith('sk-')) {
    if (options?.enableGoogleSearch) {
      throw new Error('최신 정보 확인 기능을 지원하는 AI 연결이 필요합니다.');
    }
    if (documentInput) throw new Error('PDF 분석을 지원하는 AI 연결이 필요합니다.');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${trimmedKey}`,
      },
      signal,
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI GPT-4o 통신 실패 (${res.status})`);
    }
    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) throw new Error('OpenAI로부터 빈 응답을 받았습니다.');
    return { text: rawText, groundingSources: [] };
  }

  // 3. Google Gemini: 3.5 이상 모델만 사용
  for (const [key, limits] of geminiRateLimits) {
    for (const [model, until] of limits) {
      if (until <= Date.now()) limits.delete(model);
    }
    if (limits.size === 0) geminiRateLimits.delete(key);
  }

  let lastError: any = null;
  let rateLimitError: Error | null = null;

  // 각 후보는 한 요청당 한 번만 시도한다. 429가 나도 다른 모델의 할당량은 별개다.
  for (const model of GEMINI_MODELS) {
    if (signal?.aborted) throw createGenerationCancelledError();
    const until = geminiRateLimits.get(trimmedKey)?.get(model) ?? 0;
    if (until > Date.now()) {
      rateLimitError = createGeminiRateLimitError(Math.ceil((until - Date.now()) / 1000));
      continue;
    }

    let timeoutTimer: any = null;
    let externalAbortHandler: (() => void) | null = null;
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      if (controller) {
        // 통신 시간 만료(25초 초과) 시 자동 중단 후 다음 가용 모델로 자동 전환
        timeoutTimer = setTimeout(() => controller.abort(), documentInput ? 60000 : 25000);
        if (signal) {
          externalAbortHandler = () => controller.abort();
          signal.addEventListener('abort', externalAbortHandler, { once: true });
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': trimmedKey,
        },
        signal: controller?.signal,
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              ...(documentInput
                ? [{
                    inlineData: {
                      mimeType: documentInput.mimeType,
                      data: documentInput.base64Data,
                    },
                  }]
                : []),
            ],
          }],
          ...(options?.enableGoogleSearch ? { tools: [{ google_search: {} }] } : {}),
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 8192,
            temperature: 0.2, // 환각(Hallucination) 방지를 위한 엄격한 결정론적 온도 설정
          },
        }),
      });
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (signal && externalAbortHandler) {
        signal.removeEventListener('abort', externalAbortHandler);
      }

      if (res.status === 404) {
        lastError = new Error(`Gemini 모델 [${model}] 404 Not Found`);
        console.warn(`Gemini 모델 [${model}] 404 -> 다음 호환 모델 자동 전환`);

        continue;
      }

      if (res.status === 429) {
        const waitSeconds = getRetryAfterSeconds(res.headers.get('retry-after'));
        const limits = geminiRateLimits.get(trimmedKey) ?? new Map<string, number>();
        limits.set(model, Date.now() + waitSeconds * 1000);
        geminiRateLimits.set(trimmedKey, limits);
        rateLimitError = createGeminiRateLimitError(waitSeconds);
        continue;
      }

      // 구글 AI 서버 일시적 과부하와 게이트웨이 오류는 3.5 이상 후보 안에서만 전환합니다.
      if (res.status === 503 || res.status === 502 || res.status === 504 || res.status === 500) {
        lastError = new Error(`Gemini 모델 [${model}] 서버 일시 혼잡 (${res.status})`);
        console.warn(`Gemini 모델 [${model}] 서버 혼잡 (${res.status}) -> 다음 가용 모델 자동 전환`);
        continue;
      }

      if (!res.ok) {
        if (res.status === 400) {
          throw new Error(`등록된 API 키가 유효하지 않습니다 (Google 400 오류). Google AI Studio(https://aistudio.google.com)에서 발급받은 정식 API 키(보통 AIzaSy...로 시작)인지 확인해 주세요.`);
        }
        if (res.status === 403) {
          throw new Error(`Google AI 접근 권한 거부 (403): API 키의 권한이나 활성화 상태를 확인해 주세요.`);
        }
        throw new Error(`Gemini API 통신 실패 (${res.status})`);
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      const rawJson = candidate?.content?.parts?.find(
        (part: any) => typeof part?.text === 'string'
      )?.text;
      if (!rawJson) {
        throw new Error(`Gemini 모델 [${model}]로부터 비어있는 응답을 받았습니다.`);
      }
      const groundingSources = Array.isArray(candidate?.groundingMetadata?.groundingChunks)
        ? candidate.groundingMetadata.groundingChunks
            .map((chunk: any) => chunk?.web)
            .filter((web: any) => typeof web?.uri === 'string' && typeof web?.title === 'string')
            .map((web: any) => ({ title: web.title, uri: web.uri }))
        : [];
      return { text: rawJson, groundingSources };
    } catch (err: any) {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (signal && externalAbortHandler) {
        signal.removeEventListener('abort', externalAbortHandler);
      }
      lastError = err;
      const msg = err?.message || '';
      if (signal?.aborted) {
        throw createGenerationCancelledError();
      }
      // 통신 시간 만료, AbortError, 서버 혼잡 시 다음 3.5 이상 모델로만 전환
      if (
        msg.includes('404') ||
        msg.includes('503') ||
        msg.includes('502') ||
        msg.includes('500') ||
        msg.includes('504') ||
        msg.includes('high demand') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('Resource has been exhausted') ||
        err.name === 'AbortError' ||
        msg.includes('aborted') ||
        msg.includes('timeout') ||
        msg.includes('Network request failed')
      ) {
        console.warn(`Gemini 모델 [${model}] 통신 지연/타임아웃 발생 -> 다음 3.5 이상 모델로 자동 우회 시도`);
        continue;
      }
      throw err;
    }
  }

  // 실제 통신 오류가 섞인 경우 전부 사용량 제한이라고 단정하지 않는다.
  if (!lastError && rateLimitError) throw rateLimitError;
  const detailedMsg = lastError?.message || '';
  if (detailedMsg.includes('503') || detailedMsg.includes('high demand') || detailedMsg.includes('UNAVAILABLE')) {
    throw new Error('Google Gemini AI 서버가 현재 일시적인 전 세계 트래픽 폭주(503 High Demand) 상태입니다. 약 10~30초 후 다시 시도해 주세요.');
  }

  throw lastError || new Error('최신 Gemini AI 모델에 연결할 수 없습니다. Google AI Studio에서 발급받은 정식 API 키인지 확인해 주세요.');
}

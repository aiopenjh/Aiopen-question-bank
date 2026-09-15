/**
 * Universal AI Completion & Communication Engine
 * Supports Google Gemini (with smart timeout fallback and cascade), Anthropic Claude, and OpenAI GPT.
 */

import { getPreferredAiModel } from '../data/db';

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
 * - Gemini 최신 버전(3.5 Flash) 기본 적용
 * - Claude 3.5 Sonnet (sk-ant- 키) 및 OpenAI GPT-4o (sk- 키) 멀티 프로바이더 지원
 * - 404 방어: 최신 모델부터 호환 모델까지 자동 캐스케이드 폴백
 */
export async function callUniversalAiCompletion(apiKey: string, prompt: string): Promise<string> {
  const trimmedKey = apiKey.trim();

  // 1. Anthropic Claude 3.5 Sonnet 지원 (sk-ant- 시작 키)
  if (trimmedKey.startsWith('sk-ant-')) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': trimmedKey,
        'anthropic-version': '2023-06-01',
        'dangerously-allow-browser': 'true',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude 3.5 통신 실패 (${res.status}): ${errText}`);
    }
    const data = await res.json();
    const rawText = data.content?.[0]?.text;
    if (!rawText) throw new Error('Claude로부터 빈 응답을 받았습니다.');
    return rawText;
  }

  // 2. OpenAI GPT-4o 지원 (sk- 시작 키)
  if (trimmedKey.startsWith('sk-')) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${trimmedKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI GPT-4o 통신 실패 (${res.status}): ${errText}`);
    }
    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) throw new Error('OpenAI로부터 빈 응답을 받았습니다.');
    return rawText;
  }

  // 3. Google Gemini: 3.5 최우선 사용 및 통신 시간 만료(타임아웃) 시 다음 버전 자동 우회
  const preferredModel = await getPreferredAiModel();
  let candidateModels = Array.from(
    new Set([
      preferredModel,
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ].filter(Boolean) as string[])
  );

  let lastError: any = null;
  let triedModels = new Set<string>();

  for (let i = 0; i < candidateModels.length; i++) {
    const model = candidateModels[i];
    if (triedModels.has(model)) continue;
    triedModels.add(model);

    let timeoutTimer: any = null;
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(trimmedKey)}`;
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      if (controller) {
        // 통신 시간 만료(25초 초과) 시 자동 중단 후 다음 가용 모델로 자동 전환
        timeoutTimer = setTimeout(() => controller.abort(), 25000);
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': trimmedKey,
        },
        signal: controller?.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 8192,
            temperature: 0.2, // 환각(Hallucination) 방지를 위한 엄격한 결정론적 온도 설정
          },
        }),
      });
      if (timeoutTimer) clearTimeout(timeoutTimer);

      if (res.status === 404) {
        lastError = new Error(`Gemini 모델 [${model}] 404 Not Found`);
        console.warn(`Gemini 모델 [${model}] 404 -> 다음 호환 모델 자동 전환`);

        // 만약 등록된 후보 모델들이 모두 404인 경우, 구글 API 모델 목록 엔드포인트를 동적 질의하여 가용 모델 자동 발견
        if (i === candidateModels.length - 1) {
          try {
            const listRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmedKey)}`
            );
            if (listRes.ok) {
              const listData = await listRes.json();
              const activeGoogleModels: string[] = (listData.models || [])
                .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
                .map((m: any) => m.name.replace('models/', ''));
              for (const gm of activeGoogleModels) {
                if (!triedModels.has(gm)) {
                  candidateModels.push(gm);
                }
              }
            }
          } catch {
            // 네트워크 오류 시 기존 목록 유지
          }
        }
        continue;
      }

      // 구글 AI 서버 일시적 과부하 (503 High Demand), 게이트웨이 오류(502/504), 할당량(429) 자동 전환
      if (res.status === 503 || res.status === 502 || res.status === 504 || res.status === 500 || res.status === 429) {
        const errBody = await res.text();
        lastError = new Error(`Gemini 모델 [${model}] 서버 일시 혼잡 (${res.status}): ${errBody}`);
        console.warn(`Gemini 모델 [${model}] 서버 혼잡 (${res.status}) -> 다음 가용 모델 자동 전환`);
        continue;
      }

      if (!res.ok) {
        const errorText = await res.text();
        if (res.status === 400) {
          throw new Error(`등록된 API 키가 유효하지 않습니다 (Google 400 오류). Google AI Studio(https://aistudio.google.com)에서 발급받은 정식 API 키(보통 AIzaSy...로 시작)인지 확인해 주세요.`);
        }
        if (res.status === 403) {
          throw new Error(`Google AI 접근 권한 거부 (403): API 키의 권한이나 활성화 상태를 확인해 주세요.`);
        }
        throw new Error(`Gemini API 통신 실패 (${res.status}): ${errorText}`);
      }

      const data = await res.json();
      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) {
        throw new Error(`Gemini 모델 [${model}]로부터 비어있는 응답을 받았습니다.`);
      }
      return rawJson;
    } catch (err: any) {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      lastError = err;
      const msg = err?.message || '';
      // 통신 시간 만료, AbortError, 서버 혼잡 시 즉시 다음 버전 모델로 자동 폴백
      if (
        msg.includes('404') ||
        msg.includes('503') ||
        msg.includes('502') ||
        msg.includes('500') ||
        msg.includes('504') ||
        msg.includes('429') ||
        msg.includes('high demand') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('Resource has been exhausted') ||
        err.name === 'AbortError' ||
        msg.includes('aborted') ||
        msg.includes('timeout') ||
        msg.includes('Network request failed')
      ) {
        console.warn(`Gemini 모델 [${model}] 통신 지연/타임아웃 발생 -> 다음 상위 버전으로 자동 우회 시도`);
        continue;
      }
      throw err;
    }
  }

  const detailedMsg = lastError?.message || '';
  if (detailedMsg.includes('503') || detailedMsg.includes('high demand') || detailedMsg.includes('UNAVAILABLE')) {
    throw new Error('Google Gemini AI 서버가 현재 일시적인 전 세계 트래픽 폭주(503 High Demand) 상태입니다. 약 10~30초 후 다시 시도해 주세요.');
  }

  throw lastError || new Error('최신 Gemini AI 모델에 연결할 수 없습니다. Google AI Studio에서 발급받은 정식 API 키인지 확인해 주세요.');
}

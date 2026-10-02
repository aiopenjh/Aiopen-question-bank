import { Platform } from 'react-native';
import AsyncStorage from '../data/app_storage';

const CHOICE_KEY = '@celueste:ai_connection_v1';
const SHARED_CHOICE_KEY = 'ai-login-connector:model-selection-v1';
export type DesktopProviderId = 'openai' | 'anthropic' | 'google';
export type AiConnectionChoice =
  | { mode: 'api-key' }
  | { mode: 'desktop'; providerId: DesktopProviderId; model: string; acceptApiUsage: boolean };
export interface DesktopProviderStatus {
  id: DesktopProviderId;
  name: string;
  description: string;
  signupUrl: string;
  authMode: string;
  status: string;
  canConnect: boolean;
  canInfer: boolean;
  activeAccountId: string | null;
  accounts: Array<{ id: string; label: string; signedIn: boolean }>;
  lastResult: { ok: boolean; message: string } | null;
}
export interface DesktopModel { id: string; name: string }

const messages: Record<string, string> = {
  LOCAL_HOST_REQUIRED: '로그인 시범 연결은 PC의 로컬 시범판에서 사용할 수 있습니다.',
  SESSION_REQUIRED: '로컬 로그인 프로그램을 다시 실행해 연결 화면을 여세요.',
  LOGIN_REQUIRED: '설정에서 AI 계정을 먼저 연결하세요.',
  REAUTH_REQUIRED: '로그인이 만료됐습니다. 설정에서 다시 연결하세요.',
  INFERENCE_NOT_AUTHORIZED: '연결한 계정에 AI 사용 권한이 없습니다. 설정에서 연결 상태를 확인하세요.',
  MODEL_UNAVAILABLE: '설정에서 이 계정으로 사용할 모델을 다시 선택하세요.',
  API_USAGE_CONFIRMATION: 'Google API 사용량·과금 조건을 확인한 뒤 이 연결을 선택하세요.',
  USAGE_LIMIT: '연결한 계정의 AI 사용 한도에 도달했습니다. 공급자에서 한도를 확인하세요.',
  PERMISSION_REQUIRED: '계정 또는 프로젝트의 AI 사용 권한을 확인하세요.',
  STREAM_INTERRUPTED: 'AI 응답이 완료되기 전에 연결이 끊겼습니다. 다시 요청해 주세요.',
  POPUP_BLOCKED: '로그인 창을 열 수 없습니다. 로컬 시범판의 팝업을 허용하세요.',
  CHOICE_INVALID: 'AI 연결 설정을 읽지 못했습니다. 설정에서 사용할 연결을 다시 선택하세요.',
  PDF_UNSUPPORTED: 'PDF 분석을 지원하는 AI 연결이 필요합니다.',
  SEARCH_UNSUPPORTED: '최신 정보 확인 기능을 지원하는 AI 연결이 필요합니다.',
};
export class DesktopAiConnectionError extends Error {
  constructor(public readonly code: string) {
    super(messages[code] ?? '로그인 AI 연결을 완료하지 못했습니다. 설정에서 연결 상태를 확인해 주세요.');
    this.name = 'DesktopAiConnectionError';
  }
}
function cancelled(): Error { const error = new Error('요청이 취소되었습니다.'); error.name = 'GenerationCancelledError'; return error; }
export function isDesktopConnectorEnvironment(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined'
    && window.location.protocol === 'http:' && window.location.hostname === '127.0.0.1';
}
export async function readAiConnectionChoice(): Promise<AiConnectionChoice> {
  let raw: string | null;
  try {
    raw = isDesktopConnectorEnvironment() ? window.localStorage?.getItem(SHARED_CHOICE_KEY) ?? null : null;
    if (raw === null) raw = await AsyncStorage.getItem(CHOICE_KEY);
  }
  catch { throw new DesktopAiConnectionError('CHOICE_INVALID'); }
  if (!raw) return { mode: 'api-key' };
  try {
    const value = JSON.parse(raw);
    if (value?.mode === 'api-key') return { mode: 'api-key' };
    if (value?.mode === 'desktop' && ['openai', 'anthropic', 'google'].includes(value.providerId)
      && typeof value.model === 'string' && value.model.length > 0 && value.model.length <= 160) {
      return { mode: 'desktop', providerId: value.providerId, model: value.model, acceptApiUsage: value.acceptApiUsage === true };
    }
  } catch { /* Corrupt choice must never silently fall back to a charged API key. */ }
  throw new DesktopAiConnectionError('CHOICE_INVALID');
}
export async function saveAiConnectionChoice(choice: AiConnectionChoice): Promise<void> {
  if (isDesktopConnectorEnvironment()) window.localStorage?.setItem(SHARED_CHOICE_KEY, JSON.stringify(choice));
  await AsyncStorage.setItem(CHOICE_KEY, JSON.stringify(choice));
  notifyConnectionChange();
}
function notifyConnectionChange() {
  if (isDesktopConnectorEnvironment() && window.dispatchEvent && typeof Event === 'function') window.dispatchEvent(new Event('ai-login-connector:selectionchange'));
}
export async function isDesktopAiSelected(): Promise<boolean> { return (await readAiConnectionChoice()).mode === 'desktop'; }

let csrf: string | null = null;
function assertLocal() { if (!isDesktopConnectorEnvironment()) throw new DesktopAiConnectionError('LOCAL_HOST_REQUIRED'); }
function timeoutFor(signal?: AbortSignal, milliseconds = 30_000) {
  const controller = new AbortController();
  const forward = () => controller.abort();
  if (signal?.aborted) controller.abort(); else signal?.addEventListener('abort', forward, { once: true });
  const timer = setTimeout(() => controller.abort(), milliseconds);
  return { signal: controller.signal, finish: () => { clearTimeout(timer); signal?.removeEventListener('abort', forward); } };
}
async function sessionCsrf(signal?: AbortSignal): Promise<string> {
  assertLocal();
  if (csrf) return csrf;
  const response = await fetch('/api/session', { headers: { 'x-connector-client': 'desktop-ui' }, credentials: 'same-origin', redirect: 'error', signal });
  if (!response.ok) throw new DesktopAiConnectionError('SESSION_REQUIRED');
  const session = await response.json();
  if (session.protocol !== 'ai-login-connector/1' || typeof session.csrf !== 'string' || !session.csrf) throw new DesktopAiConnectionError('SESSION_REQUIRED');
  csrf = session.csrf; return session.csrf;
}
async function requestHeaders(signal?: AbortSignal) {
  return { 'x-connector-client': 'desktop-ui', 'x-connector-csrf': await sessionCsrf(signal), 'content-type': 'application/json' };
}
async function providerError(response: Response): Promise<never> {
  let code = 'CONNECTION_FAILED';
  try { const result = await response.json(); if (typeof result.error?.code === 'string') code = result.error.code; } catch {}
  if (response.status === 401) csrf = null;
  throw new DesktopAiConnectionError(code);
}
async function requestJson<T>(path: string, body?: object): Promise<T> {
  assertLocal(); const timeout = timeoutFor();
  try {
    const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: await requestHeaders(timeout.signal),
      ...(body ? { body: JSON.stringify(body) } : {}), credentials: 'same-origin', redirect: 'error', signal: timeout.signal });
    if (!response.ok) return await providerError(response);
    return await response.json() as T;
  } catch (error) { if (error instanceof DesktopAiConnectionError) throw error; throw new DesktopAiConnectionError('CONNECTION_FAILED'); }
  finally { timeout.finish(); }
}
export async function getDesktopProviders(): Promise<DesktopProviderStatus[]> {
  const result = await requestJson<{ providers: DesktopProviderStatus[] }>('/api/providers');
  if (!Array.isArray(result.providers)) throw new DesktopAiConnectionError('CONNECTION_FAILED');
  return result.providers;
}
export async function getDesktopModels(id: DesktopProviderId): Promise<DesktopModel[]> {
  const result = await requestJson<{ models: DesktopModel[] }>(`/api/providers/${id}/models`);
  if (!Array.isArray(result.models)) throw new DesktopAiConnectionError('CONNECTION_FAILED');
  return result.models;
}
export async function startDesktopLogin(id: DesktopProviderId, accountId: string | null): Promise<void> {
  assertLocal();
  const result = await requestJson<{ redirectPath: string }>(`/api/providers/${id}/connect`, { accountId });
  if (!/^\/authorize\/[A-Za-z0-9_-]+$/.test(result.redirectPath)) throw new DesktopAiConnectionError('CONNECTION_FAILED');
  window.location.assign(result.redirectPath);
}
export async function disconnectDesktopProvider(id: DesktopProviderId): Promise<string> {
  const result = await requestJson<{ message: string }>(`/api/providers/${id}/disconnect`, {}); notifyConnectionChange(); return result.message;
}
// A fresh login can be used from the main screen before Settings has been opened.
// Existing keys and explicit connection choices are never replaced implicitly.
export async function resolveAiConnection(apiKey: string | null, minimumLength = 8): Promise<AiConnectionChoice> {
  const current = await readAiConnectionChoice();
  if (current.mode === 'desktop' || (apiKey && apiKey.trim().length >= minimumLength)
    || !isDesktopConnectorEnvironment() || await AsyncStorage.getItem(CHOICE_KEY)) return current;
  const provider = (await getDesktopProviders()).find(item => item.id === 'openai' && item.canInfer);
  if (!provider) return current;
  const models = await getDesktopModels(provider.id);
  if (!models.length) throw new DesktopAiConnectionError('MODEL_UNAVAILABLE');
  if (await AsyncStorage.getItem(CHOICE_KEY)) return readAiConnectionChoice();
  const next: AiConnectionChoice = { mode: 'desktop', providerId: provider.id, model: models[0].id, acceptApiUsage: false };
  await saveAiConnectionChoice(next); return next;
}
export async function hasUsableAiConnection(apiKey: string | null, minimumLength = 8): Promise<boolean> {
  const choice = await resolveAiConnection(apiKey, minimumLength);
  if (choice.mode === 'api-key') return Boolean(apiKey && apiKey.trim().length >= minimumLength);
  try { return (await getDesktopProviders()).some(provider => provider.id === choice.providerId && provider.canInfer); }
  catch { return false; }
}
export async function completeWithDesktopAi(
  choice: Extract<AiConnectionChoice, { mode: 'desktop' }>, prompt: string, signal?: AbortSignal
): Promise<string> {
  assertLocal(); if (signal?.aborted) throw cancelled();
  const timeout = timeoutFor(signal, 120_000);
  try {
    const response = await fetch(`/api/providers/${choice.providerId}/generate`, {
      method: 'POST', headers: await requestHeaders(timeout.signal), credentials: 'same-origin', redirect: 'error', signal: timeout.signal,
      body: JSON.stringify({ prompt, model: choice.model, acceptApiUsage: choice.acceptApiUsage }),
    });
    if (!response.ok) return await providerError(response);
    if (!response.body) throw new DesktopAiConnectionError('STREAM_INTERRUPTED');
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let buffer = '', text = '', completed = false;
    try {
      while (true) {
        const { value, done } = await reader.read(); buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        if (buffer.length > 2_000_000) throw new DesktopAiConnectionError('CONNECTION_FAILED');
        let index: number;
        while ((index = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, index); buffer = buffer.slice(index + 1); if (!line) continue;
          const event = JSON.parse(line);
          if (event.type === 'delta' && typeof event.text === 'string') text += event.text;
          else if (event.type === 'completed') completed = true;
          else if (event.type === 'error') throw new DesktopAiConnectionError(typeof event.code === 'string' ? event.code : 'CONNECTION_FAILED');
          if (text.length > 1_000_000) throw new DesktopAiConnectionError('CONNECTION_FAILED');
        }
        if (done) break;
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    if (buffer.trim() || !completed || !text) throw new DesktopAiConnectionError('STREAM_INTERRUPTED');
    return text;
  } catch (error) {
    if (signal?.aborted) throw cancelled();
    if (error instanceof DesktopAiConnectionError) throw error;
    throw new DesktopAiConnectionError('CONNECTION_FAILED');
  } finally { timeout.finish(); }
}

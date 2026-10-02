import { ConnectorError, fetchChecked, fetchJson } from '../errors.js';
import { credentialsFrom } from './openai.js';

const TOKEN = 'https://oauth2.googleapis.com/token';
const API = 'https://generativelanguage.googleapis.com/v1beta';
const CLOUD_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

export function createGeminiProvider({ clientId = '', clientSecret = '', projectId = '', apiAccess = false } = {}) {
  const canInfer = apiAccess === true && Boolean(projectId);
  async function postToken(fetchImpl, fields) {
    return fetchJson(fetchImpl, TOKEN, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...fields, client_id: clientId, ...(clientSecret ? { client_secret: clientSecret } : {}) }),
    });
  }
  const identityOptions = { issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: clientId, jwksUri: 'https://www.googleapis.com/oauth2/v3/certs' };
  function apiHeaders(account) {
    return { authorization: `Bearer ${account.accessToken}`, 'x-goog-user-project': projectId, 'content-type': 'application/json' };
  }
  return {
    id: 'google', name: 'Gemini · Google', signupUrl: 'https://accounts.google.com/signup',
    authMode: canInfer ? 'google-api-oauth' : 'google-identity-oauth', ready: Boolean(clientId),
    capabilities: { login: Boolean(clientId), inference: canInfer, streaming: false },
    requiredScopes: canInfer ? [CLOUD_SCOPE] : [],
    description: canInfer
      ? 'Google 로그인으로 Gemini API를 연결합니다. Gemini 구독 혜택과 별도이며, 설정한 Cloud 프로젝트의 권한·할당량·과금이 적용됩니다.'
      : '개발자의 Google 데스크톱 OAuth 앱 등록 후 로그인할 수 있습니다. 기본 설정은 신원 확인만 제공하며 Gemini 구독이나 AI 사용 권한을 부여하지 않습니다.',
    async begin(transaction, account) {
      if (!clientId) throw new ConnectorError('GOOGLE_SETUP_REQUIRED', '개발자의 Google 데스크톱 OAuth clientId를 먼저 설정해야 합니다.');
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({
        client_id: clientId, response_type: 'code', redirect_uri: transaction.redirectUri,
        scope: `openid profile email${canInfer ? ` ${CLOUD_SCOPE}` : ''}`,
        state: transaction.state, nonce: transaction.nonce, code_challenge_method: 'S256',
        code_challenge: transaction.challenge, access_type: 'offline', prompt: 'consent select_account',
      }).toString();
      if (account?.email) url.searchParams.set('login_hint', account.email);
      return url.toString();
    },
    async exchange(callback, transaction, account, context) {
      const tokens = await postToken(context.fetch, {
        grant_type: 'authorization_code', code: callback.searchParams.get('code'),
        code_verifier: transaction.verifier, redirect_uri: transaction.redirectUri,
      });
      const identity = await context.verifier.validate(tokens.id_token, { ...identityOptions, nonce: transaction.nonce, subject: account?.subject });
      return { ...credentialsFrom(tokens), clientId, issuer: 'https://accounts.google.com', subject: identity.sub,
        email: typeof identity.email === 'string' ? identity.email : '', name: typeof identity.name === 'string' ? identity.name : '' };
    },
    async refresh(account, context) {
      const tokens = await postToken(context.fetch, { grant_type: 'refresh_token', refresh_token: account.refreshToken });
      if (tokens.id_token) await context.verifier.validate(tokens.id_token, { ...identityOptions, subject: account.subject });
      return { ...account, ...credentialsFrom(tokens, account) };
    },
    async revoke(account, context) {
      if (!account.refreshToken && !account.accessToken) return false;
      await fetchChecked(context.fetch, 'https://oauth2.googleapis.com/revoke', {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: account.refreshToken ?? account.accessToken }),
      });
      return true;
    },
    async models(account, context) {
      const models = [], seen = new Set(); let pageToken = '', pages = 0;
      do {
        if (++pages > 25 || seen.has(pageToken)) throw new ConnectorError('CATALOG_INVALID', '모델 목록의 페이지 정보를 확인하지 못했습니다.', 502);
        seen.add(pageToken);
        const url = new URL(`${API}/models`);
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        const result = await fetchJson(context.fetch, url, { headers: apiHeaders(account) });
        if (!Array.isArray(result.models)) throw new ConnectorError('CATALOG_INVALID', 'Gemini 모델 목록을 확인하지 못했습니다.', 502);
        models.push(...result.models.filter(model => model.supportedGenerationMethods?.includes('generateContent') && typeof model.name === 'string')
          .map(model => ({ id: model.name, name: typeof model.displayName === 'string' ? model.displayName : model.name })));
        pageToken = result.nextPageToken ?? '';
        if (typeof pageToken !== 'string' || pageToken.length > 2048) throw new ConnectorError('CATALOG_INVALID', '모델 목록의 페이지 정보가 올바르지 않습니다.', 502);
        if (models.length > 2000) throw new ConnectorError('CATALOG_TOO_LARGE', '모델 목록이 시범 모듈의 크기 제한을 넘었습니다.');
      } while (pageToken);
      return models;
    },
    async generate(account, { model, prompt, signal, onDelta }, context) {
      if (!/^models\/[A-Za-z0-9._-]+$/.test(model)) throw new ConnectorError('MODEL_INVALID', '모델 식별자가 올바르지 않습니다.');
      const result = await fetchJson(context.fetch, `${API}/${model}:generateContent`, {
        method: 'POST', headers: apiHeaders(account), signal,
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
      });
      const candidate = result.candidates?.[0];
      if (candidate?.finishReason !== 'STOP') throw new ConnectorError('INFERENCE_INCOMPLETE', 'Gemini가 응답을 완성하지 못했거나 응답이 제한됐습니다.', 502);
      const text = (candidate.content?.parts ?? []).filter(part => !part.thought && typeof part.text === 'string').map(part => part.text).join('');
      if (!text) throw new ConnectorError('EMPTY_RESPONSE', 'Gemini가 텍스트 응답을 반환하지 않았습니다.', 502);
      if (text.length > 1_000_000) throw new ConnectorError('OUTPUT_TOO_LARGE', '응답이 시범 모듈의 크기 제한을 넘었습니다.');
      await onDelta?.(text);
      return { text, completed: true, model };
    },
  };
}

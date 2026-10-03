import { ConnectorError, fetchChecked, fetchJson } from '../errors.js';

const AUTH = 'https://auth.openai.com/api/accounts/authorize';
const TOKEN = 'https://auth.openai.com/api/accounts/oauth/token';
const RESOURCE = 'https://api.openai.com/v1';
const ISSUER = 'https://auth.openai.com';
const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';

export function credentialsFrom(tokens, previous = {}) {
  if (typeof tokens.access_token !== 'string' || !tokens.access_token
    || typeof tokens.token_type !== 'string' || tokens.token_type.toLowerCase() !== 'bearer'
    || !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0) {
    throw new ConnectorError('TOKEN_INVALID', '공급자가 유효한 사용 자격 증명을 반환하지 않았습니다.', 502);
  }
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? previous.refreshToken,
    idToken: tokens.id_token ?? previous.idToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    scopes: typeof tokens.scope === 'string' ? tokens.scope.split(/\s+/).filter(Boolean) : previous.scopes ?? [],
  };
}

async function postToken(fetchImpl, parameters) {
  return fetchJson(fetchImpl, TOKEN, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams(parameters),
  });
}

async function* eventsFrom(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', data = [];
  function parseEvent() {
    if (!data.length) return null;
    const source = data.join('\n'); data = [];
    if (source === '[DONE]') return null;
    try { return JSON.parse(source); }
    catch { throw new ConnectorError('STREAM_INVALID', 'AI 응답 스트림 형식을 확인하지 못했습니다.', 502); }
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (buffer.length > 2_000_000) throw new ConnectorError('STREAM_TOO_LARGE', 'AI 응답이 시범 모듈의 크기 제한을 넘었습니다.', 502);
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index).replace(/\r$/, ''); buffer = buffer.slice(index + 1);
        if (!line) { const event = parseEvent(); if (event) yield event; }
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
      }
      if (done) {
        if (buffer.startsWith('data:')) data.push(buffer.slice(5).replace(/^ /, '').replace(/\r$/, ''));
        const event = parseEvent(); if (event) yield event;
        break;
      }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export function createOpenAIProvider({ appName = 'AI Login Connector' } = {}) {
  return {
    id: 'openai', name: 'GPT · ChatGPT', signupUrl: 'https://chatgpt.com/',
    authMode: 'subscription-oauth', ready: true,
    requiredScopes: ['chatgpt.tokens.use.direct'],
    description: 'ChatGPT 공식 로그인과 계정별 모델 목록을 연결합니다. 사용 가능 여부와 한도는 계정 및 승인 권한에 따라 달라집니다.',
    capabilities: { login: true, inference: true, streaming: true },
    async begin(transaction, account, context) {
      const url = new URL(AUTH);
      url.search = new URLSearchParams({
        client_id: account?.clientId ?? 'dynamic_agent_client',
        ext_agent_host_id: context.hostId,
        response_type: 'code', redirect_uri: transaction.redirectUri, scope: SCOPES,
        resource: RESOURCE, state: transaction.state, nonce: transaction.nonce,
        code_challenge_method: 'S256', code_challenge: transaction.challenge,
      }).toString();
      if (!account) url.searchParams.set('agent_name_hint', appName);
      if (account?.idToken) url.searchParams.set('id_token_hint', account.idToken);
      if (account?.email) url.searchParams.set('login_hint', account.email);
      return url.toString();
    },
    async exchange(callback, transaction, account, context) {
      const supplied = callback.searchParams.get('client_id');
      const clientId = account?.clientId ?? supplied;
      if (!clientId || clientId === 'dynamic_agent_client' || (account && supplied && supplied !== account.clientId)) {
        throw new ConnectorError('REGISTRATION_INVALID', '발급된 앱 등록 정보를 확인하지 못했습니다.', 401);
      }
      const tokens = await postToken(context.fetch, {
        grant_type: 'authorization_code', code: callback.searchParams.get('code'),
        client_id: clientId, code_verifier: transaction.verifier,
        redirect_uri: transaction.redirectUri, resource: RESOURCE,
      });
      const identity = await context.verifier.validate(tokens.id_token, {
        issuer: ISSUER, audience: clientId, nonce: transaction.nonce, subject: account?.subject,
        jwksUri: 'https://auth.openai.com/.well-known/jwks.json',
      });
      return { ...credentialsFrom(tokens), clientId, issuer: ISSUER, subject: identity.sub,
        email: typeof identity.email === 'string' ? identity.email : '',
        name: typeof identity.name === 'string' ? identity.name : '',
      };
    },
    async refresh(account, context) {
      const tokens = await postToken(context.fetch, {
        grant_type: 'refresh_token', client_id: account.clientId,
        refresh_token: account.refreshToken, resource: RESOURCE,
      });
      if (tokens.id_token) await context.verifier.validate(tokens.id_token, {
        issuer: ISSUER, audience: account.clientId, subject: account.subject,
        jwksUri: 'https://auth.openai.com/.well-known/jwks.json',
      });
      return { ...account, ...credentialsFrom(tokens, account) };
    },
    async revoke(account, context) {
      if (!account.refreshToken) return false;
      const discovery = await fetchJson(context.fetch, `${ISSUER}/.well-known/openid-configuration`);
      const endpoint = new URL(discovery.revocation_endpoint);
      if (endpoint.origin !== ISSUER || endpoint.username || endpoint.password) throw new ConnectorError('REVOCATION_INVALID', '공급자의 연결 해제 경로가 올바르지 않습니다.');
      const response = await fetchChecked(context.fetch, endpoint, {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: account.refreshToken, token_type_hint: 'refresh_token', client_id: account.clientId }),
      });
      return response.status === 200;
    },
    async models(account, context) {
      const data = await fetchJson(context.fetch, `${RESOURCE}/models`, { headers: { authorization: `Bearer ${account.accessToken}` } });
      if (!Array.isArray(data.models)) throw new ConnectorError('CATALOG_INVALID', '계정별 모델 목록을 확인하지 못했습니다.', 502);
      return data.models.filter(model => model.visibility === 'list' && typeof model.slug === 'string')
        .map(model => ({ id: model.slug, name: typeof model.display_name === 'string' ? model.display_name : model.slug }));
    },
    async generate(account, { model, prompt, signal, onDelta }, context) {
      const response = await fetchChecked(context.fetch, `${RESOURCE}/responses`, {
        method: 'POST', headers: { authorization: `Bearer ${account.accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, input: [{ role: 'user', content: prompt }], store: false, stream: true }), signal,
      });
      let text = '', complete = false, refused = false;
      for await (const event of eventsFrom(response)) {
        if (event.type === 'response.refusal.delta' && typeof event.delta === 'string') {
          refused = true;
        } else if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
          text += event.delta;
          if (text.length > 1_000_000) throw new ConnectorError('OUTPUT_TOO_LARGE', '응답이 시범 모듈의 크기 제한을 넘었습니다.');
          await onDelta?.(event.delta);
        } else if (event.type === 'response.completed') {
          const outputs = (event.response?.output ?? []).flatMap(item => item.content ?? []);
          if (!refused) refused = outputs.some(item => typeof item.refusal === 'string');
          if (refused) throw new ConnectorError('INFERENCE_REFUSED', 'AI가 이 요청에 대한 응답을 거부했습니다.', 502);
          if (!text) {
            text = outputs.map(item => typeof item.text === 'string' ? item.text : '').join('');
            if (text.length > 1_000_000) throw new ConnectorError('OUTPUT_TOO_LARGE', '응답이 시범 모듈의 크기 제한을 넘었습니다.');
            if (text) await onDelta?.(text);
          }
          complete = true; break;
        }
        else if (event.type === 'response.failed' || event.type === 'response.incomplete' || event.type === 'error') {
          const code = event.response?.error?.code ?? event.error?.code ?? event.code;
          if (typeof code === 'string' && /usage_limit|usage_unavailable/.test(code)) throw new ConnectorError('USAGE_LIMIT', '계정의 AI 사용 한도를 확인하세요.', 429);
          throw new ConnectorError('INFERENCE_INCOMPLETE', 'AI가 응답을 완성하지 못했습니다. 일부 응답을 완료로 처리하지 않았습니다.', 502);
        }
      }
      if (!complete) throw new ConnectorError('STREAM_INTERRUPTED', '응답 완료 신호를 받기 전에 연결이 종료됐습니다.', 502);
      if (!text) throw new ConnectorError('EMPTY_RESPONSE', 'AI가 텍스트 응답을 반환하지 않았습니다.', 502);
      return { text, completed: true, model };
    },
  };
}

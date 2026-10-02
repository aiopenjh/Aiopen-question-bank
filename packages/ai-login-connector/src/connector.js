import { createHash } from 'node:crypto';
import { ConnectorError, publicError } from './errors.js';
import { challengeFor, IdentityVerifier, randomValue, sameSecret } from './oidc.js';
import { MemoryStore } from './store.js';

function assertCallbackUri(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port
    || url.pathname !== '/auth/callback' || url.search || url.hash || url.username || url.password) {
    throw new ConnectorError('CALLBACK_INVALID', '콜백은 http://127.0.0.1:<port>/auth/callback 이어야 합니다.');
  }
  return url.toString();
}
const hasGrant = (provider, account) => provider.capabilities.inference && (provider.requiredScopes ?? []).every(scope => account.scopes?.includes(scope));
const accountLabel = account => `${account.email || account.name || '계정'} · ${account.id.slice(0, 8)}`;

export class AIConnector {
  constructor({ providers, store = new MemoryStore(), fetchImpl = fetch } = {}) {
    if (!Array.isArray(providers) || !providers.length) throw new ConnectorError('PROVIDERS_REQUIRED', '공급자 연결부를 지정해야 합니다.');
    this.providers = new Map();
    for (const provider of providers) {
      if (!/^[a-z][a-z0-9_-]*$/.test(provider.id) || this.providers.has(provider.id)) throw new ConnectorError('PROVIDER_INVALID', '공급자 식별자가 올바르지 않거나 중복됩니다.');
      if (provider.ready && (typeof provider.begin !== 'function' || typeof provider.exchange !== 'function')) throw new ConnectorError('PROVIDER_INVALID', '사용 가능한 공급자는 로그인 및 코드 교환 연결부가 필요합니다.');
      if (provider.capabilities?.inference && (typeof provider.models !== 'function' || typeof provider.generate !== 'function')) throw new ConnectorError('PROVIDER_INVALID', 'AI 사용 공급자는 모델 조회 및 생성 연결부가 필요합니다.');
      this.providers.set(provider.id, provider);
    }
    this.store = store;
    this.context = { fetch: fetchImpl, verifier: new IdentityVerifier(fetchImpl) };
    this.attempts = new Map(); this.results = new Map(); this.queues = new Map(); this.epochs = new Map();
    this.catalogs = new Map(); this.controllers = new Map(); this.processingLogins = new Set(); this.mutationQueue = Promise.resolve();
  }
  provider(id) {
    const provider = this.providers.get(id);
    if (!provider) throw new ConnectorError('PROVIDER_UNKNOWN', '지원하는 공급자를 선택하세요.', 404);
    return provider;
  }
  exclusive(id, operation) {
    const next = (this.queues.get(id) ?? Promise.resolve()).then(operation);
    const queue = next.catch(() => {}); this.queues.set(id, queue);
    queue.finally(() => { if (this.queues.get(id) === queue) this.queues.delete(id); });
    return next;
  }
  mutate(operation) {
    const next = this.mutationQueue.then(async () => {
      const data = await this.store.read();
      const result = await operation(data);
      await this.store.write(data);
      return result;
    });
    this.mutationQueue = next.catch(() => {});
    return next;
  }
  async status() {
    const data = await this.store.read();
    return [...this.providers.values()].map(provider => {
      const accounts = Object.values(data.accounts).filter(account => account.provider === provider.id);
      const active = accounts.find(account => account.id === data.active[provider.id]);
      const usable = Boolean(active?.accessToken);
      const pending = this.processingLogins.has(provider.id) || [...this.attempts.values()].some(attempt => attempt.provider === provider.id && attempt.expiresAt > Date.now());
      return {
        id: provider.id, name: provider.name, signupUrl: provider.signupUrl, description: provider.description,
        authMode: provider.authMode, capabilities: provider.capabilities,
        status: pending ? 'connecting' : !provider.ready ? 'unavailable' : usable ? hasGrant(provider, active) ? 'connected' : 'identity-only' : 'disconnected',
        canConnect: provider.ready, canInfer: usable && hasGrant(provider, active),
        activeAccountId: active?.id ?? null,
        accounts: accounts.map(account => ({ id: account.id, label: accountLabel(account), signedIn: Boolean(account.accessToken) })),
        lastResult: this.results.get(provider.id) ?? null,
      };
    });
  }
  async connect(id, { redirectUri, accountId = null } = {}) {
    return this.exclusive(id, async () => {
      const provider = this.provider(id);
      if (!provider.ready) throw new ConnectorError('AUTH_NOT_READY', provider.description);
      const data = await this.store.read();
      const account = accountId ? data.accounts[accountId] : undefined;
      if (accountId && (!account || account.provider !== id)) throw new ConnectorError('ACCOUNT_UNKNOWN', '선택한 계정 등록 정보를 찾지 못했습니다.');
      for (const [state, attempt] of this.attempts) if (attempt.provider === id) { clearTimeout(attempt.timer); this.attempts.delete(state); }
      const transaction = { state: randomValue(), nonce: randomValue(), verifier: randomValue(), redirectUri: assertCallbackUri(redirectUri),
        provider: id, accountId, expiresAt: Date.now() + 600_000, epoch: this.epochs.get(id) ?? 0 };
      transaction.challenge = challengeFor(transaction.verifier);
      const authorizationUrl = await provider.begin(transaction, account, { ...this.context, hostId: data.hostId });
      const authorization = new URL(authorizationUrl);
      if (authorization.protocol !== 'https:' || authorization.username || authorization.password) throw new ConnectorError('AUTH_URL_INVALID', '공급자 인증 경로는 HTTPS여야 합니다.');
      transaction.timer = setTimeout(() => {
        this.attempts.delete(transaction.state);
        this.results.set(id, { ok: false, code: 'LOGIN_TIMEOUT', message: '로그인 시간이 만료됐습니다. 다시 연결하세요.' });
      }, 600_000);
      transaction.timer.unref();
      this.attempts.set(transaction.state, transaction); this.results.delete(id);
      // Native callers may open this URL. Browser hosts must use a server-side redirect.
      return { authorizationUrl, expiresAt: transaction.expiresAt };
    });
  }
  async completeConnect(callbackUri) {
    const callback = new URL(callbackUri);
    for (const key of ['state', 'code', 'error', 'client_id']) {
      if (callback.searchParams.getAll(key).length > 1) throw new ConnectorError('CALLBACK_INVALID', '중복된 로그인 응답을 거부했습니다.', 401);
    }
    const state = callback.searchParams.get('state');
    const attempt = this.attempts.get(state);
    if (!attempt || !sameSecret(state, attempt.state) || attempt.expiresAt <= Date.now()) throw new ConnectorError('STATE_INVALID', '로그인 요청이 만료됐거나 이미 처리됐습니다.', 401);
    const expected = new URL(attempt.redirectUri);
    if (callback.origin !== expected.origin || callback.pathname !== expected.pathname) throw new ConnectorError('CALLBACK_INVALID', '콜백 경로가 로그인 요청과 일치하지 않습니다.', 401);
    this.attempts.delete(state); clearTimeout(attempt.timer); this.processingLogins.add(attempt.provider);
    return this.exclusive(attempt.provider, async () => {
      try {
        if (attempt.epoch !== (this.epochs.get(attempt.provider) ?? 0)) throw new ConnectorError('LOGIN_CANCELLED', '취소된 로그인입니다.');
        if (callback.searchParams.has('error')) throw new ConnectorError('LOGIN_DECLINED', '공급자 로그인이 취소되거나 승인되지 않았습니다.');
        if (!callback.searchParams.get('code')) throw new ConnectorError('CODE_MISSING', '인증 코드가 없는 로그인 응답입니다.');
        const provider = this.provider(attempt.provider);
        const data = await this.store.read();
        const selected = attempt.accountId ? data.accounts[attempt.accountId] : undefined;
        const account = await provider.exchange(callback, attempt, selected, this.context);
        if (selected && (account.subject !== selected.subject || account.clientId !== selected.clientId || account.issuer !== selected.issuer)) throw new ConnectorError('ACCOUNT_MISMATCH', '선택한 계정과 로그인한 계정이 다릅니다.', 401);
        if (attempt.epoch !== (this.epochs.get(attempt.provider) ?? 0)) throw new ConnectorError('LOGIN_CANCELLED', '취소된 로그인입니다.');
        const id = createHash('sha256').update(JSON.stringify([provider.id, account.issuer, account.clientId, account.subject])).digest('hex');
        await this.mutate(stored => { stored.accounts[id] = { ...account, id, provider: provider.id }; stored.active[provider.id] = id; });
        this.catalogs.delete(provider.id);
        const result = { ok: true, message: hasGrant(provider, account) ? '로그인했습니다. 모델을 선택해 응답을 확인하세요.' : '로그인했습니다. AI 사용 권한은 아직 연결되지 않았습니다.' };
        this.results.set(provider.id, result);
        return result;
      } catch (error) { this.results.set(attempt.provider, { ok: false, ...publicError(error) }); throw error; }
      finally { this.processingLogins.delete(attempt.provider); }
    });
  }
  async selectAccount(id, accountId) {
    this.provider(id);
    return this.exclusive(id, () => this.mutate(data => {
      if (data.accounts[accountId]?.provider !== id) throw new ConnectorError('ACCOUNT_UNKNOWN', '등록된 계정을 선택하세요.');
      data.active[id] = accountId; this.catalogs.delete(id);
    }));
  }
  async accountFor(id) {
    const provider = this.provider(id);
    const data = await this.store.read();
    let account = data.accounts[data.active[id]];
    if (!account?.accessToken) throw new ConnectorError('LOGIN_REQUIRED', '먼저 계정을 연결하세요.', 401);
    if (!hasGrant(provider, account)) throw new ConnectorError('INFERENCE_NOT_AUTHORIZED', '로그인과 AI 사용 권한은 별개입니다. 이 연결에는 AI 사용 권한이 없습니다.', 403);
    if (account.expiresAt <= Date.now() + 60_000) {
      if (!account.refreshToken || !provider.refresh) throw new ConnectorError('REAUTH_REQUIRED', '로그인을 다시 진행해야 합니다.', 401);
      try {
        account = await provider.refresh(account, this.context);
        await this.mutate(stored => { stored.accounts[account.id] = account; });
      } catch (error) {
        if (error instanceof ConnectorError && error.status === 401) {
          await this.clearCredentials(account.id); this.catalogs.delete(id);
        }
        throw error;
      }
      if (!hasGrant(provider, account)) throw new ConnectorError('INFERENCE_NOT_AUTHORIZED', '갱신된 연결에 AI 사용 권한이 없습니다.', 403);
    }
    return { provider, account };
  }
  async models(id) {
    return this.exclusive(id, async () => {
      const { provider, account } = await this.accountFor(id);
      try {
        const models = await provider.models(account, this.context);
        this.catalogs.set(id, { accountId: account.id, models, expiresAt: Date.now() + 300_000 });
        return models;
      } catch (error) {
        if (error instanceof ConnectorError && error.status === 401) { await this.clearCredentials(account.id); this.catalogs.delete(id); }
        throw error;
      }
    });
  }
  async generate(id, { model, prompt, signal, onDelta } = {}) {
    if (typeof model !== 'string' || model.length > 160 || typeof prompt !== 'string' || !prompt.trim() || prompt.length > 32_000) throw new ConnectorError('REQUEST_INVALID', '모델을 선택하고 32,000자 이하의 내용을 입력하세요.');
    const epoch = this.epochs.get(id) ?? 0;
    return this.exclusive(id, async () => {
      if (epoch !== (this.epochs.get(id) ?? 0) || signal?.aborted) throw new ConnectorError('REQUEST_CANCELLED', '취소된 요청입니다.');
      const { provider, account } = await this.accountFor(id);
      let catalog = this.catalogs.get(id);
      if (!catalog || catalog.accountId !== account.id || catalog.expiresAt <= Date.now()) {
        catalog = { accountId: account.id, models: await provider.models(account, this.context), expiresAt: Date.now() + 300_000 }; this.catalogs.set(id, catalog);
      }
      if (!catalog.models.some(item => item.id === model)) throw new ConnectorError('MODEL_UNAVAILABLE', '선택한 계정에서 사용할 수 있는 모델을 선택하세요.');
      if (epoch !== (this.epochs.get(id) ?? 0) || signal?.aborted) throw new ConnectorError('REQUEST_CANCELLED', '취소된 요청입니다.');
      const controller = new AbortController(); this.controllers.set(id, controller);
      const requestSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
      try { return await provider.generate(account, { model, prompt, signal: requestSignal, onDelta }, this.context); }
      catch (error) {
        if (error instanceof ConnectorError && error.status === 401) { await this.clearCredentials(account.id); this.catalogs.delete(id); }
        throw error;
      }
      finally { this.controllers.delete(id); }
    });
  }
  async clearCredentials(accountId) {
    await this.mutate(data => {
      const account = data.accounts[accountId]; if (!account) return;
      for (const key of ['accessToken', 'refreshToken', 'idToken', 'expiresAt', 'scopes']) delete account[key];
    });
  }
  async disconnect(id) {
    this.provider(id);
    this.controllers.get(id)?.abort();
    this.epochs.set(id, (this.epochs.get(id) ?? 0) + 1);
    for (const [state, attempt] of this.attempts) if (attempt.provider === id) { clearTimeout(attempt.timer); this.attempts.delete(state); }
    return this.exclusive(id, async () => {
      const data = await this.store.read(), account = data.accounts[data.active[id]];
      let revoked = false;
      if (account?.accessToken) {
        try { revoked = await this.provider(id).revoke?.(account, this.context) === true; } catch { /* Report remote revocation separately. */ }
        await this.clearCredentials(account.id);
      }
      this.catalogs.delete(id); this.results.delete(id);
      return { remoteRevoked: revoked, message: revoked ? '현재 계정의 연결을 해제했습니다.' : '현재 계정의 로컬 연결을 해제했습니다. 원격 권한 해제는 확인되지 않았으므로 공급자 설정에서도 확인하세요.' };
    });
  }
  async close() {
    for (const attempt of this.attempts.values()) clearTimeout(attempt.timer);
    this.attempts.clear();
    for (const controller of this.controllers.values()) controller.abort();
    await Promise.allSettled([...this.queues.values()]); await this.mutationQueue;
    await this.store.close?.();
  }
}

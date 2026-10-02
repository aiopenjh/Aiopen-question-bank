const $ = id => document.getElementById(id);
const names = { openai: 'GPT', anthropic: 'Claude', google: 'Gemini' };
// Non-secret selection shared with a host on this local origin. Credentials stay in the backend.
const selectionKey = 'ai-login-connector:model-selection-v1';
let csrf = '', providers = [], selectedProvider = '', selectedAccount = null, poll = null, modelSequence = 0, models = [], chosenModel = '';
function savedSelection() {
  try { return JSON.parse(localStorage.getItem(selectionKey) ?? 'null'); } catch { return null; }
}
function closeModelMenu() { $('model-menu').hidden = true; $('model-trigger').setAttribute('aria-expanded', 'false'); }
function hideModels() { models = []; chosenModel = ''; $('models').hidden = true; $('model-menu').replaceChildren(); closeModelMenu(); }
function renderModels() {
  $('model-name').textContent = models.find(item => item.id === chosenModel)?.name ?? '모델 선택';
  $('model-menu').replaceChildren();
  for (const item of models) {
    const button = document.createElement('button'); button.type = 'button'; button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(item.id === chosenModel));
    const label = document.createElement('span'); label.textContent = item.name;
    const check = document.createElement('span'); check.textContent = item.id === chosenModel ? '✓' : ''; check.setAttribute('aria-hidden', 'true');
    button.append(label, check);
    button.addEventListener('click', () => { try { applyModel(item.id); closeModelMenu(); $('model-trigger').focus(); } catch (error) { notice(error.message, true); } });
    $('model-menu').append(button);
  }
}
function applyModel(model) {
  if (!models.some(item => item.id === model)) throw new Error('사용할 수 있는 모델을 다시 선택하세요.');
  const provider = providers.find(item => item.id === selectedProvider && item.canInfer);
  if (!provider) throw new Error('계정 연결 상태를 확인하세요.');
  const acceptApiUsage = provider.authMode === 'google-api-oauth' && $('api-consent').checked;
  localStorage.setItem(selectionKey, JSON.stringify({ mode: 'desktop', providerId: provider.id, model, acceptApiUsage }));
  chosenModel = model; renderModels();
  if (provider.authMode === 'google-api-oauth' && !$('api-consent').checked) {
    notice('Google 프로젝트의 사용 조건을 확인하면 선택한 모델이 적용됩니다.'); return;
  }
  notice(names[provider.id] + ' · ' + models.find(item => item.id === model).name + '로 문제 출제·힌트·채점을 진행합니다.');
}
function notice(message, error = false) {
  $('notice').textContent = message; $('notice').classList.toggle('error', error);
}
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: {
    'x-connector-client': 'desktop-ui', ...(csrf ? { 'x-connector-csrf': csrf } : {}),
    ...(options.body ? { 'content-type': 'application/json' } : {}),
  } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? '연결을 확인해 주세요.');
  return result;
}
const post = (path, body = {}) => api(path, { method: 'POST', body: JSON.stringify(body) });
function renderProviders() {
  for (const row of $('providers').querySelectorAll('[data-provider]')) {
    const provider = providers.find(item => item.id === row.dataset.provider);
    const button = row.querySelector('button'), hint = row.querySelector('.hint');
    button.textContent = names[row.dataset.provider] + '로 연결';
    button.disabled = !provider;
    if (provider && !provider.canConnect && !provider.canInfer) button.textContent = names[provider.id] + ' · 연결 준비';
    hint.textContent = !provider ? '' : provider.status === 'connecting' ? '로그인 중…'
      : provider.canInfer ? '연결됨 · 버튼을 누르면 모델을 확인합니다.'
      : provider.status === 'identity-only' ? '로그인됨 · AI 사용 권한은 별도입니다.'
      : provider.id === 'anthropic' ? '구독 로그인 연결 미지원'
      : provider.id === 'google' && !provider.canConnect ? 'Google 로그인 앱 등록 필요' : '';
    if (provider?.canInfer) { button.textContent = names[provider.id] + ' · 연결됨'; button.disabled = false; }
    if (provider?.signupUrl) row.querySelector('a').href = provider.signupUrl;
  }
}
async function loadModels(id) {
  const sequence = ++modelSequence;
  selectedProvider = id; selectedAccount = providers.find(item => item.id === id)?.activeAccountId;
  $('model-label').textContent = names[id] + ' 모델';
  hideModels(); $('models').hidden = false; $('model-trigger').disabled = true; $('model-name').textContent = '불러오는 중…';
  try {
    const result = await api('/api/providers/' + id + '/models');
    if (sequence !== modelSequence) return;
    models = result.models; $('model-trigger').disabled = !models.length;
    const saved = savedSelection(), provider = providers.find(item => item.id === id);
    $('api-consent-row').hidden = provider.authMode !== 'google-api-oauth';
    $('api-consent').checked = saved?.providerId === id && saved.acceptApiUsage === true;
    if (models.length) applyModel(saved?.providerId === id && models.some(item => item.id === saved.model) ? saved.model : models[0].id);
    else { renderModels(); notice('사용 가능한 모델이 없습니다.'); }
  } catch (error) { if (sequence === modelSequence) notice(error.message, true); }
}
async function refresh() {
  const result = await api('/api/providers'); providers = result.providers; renderProviders();
  if (result.hostedApp) { $('hosted-app').href = result.hostedApp.path; $('hosted-app').hidden = false; }
  const connected = providers.find(item => item.canInfer && item.id === selectedProvider);
  const saved = savedSelection();
  if (connected && (selectedAccount !== connected.activeAccountId || (saved?.providerId === connected.id && saved.model !== chosenModel))) await loadModels(connected.id);
  if (!connected) { ++modelSequence; selectedAccount = null; hideModels(); }
  clearTimeout(poll);
  if (providers.some(item => item.status === 'connecting')) poll = setTimeout(() => refresh().catch(error => notice(error.message, true)), 2000);
  const failure = providers.find(item => item.lastResult && !item.lastResult.ok);
  if (failure) notice(failure.lastResult.message, true);
}
for (const row of $('providers').querySelectorAll('[data-provider]')) {
  row.querySelector('button').addEventListener('click', async () => {
    const provider = providers.find(item => item.id === row.dataset.provider);
    if (!provider) return;
    if (selectedProvider !== provider.id) {
      ++modelSequence; selectedProvider = provider.id; selectedAccount = null;
      hideModels();
    }
    if (!provider.canConnect && !provider.canInfer) {
      notice(provider.id === 'google'
        ? 'Google 로그인 연결을 준비하고 있습니다. 개발자 측 Google 앱 등록이 완료되면 이 버튼에서 계정 로그인으로 연결할 수 있습니다. API 키 입력은 필요하지 않습니다.'
        : provider.description || '이 공급자의 로그인 연결을 준비하고 있습니다.');
      return;
    }
    if (provider.canInfer) { await loadModels(provider.id); return; }
    row.querySelector('button').disabled = true;
    try {
      const result = await post('/api/providers/' + provider.id + '/connect', { accountId: provider.activeAccountId });
      if (!/^\/authorize\/[A-Za-z0-9_-]+$/.test(result.redirectPath)) throw new Error('로그인 연결 경로를 확인하지 못했습니다.');
      notice('공식 로그인 페이지로 이동합니다.'); location.assign(result.redirectPath);
    } catch (error) { notice(error.message, true); renderProviders(); }
  });
}
window.addEventListener('focus', () => { if (csrf) refresh().catch(error => notice(error.message, true)); });
window.addEventListener('storage', event => { if (event.key === selectionKey && csrf) refresh().catch(error => notice(error.message, true)); });
$('model-trigger').addEventListener('click', () => { const open = $('model-menu').hidden; $('model-menu').hidden = !open; $('model-trigger').setAttribute('aria-expanded', String(open)); });
$('api-consent').addEventListener('change', () => { if (chosenModel) { try { applyModel(chosenModel); } catch (error) { notice(error.message, true); } } });
document.addEventListener('click', event => { if (!event.target.closest('.model-picker')) closeModelMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModelMenu(); });
try {
  const launchToken = new URLSearchParams(location.hash.slice(1)).get('launch');
  history.replaceState(null, '', location.pathname);
  const session = launchToken ? await post('/api/bootstrap', { launchToken }) : await api('/api/session');
  csrf = session.csrf; const saved = savedSelection(); if (Object.hasOwn(names, saved?.providerId)) selectedProvider = saved.providerId;
  notice('사용할 AI를 선택하세요.'); await refresh();
  if (!$('hosted-app').hidden && providers.some(provider => provider.status === 'connected' || provider.status === 'identity-only')) {
    location.replace($('hosted-app').href);
  }
} catch (error) { notice(error.message, true); }

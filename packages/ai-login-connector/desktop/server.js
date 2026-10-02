import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, sep, extname } from 'node:path';
import { spawn } from 'node:child_process';
import { AIConnector, WindowsEncryptedStore, createOpenAIProvider, createClaudeProvider, createGeminiProvider, ConnectorError } from '../src/index.js';
import { publicError } from '../src/errors.js';
import { randomValue, sameSecret } from '../src/oidc.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
let config = {};
try { config = JSON.parse(await readFile(join(root, '.local', 'config.json'), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw new Error('로컬 설정 파일을 읽지 못했습니다. .local/config.json 형식을 확인하세요.'); }
if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) throw new Error('데스크톱 시범 실행은 Windows 환경을 지원합니다. 다른 환경에서는 별도 보호 저장소를 주입하세요.');
const appName = config.appName ?? 'AI Login Connector';
const appDirectory = process.env.AI_CONNECTOR_APP_ROOT ? resolve(process.env.AI_CONNECTOR_APP_ROOT) : null;
const appMount = process.env.AI_CONNECTOR_APP_MOUNT ?? '/app';
if (appDirectory && !/^\/[A-Za-z0-9_-]+$/.test(appMount)) throw new Error('앱 경로는 /app 같은 단일 경로여야 합니다.');
const hostedApp = appDirectory ? { name: process.env.AI_CONNECTOR_APP_NAME ?? '연결된 앱', path: `${appMount}/` } : null;
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const store = new WindowsEncryptedStore(join(process.env.LOCALAPPDATA, 'AI_Login_Connector', 'credentials.enc'));
const connector = new AIConnector({ store, providers: [createOpenAIProvider({ appName }), createClaudeProvider(), createGeminiProvider(config.google)] });
const assets = new Map([
  ['/', { file: 'index.html', type: 'text/html; charset=utf-8' }],
  ['/app.js', { file: 'app.js', type: 'text/javascript; charset=utf-8' }],
  ['/style.css', { file: 'style.css', type: 'text/css; charset=utf-8' }],
]);
let origin, launchToken = randomValue(), session = null;
const redirects = new Map();

function headers(response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
}
function json(response, value, status = 200) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(value));
}
function cookieValue(request) {
  const match = (request.headers.cookie ?? '').split(';').map(value => value.trim()).find(value => value.startsWith('connector-session='));
  return match?.slice('connector-session='.length);
}
function requireSameOrigin(request) {
  if (request.headers.origin && request.headers.origin !== origin) throw new ConnectorError('ORIGIN_REJECTED', '다른 웹사이트의 접근을 거부했습니다.', 403);
  if (request.headers['sec-fetch-site'] && request.headers['sec-fetch-site'] !== 'same-origin') throw new ConnectorError('ORIGIN_REJECTED', '다른 웹사이트의 접근을 거부했습니다.', 403);
  if (request.headers['x-connector-client'] !== 'desktop-ui') throw new ConnectorError('CLIENT_REJECTED', '로컬 연결 화면에서 요청하세요.', 403);
}
function authorize(request, csrfRequired = true) {
  requireSameOrigin(request);
  if (!session || session.expiresAt <= Date.now() || !sameSecret(cookieValue(request), session.id)) throw new ConnectorError('SESSION_REQUIRED', '시작 프로그램으로 연결 화면을 다시 여세요.', 401);
  if (csrfRequired && !sameSecret(request.headers['x-connector-csrf'], session.csrf)) throw new ConnectorError('CSRF_REJECTED', '요청을 확인할 수 없습니다. 화면을 새로고침하세요.', 403);
}
async function bodyOf(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new ConnectorError('JSON_REQUIRED', 'JSON 요청을 사용하세요.', 415);
  if (Number(request.headers['content-length']) > 80_000) throw new ConnectorError('REQUEST_TOO_LARGE', '요청이 크기 제한을 넘었습니다.', 413);
  const body = await new Promise((done, reject) => {
    const chunks = []; let bytes = 0, failed = false;
    request.on('data', chunk => {
      if (failed) return;
      bytes += chunk.length;
      if (bytes > 80_000) { failed = true; reject(new ConnectorError('REQUEST_TOO_LARGE', '요청이 크기 제한을 넘었습니다.', 413)); return; }
      chunks.push(chunk);
    });
    request.once('end', () => { if (!failed) done(Buffer.concat(chunks).toString('utf8')); });
    request.once('error', () => reject(new ConnectorError('REQUEST_INTERRUPTED', '요청이 중단됐습니다.')));
  });
  try {
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch { throw new ConnectorError('JSON_INVALID', 'JSON 요청 형식이 올바르지 않습니다.'); }
}
function callbackPage(response, ok) {
  response.writeHead(ok ? 200 : 400, { 'content-type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>계정 연결 · Celueste</title><link rel="stylesheet" href="/style.css"><main class="shell callback"><div class="brand">Celueste <span class="sparkle">✦</span></div><p class="eyebrow">나만의 학습을 이어가는 곳</p><h1>${ok ? '계정 연결을 마쳤어요.' : '연결을 마치지 못했어요.'}</h1><p class="intro">${ok ? '연결 화면에서 사용할 모델을 확인하고 공부를 시작하세요.' : '연결 화면으로 돌아가 다시 시도해 주세요.'}</p><a class="continue" href="/">연결 화면으로 돌아가기 →</a></main></html>`);
}

const server = createServer(async (request, response) => {
  headers(response);
  try {
    if (request.headers.host !== new URL(origin).host) throw new ConnectorError('HOST_REJECTED', '허용되지 않은 호스트입니다.', 403);
    const url = new URL(request.url, origin);
    if (url.origin !== origin) throw new ConnectorError('HOST_REJECTED', '허용되지 않은 호스트입니다.', 403);
    if (request.method === 'GET' && appDirectory && (url.pathname === appMount || url.pathname.startsWith(`${appMount}/`))) {
      const relative = decodeURIComponent(url.pathname.slice(appMount.length)).replace(/^\/+/, '') || 'index.html';
      const target = resolve(appDirectory, relative);
      if (!target.toLowerCase().startsWith(`${appDirectory}${sep}`.toLowerCase()) || relative.includes('\0')) throw new ConnectorError('PATH_REJECTED', '허용되지 않은 파일 경로입니다.', 403);
      let file;
      try { file = await readFile(target); }
      catch (error) {
        if (!['ENOENT', 'EISDIR'].includes(error.code) || extname(relative)) throw new ConnectorError('NOT_FOUND', '앱 파일을 찾을 수 없습니다.', 404);
        file = await readFile(join(appDirectory, 'index.html'));
      }
      response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https:; worker-src 'self' blob:; frame-src 'self' blob:; base-uri 'self'; frame-ancestors 'none'");
      response.writeHead(200, { 'content-type': contentTypes[extname(relative).toLowerCase()] ?? (extname(relative) ? 'application/octet-stream' : 'text/html; charset=utf-8') });
      response.end(file); return;
    }
    if (request.method === 'GET' && assets.has(url.pathname)) {
      const asset = assets.get(url.pathname);
      response.writeHead(200, { 'content-type': asset.type });
      response.end(await readFile(join(root, 'desktop', 'public', asset.file))); return;
    }
    if (request.method === 'GET' && url.pathname === '/auth/callback') {
      try {
        await connector.completeConnect(url.toString());
        response.writeHead(303, { location: hostedApp?.path ?? '/' }); response.end();
      }
      catch { callbackPage(response, false); }
      return;
    }
    if (request.method === 'GET' && url.pathname.startsWith('/authorize/')) {
      if (!session || session.expiresAt <= Date.now() || !sameSecret(cookieValue(request), session.id)) throw new ConnectorError('SESSION_REQUIRED', '연결 화면에서 로그인을 시작하세요.', 401);
      const id = url.pathname.slice('/authorize/'.length), pending = redirects.get(id);
      redirects.delete(id);
      if (!pending || pending.expiresAt <= Date.now()) throw new ConnectorError('LOGIN_EXPIRED', '로그인 경로가 만료됐습니다. 다시 연결하세요.');
      response.writeHead(302, { location: pending.authorizationUrl }); response.end(); return;
    }
    if (request.method === 'POST' && url.pathname === '/api/bootstrap') {
      requireSameOrigin(request);
      if (request.headers.origin !== origin) throw new ConnectorError('ORIGIN_REJECTED', '로컬 연결 화면에서 요청하세요.', 403);
      const body = await bodyOf(request);
      if (!launchToken || !sameSecret(body.launchToken, launchToken)) throw new ConnectorError('LAUNCH_REJECTED', '시작 프로그램으로 연결 화면을 여세요.', 401);
      launchToken = null;
      session = { id: randomValue(), csrf: randomValue(), expiresAt: Date.now() + 28_800_000 };
      // HTTP is intentional only on loopback; Secure would exclude this local cookie.
      response.setHeader('Set-Cookie', `connector-session=${session.id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
      json(response, { csrf: session.csrf, protocol: 'ai-login-connector/1' }); return;
    }
    if (request.method === 'GET' && url.pathname === '/api/session') {
      authorize(request, false); json(response, { csrf: session.csrf, protocol: 'ai-login-connector/1' }); return;
    }
    authorize(request);
    if (request.method === 'GET' && url.pathname === '/api/providers') { json(response, { providers: await connector.status(), hostedApp }); return; }
    const match = /^\/api\/providers\/([a-z][a-z0-9_-]*)\/(connect|select|disconnect|models|generate)$/.exec(url.pathname);
    if (!match) throw new ConnectorError('NOT_FOUND', '요청 경로를 찾을 수 없습니다.', 404);
    const [, id, action] = match;
    if (request.method === 'GET' && action === 'models') { json(response, { models: await connector.models(id) }); return; }
    if (request.method !== 'POST' || action === 'models') throw new ConnectorError('METHOD_REJECTED', '허용되지 않은 요청 방식입니다.', 405);
    const body = await bodyOf(request);
    if (action === 'connect') {
      for (const [key, pending] of redirects) if (pending.expiresAt <= Date.now() || pending.provider === id) redirects.delete(key);
      const result = await connector.connect(id, { redirectUri: `${origin}/auth/callback`, accountId: body.accountId ?? null });
      const key = randomValue(); redirects.set(key, { ...result, provider: id });
      json(response, { redirectPath: `/authorize/${key}` }); return;
    }
    if (action === 'select') { await connector.selectAccount(id, body.accountId); json(response, { ok: true }); return; }
    if (action === 'disconnect') {
      for (const [key, pending] of redirects) if (pending.provider === id) redirects.delete(key);
      json(response, await connector.disconnect(id)); return;
    }
    if (action === 'generate') {
      if (connector.provider(id).authMode === 'google-api-oauth' && body.acceptApiUsage !== true) throw new ConnectorError('API_USAGE_CONFIRMATION', 'Google API 프로젝트의 사용량·과금 적용에 동의해야 요청할 수 있습니다.');
      const controller = new AbortController();
      response.once('close', () => { if (!response.writableEnded) controller.abort(); });
      response.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8' });
      const emit = value => {
        if (response.destroyed) throw new ConnectorError('REQUEST_CANCELLED', '요청을 중단했습니다.');
        response.write(`${JSON.stringify(value)}\n`);
      };
      try {
        const result = await connector.generate(id, { model: body.model, prompt: body.prompt, signal: controller.signal,
          onDelta: text => emit({ type: 'delta', text }) });
        emit({ type: 'completed', model: result.model });
      } catch (error) { if (!response.destroyed) emit({ type: 'error', ...publicError(error) }); }
      if (!response.destroyed) response.end();
      return;
    }
  } catch (error) {
    if (!response.destroyed && !response.headersSent) json(response, { error: publicError(error) }, error instanceof ConnectorError ? error.status : 500);
    else if (!response.destroyed) response.end();
  }
});
server.requestTimeout = 30_000; server.headersTimeout = 15_000;
let closing = false;
async function shutdown() {
  if (closing) return; closing = true;
  server.close(); server.closeAllConnections(); await connector.close();
}
process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
try {
  await store.read();
  if (closing) throw new ConnectorError('START_CANCELLED', '프로그램 시작을 취소했습니다.');
  const requestedPort = process.env.AI_CONNECTOR_PORT ? Number(process.env.AI_CONNECTOR_PORT) : config.port ?? 0;
  await new Promise((done, reject) => { server.once('error', reject); server.listen(requestedPort, '127.0.0.1', done); });
  origin = `http://127.0.0.1:${server.address().port}`;
  const launchUrl = `${origin}/#launch=${launchToken}`;
  console.log(`AI Login Connector: ${origin}`);
  console.log('로그인 화면을 브라우저에서 엽니다. 종료하려면 Ctrl+C를 누르세요.');
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Start-Process -FilePath $env:AI_CONNECTOR_LAUNCH_URL -WindowStyle Normal'],
    { windowsHide: true, stdio: 'ignore', env: { ...process.env, AI_CONNECTOR_LAUNCH_URL: launchUrl } });
  child.on('error', () => console.error('브라우저를 열지 못했습니다. 프로그램을 다시 시작하세요.'));
  child.on('exit', code => { if (code !== 0) console.error('브라우저를 열지 못했습니다. 프로그램을 다시 시작하세요.'); });
} catch (error) { await shutdown(); console.error(publicError(error).message); process.exitCode = 1; }

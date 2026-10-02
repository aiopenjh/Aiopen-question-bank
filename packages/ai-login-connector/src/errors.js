export class ConnectorError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ConnectorError';
    this.code = code;
    this.status = status;
  }
}

export function publicError(error) {
  return error instanceof ConnectorError
    ? { code: error.code, message: error.message }
    : { code: 'CONNECTOR_FAILED', message: '처리를 완료하지 못했습니다. 연결 상태를 확인하고 다시 시도하세요.' };
}

export async function fetchChecked(fetchImpl, url, options = {}) {
  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(90_000)])
    : AbortSignal.timeout(30_000);
  let response;
  try {
    response = await fetchImpl(url, { ...options, redirect: 'error', signal });
  } catch {
    throw new ConnectorError('NETWORK_FAILED', '공급자 연결이 중단되거나 시간 제한을 넘었습니다.', 502);
  }
  if (!response.ok) {
    // Do not forward provider bodies: they can contain private request data.
    await response.body?.cancel();
    if (response.status === 401) throw new ConnectorError('REAUTH_REQUIRED', '로그인을 다시 진행해야 합니다.', 401);
    if (response.status === 403) throw new ConnectorError('PERMISSION_REQUIRED', '계정 또는 프로젝트의 사용 권한을 확인하세요.', 403);
    if (response.status === 429) throw new ConnectorError('USAGE_LIMIT', '사용 한도에 도달했습니다. 공급자에서 한도를 확인하세요.', 429);
    throw new ConnectorError('PROVIDER_FAILED', `공급자 요청을 완료하지 못했습니다. HTTP ${response.status}`, 502);
  }
  return response;
}

export async function fetchJson(fetchImpl, url, options) {
  const response = await fetchChecked(fetchImpl, url, options);
  try { return await response.json(); }
  catch { throw new ConnectorError('INVALID_PROVIDER_RESPONSE', '공급자의 응답 형식을 확인할 수 없습니다.', 502); }
}

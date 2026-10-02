import { ConnectorError } from '../errors.js';

export function createClaudeProvider() {
  return {
    id: 'anthropic', name: 'Claude', signupUrl: 'https://claude.ai/',
    authMode: 'unavailable', ready: false,
    capabilities: { login: false, inference: false, streaming: false },
    description: '자체 앱에서 Claude 구독 로그인을 제공하는 공식 경로가 제한돼 있습니다. 승인된 인증 경로를 가진 별도 연결부를 추가해야 합니다.',
    async begin() { throw new ConnectorError('AUTH_NOT_SUPPORTED', 'Claude 자체 앱 구독 로그인은 이 모듈에서 지원하지 않습니다.'); },
  };
}

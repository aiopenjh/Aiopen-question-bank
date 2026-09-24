export const APP_BUILD_INFO = {
  version: '2.3.6',
  buildTime: '2026-09-24T13:16:29.925Z',
  buildLabel: 'v2.3.6',
};

// 개인정보 처리방침이 실제로 호스팅된 뒤 빌드 시 EXPO_PUBLIC_PRIVACY_POLICY_URL로 주입한다.
// 비어 있으면(기본값) 설정 화면에 링크를 표시하지 않는다 — 검토 중인 초안을 실수로 공개하지 않기 위함.
export const PRIVACY_POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim() || '';

/**
 * 랭킹 창 진입점.
 * Reference: docs/ranking/RANKING_FEATURE_PLAN.md §3.3
 *
 * 웹에서는 별도 브라우저 창으로 띄워 기존 학습 화면을 건드리지 않는다.
 * 팝업이 차단되었거나 네이티브면 false를 돌려주고, 호출한 화면이 앱 안
 * 전체화면으로 대체한다.
 */

import { Platform } from 'react-native';

export const RANKING_VIEW_PARAM = 'view';
export const RANKING_VIEW_VALUE = 'ranking';

/** 지금 실행 중인 문서가 랭킹 전용 창인지 판별한다. 네이티브는 항상 false. */
export function isRankingWindow(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get(RANKING_VIEW_PARAM) === RANKING_VIEW_VALUE;
  } catch {
    return false;
  }
}

/** 랭킹 창을 새 창으로 연다. 열지 못하면 false. */
export function openRankingWindow(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    const { origin, pathname } = window.location;
    const url = `${origin}${pathname}?${RANKING_VIEW_PARAM}=${RANKING_VIEW_VALUE}`;
    const opened = window.open(url, 'celueste-ranking', 'width=460,height=860');
    return !!opened;
  } catch {
    return false;
  }
}

/** 스크립트로 연 랭킹 창을 닫고, 직접 연 탭이면 메인 앱 주소로 돌아간다. */
export function closeRankingWindow(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  window.close();
  setTimeout(() => {
    if (window.closed) return;
    const url = new URL(window.location.href);
    url.searchParams.delete(RANKING_VIEW_PARAM);
    window.location.replace(url.toString());
  }, 100);
}

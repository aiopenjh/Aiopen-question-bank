import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ViewportPopupLayerProps } from './ViewportPopupLayer';

// react-dom은 Expo 웹 기존 의존성이다. 타입 패키지를 추가하지 않도록 필요한 함수만 선언해 가져온다.
const { createPortal } = require('react-dom') as {
  createPortal: (children: React.ReactNode, container: Element) => React.ReactPortal;
};

/**
 * 웹: 책 넘김 페이저가 transform을 쓰기 때문에 페이지 안의 position: fixed는
 * 화면이 아니라 페이저 기준으로 배치된다. 작은 팝업은 document.body로 옮겨
 * 스크롤 위치와 화면 크기에 관계없이 뷰포트 기준으로 띄운다.
 */
export const ViewportPopupLayer: React.FC<ViewportPopupLayerProps> = ({ visible, children }) => {
  if (!visible || typeof document === 'undefined') return null;
  return createPortal(<View style={styles.layer}>{children}</View>, document.body);
};

const styles = StyleSheet.create({
  layer: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
  },
});

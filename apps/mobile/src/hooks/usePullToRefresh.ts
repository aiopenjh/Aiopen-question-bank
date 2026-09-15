import { useState, useRef, useCallback } from 'react';
import { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

export interface UsePullToRefreshOptions {
  refreshing: boolean;
  onRefresh?: () => Promise<void> | void;
}

/**
 * 모바일 웹 및 터치 디바이스 전용 제스처 기반 당겨서 새로고침(Pull-to-Refresh) 훅
 * - 어떠한 인위적인 버튼이나 텍스트 없이 화면을 아래로 쓸어내리면(당기면) 즉시 자연스럽게 새로고침을 실행합니다.
 */
export function usePullToRefresh({ refreshing, onRefresh }: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState<number>(0);
  const startYRef = useRef<number | null>(null);
  const isAtTopRef = useRef<boolean>(true);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    isAtTopRef.current = y <= 3;
  }, []);

  const handleTouchStart = useCallback(
    (e: any) => {
      if (refreshing || !onRefresh) return;
      if (isAtTopRef.current) {
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        startYRef.current = clientY;
      } else {
        startYRef.current = null;
      }
    },
    [refreshing, onRefresh]
  );

  const handleTouchMove = useCallback(
    (e: any) => {
      if (startYRef.current === null || refreshing || !onRefresh) return;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const diff = clientY - startYRef.current;
      if (diff > 0 && isAtTopRef.current) {
        // 부드러운 감쇠 곡선 (최대 65px)
        const distance = Math.min(65, diff * 0.42);
        setPullDistance(distance);
      } else {
        setPullDistance(0);
      }
    },
    [refreshing, onRefresh]
  );

  const handleTouchEnd = useCallback(async () => {
    if (startYRef.current !== null && pullDistance >= 38 && !refreshing && onRefresh) {
      setPullDistance(45);
      try {
        await onRefresh();
      } finally {
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
    startYRef.current = null;
  }, [pullDistance, refreshing, onRefresh]);

  return {
    pullDistance: refreshing ? 45 : pullDistance,
    isPulling: pullDistance > 0 || refreshing,
    handleScroll,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}

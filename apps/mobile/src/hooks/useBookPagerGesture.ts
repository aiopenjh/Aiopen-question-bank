import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dimensions,
  Animated,
  PanResponder,
  Platform,
  Easing,
  PanResponderInstance,
  LayoutChangeEvent,
} from 'react-native';

export interface UseBookPagerGestureReturn {
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  containerWidth: number;
  setContainerWidth: React.Dispatch<React.SetStateAction<number>>;
  translateX: Animated.Value;
  goToPage: (page: number, animated?: boolean) => void;
  panResponder: PanResponderInstance;
  handleTouchStart: (e: any) => void;
  handleTouchMove: (e: any) => void;
  handleTouchEnd: (e: any) => void;
  onLayoutContainer: (e: LayoutChangeEvent) => void;
}

export function useBookPagerGesture(initialPage: number = 0): UseBookPagerGestureReturn {
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    return Dimensions.get('window').width || 380;
  });

  const translateX = useRef(new Animated.Value(-initialPage * (Dimensions.get('window').width || 380))).current;
  const currentPageRef = useRef(currentPage);
  const containerWidthRef = useRef(containerWidth);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    containerWidthRef.current = containerWidth;
  }, [containerWidth]);

  const isTransitioning = useRef<boolean>(false);
  const gestureStartPage = useRef<number>(0);

  const goToPage = useCallback((page: number, animated = true) => {
    const target = Math.max(0, Math.min(2, page));
    setCurrentPage(target);
    currentPageRef.current = target;
    const targetOffset = -target * containerWidthRef.current;

    if (animated) {
      isTransitioning.current = true;
      Animated.timing(translateX, {
        toValue: targetOffset,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        isTransitioning.current = false;
      });
    } else {
      translateX.setValue(targetOffset);
      isTransitioning.current = false;
    }
  }, [translateX]);

  // 내부 가로 스크롤(과목 필터 칩, 복습 칩 등) 터치 감지 헬퍼
  const isInsideHorizontalScroll = (target: any): boolean => {
    try {
      let el = target as HTMLElement | null;
      while (el && el !== document.body) {
        if (el.getAttribute?.('data-horizontal-scroll') === 'true') {
          return true;
        }
        if (typeof window !== 'undefined' && window.getComputedStyle) {
          const style = window.getComputedStyle(el);
          if (
            style &&
            (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
            el.scrollWidth > el.clientWidth
          ) {
            return true;
          }
        }
        el = el.parentElement;
      }
    } catch {
      // ignore
    }
    return false;
  };

  // 터치 기반 실시간 좌우 스와이프 제스처 컨트롤러 (웹 및 모바일 완전 호환)
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isSwipingHorizontal = useRef<boolean>(false);
  const isScrollingVertical = useRef<boolean>(false);

  const handleTouchStart = (e: any) => {
    if (isTransitioning.current) return;
    if (!e.touches || e.touches.length !== 1) return;
    // 과목/카테고리 칩 등 내부 가로 스크롤 영역 터치 시 책 넘김 제스처 개입 완전 차단!
    if (Platform.OS === 'web' && e.target && isInsideHorizontalScroll(e.target)) {
      touchStartX.current = null;
      return;
    }
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    gestureStartPage.current = currentPageRef.current;
    isSwipingHorizontal.current = false;
    isScrollingVertical.current = false;
  };

  const handleTouchMove = (e: any) => {
    if (isTransitioning.current) return;
    if (touchStartX.current === null || !e.touches || isScrollingVertical.current) return;

    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current!;

    // 세로 스크롤 우선 보호: 세로 이동 감지 시 수평 스와이프를 완전히 차단하여 내부 스크롤 버벅임 방지
    if (!isSwipingHorizontal.current) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        isScrollingVertical.current = true;
        return;
      }
      // 명확한 가로 스와이프만 인식 (최소 25px & 가로가 세로의 1.8배 이상)
      if (Math.abs(dx) > 25 && Math.abs(dx) > Math.abs(dy) * 1.8) {
        isSwipingHorizontal.current = true;
      }
    }

    if (isSwipingHorizontal.current) {
      if (e.cancelable) {
        e.preventDefault?.();
      }
      const currentBase = -gestureStartPage.current * containerWidthRef.current;
      if (gestureStartPage.current === 0 && dx > 0) {
        translateX.setValue(currentBase + dx * 0.15);
      } else if (gestureStartPage.current === 2 && dx < 0) {
        translateX.setValue(currentBase + dx * 0.15);
      } else {
        translateX.setValue(currentBase + dx);
      }
    }
  };

  const handleTouchEnd = (e: any) => {
    if (isSwipingHorizontal.current && touchStartX.current !== null) {
      const touch = e.changedTouches ? e.changedTouches[0] : null;
      const endX = touch ? touch.clientX : touchStartX.current;
      const dx = endX - touchStartX.current;
      const startPage = gestureStartPage.current;

      // 시작 페이지(startPage) 기준으로 정확히 1페이지만 이동 (과목자료함 건너뛰기 원천 차단)
      if (dx < -50 && startPage < 2) {
        goToPage(startPage + 1);
      } else if (dx > 50 && startPage > 0) {
        goToPage(startPage - 1);
      } else {
        goToPage(startPage);
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
    isSwipingHorizontal.current = false;
    isScrollingVertical.current = false;
  };

  // React Native PanResponder (네이티브 모바일 전용 수평 제스처 컨트롤러)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (Platform.OS === 'web' || isTransitioning.current) return false;
        const { dx, dy } = gestureState;
        return Math.abs(dx) > 25 && Math.abs(dx) > Math.abs(dy) * 1.8;
      },
      onPanResponderGrant: () => {
        gestureStartPage.current = currentPageRef.current;
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        const { dx } = gestureState;
        const currentBase = -gestureStartPage.current * containerWidthRef.current;
        if (gestureStartPage.current === 0 && dx > 0) {
          translateX.setValue(currentBase + dx * 0.15);
        } else if (gestureStartPage.current === 2 && dx < 0) {
          translateX.setValue(currentBase + dx * 0.15);
        } else {
          translateX.setValue(currentBase + dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, vx } = gestureState;
        const startPage = gestureStartPage.current;
        if (dx < -50 || (dx < -25 && vx < -0.35)) {
          if (startPage < 2) {
            goToPage(startPage + 1);
          } else {
            goToPage(startPage);
          }
        } else if (dx > 50 || (dx > 25 && vx > 0.35)) {
          if (startPage > 0) {
            goToPage(startPage - 1);
          } else {
            goToPage(startPage);
          }
        } else {
          goToPage(startPage);
        }
      },
    })
  ).current;

  // 데스크톱 / 노트북 트랙패드 수평 스크롤 연동 (500ms 쿨다운 락으로 1페이지씩만 안전 전환)
  const isWheelLocked = useRef<boolean>(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onWheel = (e: WheelEvent) => {
      if (isWheelLocked.current || isTransitioning.current) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.8 && Math.abs(e.deltaX) > 35) {
        isWheelLocked.current = true;
        const startPage = currentPageRef.current;
        if (e.deltaX > 35 && startPage < 2) {
          goToPage(startPage + 1);
        } else if (e.deltaX < -35 && startPage > 0) {
          goToPage(startPage - 1);
        }
        setTimeout(() => {
          isWheelLocked.current = false;
        }, 500);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel);
    };
  }, [goToPage]);

  // 모바일 브라우저 입력창(input) 터치 시 창 크기 축소/자동 확대 왜곡 전역 차단
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      let meta = document.querySelector('meta[name="viewport"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'viewport');
        document.head.appendChild(meta);
      }
      meta.setAttribute(
        'content',
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no, viewport-fit=cover'
      );

      const styleId = 'celueste-prevent-input-zoom';
      if (!document.getElementById(styleId)) {
        const styleTag = document.createElement('style');
        styleTag.id = styleId;
        styleTag.textContent = `
          input, textarea, select {
            font-size: 16px !important;
          }
        `;
        document.head.appendChild(styleTag);
      }
    }
  }, []);

  const onLayoutContainer = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidthRef.current) > 1) {
      setContainerWidth(w);
      translateX.setValue(-currentPageRef.current * w);
    }
  }, [translateX]);

  return {
    currentPage,
    setCurrentPage,
    containerWidth,
    setContainerWidth,
    translateX,
    goToPage,
    panResponder,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    onLayoutContainer,
  };
}

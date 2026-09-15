import { useRef } from 'react';
import { PanResponder, GestureResponderHandlers } from 'react-native';

export interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  velocityThreshold?: number;
}

/**
 * 모바일 화면 좌/우 스와이프 제스처 훅
 * - 수직 스크롤(상/하)을 방해하지 않고, 수평(좌/우) 스와이프만 정확하게 감지합니다.
 * - 왼쪽으로 넘기면 onSwipeLeft 실행
 * - 오른쪽으로 넘기면 onSwipeRight 실행
 */
export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  threshold = 45,
  velocityThreshold = 0.2,
}: SwipeGestureOptions): GestureResponderHandlers {
  const panResponder = useRef(
    PanResponder.create({
      // 수평 이동 각도 및 최소 이동 거리가 수직 이동보다 명확하게 클 때만 제스처 감지
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > 22 && Math.abs(dx) > Math.abs(dy) * 1.5;
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, vx } = gestureState;
        if (dx < -threshold || (dx < -20 && vx < -velocityThreshold)) {
          // 왼쪽으로 넘김 (손가락을 오른쪽에서 왼쪽으로)
          onSwipeLeft?.();
        } else if (dx > threshold || (dx > 20 && vx > velocityThreshold)) {
          // 오른쪽으로 넘김 (손가락을 왼쪽에서 오른쪽으로)
          onSwipeRight?.();
        }
      },
    })
  ).current;

  return panResponder.panHandlers;
}

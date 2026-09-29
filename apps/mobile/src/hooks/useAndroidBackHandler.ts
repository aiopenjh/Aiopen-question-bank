import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Android 하드웨어 뒤로가기. 마운트 동안 한 번만 등록하고 최신 처리 함수를 ref로 호출한다
 * (다시 그릴 때마다 재등록하지 않아 중복·누수와 호출 순서 변화가 없다). true면 기본 동작을 막는다.
 * 웹·iOS에서는 등록하지 않는다. 네이티브 Modal이 열려 있으면 Modal의 onRequestClose가 먼저 받는다.
 */
export function useAndroidBackHandler(onBack: () => boolean): void {
  const handlerRef = useRef(onBack);
  handlerRef.current = onBack;
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => handlerRef.current());
    return () => subscription.remove();
  }, []);
}

import React from 'react';
import { Modal, ModalProps, Platform, View, StyleSheet } from 'react-native';

export interface UniversalModalProps extends Omit<ModalProps, 'visible'> {
  visible: boolean;
  children: React.ReactNode;
  onClose?: () => void;
}

/**
 * UniversalModal
 * 
 * React 19 + react-native-web 환경에서 <Modal>이 document.body로 포털되면서
 * 터치/클릭 이벤트(Responder)가 유실되어 버튼이 안 눌리는 버그를 원천 해결합니다.
 * 
 * - Web: React 트리 내부에 고정(fixed) 최상위 오버레이로 렌더링하여 이벤트 유실 0% 보장
 * - Native (iOS/Android): 네이티브 최적화 <Modal> 컴포넌트로 부드럽게 렌더링
 */
export const UniversalModal: React.FC<UniversalModalProps> = ({
  visible,
  children,
  transparent = true,
  animationType = 'fade',
  onRequestClose,
  onClose,
  ...rest
}) => {
  if (!visible) return null;

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.webFixedContainer,
        ]}
        // @ts-ignore
        role="dialog"
        aria-modal={true}
      >
        {children}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent={transparent}
      animationType={animationType}
      onRequestClose={onRequestClose || onClose}
      {...rest}
    >
      {children}
    </Modal>
  );
};

const styles = StyleSheet.create({
  webFixedContainer: {
    // Web 환경에서 전체 뷰포트를 덮는 fixed 최상위 레이어
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          display: 'flex',
        } as any)
      : {}),
  },
});

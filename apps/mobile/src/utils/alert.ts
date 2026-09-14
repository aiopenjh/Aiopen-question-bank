import { Platform, Alert } from 'react-native';

export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertData {
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

type AlertListener = (data: AlertData | null) => void;

let currentListener: AlertListener | null = null;

/**
 * 전역 커스텀 인앱 알림/확인 모달 리스너 등록
 */
export function registerAlertListener(listener: AlertListener): () => void {
  currentListener = listener;
  return () => {
    if (currentListener === listener) {
      currentListener = null;
    }
  };
}

/**
 * 활성 알림 모달 강제 닫기
 */
export function dismissAlert(): void {
  if (currentListener) {
    currentListener(null);
  }
}

/**
 * Universal In-App Alert Helper
 * 웹 브라우저의 못생긴 window.alert / window.confirm 팝업을 완전히 제거하고,
 * 앱 내 일체화된 세련된 다크 글래스모피즘 팝업 모달로 표시합니다.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (currentListener) {
    currentListener({ title, message, buttons });
    return;
  }

  // 리스너 마운트 이전의 폴백
  if (Platform.OS === 'web') {
    const fullMsg = message ? `${title}\n\n${message}` : title;
    if (buttons && buttons.length > 1) {
      const confirmed = window.confirm(fullMsg);
      if (confirmed) {
        const confirmBtn = buttons.find((b) => b.style !== 'cancel') || buttons[buttons.length - 1];
        confirmBtn?.onPress?.();
      } else {
        const cancelBtn = buttons.find((b) => b.style === 'cancel');
        cancelBtn?.onPress?.();
      }
    } else {
      window.alert(fullMsg);
      if (buttons && buttons[0]?.onPress) {
        buttons[0].onPress();
      }
    }
  } else {
    Alert.alert(title, message, buttons);
  }
}

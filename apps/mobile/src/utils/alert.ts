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

// 스택 구조: 랭킹 창(RankingWindowScreen)처럼 메인 화면과 별도로 자체 구독하는
// 화면이 열려 있는 동안에도 메인 리스너를 잃지 않기 위함이다.
// 이전에는 단일 변수라 나중에 등록한 화면이 닫힐 때 항상 null로 덮어써서,
// 그 화면을 한 번이라도 열었다 닫으면 이후 모든 showAlert가 리스너 없음으로
// 처리되어 네이티브 Alert.alert(기본 OS 알림창) 폴백으로 떨어지는 문제가 있었다.
const listenerStack: AlertListener[] = [];

/**
 * 전역 커스텀 인앱 알림/확인 모달 리스너 등록
 */
export function registerAlertListener(listener: AlertListener): () => void {
  listenerStack.push(listener);
  return () => {
    const idx = listenerStack.lastIndexOf(listener);
    if (idx !== -1) listenerStack.splice(idx, 1);
  };
}

/**
 * 활성 알림 모달 강제 닫기
 */
export function dismissAlert(): void {
  const current = listenerStack[listenerStack.length - 1];
  if (current) {
    current(null);
  }
}

/**
 * Universal In-App Alert Helper
 * 웹 브라우저의 못생긴 window.alert / window.confirm 팝업을 완전히 제거하고,
 * 앱 내 일체화된 세련된 다크 글래스모피즘 팝업 모달로 표시합니다.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  const current = listenerStack[listenerStack.length - 1];
  if (current) {
    current({ title, message, buttons });
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

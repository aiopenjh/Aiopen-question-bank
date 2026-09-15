import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  ScrollView,
} from 'react-native';
import { UniversalModal as Modal } from '../common/UniversalModal';
import { AlertData, AlertButton } from '../../utils/alert';

interface AppAlertModalProps {
  alert: AlertData | null;
  onClose: () => void;
}

export const AppAlertModal: React.FC<AppAlertModalProps> = ({ alert, onClose }) => {
  if (!alert) return null;

  const { title, message, buttons } = alert;

  // 헤더 배지 아이콘 결정
  const getHeaderIcon = (t: string) => {
    if (t.includes('오류') || t.includes('실패') || t.includes('위험')) return '⚠️';
    if (t.includes('성공') || t.includes('완료') || t.includes('설계')) return '✨';
    if (t.includes('삭제') || t.includes('초기화') || t.includes('종료')) return '🗑️';
    if (t.includes('목차') || t.includes('단원') || t.includes('커리큘럼')) return '🌳';
    if (t.includes('키') || t.includes('보안') || t.includes('암호')) return '🔒';
    if (t.includes('복습') || t.includes('오답')) return '🔔';
    return '💡';
  };

  // 버튼 목록 구성 (미지정 시 기본 [확인] 1개 제공)
  const resolvedButtons: AlertButton[] =
    buttons && buttons.length > 0
      ? buttons
      : [{ text: '확인', style: 'default' }];

  const isVerticalLayout = resolvedButtons.length > 2 || resolvedButtons.some((b) => (b.text || '').length > 7);

  const handleButtonPress = (btn: AlertButton) => {
    onClose();
    if (btn.onPress) {
      setTimeout(() => {
        btn.onPress?.();
      }, 50);
    }
  };

  return (
    <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        activeOpacity={1}
        style={styles.backdrop}
        onPress={onClose}
        {...(Platform.OS === 'web' ? ({ onClick: onClose } as any) : {})}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.card}
          onPress={(e) => e.stopPropagation?.()}
          {...(Platform.OS === 'web' ? ({ onClick: (e: any) => e.stopPropagation?.() } as any) : {})}
        >
          {/* 상단 뱃지 및 제목 */}
          <View style={styles.headerRow}>
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>{getHeaderIcon(title)}</Text>
            </View>
            <Text style={styles.titleText}>{title}</Text>
          </View>

          {/* 본문 메시지 */}
          {message ? (
            <ScrollView style={styles.messageScroll} contentContainerStyle={styles.messageContent}>
              <Text style={styles.messageText}>{message}</Text>
            </ScrollView>
          ) : null}

          {/* 하단 액션 버튼 영역 */}
          <View style={[styles.buttonsContainer, isVerticalLayout && styles.buttonsVertical]}>
            {resolvedButtons.map((btn, idx) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';

              let btnStyle = styles.defaultBtn;
              let textStyle = styles.defaultBtnText;

              if (isCancel) {
                btnStyle = styles.cancelBtn;
                textStyle = styles.cancelBtnText;
              } else if (isDestructive) {
                btnStyle = styles.destructiveBtn;
                textStyle = styles.destructiveBtnText;
              }

              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.baseBtn,
                    btnStyle,
                    !isVerticalLayout && { flex: 1 },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleButtonPress(btn)}
                  {...(Platform.OS === 'web' ? ({ onClick: () => handleButtonPress(btn) } as any) : {})}
                >
                  <Text style={[styles.baseBtnText, textStyle]}>{btn.text || '확인'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 99999,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 18,
  },
  titleText: {
    flex: 1,
    fontSize: 17,
    fontWeight: 'bold',
    color: '#f8fafc',
    letterSpacing: -0.3,
  },
  messageScroll: {
    maxHeight: 260,
    marginBottom: 18,
  },
  messageContent: {
    paddingVertical: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#cbd5e1',
    letterSpacing: -0.2,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  buttonsVertical: {
    flexDirection: 'column',
    gap: 8,
  },
  baseBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  defaultBtn: {
    backgroundColor: '#4f46e5',
  },
  defaultBtnText: {
    color: '#ffffff',
  },
  cancelBtn: {
    backgroundColor: '#334155',
  },
  cancelBtnText: {
    color: '#94a3b8',
  },
  destructiveBtn: {
    backgroundColor: '#dc2626',
  },
  destructiveBtnText: {
    color: '#ffffff',
  },
});

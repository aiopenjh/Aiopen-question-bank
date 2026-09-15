import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { UniversalModal as Modal } from '../common/UniversalModal';
import { AlertData, AlertButton } from '../../utils/alert';
import { colors, radius, shadows, spacing } from '../../styles/designTokens';

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
      <View style={styles.backdrop}>
        <View style={styles.card}>
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

              const btnStyle = isCancel
                ? styles.cancelBtn
                : isDestructive
                  ? styles.destructiveBtn
                  : styles.defaultBtn;
              const textStyle = isCancel
                ? styles.cancelBtnText
                : isDestructive
                  ? styles.destructiveBtnText
                  : styles.defaultBtnText;

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
                >
                  <Text style={[styles.baseBtnText, textStyle]}>{btn.text || '확인'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(64, 48, 56, 0.44)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    zIndex: 99999,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
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
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.ink,
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
    color: colors.inkMuted,
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
    borderRadius: radius.md,
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
    backgroundColor: colors.primaryPressed,
  },
  defaultBtnText: {
    color: '#ffffff',
  },
  cancelBtn: {
    backgroundColor: colors.primarySoft,
  },
  cancelBtnText: {
    color: colors.primaryPressed,
  },
  destructiveBtn: {
    backgroundColor: colors.danger,
  },
  destructiveBtnText: {
    color: '#ffffff',
  },
});

import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { UniversalModal as Modal } from '../../components/common/UniversalModal';
import { colors, radius, shadows, spacing } from '../../styles/designTokens';

const FEEDBACK_ENDPOINT = 'https://formspree.io/f/xgavekne';

export interface FeedbackCardProps {
  compact?: boolean;
}

export const FeedbackCard: React.FC<FeedbackCardProps> = ({ compact = false }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const submittingRef = useRef(false);

  const openModal = () => {
    if (isSubmitting) return;
    submittingRef.current = false;
    setIsSent(false);
    setErrorMessage('');
    setVisible(true);
  };

  const closeModal = () => {
    if (!isSubmitting) setVisible(false);
  };

  const handleSubmit = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || submittingRef.current) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage('');
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let sent = false;

    try {
      const response = await Promise.race([fetch(FEEDBACK_ENDPOINT, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: trimmedMessage,
          _subject: 'Celueste 앱 사용자 의견',
        }),
      }), new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error('TIMEOUT'));
          controller.abort();
        }, 20000);
      })]);

      if (!response.ok) throw new Error(String(response.status));

      sent = true;
      setMessage('');
      setIsSent(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message === 'TIMEOUT'
          ? '응답이 늦어 전송 결과를 확인하지 못했습니다. 내용은 유지됩니다. 잠시 후 확인해 주세요.'
          : error instanceof Error && error.message === '429'
          ? '현재 의견 접수 한도에 도달했습니다. 나중에 다시 보내주세요.'
          : '의견을 보내지 못했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.'
      );
    } finally {
      clearTimeout(timeout);
      if (!sent) submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={compact ? styles.compactContainer : styles.cardContainer}
        onPress={openModal}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="의견 보내기"
      >
        {compact ? (
          <>
            <Text style={styles.compactIcon}>✉️</Text>
            <Text style={styles.compactText}>의견 보내기</Text>
            <Text style={styles.compactArrow}>›</Text>
          </>
        ) : (
          <>
            <View style={styles.copyArea}>
              <Text style={styles.headerTitle}>의견 보내기</Text>
              <Text style={styles.description}>불편한 점이나 필요한 기능을 알려주세요.</Text>
            </View>
            <Text style={styles.sendLinkText}>작성 ›</Text>
          </>
        )}
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalBackdrop} onPress={closeModal}>
            <TouchableOpacity
              activeOpacity={1}
              style={styles.modalCard}
              onPress={(event) => event.stopPropagation?.()}
            >
              {isSent ? (
                <>
                  <Text style={styles.modalIcon}>💌</Text>
                  <Text style={styles.modalTitleCentered}>의견을 전달했습니다</Text>
                  <Text style={styles.sentDescription}>보내주신 내용은 앱 개선에 소중히 반영하겠습니다.</Text>
                  <TouchableOpacity
                    style={[styles.primaryButton, styles.successButton]}
                    onPress={closeModal}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryButtonText}>확인</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.modalHeader}>
                    <View style={styles.modalIconBadge}>
                      <Text style={styles.modalIconSmall}>✉️</Text>
                    </View>
                    <View style={styles.modalHeaderCopy}>
                      <Text style={styles.modalTitle}>Celueste에 의견 보내기</Text>
                      <Text style={styles.modalDescription}>불편한 점이나 바라는 기능을 자유롭게 적어주세요.</Text>
                    </View>
                  </View>

                  <TextInput
                    style={styles.messageInput}
                    value={message}
                    onChangeText={setMessage}
                    placeholder="하고 싶은 말을 입력해주세요."
                    placeholderTextColor={colors.inkMuted}
                    multiline
                    maxLength={1500}
                    editable={!isSubmitting}
                    textAlignVertical="top"
                    autoFocus
                    accessibilityLabel="의견 내용"
                  />
                  <Text style={styles.characterCount}>{message.length} / 1500</Text>

                  {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={closeModal}
                      disabled={isSubmitting}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.secondaryButtonText}>취소</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        (!message.trim() || isSubmitting) && styles.disabledButton,
                      ]}
                      onPress={handleSubmit}
                      disabled={!message.trim() || isSubmitting}
                      activeOpacity={0.8}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Text style={styles.primaryButtonText}>보내기</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  copyArea: {
    flex: 1,
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
  },
  description: {
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: 2,
  },
  sendLinkText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  compactContainer: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  compactText: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  compactArrow: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 5,
  },
  modalOverlay: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(64, 48, 56, 0.46)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    ...shadows.soft,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  modalIconSmall: {
    fontSize: 20,
  },
  modalHeaderCopy: {
    flex: 1,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  modalDescription: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  messageInput: {
    minHeight: 150,
    maxHeight: 240,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21,
    padding: spacing.md,
  },
  characterCount: {
    alignSelf: 'flex-end',
    color: colors.inkMuted,
    fontSize: 10,
    marginTop: spacing.xs,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.inkMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  primaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryPressed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.45,
  },
  modalIcon: {
    alignSelf: 'center',
    fontSize: 34,
    marginBottom: spacing.md,
  },
  modalTitleCentered: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  sentDescription: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  successButton: {
    marginTop: spacing.lg,
  },
});

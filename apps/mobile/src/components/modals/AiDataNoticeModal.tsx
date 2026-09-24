import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { UniversalModal as Modal } from '../common/UniversalModal';
import { colors, radius, shadows, spacing } from '../../styles/designTokens';
import { registerAiDataNoticeListener } from '../../domain/ai_data_notice';

// 특정 AI 제품명은 쓰지 않는다. 문구를 바꾸면 ai_data_notice.ts의 AI_DATA_NOTICE_VERSION도 올린다.
export const AI_DATA_NOTICE_TITLE = 'AI 서비스로 전송되는 정보';
export const AI_DATA_NOTICE_MESSAGE = [
  'AI 기능을 쓰면 다음 정보가 사용자가 연결한 AI 서비스 제공자에게 전송될 수 있습니다.',
  '',
  '· 직접 입력한 출제 요청과 과목·단원 이름',
  '· 연결한 교재에서 선택한 페이지',
  '· AI 채점과 힌트에 쓰이는 문제와 답안',
  '· AI 연결에 쓰는 API 키',
  '',
  '전송된 정보의 처리·보관 조건은 제공자와 요금제에 따라 다릅니다. 입력 내용이 제공자의 서비스 개선에 쓰이거나 사람이 검토할 수도 있으니, 민감한 개인정보는 넣지 마세요. 자세한 조건은 사용하는 AI 서비스의 약관과 개인정보 처리방침에서 확인할 수 있습니다.',
].join('\n');

/** 앱에 한 번만 두는 안내 창. ensureAiDataNoticeAccepted()가 요청할 때만 보인다. */
export const AiDataNoticeModal: React.FC = () => {
  const [answer, setAnswer] = useState<((accepted: boolean) => void) | null>(null);

  useEffect(() => registerAiDataNoticeListener((next) => setAnswer(() => next)), []);

  if (!answer) return null;
  const respond = (accepted: boolean) => {
    setAnswer(null);
    answer(accepted);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => respond(false)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{AI_DATA_NOTICE_TITLE}</Text>
          <ScrollView style={styles.messageScroll}>
            <Text style={styles.message}>{AI_DATA_NOTICE_MESSAGE}</Text>
          </ScrollView>
          <View style={styles.buttons}>
            <TouchableOpacity style={[styles.button, styles.cancel]} onPress={() => respond(false)} activeOpacity={0.8}>
              <Text style={[styles.buttonText, styles.cancelText]}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.confirm]} onPress={() => respond(true)} activeOpacity={0.8}>
              <Text style={[styles.buttonText, styles.confirmText]}>계속하기</Text>
            </TouchableOpacity>
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
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  title: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  messageScroll: {
    flexShrink: 1,
  },
  message: {
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  button: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: {
    backgroundColor: colors.primarySoft,
  },
  confirm: {
    backgroundColor: colors.primaryPressed,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  cancelText: {
    color: colors.primaryPressed,
  },
  confirmText: {
    color: colors.white,
  },
});

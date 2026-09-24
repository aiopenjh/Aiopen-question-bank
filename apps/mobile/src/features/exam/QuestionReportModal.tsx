/**
 * AI 생성 문제 신고. 사용자가 '신고 보내기'를 누를 때만 기존 의견 전송 경로(Formspree)로 보낸다.
 * 보내는 항목: 문제 ID·지문·보기 문구·사유·메모. 답안·정답·해설·API 키·다른 문제·사용자 식별 정보는 넣지 않는다.
 * 시험 답안과 채점 결과는 건드리지 않는다.
 */

import React, { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { QuestionRevision } from '../../contracts/types';
import { UniversalModal as Modal } from '../../components/common/UniversalModal';
import { colors, radius, spacing } from '../../styles/designTokens';
import { feedbackStyles as fs, postFeedback } from '../study/FeedbackCard';

export const QUESTION_REPORT_REASONS = [
  '사실과 다른 내용',
  '정답이 없거나 둘 이상',
  '문제·보기가 모호함',
  '표시·형식 오류',
  '부적절하거나 유해한 내용',
  '기타',
] as const;

export const QUESTION_REPORT_NOTICE = '이 문제의 지문·보기, 신고 사유·메모가 Celueste 운영자에게 전달됩니다.';

export function buildQuestionReportPayload(question: QuestionRevision, reason: string, memo: string): Record<string, string> {
  return {
    _subject: 'Celueste 문제 신고',
    questionId: question.questionId,
    stem: question.stem,
    // 보기는 화면에 보인 순서의 문구만 보낸다(정답 표시 필드는 제외).
    options: (question.options || []).map((option, index) => `${index + 1}. ${option.text}`).join('\n'),
    reason,
    memo: memo.trim(),
  };
}

export const ReportQuestionButton: React.FC<{ onPress: () => void }> = ({ onPress }) => (
  <TouchableOpacity style={styles.trigger} onPress={onPress} accessibilityRole="button" activeOpacity={0.8}>
    <Text style={styles.triggerText}>문제 신고</Text>
  </TouchableOpacity>
);

export const QuestionReportModal: React.FC<{ question: QuestionRevision; onClose: () => void }> = ({ question, onClose }) => {
  const [reason, setReason] = useState('');
  const [memo, setMemo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const submittingRef = useRef(false);

  const close = () => {
    if (!isSubmitting) onClose();
  };

  const submit = async () => {
    if (!reason || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await postFeedback(buildQuestionReportPayload(question, reason, memo));
      setIsSent(true);
    } catch (error) {
      // 실패하면 사유와 메모는 그대로 두고 다시 보낼 수 있게 한다.
      setErrorMessage(
        error instanceof Error && error.message === 'TIMEOUT'
          ? '응답이 늦어 전송 결과를 확인하지 못했습니다. 작성한 내용은 그대로 있습니다. 잠시 후 확인해 주세요.'
          : error instanceof Error && error.message === '429'
          ? '현재 신고 접수 한도에 도달했습니다. 나중에 다시 보내주세요.'
          : '신고를 보내지 못했습니다. 인터넷 연결을 확인하고 다시 시도해주세요. 작성한 내용은 그대로 있습니다.'
      );
      submittingRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        style={fs.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      >
        <View style={fs.modalBackdrop}>
          <View style={[fs.modalCard, styles.card]}>
            <ScrollView style={fs.modalScroll} contentContainerStyle={fs.modalScrollContent} keyboardShouldPersistTaps="handled">
              {isSent ? (
                <>
                  <Text style={fs.modalTitle}>신고를 전달했습니다</Text>
                  <Text style={fs.modalDescription}>확인 후 문제 품질 개선에 반영하겠습니다. 시험 답안과 채점 결과는 바뀌지 않습니다.</Text>
                  <View style={fs.buttonRow}>
                    <TouchableOpacity style={fs.primaryButton} onPress={onClose} activeOpacity={0.8}>
                      <Text style={fs.primaryButtonText}>확인</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={fs.modalTitle}>문제 신고</Text>
                  <Text style={fs.modalDescription}>신고 사유를 고르고, 필요하면 메모를 남겨주세요.</Text>

                  <View style={styles.reasonList}>
                    {QUESTION_REPORT_REASONS.map((item) => (
                      <TouchableOpacity
                        key={item}
                        style={[styles.reason, reason === item && styles.reasonSelected]}
                        onPress={() => setReason(item)}
                        disabled={isSubmitting}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: reason === item }}
                      >
                        <Text style={[styles.reasonText, reason === item && styles.reasonTextSelected]}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    style={[fs.messageInput, styles.memo]}
                    value={memo}
                    onChangeText={setMemo}
                    placeholder="메모 (선택)"
                    placeholderTextColor={colors.inkMuted}
                    multiline
                    maxLength={500}
                    editable={!isSubmitting}
                    textAlignVertical="top"
                    accessibilityLabel="신고 메모"
                  />

                  <Text style={styles.notice}>{QUESTION_REPORT_NOTICE}</Text>
                  {errorMessage ? <Text style={fs.errorText}>{errorMessage}</Text> : null}

                  <View style={fs.buttonRow}>
                    <TouchableOpacity style={fs.secondaryButton} onPress={close} disabled={isSubmitting} activeOpacity={0.8}>
                      <Text style={fs.secondaryButtonText}>취소</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[fs.primaryButton, (!reason || isSubmitting) && fs.disabledButton]}
                      onPress={submit}
                      disabled={!reason || isSubmitting}
                      activeOpacity={0.8}
                    >
                      {isSubmitting ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={fs.primaryButtonText}>신고 보내기</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  trigger: {
    alignSelf: 'flex-end',
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
  },
  triggerText: {
    color: colors.inkMuted,
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  card: {
    maxWidth: 440,
  },
  reasonList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  reason: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  reasonSelected: {
    borderColor: colors.primaryPressed,
    backgroundColor: colors.primarySoft,
  },
  reasonText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  reasonTextSelected: {
    color: colors.primaryPressed,
    fontWeight: '800',
  },
  memo: {
    minHeight: 88,
    maxHeight: 160,
  },
  notice: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
  },
});

import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LearnerKnowledgeLevel } from '../../contracts/types';
import { colors, radius, shadows, spacing } from '../../styles/designTokens';
import { UniversalModal as Modal } from '../common/UniversalModal';

export interface QuizCountModalOptions {
  learnerLevel?: LearnerKnowledgeLevel;
  shouldReplaceExisting?: boolean;
}

interface QuizCountModalProps {
  visible: boolean;
  unitTitle?: string;
  topicName?: string;
  existingCount?: number;
  initialLevel?: LearnerKnowledgeLevel;
  onClose: () => void;
  onSelectCount: (count: number, options?: QuizCountModalOptions) => void;
  onOpenBackup?: () => void;
}

const LEVEL_OPTIONS = [
  { key: 'beginner', icon: '🌱', name: '입문', desc: '기초 개념' },
  { key: 'basic', icon: '📘', name: '기본', desc: '필수 원리' },
  { key: 'advanced', icon: '🔥', name: '실전', desc: '응용·함정' },
  { key: 'master', icon: '👑', name: '심화', desc: '복합 추론' },
] as const;

const COUNT_OPTIONS = [
  { count: 3, title: '3문제', meta: '빠른 확인', description: '핵심 개념을 짧게 점검해요.', recommended: false },
  { count: 5, title: '5문제', meta: '추천', description: '개념과 응용을 균형 있게 풀어요.', recommended: true },
  { count: 10, title: '10문제', meta: '집중 학습', description: '단원을 충분히 연습해요.', recommended: false },
] as const;

export const QuizCountModal: React.FC<QuizCountModalProps> = ({
  visible,
  unitTitle,
  topicName,
  existingCount = 0,
  initialLevel = 'basic',
  onClose,
  onSelectCount,
  onOpenBackup,
}) => {
  const [selectedLevel, setSelectedLevel] = useState<LearnerKnowledgeLevel>(initialLevel);
  const [shouldReplace, setShouldReplace] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedLevel(initialLevel || 'basic');
      setShouldReplace(false);
    }
  }, [visible, initialLevel]);

  const selectedLevelInfo = LEVEL_OPTIONS.find((item) => item.key === selectedLevel)!;
  const isModifiedFromDefault = selectedLevel !== initialLevel;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation?.()}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>QUIZ SETUP</Text>
              <Text style={styles.title}>이번에는 얼마나 풀까요?</Text>
              {unitTitle ? (
                <Text style={styles.subtitle} numberOfLines={2}>
                  {topicName ? `${topicName} · ` : ''}{unitTitle}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="출제 설정 닫기"
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.currentLevelRow}>
              <View style={styles.levelMark}>
                <Text style={styles.levelMarkText}>{selectedLevelInfo.icon}</Text>
              </View>
              <View style={styles.currentLevelCopy}>
                <Text style={styles.currentLevelLabel}>현재 난이도</Text>
                <Text style={styles.currentLevelValue}>
                  {selectedLevelInfo.name} · {selectedLevelInfo.desc}
                </Text>
              </View>
              <Text style={styles.originTag}>
                {isModifiedFromDefault ? '이번만 변경' : '과목 기본값'}
              </Text>
            </View>

            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionTitle}>난이도</Text>
              {isModifiedFromDefault ? (
                <TouchableOpacity onPress={() => setSelectedLevel(initialLevel)}>
                  <Text style={styles.resetText}>기본값으로</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.sectionHint}>필요할 때만 바꾸세요</Text>
              )}
            </View>
            <View style={styles.levelRow}>
              {LEVEL_OPTIONS.map((item) => {
                const active = selectedLevel === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.levelChip, active && styles.levelChipActive]}
                    onPress={() => setSelectedLevel(item.key)}
                  >
                    <Text style={styles.levelChipIcon}>{item.icon}</Text>
                    <Text style={[styles.levelChipText, active && styles.levelChipTextActive]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {existingCount > 0 ? (
              <View style={styles.existingSection}>
                <View style={styles.sectionHeadingRow}>
                  <Text style={styles.sectionTitle}>기존 {existingCount}문제</Text>
                  <Text style={styles.sectionHint}>처리 방식</Text>
                </View>
                <View style={styles.replaceRow}>
                  <TouchableOpacity
                    style={[styles.replaceButton, !shouldReplace && styles.replaceButtonActive]}
                    onPress={() => setShouldReplace(false)}
                  >
                    <Text style={[styles.replaceText, !shouldReplace && styles.replaceTextActive]}>
                      유지하고 추가
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.replaceButton, shouldReplace && styles.replaceButtonDanger]}
                    onPress={() => setShouldReplace(true)}
                  >
                    <Text style={[styles.replaceText, shouldReplace && styles.replaceTextDanger]}>
                      지우고 교체
                    </Text>
                  </TouchableOpacity>
                </View>
                {shouldReplace ? (
                  <Text style={styles.replaceWarning}>
                    기존 문제를 비운 뒤 선택한 난이도로 새로 만듭니다.
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Text style={[styles.sectionTitle, styles.countSectionTitle]}>문항 수</Text>
            <View style={styles.countList}>
              {COUNT_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item.count}
                  style={[styles.countCard, item.recommended && styles.countCardRecommended]}
                  onPress={() =>
                    onSelectCount(item.count, {
                      learnerLevel: selectedLevel,
                      shouldReplaceExisting: shouldReplace,
                    })
                  }
                  activeOpacity={0.82}
                >
                  <View style={styles.countNumberBox}>
                    <Text style={styles.countNumber}>{item.count}</Text>
                  </View>
                  <View style={styles.countCopy}>
                    <View style={styles.countTitleRow}>
                      <Text style={styles.countTitle}>{item.title}</Text>
                      <View style={[styles.countMeta, item.recommended && styles.countMetaRecommended]}>
                        <Text style={[styles.countMetaText, item.recommended && styles.countMetaTextRecommended]}>
                          {item.meta}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.countDescription}>{item.description}</Text>
                  </View>
                  <Text style={styles.countArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>

            {existingCount >= 30 && onOpenBackup ? (
              <TouchableOpacity
                style={styles.backupNotice}
                onPress={() => {
                  onClose();
                  onOpenBackup();
                }}
              >
                <Text style={styles.backupNoticeIcon}>🛡️</Text>
                <View style={styles.backupNoticeCopy}>
                  <Text style={styles.backupNoticeTitle}>문제가 많이 쌓였어요</Text>
                  <Text style={styles.backupNoticeText}>기기 변경에 대비해 백업 파일을 만들어 두세요.</Text>
                </View>
                <Text style={styles.backupNoticeAction}>백업</Text>
              </TouchableOpacity>
            ) : null}

            <Text style={styles.privacyNote}>생성된 문제는 이 기기의 개인 문제은행에만 보관됩니다.</Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(64, 48, 56, 0.44)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCopy: {
    flex: 1,
    paddingRight: spacing.md,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  closeButtonText: {
    color: colors.inkMuted,
    fontSize: 24,
    lineHeight: 25,
  },
  scrollArea: {
    flexShrink: 1,
  },
  scrollContent: {
    padding: spacing.xl,
  },
  currentLevelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.lg,
  },
  levelMark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginRight: spacing.sm,
  },
  levelMarkText: {
    fontSize: 15,
  },
  currentLevelCopy: {
    flex: 1,
  },
  currentLevelLabel: {
    color: colors.inkMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  currentLevelValue: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  originTag: {
    color: colors.primaryPressed,
    fontSize: 10,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  sectionHint: {
    color: colors.inkMuted,
    fontSize: 10,
  },
  resetText: {
    color: colors.primaryPressed,
    fontSize: 10,
    fontWeight: '700',
  },
  levelRow: {
    flexDirection: 'row',
    gap: 6,
  },
  levelChip: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  levelChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  levelChipIcon: {
    fontSize: 14,
    marginBottom: 2,
  },
  levelChipText: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  levelChipTextActive: {
    color: colors.primaryPressed,
    fontWeight: '800',
  },
  existingSection: {
    marginTop: spacing.lg,
  },
  replaceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  replaceButton: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  replaceButtonActive: {
    borderColor: '#C9E1D9',
    backgroundColor: colors.mintSoft,
  },
  replaceButtonDanger: {
    borderColor: '#E6C7CD',
    backgroundColor: '#FAECEE',
  },
  replaceText: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  replaceTextActive: {
    color: colors.mint,
  },
  replaceTextDanger: {
    color: colors.danger,
  },
  replaceWarning: {
    color: colors.danger,
    fontSize: 10,
    lineHeight: 15,
    marginTop: spacing.sm,
  },
  countSectionTitle: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  countList: {
    gap: spacing.sm,
  },
  countCard: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  countCardRecommended: {
    borderColor: '#DFC2CB',
    backgroundColor: '#FFFBFC',
  },
  countNumberBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginRight: spacing.md,
  },
  countNumber: {
    color: colors.primaryPressed,
    fontSize: 16,
    fontWeight: '900',
  },
  countCopy: {
    flex: 1,
    minWidth: 0,
  },
  countTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  countMeta: {
    marginLeft: spacing.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  countMetaRecommended: {
    backgroundColor: colors.primarySoft,
  },
  countMetaText: {
    color: colors.inkMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  countMetaTextRecommended: {
    color: colors.primaryPressed,
  },
  countDescription: {
    color: colors.inkMuted,
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 3,
  },
  countArrow: {
    color: colors.primary,
    fontSize: 22,
    marginLeft: spacing.sm,
  },
  backupNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginTop: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.mintSoft,
  },
  backupNoticeIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  backupNoticeCopy: {
    flex: 1,
  },
  backupNoticeTitle: {
    color: colors.mint,
    fontSize: 11,
    fontWeight: '800',
  },
  backupNoticeText: {
    color: colors.inkMuted,
    fontSize: 9.5,
    marginTop: 2,
  },
  backupNoticeAction: {
    color: colors.mint,
    fontSize: 11,
    fontWeight: '800',
    marginLeft: spacing.sm,
  },
  privacyNote: {
    color: colors.inkMuted,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});

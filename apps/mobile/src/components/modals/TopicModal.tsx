import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LearnerKnowledgeLevel } from '../../contracts/types';
import { colors, radius, shadows, spacing } from '../../styles/designTokens';
import { showAlert } from '../../utils/alert';
import { UniversalModal as Modal } from '../common/UniversalModal';

export interface TopicModalProps {
  visible: boolean;
  onClose: () => void;
  initialTopicName?: string;
  onCreateTopic: (
    name: string,
    description: string,
    options?: {
      autoCurriculum?: boolean;
      learnerLevel?: LearnerKnowledgeLevel;
      category?: string;
      customUnits?: string[];
    }
  ) => Promise<void>;
}

const CATEGORY_SUGGESTIONS = [
  { icon: '⚖️', label: '법학·행정', value: '법학/행정' },
  { icon: '🎮', label: 'IT·개발', value: 'IT/개발' },
  { icon: '💼', label: '경영·경제', value: '비즈니스/경영' },
  { icon: '🌐', label: '언어·어학', value: '언어/어학' },
  { icon: '📐', label: '수학·과학', value: '자연과학/수학' },
  { icon: '🩺', label: '의학·보건', value: '의학/보건' },
  { icon: '🎨', label: '문화·예술', value: '문화/예술' },
  { icon: '📚', label: '교양·자격', value: '교양/자격증' },
] as const;

const LEVEL_OPTIONS = [
  { key: 'beginner', icon: '🌱', label: '입문', description: '처음 배우는 단계' },
  { key: 'basic', icon: '📘', label: '기본', description: '핵심 개념 중심' },
  { key: 'advanced', icon: '🔥', label: '실전', description: '응용 문제 중심' },
  { key: 'master', icon: '👑', label: '심화', description: '고난도·세부 개념' },
] as const;

export const TopicModal: React.FC<TopicModalProps> = ({
  visible,
  onClose,
  initialTopicName = '',
  onCreateTopic,
}) => {
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const [topicName, setTopicName] = useState(initialTopicName);
  const [category, setCategory] = useState('');
  const [learnerLevel, setLearnerLevel] = useState<LearnerKnowledgeLevel>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setTopicName(initialTopicName || '');
      setCategory('');
      setLearnerLevel('basic');
    }
  }, [visible, initialTopicName]);

  async function handleCreate() {
    const trimmedName = topicName.trim();
    if (!trimmedName) {
      showAlert('알림', '학습할 과목 이름을 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateTopic(trimmedName, '', {
        autoCurriculum: true,
        learnerLevel,
        category: category.trim() || '일반',
      });
      setTopicName('');
      setCategory('');
      onClose();
    } catch (err: any) {
      showAlert('오류', `과목 생성 실패: ${err?.message || '알 수 없는 오류'}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.card, isCompact && styles.cardCompact]}
          onPress={(event) => event.stopPropagation?.()}
        >
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>NEW STUDY</Text>
              <Text style={styles.title}>새 학습 과목</Text>
              <Text style={styles.guide}>
                이름과 시작 수준을 정하면 AI가 단계별 목차를 설계해요.
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="과목 추가 닫기"
              style={styles.closeButton}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.fieldLabel}>과목 이름</Text>
            <TextInput
              style={styles.input}
              placeholder="예: 수학, 한국사, Python 비동기 프로그래밍"
              placeholderTextColor="#A9959C"
              value={topicName}
              onChangeText={setTopicName}
              editable={!isSubmitting}
              returnKeyType="next"
            />

            <View style={styles.fieldHeadingRow}>
              <Text style={styles.fieldLabel}>과목 분류</Text>
              <Text style={styles.optionalText}>선택 사항</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="직접 입력하거나 아래에서 선택"
              placeholderTextColor="#A9959C"
              value={category}
              onChangeText={setCategory}
              editable={!isSubmitting}
              returnKeyType="done"
            />
            <View style={styles.categoryGrid}>
              {CATEGORY_SUGGESTIONS.map((item) => {
                const isSelected = category === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.categoryChip,
                      isCompact && styles.categoryChipCompact,
                      isSelected && styles.categoryChipSelected,
                    ]}
                    onPress={() => setCategory(item.value)}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.categoryIcon}>{item.icon}</Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.categoryText, isSelected && styles.categoryTextSelected]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, styles.levelLabel]}>시작 난이도</Text>
            <View style={styles.levelGrid}>
              {LEVEL_OPTIONS.map((item) => {
                const isSelected = learnerLevel === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.levelCard, isSelected && styles.levelCardSelected]}
                    onPress={() => setLearnerLevel(item.key)}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.levelIcon}>{item.icon}</Text>
                    <View style={styles.levelCopy}>
                      <Text style={[styles.levelTitle, isSelected && styles.levelTitleSelected]}>
                        {item.label}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.levelDescription,
                          isSelected && styles.levelDescriptionSelected,
                        ]}
                      >
                        {item.description}
                      </Text>
                    </View>
                    <View style={[styles.radio, isSelected && styles.radioSelected]}>
                      {isSelected ? <View style={styles.radioDot} /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.aiNote}>
              <Text style={styles.aiNoteIcon}>✦</Text>
              <Text style={styles.aiNoteText}>
                등록 후 선택한 난이도를 기준으로 1~5단계 목차를 자동 생성합니다.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.submitButton]}
              onPress={handleCreate}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <View style={styles.submittingRow}>
                  <ActivityIndicator color={colors.white} size="small" />
                  <Text style={styles.submitButtonText}>목차 설계 중</Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>과목 만들기</Text>
              )}
            </TouchableOpacity>
          </View>
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
    maxWidth: 460,
    maxHeight: '92%',
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  cardCompact: {
    borderRadius: radius.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: '#FFF9FB',
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
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  guide: {
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
    backgroundColor: colors.primarySoft,
  },
  closeButtonText: {
    color: colors.primaryPressed,
    fontSize: 24,
    lineHeight: 25,
    fontWeight: '400',
  },
  scrollArea: {
    flexShrink: 1,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.lg,
  },
  fieldHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  optionalText: {
    color: colors.inkMuted,
    fontSize: 11,
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: 46,
    backgroundColor: '#FFFBFC',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    width: '47%',
    minWidth: 86,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  categoryChipCompact: {
    width: '47%',
  },
  categoryChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  categoryIcon: {
    fontSize: 13,
    marginRight: 5,
  },
  categoryText: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  categoryTextSelected: {
    color: colors.primaryPressed,
    fontWeight: '800',
  },
  levelLabel: {
    marginTop: spacing.lg,
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  levelCard: {
    width: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  levelCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  levelIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  levelCopy: {
    flex: 1,
    minWidth: 0,
  },
  levelTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  levelTitleSelected: {
    color: colors.primaryPressed,
  },
  levelDescription: {
    color: colors.inkMuted,
    fontSize: 9,
    marginTop: 2,
  },
  levelDescriptionSelected: {
    color: colors.primary,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#CDBFC4',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  aiNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.lavenderSoft,
  },
  aiNoteIcon: {
    color: colors.lavender,
    fontSize: 14,
    fontWeight: '800',
    marginRight: spacing.sm,
  },
  aiNoteText: {
    flex: 1,
    color: '#655A82',
    fontSize: 11,
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: '#FFFDFE',
  },
  actionButton: {
    minHeight: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    width: 94,
    backgroundColor: colors.primarySoft,
  },
  cancelButtonText: {
    color: colors.primaryPressed,
    fontSize: 13,
    fontWeight: '800',
  },
  submitButton: {
    flex: 1,
    backgroundColor: colors.primaryPressed,
    ...shadows.action,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});

import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { QuestionRevision, Topic, Unit } from '../../contracts/types';
import { colors, radius, shadows, spacing } from '../../styles/designTokens';
import { UniversalModal as Modal } from '../common/UniversalModal';

export interface UnitSelectModalProps {
  visible: boolean;
  topic: Topic | null;
  units: Unit[];
  questions: QuestionRevision[];
  onSelectUnitForGeneration: (topic: Topic, unit: Unit) => void;
  onSelectTopicOverviewForGeneration: (topic: Topic) => void;
  onStartExamWithExistingQuestions?: (questions: QuestionRevision[]) => void;
  onClose: () => void;
}

export const UnitSelectModal: React.FC<UnitSelectModalProps> = ({
  visible,
  topic,
  units,
  questions,
  onSelectUnitForGeneration,
  onSelectTopicOverviewForGeneration,
  onStartExamWithExistingQuestions,
  onClose,
}) => {
  if (!topic) return null;

  const topicUnits = units.filter((unit) => unit.topicId === topic.id);
  const topicQuestions = questions.filter((question) => question.topicId === topic.id);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation?.()}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>CHOOSE A UNIT</Text>
              <Text style={styles.title}>어느 단원을 공부할까요?</Text>
              <Text style={styles.subtitle} numberOfLines={2}>{topic.name}</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="단원 선택 닫기"
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {topicQuestions.length > 0 && onStartExamWithExistingQuestions ? (
              <TouchableOpacity
                style={styles.savedQuizCard}
                onPress={() => onStartExamWithExistingQuestions(topicQuestions)}
              >
                <View style={styles.savedQuizMark}>
                  <Text style={styles.savedQuizMarkText}>✓</Text>
                </View>
                <View style={styles.savedQuizCopy}>
                  <Text style={styles.savedQuizTitle}>저장된 문제 바로 풀기</Text>
                  <Text style={styles.savedQuizText}>새로 만들지 않고 {topicQuestions.length}문항을 시작합니다.</Text>
                </View>
                <Text style={styles.savedQuizArrow}>›</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.overviewCard}
              onPress={() => onSelectTopicOverviewForGeneration(topic)}
            >
              <View style={styles.overviewMark}>
                <Text style={styles.overviewMarkText}>✦</Text>
              </View>
              <View style={styles.overviewCopy}>
                <View style={styles.overviewTitleRow}>
                  <Text style={styles.overviewTitle}>전체 단원 종합</Text>
                  <View style={styles.overviewBadge}>
                    <Text style={styles.overviewBadgeText}>모의 학습</Text>
                  </View>
                </View>
                <Text style={styles.overviewText}>여러 단원의 핵심 개념을 섞어서 출제합니다.</Text>
              </View>
              <Text style={styles.overviewArrow}>›</Text>
            </TouchableOpacity>

            {topicUnits.length > 0 ? (
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionTitle}>단원별 학습</Text>
                <Text style={styles.sectionCount}>{topicUnits.length}개 단원</Text>
              </View>
            ) : null}

            {topicUnits.map((unit, index) => {
              const unitQuestions = questions.filter((question) => question.unitId === unit.id);
              const hasSavedQuestions = unitQuestions.length > 0;

              return (
                <View key={unit.id} style={styles.unitCard}>
                  <View style={styles.unitTopRow}>
                    <View style={styles.unitIndex}>
                      <Text style={styles.unitIndexText}>{String(index + 1).padStart(2, '0')}</Text>
                    </View>
                    <View style={styles.unitCopy}>
                      <Text style={styles.unitTitle} numberOfLines={3}>{unit.title}</Text>
                      <Text style={styles.unitMeta}>
                        {hasSavedQuestions ? `저장된 문제 ${unitQuestions.length}문항` : '아직 만든 문제가 없어요'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.unitActions}>
                    {hasSavedQuestions && onStartExamWithExistingQuestions ? (
                      <TouchableOpacity
                        style={[styles.unitActionButton, styles.solveButton]}
                        onPress={() => onStartExamWithExistingQuestions(unitQuestions)}
                      >
                        <Text style={styles.solveButtonText}>기존 문제 풀기</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.unitActionButton, styles.generateButton]}
                      onPress={() => onSelectUnitForGeneration(topic, unit)}
                    >
                      <Text style={styles.generateButtonText}>새 문제 만들기  ›</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {topicUnits.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>🌱</Text>
                <Text style={styles.emptyTitle}>등록된 단원이 없습니다</Text>
                <Text style={styles.emptyText}>우선 과목 전체 범위에서 핵심 문제를 만들 수 있어요.</Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => onSelectTopicOverviewForGeneration(topic)}
                >
                  <Text style={styles.emptyButtonText}>종합 문제 만들기</Text>
                </TouchableOpacity>
              </View>
            ) : null}
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
    maxWidth: 460,
    maxHeight: '90%',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
  list: {
    flexShrink: 1,
  },
  listContent: {
    padding: spacing.xl,
  },
  savedQuizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.mintSoft,
  },
  savedQuizMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D8EAE3',
    marginRight: spacing.sm,
  },
  savedQuizMarkText: {
    color: colors.mint,
    fontSize: 14,
    fontWeight: '900',
  },
  savedQuizCopy: {
    flex: 1,
  },
  savedQuizTitle: {
    color: colors.mint,
    fontSize: 12,
    fontWeight: '800',
  },
  savedQuizText: {
    color: colors.inkMuted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 2,
  },
  savedQuizArrow: {
    color: colors.mint,
    fontSize: 20,
    marginLeft: spacing.sm,
  },
  overviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#DED7ED',
    backgroundColor: colors.lavenderSoft,
  },
  overviewMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E4DDF0',
    marginRight: spacing.sm,
  },
  overviewMarkText: {
    color: colors.lavender,
    fontSize: 15,
    fontWeight: '900',
  },
  overviewCopy: {
    flex: 1,
  },
  overviewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  overviewBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  overviewBadgeText: {
    color: colors.lavender,
    fontSize: 9,
    fontWeight: '700',
  },
  overviewText: {
    color: colors.inkMuted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 2,
  },
  overviewArrow: {
    color: colors.lavender,
    fontSize: 20,
    marginLeft: spacing.sm,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  sectionCount: {
    color: colors.inkMuted,
    fontSize: 10,
  },
  unitCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  unitTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  unitIndex: {
    minWidth: 30,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    backgroundColor: colors.primarySoft,
    marginRight: spacing.sm,
  },
  unitIndexText: {
    color: colors.primaryPressed,
    fontSize: 10,
    fontWeight: '900',
  },
  unitCopy: {
    flex: 1,
  },
  unitTitle: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  unitMeta: {
    color: colors.inkMuted,
    fontSize: 10,
    marginTop: spacing.xs,
  },
  unitActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  unitActionButton: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  solveButton: {
    backgroundColor: colors.mintSoft,
    borderWidth: 1,
    borderColor: '#C9E1D9',
  },
  solveButtonText: {
    color: colors.mint,
    fontSize: 10.5,
    fontWeight: '800',
  },
  generateButton: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#DFC2CB',
  },
  generateButtonText: {
    color: colors.primaryPressed,
    fontSize: 10.5,
    fontWeight: '800',
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xxl,
    marginTop: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  emptyIcon: {
    fontSize: 26,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.inkMuted,
    fontSize: 10.5,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  emptyButton: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryPressed,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
});

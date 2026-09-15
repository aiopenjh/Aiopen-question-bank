import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { QuestionRevision, Topic } from '../../contracts/types';
import { colors, radius, shadows, spacing } from '../../styles/designTokens';
import { UniversalModal as Modal } from '../common/UniversalModal';

interface TopicSelectModalProps {
  visible: boolean;
  topics: Topic[];
  questions: QuestionRevision[];
  lastStudiedTopicId?: string | null;
  onSelectTopic: (topic: Topic) => void;
  onClose: () => void;
  onOpenLibrary?: () => void;
}

export const TopicSelectModal: React.FC<TopicSelectModalProps> = ({
  visible,
  topics,
  questions,
  lastStudiedTopicId,
  onSelectTopic,
  onClose,
  onOpenLibrary,
}) => {
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (visible) setShowAll(false);
  }, [visible]);

  const sortedTopics = useMemo(
    () =>
      [...topics].sort((left, right) => {
        if (left.id === lastStudiedTopicId) return -1;
        if (right.id === lastStudiedTopicId) return 1;
        return 0;
      }),
    [topics, lastStudiedTopicId]
  );
  const displayedTopics = showAll ? sortedTopics : sortedTopics.slice(0, 5);
  const remainingCount = Math.max(0, sortedTopics.length - 5);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation?.()}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>STUDY PICK</Text>
              <Text style={styles.title}>학습할 과목을 골라주세요</Text>
              <Text style={styles.subtitle}>저장된 문제로 바로 이어서 풀 수 있어요.</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="과목 선택 닫기"
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
            {displayedTopics.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🌱</Text>
                <Text style={styles.emptyTitle}>먼저 과목을 만들어 주세요</Text>
                <Text style={styles.emptyText}>자료함에서 과목과 목차를 준비하면 바로 학습할 수 있습니다.</Text>
              </View>
            ) : (
              displayedTopics.map((topic) => {
                const isRecent = topic.id === lastStudiedTopicId;
                const questionCount = questions.filter((item) => item.topicId === topic.id).length;
                return (
                  <TouchableOpacity
                    key={topic.id}
                    style={[styles.topicCard, isRecent && styles.topicCardRecent]}
                    onPress={() => onSelectTopic(topic)}
                    activeOpacity={0.82}
                  >
                    <View style={styles.topicTopRow}>
                      <Text style={styles.topicName} numberOfLines={1}>{topic.name}</Text>
                      {isRecent ? (
                        <View style={styles.recentBadge}>
                          <Text style={styles.recentBadgeText}>최근 학습</Text>
                        </View>
                      ) : null}
                    </View>
                    {topic.description ? (
                      <Text style={styles.topicDescription} numberOfLines={2}>{topic.description}</Text>
                    ) : null}
                    <View style={styles.topicMetaRow}>
                      <Text style={styles.questionCount}>보관 문제 {questionCount}문항</Text>
                      <Text style={[styles.selectText, isRecent && styles.selectTextRecent]}>
                        {isRecent ? '이어서 풀기' : '선택하기'}  ›
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}

            {sortedTopics.length > 5 ? (
              <TouchableOpacity style={styles.moreButton} onPress={() => setShowAll((value) => !value)}>
                <Text style={styles.moreButtonText}>
                  {showAll ? '접기' : `과목 ${remainingCount}개 더 보기`}
                </Text>
              </TouchableOpacity>
            ) : null}

            {onOpenLibrary ? (
              <TouchableOpacity style={styles.libraryButton} onPress={onOpenLibrary}>
                <Text style={styles.libraryButtonIcon}>⌂</Text>
                <View style={styles.libraryButtonCopy}>
                  <Text style={styles.libraryButtonTitle}>학습 자료함에서 직접 선택</Text>
                  <Text style={styles.libraryButtonText}>과목·목차와 보관 문제를 함께 확인합니다.</Text>
                </View>
                <Text style={styles.libraryButtonArrow}>›</Text>
              </TouchableOpacity>
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
    maxHeight: '88%',
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
  topicCard: {
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  topicCardRecent: {
    borderColor: '#DFC2CB',
    backgroundColor: '#FFFBFC',
  },
  topicTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topicName: {
    flex: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  recentBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginLeft: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  recentBadgeText: {
    color: colors.primaryPressed,
    fontSize: 9,
    fontWeight: '800',
  },
  topicDescription: {
    color: colors.inkMuted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  topicMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  questionCount: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  selectText: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  selectTextRecent: {
    color: colors.primaryPressed,
  },
  moreButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  moreButtonText: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  libraryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.lavenderSoft,
  },
  libraryButtonIcon: {
    color: colors.lavender,
    fontSize: 17,
    fontWeight: '800',
    marginRight: spacing.sm,
  },
  libraryButtonCopy: {
    flex: 1,
  },
  libraryButtonTitle: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '800',
  },
  libraryButtonText: {
    color: colors.inkMuted,
    fontSize: 9.5,
    marginTop: 2,
  },
  libraryButtonArrow: {
    color: colors.lavender,
    fontSize: 20,
    marginLeft: spacing.sm,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.inkMuted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});

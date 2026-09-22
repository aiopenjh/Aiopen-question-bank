import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Platform,
} from 'react-native';
import { RoutineRevision } from '../../contracts/types';
import { DailyInspirationCard } from './DailyInspirationCard';
import { RankingLeaderboardCard } from './RankingLeaderboardCard';
import { PullRefreshIndicator } from '../../components/common/PullRefreshIndicator';
import { StateIllustration } from '../../components/common/StateIllustration';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { colors, radius, shadows, spacing } from '../../styles/designTokens';
import { DAILY_GOAL_DEFAULT } from '../../domain/daily_goal';

export interface StudyMapScreenProps {
  // 통합 학습 현황 & 복습 연동
  routine?: RoutineRevision | null;
  todayAttemptsCount?: number;
  dueQuestionsCount?: number;
  onStartExam?: () => void;
  onStartDueReview?: () => void;
  onOpenCustomNotebook?: () => void;

  // 당겨서 새로고침 (Pull to Refresh)
  refreshing?: boolean;
  onRefresh?: () => Promise<void> | void;

  // 과목 추가 모달 연동 (난이도 조절 및 커리큘럼 설계)
  onOpenTopicModal?: (initialName?: string) => void;

  // 자유 주제 즉시 AI 출제 연동 (하위 호환)
  onQuickPromptGenerate?: (prompt: string) => Promise<void> | void;
  isAiGenerating?: boolean;

  // AI 응원 문구 연동
  apiKey?: string;
  topicName?: string;

  // 화면 전환 연동
  onOpenSettings?: () => void;
}

export const StudyMapScreen: React.FC<StudyMapScreenProps> = ({
  routine = null,
  todayAttemptsCount = 0,
  dueQuestionsCount = 0,
  onStartExam,
  onStartDueReview,
  onOpenCustomNotebook,
  refreshing = false,
  onRefresh,
  onOpenTopicModal,
  onQuickPromptGenerate,
  isAiGenerating = false,
  apiKey,
  topicName,
  onOpenSettings,
}) => {
  const [customPrompt, setCustomPrompt] = useState<string>('');

  const { pullDistance, handleScroll, touchHandlers } = usePullToRefresh({
    refreshing,
    onRefresh,
  });

  const targetCount = routine?.targetQuestionCount || DAILY_GOAL_DEFAULT;
  const progressPercent = Math.min(100, Math.round((todayAttemptsCount / targetCount) * 100));

  const handleAddTopic = () => {
    const p = customPrompt.trim();
    if (onOpenTopicModal) {
      onOpenTopicModal(p);
      setCustomPrompt('');
    } else if (onQuickPromptGenerate && p) {
      if (isAiGenerating) return;
      setCustomPrompt('');
      onQuickPromptGenerate(p);
    }
  };

  return (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={[styles.scrollPadding, { flexGrow: 1 }]}
      bounces={true}
      alwaysBounceVertical={true}
      overScrollMode="always"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      {...touchHandlers}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#f43f5e', '#be123c']}
            tintColor="#f43f5e"
            titleColor="#be123c"
            progressBackgroundColor="#ffffff"
            progressViewOffset={Platform.OS === 'android' ? 20 : 0}
          />
        ) : undefined
      }
    >
      {/* 화면 위로 당겨서 새로고침 인디케이터 (버튼 없는 자연스러운 제스처) */}
      <PullRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />

      {/* 오늘 해야 할 학습에 초점을 맞춘 홈 Hero */}
      <View style={styles.heroRoutineCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>TODAY'S STUDY</Text>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {topicName || '나만의 학습 루틴'}
            </Text>
            <View style={styles.heroStatusRow}>
              <View style={styles.routineStatusBadge}>
                <Text style={styles.routineStatusBadgeText}>
                  {progressPercent >= 100
                    ? '오늘 목표 완료'
                    : todayAttemptsCount > 0
                    ? '학습 진행 중'
                    : '학습 준비 완료'}
                </Text>
              </View>
            </View>
          </View>
          <StateIllustration kind="home" width={116} style={styles.heroIllustration} />
        </View>

        <View style={styles.metricRow}>
          <Text style={[styles.progressPercent, progressPercent >= 100 && styles.progressPercentComplete]}>
            {progressPercent}%
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={styles.metricCurrentNumber}>{todayAttemptsCount}</Text>
            <Text style={styles.metricTargetNumber}> / {targetCount}문항</Text>
          </View>
        </View>

        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>

        {onStartExam && (
          <TouchableOpacity
            style={styles.primaryActionButton}
            onPress={onStartExam}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryActionText}>
              {todayAttemptsCount > 0 ? '이어서 학습하기' : '오늘 학습 시작'}
            </Text>
            <Text style={styles.primaryActionArrow}>→</Text>
          </TouchableOpacity>
        )}

      </View>

      <RankingLeaderboardCard />

      {(onOpenTopicModal || onQuickPromptGenerate) && (
        <View style={styles.quickPromptCard}>
          <View style={styles.secondarySectionHeader}>
            <Text style={styles.quickPromptLabel}>
              새 과목 시작 <Text style={styles.secondarySectionHint}>(관심 분야를 새 학습 과정으로 만들어요)</Text>
            </Text>
          </View>

          <DailyInspirationCard embedded />

          <View style={styles.quickPromptInputRow}>
            <TextInput
              style={styles.quickPromptInput}
              placeholder="공부할 과목을 입력하세요"
              placeholderTextColor={colors.inkMuted}
              value={customPrompt}
              onChangeText={setCustomPrompt}
              returnKeyType="done"
              onSubmitEditing={handleAddTopic}
              onKeyPress={(e: any) => {
                if (e?.nativeEvent?.key === 'Enter' && !e?.nativeEvent?.shiftKey) {
                  e?.preventDefault?.();
                  handleAddTopic();
                }
              }}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[styles.quickPromptSubmitBtn, isAiGenerating && { opacity: 0.6 }]}
              disabled={isAiGenerating}
              onPress={handleAddTopic}
              activeOpacity={0.85}
            >
              {isAiGenerating ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.quickPromptSubmitText}>추가</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.quickActionRow}>
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={onStartDueReview}
          disabled={!onStartDueReview}
          activeOpacity={0.8}
        >
          <Text style={[styles.quickActionIcon, { color: colors.lavender }]}>◷</Text>
          <Text style={styles.quickActionTitle}>복습 예정</Text>
          <Text style={styles.quickActionValue}>{dueQuestionsCount}문항</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickActionCard, styles.notebookQuickActionCard]}
          onPress={onOpenCustomNotebook}
          disabled={!onOpenCustomNotebook}
          activeOpacity={0.8}
        >
          <StateIllustration
            kind="reviewComplete"
            width={48}
            style={styles.notebookQuickActionCharacter}
          />
          <Text style={styles.quickActionTitle}>나만의 오답노트</Text>
          <Text style={styles.quickActionValue}>열기</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  tabContent: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollPadding: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  heroRoutineCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 94,
    marginBottom: spacing.sm,
  },
  heroCopy: {
    flex: 1,
    zIndex: 1,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: colors.primary,
  },
  heroTitle: {
    marginTop: spacing.xs,
    color: colors.ink,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '800',
    ...(Platform.OS === 'web' ? ({ wordBreak: 'keep-all' } as any) : {}),
  },
  heroStatusRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  heroIllustration: {
    marginRight: -12,
    marginTop: -6,
  },
  routineStatusBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  routineStatusBadgeText: {
    color: colors.primaryPressed,
    fontSize: 11,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  metricCurrentNumber: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.ink,
  },
  metricTargetNumber: {
    fontSize: 14,
    color: colors.inkMuted,
    marginLeft: 4,
    fontWeight: '600',
  },
  progressPercent: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  progressPercentComplete: {
    color: colors.mint,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  primaryActionButton: {
    backgroundColor: colors.primaryPressed,
    borderRadius: radius.md,
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.action,
  },
  primaryActionArrow: {
    color: colors.white,
    fontSize: 19,
    fontWeight: '500',
  },
  extraPracticeBtn: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  extraPracticeBtnText: {
    color: colors.primaryPressed,
    fontSize: 14,
    fontWeight: '700',
  },
  primaryActionText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickActionCard: {
    flex: 1,
    minHeight: 108,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notebookQuickActionCard: {
    backgroundColor: colors.primarySoft,
    borderColor: '#DFC2CB',
    shadowColor: colors.primaryPressed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  notebookQuickActionCharacter: {
    marginTop: -7,
    marginBottom: -1,
  },
  quickActionIcon: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  quickActionTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  quickActionValue: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  quickPromptCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickPromptLabel: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '800',
    color: colors.ink,
  },
  secondarySectionHeader: {
    marginBottom: spacing.sm,
  },
  secondarySectionHint: {
    fontSize: 10.5,
    color: colors.inkMuted,
    fontWeight: '500',
  },
  quickPromptInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  quickPromptInput: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.ink,
    fontSize: 16,
  },
  quickPromptSubmitBtn: {
    backgroundColor: colors.primaryPressed,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPromptSubmitText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
});

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { RoutineRevision } from '../../contracts/types';
import { DailyInspirationCard } from './DailyInspirationCard';
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

  topicName?: string;
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
  topicName,
}) => {
  const { width: viewportWidth } = useWindowDimensions();
  const activeLedOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(activeLedOpacity, {
          toValue: 0.28,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(activeLedOpacity, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();
    return () => pulse.stop();
  }, [activeLedOpacity]);

  const { pullDistance, handleScroll, touchHandlers } = usePullToRefresh({
    refreshing,
    onRefresh,
  });

  const targetCount = routine?.targetQuestionCount || DAILY_GOAL_DEFAULT;
  const progressPercent = Math.min(100, Math.round((todayAttemptsCount / targetCount) * 100));
  const heroContentWidth = Math.max(
    280,
    Math.min(560, viewportWidth - spacing.lg * 2 - spacing.xl * 2),
  );
  const watermarkStageHeight = Math.max(230, Math.min(328, heroContentWidth * 0.76));
  const watermarkImageSize = watermarkStageHeight * 1.18;
  const watermarkLetterSize = Math.max(48, Math.min(64, heroContentWidth * 0.148));
  const watermarkLetterDrop = Math.max(30, Math.min(42, heroContentWidth * 0.097));
  const watermarkLettersTop =
    watermarkStageHeight / 2 - watermarkLetterSize / 2 - (7 * watermarkLetterDrop) / 2;

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
              <Animated.View style={[styles.activeLed, { opacity: activeLedOpacity }]} />
              <Text style={styles.activeCourseText}>진행 중인 과목</Text>
            </View>
          </View>
          <StateIllustration kind="home" width={116} style={styles.heroIllustration} />
        </View>

        <View
          style={[styles.heroWatermarkStage, { height: watermarkStageHeight }]}
          pointerEvents="box-none"
        >
          <Image
            source={require('../../../assets/android-icon-foreground-v2.png')}
            resizeMode="contain"
            style={[
              styles.heroWatermarkImage,
              { width: watermarkImageSize, height: watermarkImageSize },
            ]}
            accessible={false}
          />
          <View
            style={[styles.heroWatermarkLetters, { top: watermarkLettersTop }]}
            pointerEvents="none"
          >
            {Array.from('Celueste').map((letter, index) => (
              <Text
                key={`${letter}-${index}`}
                style={[
                  styles.heroWatermarkLetter,
                  {
                    fontSize: watermarkLetterSize,
                    transform: [{ translateY: index * watermarkLetterDrop }],
                  },
                ]}
              >
                {letter}
              </Text>
            ))}
          </View>

          {onOpenTopicModal && (
            <View style={styles.freeTopicSection}>
              <TouchableOpacity
                style={styles.freeTopicSearch}
                onPress={() => onOpenTopicModal('')}
                activeOpacity={0.78}
              >
                <Text style={styles.freeTopicSearchIcon}>⌕</Text>
                <Text style={styles.freeTopicSearchText}>배우고 싶은 주제를 자유롭게 입력하세요</Text>
              </TouchableOpacity>
              <Text style={styles.freeTopicExamples} numberOfLines={1}>
                예: 커피 로스팅 · 게임 세계관 · 바람 잘 피하기 · 불편하게 잠자기
              </Text>
            </View>
          )}
        </View>

        <View style={styles.heroProgressSection}>
          <View style={styles.metricRow}>
            <View style={styles.progressStatusGroup}>
              <Text style={[styles.progressPercent, progressPercent >= 100 && styles.progressPercentComplete]}>
                {progressPercent}%
              </Text>
              <Text style={styles.progressStatusText}>
                {progressPercent >= 100 ? '오늘 목표 완료' : '오늘 학습 진행률'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={styles.metricCurrentNumber}>{todayAttemptsCount}</Text>
              <Text style={styles.metricTargetNumber}> / {targetCount}문항</Text>
            </View>
          </View>

          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                progressPercent >= 100 && styles.progressBarFillComplete,
                { width: `${progressPercent}%` },
              ]}
            />
          </View>

          <View style={styles.heroInspiration}>
            <DailyInspirationCard />
          </View>
        </View>

        <View style={styles.heroActionSection}>
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

      </View>

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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.soft,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 100,
    marginBottom: 0,
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
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  heroIllustration: {
    marginRight: -12,
    marginTop: -6,
  },
  heroWatermarkStage: {
    position: 'relative',
    width: '100%',
    marginTop: -38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroWatermarkImage: {
    opacity: 0.045,
  },
  heroWatermarkLetters: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroWatermarkLetter: {
    color: '#172550',
    opacity: 0.065,
    fontWeight: '900',
  },
  freeTopicSection: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    alignItems: 'center',
  },
  freeTopicSearch: {
    position: 'absolute',
    top: '50%',
    width: '92%',
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    transform: [{ translateY: -20 }],
  },
  freeTopicSearchIcon: {
    marginRight: spacing.sm,
    color: colors.primaryPressed,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '400',
  },
  freeTopicSearchText: {
    flex: 1,
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'left',
    opacity: 0.4,
  },
  freeTopicExamples: {
    position: 'absolute',
    top: '50%',
    width: '92%',
    marginTop: 27,
    color: colors.inkMuted,
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'left',
  },
  activeLed: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.mint,
    marginRight: 6,
  },
  activeCourseText: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  progressStatusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressStatusText: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  heroProgressSection: {
    width: '100%',
    marginTop: 'auto',
  },
  heroActionSection: {
    width: '100%',
    marginTop: 0,
  },
  heroInspiration: {
    marginTop: spacing.sm,
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
    height: 9,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginBottom: 0,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  progressBarFillComplete: {
    backgroundColor: colors.mint,
  },
  primaryActionButton: {
    backgroundColor: colors.primaryPressed,
    borderRadius: radius.md,
    minHeight: 38,
    paddingVertical: 7,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.action,
  },
  primaryActionArrow: {
    color: colors.white,
    fontSize: 16,
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
    fontSize: 13,
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
});

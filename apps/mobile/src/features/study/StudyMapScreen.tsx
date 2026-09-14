import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { RoutineRevision } from '../../contracts/types';
import { ROUTINE_PRESETS, isStudyDay } from '../../domain/routine';

interface StudyMapScreenProps {
  // 통합 학습 현황 & 복습 연동
  routine?: RoutineRevision | null;
  todayAttemptsCount?: number;
  dueQuestionsCount?: number;
  incorrectQuestionsCount?: number;
  onStartExam?: () => void;
  onStartMoreQuestions?: () => void;
  onStartDueReview?: () => void;
  onStartIncorrectReview?: () => void;
  onGoToScaffolding?: () => void;

  // 자유 주제 즉시 AI 출제 연동
  onQuickPromptGenerate?: (prompt: string) => Promise<void> | void;
  isAiGenerating?: boolean;
}

export const StudyMapScreen: React.FC<StudyMapScreenProps> = ({
  routine = null,
  todayAttemptsCount = 0,
  dueQuestionsCount = 0,
  incorrectQuestionsCount = 0,
  onStartExam,
  onStartMoreQuestions,
  onStartDueReview,
  onStartIncorrectReview,
  onGoToScaffolding,
  onQuickPromptGenerate,
  isAiGenerating = false,
}) => {
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const targetCount = routine?.targetQuestionCount || 3;
  const progressPercent = Math.min(100, Math.round((todayAttemptsCount / targetCount) * 100));

  const handleSendPrompt = () => {
    if (!customPrompt.trim() || isAiGenerating || !onQuickPromptGenerate) return;
    const p = customPrompt.trim();
    setCustomPrompt('');
    onQuickPromptGenerate(p);
  };

  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding}>
      {/* 1. 큼직하고 시원한 오늘의 학습 현황 카드 (Hero Card) */}
      <View style={styles.heroRoutineCard}>
        <View style={styles.routineHeaderRow}>
          <View>
            <Text style={styles.cardSectionTitle}>📊 오늘의 학습 현황</Text>
            <Text style={styles.routinePresetText}>
              {routine ? ROUTINE_PRESETS[routine.preset]?.label : '격일 학습'} · 목표 {targetCount}문항
            </Text>
          </View>
          <View style={styles.routineStatusBadge}>
            <Text style={styles.routineStatusBadgeText}>
              {routine && isStudyDay(routine) ? '🔔 오늘 학습일' : '☕ 오늘은 휴식일'}
            </Text>
          </View>
        </View>

        {/* 대형 문항 달성 지표 & 목표 완료 뱃지 */}
        <View style={styles.metricRow}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={styles.metricCurrentNumber}>{todayAttemptsCount}</Text>
            <Text style={styles.metricTargetNumber}> / {targetCount} 문항 완료</Text>
          </View>
          <View style={[styles.percentBadge, progressPercent >= 100 && styles.percentBadgeCompleted]}>
            <Text style={[styles.percentBadgeText, progressPercent >= 100 && styles.percentBadgeTextCompleted]}>
              {progressPercent >= 100 ? '🎉 목표 완료' : `${progressPercent}% 달성`}
            </Text>
          </View>
        </View>

        {/* 굵고 시원한 프로그레스 바 */}
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>

        {/* 메인 학습목표 문제 풀기 버튼 */}
        {onStartExam && (
          <TouchableOpacity
            style={styles.primaryActionButton}
            onPress={onStartExam}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryActionText}>
              🚀 오늘의 학습목표 문제 풀기
            </Text>
          </TouchableOpacity>
        )}

        {/* 목표 달성 후 추가 연습을 원하는 경우의 추가 버튼 (동일 개념 범위 신규 출제) */}
        {progressPercent >= 100 && (onStartMoreQuestions || onStartExam) && (
          <TouchableOpacity
            style={styles.extraPracticeBtn}
            onPress={onStartMoreQuestions || onStartExam}
            activeOpacity={0.85}
          >
            <Text style={styles.extraPracticeBtnText}>
              ⚡ 문제 더 풀어보기 (같은 범위 새 문제 출제)
            </Text>
          </TouchableOpacity>
        )}

        {/* 오답 개념 집중 보충 학습 */}
        {incorrectQuestionsCount > 0 && onGoToScaffolding && (
          <TouchableOpacity
            style={styles.scaffoldingBtn}
            onPress={onGoToScaffolding}
            activeOpacity={0.85}
          >
            <Text style={styles.scaffoldingBtnText}>
              💡 오답 개념 집중 보충 학습 ({incorrectQuestionsCount}개 분석) ➔
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. 즉시 AI 문제 출제 바 (자유 주제) */}
      {onQuickPromptGenerate && (
        <View style={styles.quickPromptCard}>
          <Text style={styles.quickPromptLabel}>✨ 원하는 개념 즉시 출제</Text>
          <Text style={styles.quickPromptGuide}>
            공부하고 싶은 개념이나 키워드를 입력하면 AI가 맞춤형 CBT 문제를 즉시 출제합니다.
          </Text>
          <View style={styles.quickPromptInputRow}>
            <TextInput
              style={styles.quickPromptInput}
              placeholder="예: Git cherry-pick 원리, 미적분 기초, 회계원리..."
              placeholderTextColor="#64748b"
              value={customPrompt}
              onChangeText={setCustomPrompt}
              returnKeyType="send"
              onSubmitEditing={handleSendPrompt}
              onKeyPress={(e: any) => {
                if (e?.nativeEvent?.key === 'Enter' && !e?.nativeEvent?.shiftKey) {
                  e?.preventDefault?.();
                  handleSendPrompt();
                }
              }}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[styles.quickPromptSubmitBtn, isAiGenerating && { opacity: 0.6 }]}
              disabled={isAiGenerating}
              onPress={handleSendPrompt}
              activeOpacity={0.85}
            >
              {isAiGenerating ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.quickPromptSubmitText}>⚡ 출제</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  tabContent: {
    flex: 1,
  },
  scrollPadding: {
    padding: 18,
    paddingBottom: 40,
  },
  heroRoutineCard: {
    backgroundColor: '#1e293b',
    borderRadius: 18,
    padding: 22,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#4338ca',
  },
  routineHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  routinePresetText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 3,
  },
  routineStatusBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  routineStatusBadgeText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricCurrentNumber: {
    fontSize: 38,
    fontWeight: '900',
    color: '#ffffff',
  },
  metricTargetNumber: {
    fontSize: 15,
    color: '#94a3b8',
    marginLeft: 4,
    fontWeight: '600',
  },
  percentBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  percentBadgeCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
  },
  percentBadgeText: {
    color: '#a5b4fc',
    fontSize: 13,
    fontWeight: 'bold',
  },
  percentBadgeTextCompleted: {
    color: '#6ee7b7',
  },
  progressBarBackground: {
    height: 12,
    backgroundColor: '#0f172a',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 6,
  },
  primaryActionButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  extraPracticeBtn: {
    backgroundColor: '#1e1b4b',
    borderColor: '#818cf8',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  extraPracticeBtnText: {
    color: '#c7d2fe',
    fontSize: 14,
    fontWeight: 'bold',
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  scaffoldingBtn: {
    backgroundColor: '#311042',
    borderColor: '#a855f7',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  scaffoldingBtnText: {
    color: '#f3e8ff',
    fontSize: 13,
    fontWeight: '600',
  },
  quickPromptCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickPromptLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#c7d2fe',
    marginBottom: 4,
  },
  quickPromptGuide: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 12,
    lineHeight: 17,
  },
  quickPromptInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  quickPromptInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#ffffff',
    fontSize: 14,
  },
  quickPromptSubmitBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPromptSubmitText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

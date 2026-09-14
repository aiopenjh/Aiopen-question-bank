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
  onStartDueReview?: () => void;
  onStartIncorrectReview?: () => void;
  onGoToScaffolding?: () => void;

  // 자유 주제 즉시 AI 출제 연동
  onQuickPromptGenerate?: (prompt: string) => Promise<void> | void;
  isAiGenerating?: boolean;

  // 자료함 바로가기
  onOpenLibrary?: () => void;
  topicCount?: number;
  questionCount?: number;
}

export const StudyMapScreen: React.FC<StudyMapScreenProps> = ({
  routine = null,
  todayAttemptsCount = 0,
  dueQuestionsCount = 0,
  incorrectQuestionsCount = 0,
  onStartExam,
  onStartDueReview,
  onStartIncorrectReview,
  onGoToScaffolding,
  onQuickPromptGenerate,
  isAiGenerating = false,
  onOpenLibrary,
  topicCount = 0,
  questionCount = 0,
}) => {
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const targetCount = routine?.targetQuestionCount || 3;

  const handleSendPrompt = () => {
    if (!customPrompt.trim() || isAiGenerating || !onQuickPromptGenerate) return;
    const p = customPrompt.trim();
    setCustomPrompt('');
    onQuickPromptGenerate(p);
  };

  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding}>
      {/* 1. 오늘의 학습 현황 & 빠른 풀기/복습 카드 */}
      <View style={styles.routineCard}>
        <View style={styles.routineInfoRow}>
          <Text style={styles.cardSectionTitle}>📊 오늘의 학습 현황</Text>
          <Text style={styles.routineStatusBadge}>
            {routine && isStudyDay(routine) ? '🔔 오늘 학습일' : '☕ 오늘은 휴식일'}
          </Text>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>
              목표 달성 ({routine ? ROUTINE_PRESETS[routine.preset]?.label : '격일 학습'})
            </Text>
            <Text style={styles.progressValue}>
              {todayAttemptsCount} / {targetCount} 문항
            </Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min(100, (todayAttemptsCount / targetCount) * 100)}%` },
              ]}
            />
          </View>
        </View>

        {onStartExam && (
          <TouchableOpacity style={styles.primaryActionButton} onPress={onStartExam}>
            <Text style={styles.primaryActionText}>
              🚀 오늘의 실전 문제 풀기 (CBT)
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.reviewBtnRow}>
          {onStartDueReview && (
            <TouchableOpacity
              style={[styles.subActionBtn, { backgroundColor: '#312e81' }]}
              onPress={onStartDueReview}
            >
              <Text style={styles.subActionBtnText}>
                🔔 복습 문제 ({dueQuestionsCount})
              </Text>
            </TouchableOpacity>
          )}

          {onStartIncorrectReview && (
            <TouchableOpacity
              style={[styles.subActionBtn, { backgroundColor: '#450a0a' }]}
              onPress={onStartIncorrectReview}
            >
              <Text style={[styles.subActionBtnText, { color: '#fca5a5' }]}>
                📕 오답노트 ({incorrectQuestionsCount})
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {incorrectQuestionsCount > 0 && onGoToScaffolding && (
          <TouchableOpacity
            style={styles.scaffoldingBtn}
            onPress={onGoToScaffolding}
          >
            <Text style={styles.scaffoldingBtnText}>
              💡 오답 개념 보충 학습 ({incorrectQuestionsCount}) ➔
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. 즉시 AI 문제 출제 바 (자유 주제) */}
      {onQuickPromptGenerate && (
        <View style={styles.quickPromptCard}>
          <Text style={styles.quickPromptLabel}>✨ 원하는 개념 즉시 출제</Text>
          <Text style={styles.quickPromptGuide}>
            공부하고 싶은 개념을 입력하면 AI가 맞춤형 CBT 3문항을 즉시 출제합니다.
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

      {/* 3. 자료함(과목 & 단원 커리큘럼 & 문제 보관함) 바로가기 배너 */}
      {onOpenLibrary && (
        <TouchableOpacity style={styles.libraryShortcutCard} onPress={onOpenLibrary} activeOpacity={0.8}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Text style={{ fontSize: 18 }}>📚</Text>
              <Text style={styles.libraryShortcutTitle}>학습 과목 & 문제 보관함</Text>
            </View>
            <Text style={styles.libraryShortcutDesc}>
              등록된 과목 {topicCount}개 · 총 {questionCount}문항이 과목별로 정리되어 있습니다.
            </Text>
          </View>
          <View style={styles.libraryShortcutBadge}>
            <Text style={styles.libraryShortcutBadgeText}>자료실 열기 ➔</Text>
          </View>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  tabContent: {
    flex: 1,
  },
  scrollPadding: {
    padding: 16,
    paddingBottom: 30,
  },
  routineCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  routineInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  routineStatusBadge: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressContainer: {
    marginBottom: 14,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  progressValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 4,
  },
  primaryActionButton: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  reviewBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  subActionBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subActionBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  scaffoldingBtn: {
    backgroundColor: '#311042',
    borderColor: '#a855f7',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  scaffoldingBtnText: {
    color: '#f3e8ff',
    fontSize: 12,
    fontWeight: '600',
  },
  quickPromptCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  quickPromptLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#c7d2fe',
    marginBottom: 4,
  },
  quickPromptGuide: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 10,
    lineHeight: 16,
  },
  quickPromptInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  quickPromptInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#ffffff',
    fontSize: 13,
  },
  quickPromptSubmitBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPromptSubmitText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  libraryShortcutCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  libraryShortcutTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  libraryShortcutDesc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
  },
  libraryShortcutBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: '#6366f1',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  libraryShortcutBadgeText: {
    color: '#a5b4fc',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

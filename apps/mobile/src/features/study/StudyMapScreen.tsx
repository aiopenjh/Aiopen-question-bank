import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { Topic, Unit, ManualCompletion, RoutineRevision } from '../../contracts/types';
import { ROUTINE_PRESETS, isStudyDay, MentorMessage } from '../../domain/routine';
import { showAlert } from '../../utils/alert';

interface StudyMapScreenProps {
  topics: Topic[];
  selectedTopicId: string | null;
  units: Unit[];
  completions: ManualCompletion[];
  onSelectTopic: (id: string) => void;
  onOpenTopicModal: () => void;
  onOpenUnitModal: () => void;
  onDeleteTopic: (id: string, name: string) => void;
  onToggleUnitCompletion: (unitId: string) => Promise<void>;
  onDeleteUnit: (unitId: string) => Promise<void>;
  onGenerateCurriculumForTopic: (topicId: string, topicName: string) => Promise<void>;
  onQuickGenerateForUnit: (topicId: string, topicName: string, unitId: string, unitTitle: string) => void | Promise<void>;
  onDeduplicateUnits?: (topicId: string) => Promise<void>;
  isAiGenerating?: boolean;
  generatingUnitId?: string | null;
  onOpenLibrary?: () => void;

  // 통합 학습 루틴 & 복습 연동
  routine?: RoutineRevision | null;
  todayAttemptsCount?: number;
  dueQuestionsCount?: number;
  incorrectQuestionsCount?: number;
  mentorMessage?: MentorMessage | null;
  onStartExam?: () => void;
  onStartDueReview?: () => void;
  onStartIncorrectReview?: () => void;
  onGoToScaffolding?: () => void;

  // 자유 주제 즉시 AI 출제 연동
  onQuickPromptGenerate?: (prompt: string) => Promise<void> | void;
}

export const StudyMapScreen: React.FC<StudyMapScreenProps> = ({
  topics,
  selectedTopicId,
  units,
  completions,
  onSelectTopic,
  onOpenTopicModal,
  onOpenUnitModal,
  onDeleteTopic,
  onToggleUnitCompletion,
  onDeleteUnit,
  onGenerateCurriculumForTopic,
  onQuickGenerateForUnit,
  onDeduplicateUnits,
  isAiGenerating = false,
  generatingUnitId = null,
  onOpenLibrary,

  routine = null,
  todayAttemptsCount = 0,
  dueQuestionsCount = 0,
  incorrectQuestionsCount = 0,
  mentorMessage = null,
  onStartExam,
  onStartDueReview,
  onStartIncorrectReview,
  onGoToScaffolding,
  onQuickPromptGenerate,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [customPrompt, setCustomPrompt] = useState<string>('');

  const targetCount = routine?.targetQuestionCount || 3;

  const handleUnitPress = (unit: Unit, isCompleted: boolean) => {
    if (!currentTopic) return;
    if (isCompleted) {
      showAlert(
        '단원 학습 완료 안내',
        `[${unit.title}] 단원은 이미 완료(학습)된 상태입니다.\n오답노트 및 복습창으로 이동하시겠습니까, 아니면 새로운 문제를 다시 출제하여 푸시겠습니까?`,
        [
          {
            text: '취소',
            style: 'cancel',
          },
          {
            text: '📖 복습창으로 이동',
            onPress: () => {
              if (onOpenLibrary) {
                onOpenLibrary();
              } else if (onStartDueReview) {
                onStartDueReview();
              }
            },
          },
          {
            text: '⚡ 새 문제 풀기',
            onPress: () => {
              onQuickGenerateForUnit(currentTopic.id, currentTopic.name, unit.id, unit.title);
            },
          },
        ]
      );
    } else {
      // 미완료 단원: 이름 클릭 시 즉시 문제 출제(문항 수 선택 모달) 실행
      onQuickGenerateForUnit(currentTopic.id, currentTopic.name, unit.id, unit.title);
    }
  };

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    topics.forEach((t) => {
      if (t.category) set.add(t.category);
      else set.add('📚 일반');
    });
    return ['전체', ...Array.from(set)];
  }, [topics]);

  const filteredTopics = React.useMemo(() => {
    if (selectedCategory === '전체') return topics;
    return topics.filter((t) => (t.category || '📚 일반') === selectedCategory);
  }, [topics, selectedCategory]);

  const currentTopic = topics.find((t) => t.id === selectedTopicId);
  const topicUnits = units.filter((u) => u.topicId === selectedTopicId);
  const hasDuplicates = new Set(topicUnits.map((u) => u.title.trim())).size < topicUnits.length;

  // 선택된 토픽의 대단위(카테고리)가 현재 카테고리 필터와 다를 경우 자동 전환하여 항상 노출되도록 보장
  React.useEffect(() => {
    if (currentTopic && selectedCategory !== '전체') {
      const topicCat = currentTopic.category || '📚 일반';
      if (selectedCategory !== topicCat) {
        setSelectedCategory(topicCat);
      }
    }
  }, [selectedTopicId, currentTopic?.category]);

  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding}>
      {/* 1. 멘토 피드백 카드 */}
      {mentorMessage && (
        <View style={styles.mentorCard}>
          <View style={styles.mentorHeader}>
            <Text style={styles.mentorBadge}>{mentorMessage.badge}</Text>
            <Text style={styles.mentorRole}>나의 학습 메이트</Text>
          </View>
          <Text style={styles.mentorTitle}>{mentorMessage.title}</Text>
          <Text style={styles.mentorText}>{mentorMessage.message}</Text>
        </View>
      )}

      {/* 2. 오늘의 마이크로 러닝 루틴 & 빠른 풀기/복습 카드 */}
      <View style={styles.routineCard}>
        <View style={styles.routineInfoRow}>
          <Text style={styles.cardSectionTitle}>📅 오늘의 마이크로 러닝 루틴</Text>
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
              🚀 {currentTopic ? `[${currentTopic.name}] 실전 문제 풀기` : '오늘의 실전 문제 풀기 (CBT)'}
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
                🔔 망각곡선 복습 ({dueQuestionsCount})
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
              💡 최근 오답 개념 기초 다지기 ({incorrectQuestionsCount}개 분석) ➔
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 3. 즉시 AI 문제 출제 바 (자유 주제) */}
      {onQuickPromptGenerate && (
        <View style={styles.quickPromptCard}>
          <Text style={styles.quickPromptLabel}>✨ 원하는 개념 즉시 출제</Text>
          <View style={styles.quickPromptInputRow}>
            <TextInput
              style={styles.quickPromptInput}
              placeholder="예: Git cherry-pick 원리, 피타고라스 정리..."
              placeholderTextColor="#64748b"
              value={customPrompt}
              onChangeText={setCustomPrompt}
              returnKeyType="send"
              onSubmitEditing={() => {
                if (!customPrompt.trim() || isAiGenerating) return;
                const p = customPrompt.trim();
                setCustomPrompt('');
                onQuickPromptGenerate(p);
              }}
              onKeyPress={(e: any) => {
                if (e?.nativeEvent?.key === 'Enter' && !e?.nativeEvent?.shiftKey) {
                  e?.preventDefault?.();
                  if (!customPrompt.trim() || isAiGenerating) return;
                  const p = customPrompt.trim();
                  setCustomPrompt('');
                  onQuickPromptGenerate(p);
                }
              }}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[styles.quickPromptSubmitBtn, isAiGenerating && { opacity: 0.6 }]}
              disabled={isAiGenerating}
              onPress={() => {
                if (!customPrompt.trim() || isAiGenerating) return;
                const p = customPrompt.trim();
                setCustomPrompt('');
                onQuickPromptGenerate(p);
              }}
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

      {/* 4. 과목 / 커리큘럼 헤더 */}
      <View style={styles.studyHeaderCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.studyHeaderTitle}>🌳 대단위 커리큘럼 & 문제 출제</Text>
          <TouchableOpacity style={styles.headerActionBtn} onPress={onOpenTopicModal}>
            <Text style={styles.headerActionBtnText}>+ 새 주제</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.studyHeaderSubtitle}>
          대단위(IT, 수학, 언어 등) 과목을 선택하면 단원별로 3/5/10문항 즉시 출제 및 CBT 시험이 진행됩니다.
        </Text>
      </View>

      {topics.length === 0 ? (
        <View style={styles.emptyTopicCard}>
          <Text style={{ fontSize: 30, marginBottom: 8 }}>📚</Text>
          <Text style={styles.emptyTopicText}>등록된 학습 주제가 없습니다.</Text>
          <TouchableOpacity style={styles.primaryActionButton} onPress={onOpenTopicModal}>
            <Text style={styles.primaryActionText}>✨ AI 맞춤 학습 주제 만들기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* 대분류(카테고리) 탭 필터 바 */}
          {categories.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {categories.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryFilterChip,
                      isActive && styles.categoryFilterChipActive,
                    ]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text style={[styles.categoryFilterText, isActive && styles.categoryFilterTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* 주제 선택 탭 바 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topicPillsScroll}>
            {filteredTopics.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.topicPill, selectedTopicId === t.id && styles.topicPillActive]}
                onPress={() => onSelectTopic(t.id)}
              >
                <Text style={[styles.topicPillText, selectedTopicId === t.id && styles.topicPillTextActive]}>
                  {t.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {currentTopic && (
            <View style={styles.topicSectionCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Text style={styles.categoryBadge}>{currentTopic.category || '📚 일반'}</Text>
                    <Text style={styles.topicTitle}>{currentTopic.name}</Text>
                  </View>
                  <Text style={styles.topicDesc}>{currentTopic.description || 'AI 맞춤 학습 커리큘럼'}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => onDeleteTopic(currentTopic.id, currentTopic.name)}
                  style={styles.deleteTopicBtn}
                >
                  <Text style={styles.deleteTopicText}>삭제</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 10 }}>
                <Text style={styles.unitListHeading}>목차 리스트 ({topicUnits.length}개)</Text>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  {hasDuplicates && onDeduplicateUnits && (
                    <TouchableOpacity
                      style={styles.cleanupBtn}
                      onPress={() => onDeduplicateUnits(currentTopic.id)}
                    >
                      <Text style={styles.cleanupBtnText}>🧹 중복 정리</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.aiAddUnitBtn}
                    onPress={() => onGenerateCurriculumForTopic(currentTopic.id, currentTopic.name)}
                    disabled={isAiGenerating}
                  >
                    <Text style={styles.aiAddUnitBtnText}>✨ AI 목차 자동 생성</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={onOpenUnitModal}>
                    <Text style={styles.addUnitText}>+ 직접 추가</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {topicUnits.length === 0 ? (
                <View style={styles.emptyUnitCard}>
                  <Text style={{ fontSize: 28, marginBottom: 6 }}>⚡</Text>
                  <Text style={styles.emptyUnitText}>아직 등록된 단원이 없습니다.</Text>
                  <Text style={styles.emptyUnitSubText}>
                    일일이 입력하실 필요 없습니다! 아래 버튼을 누르면 AI가 [{currentTopic.name}] 주제의 5단계 목차를 즉시 자동 설계합니다.
                  </Text>
                  <TouchableOpacity
                    style={styles.aiGenerateCurriculumBtn}
                    onPress={() => onGenerateCurriculumForTopic(currentTopic.id, currentTopic.name)}
                    disabled={isAiGenerating}
                  >
                    {isAiGenerating ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ActivityIndicator color="#ffffff" size="small" />
                        <Text style={styles.aiGenerateCurriculumBtnText}>AI 커리큘럼 설계 중...</Text>
                      </View>
                    ) : (
                      <Text style={styles.aiGenerateCurriculumBtnText}>✨ AI 커리큘럼(단원) 자동 완성</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                topicUnits.map((u) => {
                  const isCompleted = completions.some((c) => c.unitId === u.id && c.completed);
                  const isThisUnitGenerating = generatingUnitId === u.id;
                  return (
                    <View key={u.id} style={styles.unitRow}>
                      <View style={styles.unitMainCol}>
                        <TouchableOpacity
                          style={styles.unitCheckTouch}
                          onPress={() => onToggleUnitCompletion(u.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.checkIcon}>{isCompleted ? '✅' : '⬜'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.unitTitleTouch}
                          onPress={() => handleUnitPress(u, isCompleted)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[styles.microUnitText, isCompleted && styles.microUnitTextCompleted]}
                            numberOfLines={2}
                          >
                            {u.title}
                          </Text>
                          {isCompleted && (
                            <Text style={styles.unitCompletedBadge}>완료됨 · 클릭 시 복습 / 재출제</Text>
                          )}
                        </TouchableOpacity>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          style={styles.unitQuickQuizBtn}
                          onPress={() => onQuickGenerateForUnit(currentTopic.id, currentTopic.name, u.id, u.title)}
                          disabled={isAiGenerating}
                        >
                          {isThisUnitGenerating ? (
                            <ActivityIndicator color="#ffffff" size="small" />
                          ) : (
                            <Text style={styles.unitQuickQuizBtnText}>⚡ 문제 풀기</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onDeleteUnit(u.id)}>
                          <Text style={styles.unitDeleteText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </>
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
  studyHeaderCard: {
    marginBottom: 14,
  },
  studyHeaderTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  studyHeaderSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  headerActionBtn: {
    backgroundColor: '#4338ca',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  headerActionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyTopicCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
  },
  emptyTopicText: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 12,
  },
  primaryActionButton: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  topicPillsScroll: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  topicPill: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  topicPillActive: {
    backgroundColor: '#4338ca',
    borderColor: '#6366f1',
  },
  topicPillText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  topicPillTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  topicSectionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  topicTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  topicDesc: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 3,
  },
  deleteTopicBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteTopicText: {
    color: '#ef4444',
    fontSize: 12,
  },
  unitListHeading: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#cbd5e1',
  },
  addUnitText: {
    fontSize: 13,
    color: '#818cf8',
    fontWeight: 'bold',
  },
  unitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  unitMainCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  unitCheckTouch: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  unitTitleTouch: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  checkIcon: {
    fontSize: 16,
  },
  microUnitText: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '500',
  },
  microUnitTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#64748b',
  },
  unitCompletedBadge: {
    fontSize: 10,
    color: '#38bdf8',
    marginTop: 2,
    fontWeight: '600',
  },
  unitDeleteText: {
    color: '#64748b',
    fontSize: 14,
    paddingHorizontal: 6,
  },
  cleanupBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  cleanupBtnText: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: 'bold',
  },
  aiAddUnitBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  aiAddUnitBtnText: {
    color: '#a5b4fc',
    fontSize: 11,
    fontWeight: 'bold',
  },
  unitQuickQuizBtn: {
    backgroundColor: '#0f766e',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
  unitQuickQuizBtnText: {
    color: '#ccfbf1',
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyUnitCard: {
    paddingVertical: 20,
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 16,
    marginTop: 6,
  },
  emptyUnitText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyUnitSubText: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    marginBottom: 14,
  },
  aiGenerateCurriculumBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  aiGenerateCurriculumBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  categoryFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 6,
  },
  categoryFilterChipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: '#6366f1',
  },
  categoryFilterText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  categoryFilterTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  categoryBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  mentorCard: {
    backgroundColor: '#1e1b4b',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#4338ca',
  },
  mentorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  mentorBadge: {
    fontSize: 14,
    marginRight: 6,
  },
  mentorRole: {
    fontSize: 11,
    color: '#a5b4fc',
    fontWeight: 'bold',
  },
  mentorTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e0e7ff',
    marginBottom: 3,
  },
  mentorText: {
    fontSize: 12,
    color: '#c7d2fe',
    lineHeight: 17,
  },
  routineCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  routineInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  routineStatusBadge: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressContainer: {
    marginBottom: 12,
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
    height: 7,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 4,
  },
  reviewBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
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
    marginTop: 8,
  },
  scaffoldingBtnText: {
    color: '#f3e8ff',
    fontSize: 12,
    fontWeight: '600',
  },
  quickPromptCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 13,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  quickPromptLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#c7d2fe',
    marginBottom: 8,
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
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 13,
  },
  quickPromptSubmitBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPromptSubmitText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});

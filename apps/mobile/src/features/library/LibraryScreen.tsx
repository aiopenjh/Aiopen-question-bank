import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Source, QuestionRevision, Topic, Unit, ManualCompletion } from '../../contracts/types';
import { showAlert } from '../../utils/alert';

export interface LibraryScreenProps {
  questions: QuestionRevision[];
  topics: Topic[];
  units: Unit[];
  completions: ManualCompletion[];
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
  onStartExamWithQuestions: (questions: QuestionRevision[]) => void;
  onDeleteQuestion?: (questionId: string) => Promise<void>;

  // Source / Text notes
  sources: Source[];
  sourceTitle: string;
  onChangeSourceTitle: (text: string) => void;
  sourceText: string;
  onChangeSourceText: (text: string) => void;
  onSaveSource: () => Promise<void>;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  questions,
  topics,
  units,
  completions,
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
  onStartExamWithQuestions,
  onDeleteQuestion,

  sources,
  sourceTitle,
  onChangeSourceTitle,
  sourceText,
  onChangeSourceText,
  onSaveSource,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);
  const [expandedUnitQuestionId, setExpandedUnitQuestionId] = useState<string | null>(null);
  const [expandedQuestionDetailId, setExpandedQuestionDetailId] = useState<string | null>(null);
  const [isOtherQuestionsExpanded, setIsOtherQuestionsExpanded] = useState(false);

  // 카테고리 목록
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    topics.forEach((t) => {
      if (t.category) set.add(t.category);
      else set.add('📚 일반');
    });
    return ['전체', ...Array.from(set)];
  }, [topics]);

  // 필터링된 토픽
  const filteredTopics = React.useMemo(() => {
    if (selectedCategory === '전체') return topics;
    return topics.filter((t) => (t.category || '📚 일반') === selectedCategory);
  }, [topics, selectedCategory]);

  // 등록된 토픽 ID 세트
  const topicIdSet = React.useMemo(() => new Set(topics.map((t) => t.id)), [topics]);

  // 자유 출제 및 기타 문제 (등록된 과목에 속하지 않는 문제들)
  const unassignedQuestions = React.useMemo(() => {
    return questions.filter((q) => !q.topicId || !topicIdSet.has(q.topicId));
  }, [questions, topicIdSet]);

  const handleUnitPress = (topic: Topic, unit: Unit, isCompleted: boolean) => {
    if (isCompleted) {
      showAlert(
        '단원 학습 완료 안내',
        `[${unit.title}] 단원은 이미 완료(학습)된 상태입니다.\n이 단원의 문제들을 다시 풀며 복습하시겠습니까, 아니면 새 문제를 출제하시겠습니까?`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '📖 이 단원 문제 풀기',
            onPress: () => {
              const unitQs = questions.filter(
                (q) => q.topicId === topic.id && (q.unitId === unit.id || q.stem.includes(unit.title))
              );
              if (unitQs.length > 0) {
                onStartExamWithQuestions(unitQs);
              } else {
                onQuickGenerateForUnit(topic.id, topic.name, unit.id, unit.title);
              }
            },
          },
          {
            text: '⚡ 새 문제 출제',
            onPress: () => {
              onQuickGenerateForUnit(topic.id, topic.name, unit.id, unit.title);
            },
          },
        ]
      );
    } else {
      onQuickGenerateForUnit(topic.id, topic.name, unit.id, unit.title);
    }
  };

  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding}>
      {/* 1. 상단 통계 및 과목 생성 헤더 */}
      <View style={styles.headerCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.headerTitle}>📁 내 학습 과목 & 문제 보관함</Text>
            <Text style={styles.headerSubtitle}>
              등록된 과목 {topics.length}개 · 총 {questions.length}문항 보관 중
            </Text>
          </View>
          <TouchableOpacity style={styles.newTopicBtn} onPress={onOpenTopicModal}>
            <Text style={styles.newTopicBtnText}>+ 새 과목</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. 대분류 카테고리 필터 칩 바 */}
      {categories.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* 3. 과목별 문제집 집 (폴더 카드 리스트) */}
      {filteredTopics.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>📚</Text>
          <Text style={styles.emptyTitle}>등록된 과목이 없습니다.</Text>
          <Text style={styles.emptyDesc}>
            [+ 새 과목]을 눌러 공부하고 싶은 주제를 추가하면 체계적인 5단계 목차와 문제집이 자동 구성됩니다.
          </Text>
          <TouchableOpacity style={styles.primaryActionButton} onPress={onOpenTopicModal}>
            <Text style={styles.primaryActionText}>✨ 새 과목 등록하기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        filteredTopics.map((topic) => {
          const topicUnits = units.filter((u) => u.topicId === topic.id);
          const topicQuestions = questions.filter((q) => q.topicId === topic.id);
          const isExpanded = expandedTopicId === topic.id;
          const hasDuplicates = new Set(topicUnits.map((u) => u.title.trim())).size < topicUnits.length;

          return (
            <View key={topic.id} style={styles.topicHouseCard}>
              {/* 토픽 헤더 */}
              <View style={styles.topicHouseHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Text style={styles.categoryBadge}>{topic.category || '📚 일반'}</Text>
                    <Text style={styles.topicHouseTitle}>{topic.name}</Text>
                  </View>
                  <Text style={styles.topicHouseSub}>
                    단원 {topicUnits.length}개 · 보관된 문제 {topicQuestions.length}문항
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.toggleAccordionBtn, isExpanded && styles.toggleAccordionBtnActive]}
                  onPress={() => setExpandedTopicId(isExpanded ? null : topic.id)}
                >
                  <Text style={styles.toggleAccordionText}>
                    {isExpanded ? '접기 ▲' : '열기 ▼'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 과목 전체 즉시 CBT 버튼 */}
              {topicQuestions.length > 0 && (
                <TouchableOpacity
                  style={styles.topicExamBtn}
                  onPress={() => onStartExamWithQuestions(topicQuestions)}
                >
                  <Text style={styles.topicExamBtnText}>
                    🚀 [{topic.name}] 전체 {topicQuestions.length}문제 CBT 시험 응시
                  </Text>
                </TouchableOpacity>
              )}

              {/* 펼쳤을 때: 커리큘럼 단원 및 단원별 문제집 */}
              {isExpanded && (
                <View style={styles.topicExpandedBody}>
                  {/* 조작 버튼 바 */}
                  <View style={styles.topicActionRow}>
                    <TouchableOpacity
                      style={styles.actionPillBtn}
                      onPress={() => onGenerateCurriculumForTopic(topic.id, topic.name)}
                      disabled={isAiGenerating}
                    >
                      <Text style={styles.actionPillText}>✨ AI 5단계 목차 생성</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionPillBtn}
                      onPress={onOpenUnitModal}
                    >
                      <Text style={styles.actionPillText}>+ 단원 추가</Text>
                    </TouchableOpacity>
                    {hasDuplicates && onDeduplicateUnits && (
                      <TouchableOpacity
                        style={[styles.actionPillBtn, { borderColor: '#ef4444' }]}
                        onPress={() => onDeduplicateUnits(topic.id)}
                      >
                        <Text style={[styles.actionPillText, { color: '#fca5a5' }]}>🧹 중복 정리</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.actionPillBtn, { borderColor: '#ef4444' }]}
                      onPress={() => onDeleteTopic(topic.id, topic.name)}
                    >
                      <Text style={[styles.actionPillText, { color: '#ef4444' }]}>삭제</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 단원 목록 */}
                  {topicUnits.length === 0 ? (
                    <View style={styles.emptyUnitCard}>
                      <Text style={styles.emptyUnitTitle}>등록된 단원이 없습니다.</Text>
                      <Text style={styles.emptyUnitDesc}>
                        [✨ AI 5단계 목차 생성]을 누르시면 공인 표준 5단계 목차가 자동 설계됩니다.
                      </Text>
                    </View>
                  ) : (
                    topicUnits.map((unit) => {
                      const isCompleted = completions.some((c) => c.unitId === unit.id && c.completed);
                      const unitQuestions = questions.filter(
                        (q) => q.topicId === topic.id && (q.unitId === unit.id || q.stem.includes(unit.title))
                      );
                      const isThisUnitGenerating = generatingUnitId === unit.id;
                      const isUnitQuestionsOpen = expandedUnitQuestionId === unit.id;

                      return (
                        <View key={unit.id} style={styles.unitHouseRow}>
                          <View style={styles.unitTopBar}>
                            <TouchableOpacity
                              style={styles.unitCheckTouch}
                              onPress={() => onToggleUnitCompletion(unit.id)}
                            >
                              <Text style={{ fontSize: 16 }}>{isCompleted ? '✅' : '⬜'}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.unitTitleTouch}
                              onPress={() => handleUnitPress(topic, unit, isCompleted)}
                            >
                              <Text
                                style={[styles.unitTitleText, isCompleted && styles.unitTitleCompleted]}
                                numberOfLines={2}
                              >
                                {unit.title}
                              </Text>
                              <Text style={styles.unitQuestionCountText}>
                                {unitQuestions.length > 0 ? `보관된 문제: ${unitQuestions.length}개` : '미출제'}
                              </Text>
                            </TouchableOpacity>

                            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                              <TouchableOpacity
                                style={styles.unitQuizBtn}
                                onPress={() => handleUnitPress(topic, unit, isCompleted)}
                                disabled={isAiGenerating}
                              >
                                {isThisUnitGenerating ? (
                                  <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                  <Text style={styles.unitQuizBtnText}>⚡ 출제/풀기</Text>
                                )}
                              </TouchableOpacity>

                              {unitQuestions.length > 0 && (
                                <TouchableOpacity
                                  style={[styles.unitViewBtn, isUnitQuestionsOpen && styles.unitViewBtnActive]}
                                  onPress={() =>
                                    setExpandedUnitQuestionId(isUnitQuestionsOpen ? null : unit.id)
                                  }
                                >
                                  <Text style={styles.unitViewBtnText}>
                                    {isUnitQuestionsOpen ? '접기 ▲' : `문제 (${unitQuestions.length}) ▼`}
                                  </Text>
                                </TouchableOpacity>
                              )}

                              <TouchableOpacity onPress={() => onDeleteUnit(unit.id)}>
                                <Text style={styles.unitDeleteIcon}>✕</Text>
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* 단원 내 저장된 문제 상세 펼치기 */}
                          {isUnitQuestionsOpen && unitQuestions.length > 0 && (
                            <View style={styles.unitQuestionsContainer}>
                              {unitQuestions.map((q, qIdx) => {
                                const isDetailOpen = expandedQuestionDetailId === q.id;
                                return (
                                  <View key={q.id} style={styles.questionItemCard}>
                                    <View style={styles.questionItemHeader}>
                                      <Text style={styles.questionItemNumber}>Q{qIdx + 1}.</Text>
                                      <Text style={styles.questionItemStem} numberOfLines={isDetailOpen ? undefined : 2}>
                                        {q.stem}
                                      </Text>
                                      {onDeleteQuestion && (
                                        <TouchableOpacity onPress={() => onDeleteQuestion(q.id)}>
                                          <Text style={styles.questionItemDelete}>삭제</Text>
                                        </TouchableOpacity>
                                      )}
                                    </View>

                                    <TouchableOpacity
                                      style={styles.toggleAnswerBtn}
                                      onPress={() =>
                                        setExpandedQuestionDetailId(isDetailOpen ? null : q.id)
                                      }
                                    >
                                      <Text style={styles.toggleAnswerBtnText}>
                                        {isDetailOpen ? '▲ 정답 및 풀이 접기' : '▼ 정답 및 풀이 확인'}
                                      </Text>
                                    </TouchableOpacity>

                                    {isDetailOpen && (
                                      <View style={styles.questionDetailBox}>
                                        {/* 보기 목록 */}
                                        <View style={styles.optionsList}>
                                          {q.options.map((opt, oIdx) => {
                                            const isAnswer = opt.id === q.answerOptionId;
                                            return (
                                              <View
                                                key={opt.id}
                                                style={[
                                                  styles.optionRow,
                                                  isAnswer && styles.optionRowCorrect,
                                                ]}
                                              >
                                                <Text style={styles.optionIndex}>{oIdx + 1}.</Text>
                                                <Text style={[styles.optionText, isAnswer && styles.optionTextCorrect]}>
                                                  {opt.text}
                                                </Text>
                                                {isAnswer && <Text style={styles.correctTag}>[공식 정답]</Text>}
                                              </View>
                                            );
                                          })}
                                        </View>

                                        {/* 풀이 및 해설 */}
                                        {q.explanation && (
                                          <View style={styles.solutionBox}>
                                            <Text style={styles.solutionTitle}>💡 문제 풀이 및 정답 해설</Text>
                                            <Text style={styles.solutionText}>
                                              {q.explanation
                                                .replace(/\[출제\s*근거\s*팩트\s*:[^\]]*\]/gi, '')
                                                .replace(/출제\s*근거\s*팩트\s*:[^\n]*/gi, '')
                                                .trim()}
                                            </Text>
                                          </View>
                                        )}
                                      </View>
                                    )}
                                  </View>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </View>
          );
        })
      )}

      {/* 4. 자유 출제 / 기타 문제집 집 (과목에 미할당된 문제) */}
      {unassignedQuestions.length > 0 && (
        <View style={styles.topicHouseCard}>
          <View style={styles.topicHouseHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Text style={[styles.categoryBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }]}>
                  ⚡ 즉시 출제
                </Text>
                <Text style={styles.topicHouseTitle}>자유 프롬프트 출제 문제집</Text>
              </View>
              <Text style={styles.topicHouseSub}>
                원하는 개념 즉시 출제로 생성된 문제 {unassignedQuestions.length}문항
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.toggleAccordionBtn, isOtherQuestionsExpanded && styles.toggleAccordionBtnActive]}
              onPress={() => setIsOtherQuestionsExpanded(!isOtherQuestionsExpanded)}
            >
              <Text style={styles.toggleAccordionText}>
                {isOtherQuestionsExpanded ? '접기 ▲' : '열기 ▼'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.topicExamBtn}
            onPress={() => onStartExamWithQuestions(unassignedQuestions)}
          >
            <Text style={styles.topicExamBtnText}>
              🚀 자유 출제 전체 {unassignedQuestions.length}문제 CBT 시험 응시
            </Text>
          </TouchableOpacity>

          {isOtherQuestionsExpanded && (
            <View style={styles.unitQuestionsContainer}>
              {unassignedQuestions.map((q, qIdx) => {
                const isDetailOpen = expandedQuestionDetailId === q.id;
                return (
                  <View key={q.id} style={styles.questionItemCard}>
                    <View style={styles.questionItemHeader}>
                      <Text style={styles.questionItemNumber}>Q{qIdx + 1}.</Text>
                      <Text style={styles.questionItemStem} numberOfLines={isDetailOpen ? undefined : 2}>
                        {q.stem}
                      </Text>
                      {onDeleteQuestion && (
                        <TouchableOpacity onPress={() => onDeleteQuestion(q.id)}>
                          <Text style={styles.questionItemDelete}>삭제</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <TouchableOpacity
                      style={styles.toggleAnswerBtn}
                      onPress={() =>
                        setExpandedQuestionDetailId(isDetailOpen ? null : q.id)
                      }
                    >
                      <Text style={styles.toggleAnswerBtnText}>
                        {isDetailOpen ? '▲ 정답 및 풀이 접기' : '▼ 정답 및 풀이 확인'}
                      </Text>
                    </TouchableOpacity>

                    {isDetailOpen && (
                      <View style={styles.questionDetailBox}>
                        <View style={styles.optionsList}>
                          {q.options.map((opt, oIdx) => {
                            const isAnswer = opt.id === q.answerOptionId;
                            return (
                              <View
                                key={opt.id}
                                style={[
                                  styles.optionRow,
                                  isAnswer && styles.optionRowCorrect,
                                ]}
                              >
                                <Text style={styles.optionIndex}>{oIdx + 1}.</Text>
                                <Text style={[styles.optionText, isAnswer && styles.optionTextCorrect]}>
                                  {opt.text}
                                </Text>
                                {isAnswer && <Text style={styles.correctTag}>[공식 정답]</Text>}
                              </View>
                            );
                          })}
                        </View>

                        {q.explanation && (
                          <View style={styles.solutionBox}>
                            <Text style={styles.solutionTitle}>💡 문제 풀이 및 정답 해설</Text>
                            <Text style={styles.solutionText}>
                              {q.explanation
                                .replace(/\[출제\s*근거\s*팩트\s*:[^\]]*\]/gi, '')
                                .replace(/출제\s*근거\s*팩트\s*:[^\n]*/gi, '')
                                .trim()}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* 5. 교재 및 텍스트 자료 등록 카드 */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>📖 내 교재 및 텍스트 발췌 등록</Text>
        <Text style={styles.promptGuideText}>
          교재 본문이나 학습 요약 텍스트를 등록해 두시면 해당 내용을 우선 반영하여 문제가 출제됩니다.
        </Text>

        <TextInput
          style={styles.inputField}
          placeholder="자료 제목 (예: 자료구조 3장 트리, 영문법 수동태 요약)"
          placeholderTextColor="#64748b"
          value={sourceTitle}
          onChangeText={onChangeSourceTitle}
        />

        <TextInput
          style={[styles.inputField, styles.textArea]}
          placeholder="교재 본문이나 강의 요약 노트를 붙여넣으세요..."
          placeholderTextColor="#64748b"
          multiline
          numberOfLines={4}
          value={sourceText}
          onChangeText={onChangeSourceText}
        />

        <TouchableOpacity style={styles.primaryActionButton} onPress={onSaveSource}>
          <Text style={styles.primaryActionText}>💾 자료 저장하기</Text>
        </TouchableOpacity>

        {sources.length > 0 && (
          <View style={styles.sourceList}>
            <Text style={styles.sourceListTitle}>등록된 학습 자료 ({sources.length}건):</Text>
            {sources.map((s) => (
              <View key={s.id} style={styles.sourceItem}>
                <Text style={styles.sourceItemTitle}>📄 {s.title}</Text>
                <Text style={styles.sourceItemMeta}>
                  {s.createdAt.slice(0, 10)} 등록
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  tabContent: {
    flex: 1,
  },
  scrollPadding: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  newTopicBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  newTopicBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  categoryScroll: {
    marginBottom: 14,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 6,
  },
  categoryChipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: '#6366f1',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  emptyCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  topicHouseCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  topicHouseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  topicHouseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  topicHouseSub: {
    fontSize: 12,
    color: '#94a3b8',
  },
  toggleAccordionBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  toggleAccordionBtnActive: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  toggleAccordionText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: 'bold',
  },
  topicExamBtn: {
    backgroundColor: '#312e81',
    borderWidth: 1,
    borderColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  topicExamBtnText: {
    color: '#e0e7ff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  topicExpandedBody: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
  },
  topicActionRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  actionPillBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionPillText: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  emptyUnitCard: {
    padding: 14,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyUnitTitle: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  emptyUnitDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  unitHouseRow: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  unitTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitCheckTouch: {
    paddingRight: 8,
  },
  unitTitleTouch: {
    flex: 1,
    marginRight: 8,
  },
  unitTitleText: {
    fontSize: 13,
    color: '#e2e8f0',
    fontWeight: '600',
  },
  unitTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#64748b',
  },
  unitQuestionCountText: {
    fontSize: 11,
    color: '#38bdf8',
    marginTop: 2,
  },
  unitQuizBtn: {
    backgroundColor: '#0f766e',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  unitQuizBtnText: {
    color: '#ccfbf1',
    fontSize: 11,
    fontWeight: 'bold',
  },
  unitViewBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  unitViewBtnActive: {
    borderColor: '#38bdf8',
  },
  unitViewBtnText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  unitDeleteIcon: {
    color: '#64748b',
    fontSize: 13,
    paddingHorizontal: 4,
  },
  unitQuestionsContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 10,
  },
  questionItemCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  questionItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  questionItemNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#818cf8',
  },
  questionItemStem: {
    flex: 1,
    fontSize: 12,
    color: '#e2e8f0',
    lineHeight: 17,
  },
  questionItemDelete: {
    fontSize: 11,
    color: '#ef4444',
    paddingHorizontal: 4,
  },
  toggleAnswerBtn: {
    marginTop: 6,
    paddingVertical: 4,
  },
  toggleAnswerBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  questionDetailBox: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 8,
  },
  optionsList: {
    gap: 4,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 6,
    borderRadius: 6,
  },
  optionRowCorrect: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  optionIndex: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b',
    marginRight: 6,
  },
  optionText: {
    flex: 1,
    fontSize: 12,
    color: '#cbd5e1',
  },
  optionTextCorrect: {
    color: '#a7f3d0',
    fontWeight: 'bold',
  },
  correctTag: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#10b981',
    marginLeft: 6,
  },
  solutionBox: {
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  solutionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#818cf8',
    marginBottom: 3,
  },
  solutionText: {
    fontSize: 11,
    color: '#cbd5e1',
    lineHeight: 16,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 4,
  },
  promptGuideText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 12,
    lineHeight: 17,
  },
  inputField: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#ffffff',
    fontSize: 13,
    marginBottom: 10,
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  primaryActionButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  sourceList: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
  },
  sourceListTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 6,
  },
  sourceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  sourceItemTitle: {
    fontSize: 12,
    color: '#cbd5e1',
    flex: 1,
  },
  sourceItemMeta: {
    fontSize: 11,
    color: '#64748b',
  },
});

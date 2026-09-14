import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
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

  // 당겨서 새로고침 (Pull to Refresh)
  refreshing?: boolean;
  onRefresh?: () => Promise<void> | void;

  // Source / Text notes
  sources: Source[];
  sourceTitle: string;
  onChangeSourceTitle: (text: string) => void;
  sourceText: string;
  onChangeSourceText: (text: string) => void;
  onSaveSource: () => Promise<void>;
  onPickSourceFile?: () => Promise<void>;
  selectedSourceTopicId?: string | null;
  onSelectSourceTopicId?: (topicId: string | null) => void;
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
  refreshing = false,
  onRefresh,

  sources,
  sourceTitle,
  onChangeSourceTitle,
  sourceText,
  onChangeSourceText,
  onSaveSource,
  onPickSourceFile,
  selectedSourceTopicId,
  onSelectSourceTopicId,
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

  const handleUnitPress = (topic: Topic, unit: Unit) => {
    onQuickGenerateForUnit(topic.id, topic.name, unit.id, unit.title);
  };

  return (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.scrollPadding}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#f43f5e', '#be123c']}
            tintColor="#f43f5e"
          />
        ) : undefined
      }
    >
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
                      const unitQuestions = questions.filter(
                        (q) => q.topicId === topic.id && (q.unitId === unit.id || q.stem.includes(unit.title))
                      );
                      const isThisUnitGenerating = generatingUnitId === unit.id;

                      return (
                        <View key={unit.id} style={styles.unitHouseRow}>
                          {/* 상단: 소단원 전체 명칭 100% 완전 노출 + 우측 삭제 아이콘 */}
                          <View style={styles.unitHeaderRow}>
                            <TouchableOpacity
                              style={{ flex: 1 }}
                              onPress={() => handleUnitPress(topic, unit)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.unitTitleText}>
                                {unit.title}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => onDeleteUnit(unit.id)}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              style={styles.unitDeleteTouch}
                            >
                              <Text style={styles.unitDeleteIcon}>✕</Text>
                            </TouchableOpacity>
                          </View>

                          {/* 하단: 보관된 문항 수 + 우측 소형 [출제/풀기] 버튼 */}
                          <View style={styles.unitFooterRow}>
                            <Text style={styles.unitQuestionCountText}>
                              {unitQuestions.length > 0 ? `📚 보관된 문제: ${unitQuestions.length}문항` : '⚡ 출제 대기'}
                            </Text>

                            <TouchableOpacity
                              style={styles.unitQuizBtn}
                              onPress={() => handleUnitPress(topic, unit)}
                              disabled={isAiGenerating}
                              activeOpacity={0.8}
                            >
                              {isThisUnitGenerating ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                              ) : (
                                <Text style={styles.unitQuizBtnText}>⚡ 출제 / 풀기</Text>
                              )}
                            </TouchableOpacity>
                          </View>
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

      {/* 5. 교재 및 학습 자료 등록 (과목 선택 & 파일 업로드) */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={styles.cardSectionTitle}>📖 내 교재 및 학습 자료 등록</Text>
          <View style={styles.badgePill}>
            <Text style={styles.badgePillText}>과목 연계 & 파일 첨부</Text>
          </View>
        </View>

        {/* ⚠️ 파일 업로드 시 주의사항 (유저 요청 100% 반영) */}
        <View style={styles.sourceNoticeBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Text style={{ fontSize: 13 }}>⚠️</Text>
            <Text style={styles.sourceNoticeTitle}>파일 업로드 시 주의사항</Text>
          </View>
          <Text style={styles.sourceNoticeText}>
            • <Text style={{ fontWeight: 'bold' }}>PDF, TXT 파일</Text>은 단일 파일 또는 ZIP 압축으로 바로 첨부 가능합니다.{'\n'}
            • <Text style={{ fontWeight: 'bold', color: '#be123c' }}>한글 문서(.hwp)</Text>는 AI가 직접 읽을 수 없으므로, 반드시 <Text style={{ fontWeight: 'bold', color: '#9f1239' }}>[PDF 또는 TXT 파일로 변환]</Text>하여 첨부 바랍니다.{'\n'}
            • 파일을 첨부하시면 제목과 본문 내용이 자동 추출되어 일일이 타이핑하실 필요가 없습니다.
          </Text>
        </View>

        {/* 1단계: 적용할 학습 과목(대단원) 선택 */}
        <Text style={styles.stepLabel}>1️⃣ 적용할 학습 과목(대단원) 선택</Text>
        {topics.length === 0 ? (
          <Text style={styles.emptyTopicHint}>※ 먼저 상단에서 학습 과목(대단원)을 생성해 주세요.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topicChipScroll}>
            {topics.map((t) => {
              const isSelected = selectedSourceTopicId === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.topicChip, isSelected && styles.topicChipSelected]}
                  onPress={() => onSelectSourceTopicId?.(isSelected ? null : t.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.topicChipText, isSelected && styles.topicChipTextSelected]}>
                    {isSelected ? '✓ ' : ''}{t.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* 2단계: 파일 원클릭 첨부 버튼 (PDF, TXT, ZIP) */}
        <Text style={[styles.stepLabel, { marginTop: 12 }]}>2️⃣ 교재 파일 첨부 (일일이 타자칠 필요 없음!)</Text>
        {onPickSourceFile && (
          <TouchableOpacity
            style={styles.fileUploadBigBtn}
            onPress={onPickSourceFile}
            activeOpacity={0.8}
          >
            <Text style={styles.fileUploadBigIcon}>📁</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.fileUploadBigTitle}>교재 / 요약 파일 선택하기</Text>
              <Text style={styles.fileUploadBigSub}>PDF, TXT, ZIP 압축 파일 지원 (한글 문서는 변환 후 첨부)</Text>
            </View>
            <View style={styles.fileUploadTag}>
              <Text style={styles.fileUploadTagText}>파일 탐색</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* 3단계: 추출된 자료 확인 & 등록 */}
        <Text style={[styles.stepLabel, { marginTop: 12 }]}>3️⃣ 등록할 자료 제목 및 요약 내용</Text>
        <TextInput
          style={styles.inputField}
          placeholder="파일을 선택하면 제목이 자동 입력됩니다 (직접 수정 가능)"
          placeholderTextColor="#94a3b8"
          value={sourceTitle}
          onChangeText={onChangeSourceTitle}
        />

        <TextInput
          style={[styles.inputField, styles.textArea]}
          placeholder="파일을 첨부하시면 내용이 자동 입력됩니다..."
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={3}
          value={sourceText}
          onChangeText={onChangeSourceText}
        />

        <TouchableOpacity
          style={[
            styles.primaryActionButton,
            (!sourceTitle.trim() || !sourceText.trim()) && styles.disabledActionBtn,
          ]}
          onPress={onSaveSource}
          disabled={!sourceTitle.trim() || !sourceText.trim()}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryActionText}>💾 선택한 과목에 교재 자료 등록하기</Text>
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
    backgroundColor: '#fff1f4',
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
    color: '#881337',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9f1239',
    marginTop: 4,
  },
  newTopicBtn: {
    backgroundColor: '#f43f5e',
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fecdd3',
    marginRight: 6,
  },
  categoryChipActive: {
    backgroundColor: '#ffe4e6',
    borderColor: '#f43f5e',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#be123c',
    fontWeight: 'bold',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fecdd3',
    marginBottom: 14,
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#881337',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  topicHouseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 15,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#fecdd3',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  topicHouseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#be123c',
    backgroundColor: '#ffe4e6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  topicHouseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  topicHouseSub: {
    fontSize: 12,
    color: '#64748b',
  },
  toggleAccordionBtn: {
    backgroundColor: '#fff1f4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  toggleAccordionBtnActive: {
    borderColor: '#f43f5e',
    backgroundColor: '#ffe4e6',
  },
  toggleAccordionText: {
    color: '#be123c',
    fontSize: 11,
    fontWeight: 'bold',
  },
  topicExamBtn: {
    backgroundColor: '#f43f5e',
    borderWidth: 1,
    borderColor: '#e11d48',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  topicExamBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  topicExpandedBody: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#fecdd3',
    paddingTop: 12,
  },
  topicActionRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  actionPillBtn: {
    backgroundColor: '#fff1f4',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  actionPillText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  emptyUnitCard: {
    padding: 14,
    backgroundColor: '#fff5f7',
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyUnitTitle: {
    fontSize: 13,
    color: '#881337',
    fontWeight: 'bold',
  },
  emptyUnitDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  unitHouseRow: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fecdd3',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  unitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  unitTitleText: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '700',
    lineHeight: 20,
    flex: 1,
    paddingRight: 8,
  },
  unitDeleteTouch: {
    padding: 4,
    marginLeft: 4,
  },
  unitDeleteIcon: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: 'bold',
  },
  unitFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#fff1f2',
  },
  unitQuestionCountText: {
    fontSize: 12,
    color: '#be123c',
    fontWeight: '600',
  },
  unitQuizBtn: {
    backgroundColor: '#f43f5e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  unitQuizBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  unitQuestionsContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#fecdd3',
    paddingTop: 10,
  },
  questionItemCard: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  questionItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  questionItemNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#e11d48',
  },
  questionItemStem: {
    flex: 1,
    fontSize: 12,
    color: '#1f2937',
    lineHeight: 17,
  },
  questionItemDelete: {
    fontSize: 11,
    color: '#f43f5e',
    paddingHorizontal: 4,
  },
  toggleAnswerBtn: {
    marginTop: 6,
    paddingVertical: 4,
  },
  toggleAnswerBtnText: {
    color: '#e11d48',
    fontSize: 11,
    fontWeight: 'bold',
  },
  questionDetailBox: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#fecdd3',
    paddingTop: 8,
  },
  optionsList: {
    gap: 4,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f7',
    padding: 6,
    borderRadius: 6,
  },
  optionRowCorrect: {
    backgroundColor: '#dcfce7',
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
    color: '#1f2937',
  },
  optionTextCorrect: {
    color: '#15803d',
    fontWeight: 'bold',
  },
  correctTag: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#10b981',
    marginLeft: 6,
  },
  solutionBox: {
    backgroundColor: '#fff1f4',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  solutionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#881337',
    marginBottom: 3,
  },
  solutionText: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#fecdd3',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#881337',
    marginBottom: 4,
  },
  promptGuideText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
    lineHeight: 17,
  },
  inputField: {
    backgroundColor: '#fff5f7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecdd3',
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#1f2937',
    fontSize: 13,
    marginBottom: 10,
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  primaryActionButton: {
    backgroundColor: '#f43f5e',
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
    borderTopColor: '#fecdd3',
    paddingTop: 12,
  },
  sourceListTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#881337',
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
    color: '#1f2937',
    flex: 1,
  },
  sourceItemMeta: {
    fontSize: 11,
    color: '#64748b',
  },
  badgePill: {
    backgroundColor: '#ffe4e6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fda4af',
  },
  badgePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#e11d48',
  },
  sourceNoticeBox: {
    backgroundColor: '#fff1f4',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  sourceNoticeTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#881337',
  },
  sourceNoticeText: {
    fontSize: 11,
    color: '#9f1239',
    lineHeight: 16,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  emptyTopicHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 8,
  },
  topicChipScroll: {
    marginBottom: 6,
  },
  topicChip: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 6,
  },
  topicChipSelected: {
    backgroundColor: '#f43f5e',
    borderColor: '#f43f5e',
  },
  topicChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  topicChipTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  fileUploadBigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#f43f5e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  fileUploadBigIcon: {
    fontSize: 24,
  },
  fileUploadBigTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#881337',
    marginBottom: 2,
  },
  fileUploadBigSub: {
    fontSize: 10.5,
    color: '#64748b',
  },
  fileUploadTag: {
    backgroundColor: '#ffe4e6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  fileUploadTagText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#e11d48',
  },
  disabledActionBtn: {
    backgroundColor: '#cbd5e1',
    opacity: 0.6,
  },
});

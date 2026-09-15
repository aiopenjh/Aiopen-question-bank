import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { QuestionRevision, Topic, Unit } from '../../contracts/types';
import { getCustomNoteQuestionIds, toggleCustomNoteQuestion } from '../../data/db';
import { styles } from './libraryStyles';

export interface ReviewHouseSectionProps {
  questions: QuestionRevision[];
  topics: Topic[];
  units: Unit[];
  incorrectQuestions?: QuestionRevision[];
  onDeleteQuestion?: (questionId: string) => Promise<void>;
  onOpenCustomNotebook: () => void;
  onCustomNoteChanged?: () => void;
}

export const ReviewHouseSection: React.FC<ReviewHouseSectionProps> = ({
  questions,
  topics,
  units,
  incorrectQuestions = [],
  onDeleteQuestion,
  onOpenCustomNotebook,
  onCustomNoteChanged,
}) => {
  const [activeReviewTopicId, setActiveReviewTopicId] = useState<string | null>(null); // null: 전체 과목
  const [expandedReviewUnitId, setExpandedReviewUnitId] = useState<string | null>(null);
  const [expandedQuestionExplId, setExpandedQuestionExplId] = useState<string | null>(null);
  const [customNoteIds, setCustomNoteIds] = useState<Set<string>>(new Set());

  // 나만의 오답노트 북마크 로드
  const loadBookmarks = async () => {
    const ids = await getCustomNoteQuestionIds();
    setCustomNoteIds(new Set(ids));
  };

  useEffect(() => {
    loadBookmarks();
  }, []);

  const handleToggleCustomNote = async (questionId: string) => {
    const isSaved = await toggleCustomNoteQuestion(questionId);
    setCustomNoteIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.add(questionId);
      else next.delete(questionId);
      return next;
    });
    if (onCustomNoteChanged) {
      onCustomNoteChanged();
    }
  };

  const currentTopicId = activeReviewTopicId;

  // 오답 ID Set
  const incorrectIdSet = useMemo(() => {
    return new Set(incorrectQuestions.map((q) => q.id));
  }, [incorrectQuestions]);

  // 현재 선택된 토픽의 문제들
  const topicQuestions = useMemo(() => {
    if (!currentTopicId) return questions;
    return questions.filter((q) => q.topicId === currentTopicId);
  }, [questions, currentTopicId]);

  // 과목 ID -> 과목명 맵핑
  const topicMap = useMemo(() => {
    return new Map(topics.map((t) => [t.id, t.name]));
  }, [topics]);

  // 현재 토픽의 단원들 및 단원별 그룹핑
  const currentTopicUnits = useMemo(() => {
    if (!currentTopicId) return units;
    return units.filter((u) => u.topicId === currentTopicId);
  }, [units, currentTopicId]);

  const unitReviewGroups = useMemo(() => {
    const groups: {
      unitId: string;
      unitTitle: string;
      questions: QuestionRevision[];
      incorrectCount: number;
    }[] = [];

    for (const u of currentTopicUnits) {
      const uQs = topicQuestions.filter((q) => q.unitId === u.id || q.stem.includes(u.title));
      const uIncCount = uQs.filter((q) => incorrectIdSet.has(q.id)).length;
      if (uQs.length > 0) {
        const topicNamePrefix = !currentTopicId && u.topicId && topicMap.has(u.topicId)
          ? `[${topicMap.get(u.topicId)}] `
          : '';
        groups.push({
          unitId: u.id,
          unitTitle: `${topicNamePrefix}${u.title}`,
          questions: uQs,
          incorrectCount: uIncCount,
        });
      }
    }

    return groups;
  }, [currentTopicUnits, topicQuestions, incorrectIdSet, currentTopicId, topicMap]);

  return (
    <View style={styles.reviewHouseCard}>
      {/* 1. 상단 안내 */}
      <View style={styles.reviewHouseHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Text style={styles.reviewHouseBadge}>📋 문제은행 보관실</Text>
        </View>
        <Text style={styles.reviewHouseSubtitle}>
          단원별 보관 문제를 검토하고, 기억하고 싶은 문제는 [☆ 기억하기]를 눌러 나만의 오답노트로 모아볼 수 있습니다.
        </Text>
      </View>

      {/* 2. 나만의 오답노트 전용실 바로가기 배너 */}
      <TouchableOpacity
        style={styles.openCustomNoteBanner}
        onPress={onOpenCustomNotebook}
        activeOpacity={0.8}
      >
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.openCustomNoteTitle}>⭐ 나만의 오답노트 열기 ({customNoteIds.size}문항)</Text>
          <Text style={styles.openCustomNoteSub} numberOfLines={1}>독립된 공간에서 조용하게 집중 복습하기</Text>
        </View>
        <View style={styles.openCustomNoteBtn}>
          <Text style={styles.openCustomNoteBtnText}>입장하기 ➔</Text>
        </View>
      </TouchableOpacity>

      {/* 3. 과목 선택 가로 칩 바 (전체 맨 앞) */}
      {topics.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.reviewTopicScroll}
          onTouchStart={(e: any) => e.stopPropagation?.()}
          onTouchMove={(e: any) => e.stopPropagation?.()}
          onTouchEnd={(e: any) => e.stopPropagation?.()}
          {...({ 'data-horizontal-scroll': 'true' } as any)}
        >
          <TouchableOpacity
            style={[styles.reviewTopicChip, activeReviewTopicId === null && styles.reviewTopicChipActive]}
            onPress={() => setActiveReviewTopicId(null)}
            activeOpacity={0.7}
          >
            <Text style={[styles.reviewTopicChipText, activeReviewTopicId === null && styles.reviewTopicChipTextActive]}>
              전체 ({questions.length})
            </Text>
          </TouchableOpacity>
          {topics.map((t) => {
            const isActive = activeReviewTopicId === t.id;
            const tQCount = questions.filter((q) => q.topicId === t.id).length;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.reviewTopicChip, isActive && styles.reviewTopicChipActive]}
                onPress={() => setActiveReviewTopicId(t.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.reviewTopicChipText, isActive && styles.reviewTopicChipTextActive]}>
                  {t.name} ({tQCount})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* 4. 단원별 문제 목록 */}
      {unitReviewGroups.length === 0 ? (
        <View style={styles.emptyReviewBox}>
          <Text style={{ fontSize: 26, marginBottom: 4 }}>📝</Text>
          <Text style={styles.emptyReviewTitle}>등록된 문제가 없습니다.</Text>
          <Text style={styles.emptyReviewSubtitle}>
            상단 단원에서 문제를 출제하여 학습을 시작해보세요.
          </Text>
        </View>
      ) : (
        unitReviewGroups.map((group) => {
          const isGroupExpanded =
            expandedReviewUnitId === group.unitId ||
            (unitReviewGroups.length === 1 && expandedReviewUnitId !== '__closed__');

          return (
            <View key={group.unitId} style={styles.unitReviewGroupCard}>
              {/* 단원 헤더 */}
              <TouchableOpacity
                style={styles.unitReviewGroupHeader}
                onPress={() => setExpandedReviewUnitId(isGroupExpanded ? '__closed__' : group.unitId)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.unitReviewGroupTitle} numberOfLines={1}>
                    {group.unitTitle}
                  </Text>
                  <Text style={styles.unitReviewGroupSubtitle}>
                    보관 {group.questions.length}문항 {group.incorrectCount > 0 ? `· 🚨 오답 ${group.incorrectCount}개` : ''}
                  </Text>
                </View>
                <Text style={styles.accordionArrowText}>
                  {isGroupExpanded ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>

              {/* 단원 내 개별 문제 카드들 */}
              {isGroupExpanded && (
                <View style={styles.unitQuestionsContainer}>
                  {group.questions.map((q, qIndex) => {
                    const isExplOpen = expandedQuestionExplId === q.id;
                    const isIncorrect = incorrectIdSet.has(q.id);
                    const isSaved = customNoteIds.has(q.id);

                    return (
                      <View key={q.id} style={styles.questionReviewCard}>
                        <View style={styles.questionReviewHeaderRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                            <Text style={styles.questionNumBadge}>Q{qIndex + 1}</Text>
                            {isIncorrect && (
                              <View style={styles.incorrectBadge}>
                                <Text style={styles.incorrectBadgeText}>🚨 오답</Text>
                              </View>
                            )}
                          </View>

                          {/* 기억하고 싶은 문제 (나만의 오답노트) 토글 버튼 */}
                          <TouchableOpacity
                            style={[
                              styles.bookmarkBtn,
                              isSaved && styles.bookmarkBtnActive,
                            ]}
                            onPress={() => handleToggleCustomNote(q.id)}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.bookmarkBtnText,
                                isSaved && styles.bookmarkBtnTextActive,
                              ]}
                            >
                              {isSaved ? '⭐ 기억 중' : '☆ 기억하기'}
                            </Text>
                          </TouchableOpacity>

                          {onDeleteQuestion && (
                            <TouchableOpacity
                              style={styles.deleteQMiniBtn}
                              onPress={() => onDeleteQuestion(q.id)}
                            >
                              <Text style={styles.deleteQMiniBtnText}>✕</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        <Text style={styles.questionStemText}>{q.stem}</Text>

                        {/* 4지선다 보기 리스트 */}
                        <View style={styles.optionsReviewBox}>
                          {q.options.map((opt, oIdx) => {
                            const isCorrectOpt = opt.id === q.answerOptionId;
                            return (
                              <View
                                key={opt.id}
                                style={[
                                  styles.optionReviewRow,
                                  isCorrectOpt && styles.optionReviewRowCorrect,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.optionReviewNumber,
                                    isCorrectOpt && styles.optionReviewNumberCorrect,
                                  ]}
                                >
                                  {oIdx + 1}
                                </Text>
                                <Text
                                  style={[
                                    styles.optionReviewText,
                                    isCorrectOpt && styles.optionReviewTextCorrect,
                                  ]}
                                >
                                  {opt.text}
                                </Text>
                                {isCorrectOpt && (
                                  <Text style={styles.correctOptTag}>✓ 정답</Text>
                                )}
                              </View>
                            );
                          })}
                        </View>

                        {/* 해설 토글 */}
                        <TouchableOpacity
                          style={styles.explToggleBtn}
                          onPress={() => setExpandedQuestionExplId(isExplOpen ? null : q.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.explToggleBtnText}>
                            {isExplOpen ? '💡 정답 및 해설 닫기 ▲' : '💡 정답 및 상세 해설 보기 ▼'}
                          </Text>
                        </TouchableOpacity>

                        {isExplOpen && (
                          <View style={styles.explContentBox}>
                            <Text style={styles.explTitle}>[공식 정답 및 상세 해설]</Text>
                            <Text style={styles.explText}>
                              {q.explanation || '해설 정보가 등록되어 있지 않습니다.'}
                            </Text>
                            {q.deepReasoningHint ? (
                              <View style={styles.misconceptionBox}>
                                <Text style={styles.misconceptionTitle}>⚠️ 빈출 오답 및 함정 분석:</Text>
                                <Text style={styles.misconceptionText}>{q.deepReasoningHint}</Text>
                              </View>
                            ) : null}
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
  );
};

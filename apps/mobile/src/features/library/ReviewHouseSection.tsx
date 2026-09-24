import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { QuestionRevision, Topic, Unit } from '../../contracts/types';
import { getCustomNoteQuestionIds, toggleCustomNoteQuestion } from '../../data/db';
import { StateIllustration } from '../../components/common/StateIllustration';
import { CurrentReferenceNotice } from '../../components/common/CurrentReferenceNotice';
import { MathText } from '../../components/common/MathText';
import { hasMissingOptions, MISSING_OPTIONS_LABEL } from '../../domain/question_integrity';
import { styles } from './libraryStyles';

const ALL_TOPICS_ID = '__all_topics__';

export interface ReviewHouseSectionProps {
  mode?: 'bank' | 'review';
  questions: QuestionRevision[];
  topics: Topic[];
  units: Unit[];
  incorrectQuestions?: QuestionRevision[];
  onDeleteQuestion?: (questionId: string) => Promise<void>;
  onCustomNoteChanged?: () => void;
  refreshCustomNotesRequest?: number;
}

export const ReviewHouseSection: React.FC<ReviewHouseSectionProps> = ({
  mode = 'bank',
  questions,
  topics,
  units,
  incorrectQuestions = [],
  onDeleteQuestion,
  onCustomNoteChanged,
  refreshCustomNotesRequest = 0,
}) => {
  const [activeReviewTopicId, setActiveReviewTopicId] = useState<string | null>(null); // null: 모두 접힘
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
  }, [refreshCustomNotesRequest]);

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

  const currentTopicId = activeReviewTopicId === ALL_TOPICS_ID ? null : activeReviewTopicId;
  const visibleQuestions = mode === 'review' ? incorrectQuestions : questions;
  // 오답 ID Set
  const incorrectIdSet = useMemo(() => {
    return new Set(incorrectQuestions.map((q) => q.id));
  }, [incorrectQuestions]);

  // 현재 선택된 토픽의 문제들
  const topicQuestions = useMemo(() => {
    if (!currentTopicId) return visibleQuestions;
    return visibleQuestions.filter((q) => q.topicId === currentTopicId);
  }, [visibleQuestions, currentTopicId]);

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

    const groupedQuestions = new Set<QuestionRevision>();

    for (const u of currentTopicUnits) {
      const uQs = topicQuestions.filter((q) => {
        if (groupedQuestions.has(q)) return false;
        return q.unitId === u.id;
      });
      const uIncCount = uQs.filter((q) => incorrectIdSet.has(q.id)).length;
      if (uQs.length > 0) {
        uQs.forEach((q) => groupedQuestions.add(q));
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

    const ungroupedByTopic = new Map<string, QuestionRevision[]>();
    topicQuestions.forEach((q) => {
      if (groupedQuestions.has(q)) return;
      const groupKey = q.topicId || '__unknown_topic__';
      const existing = ungroupedByTopic.get(groupKey) || [];
      existing.push(q);
      ungroupedByTopic.set(groupKey, existing);
    });

    ungroupedByTopic.forEach((ungroupedQuestions, topicId) => {
      const topicName = topicMap.get(topicId);
      const titlePrefix = !currentTopicId && topicName ? `[${topicName}] ` : '';
      groups.push({
        unitId: `__ungrouped__-${topicId}`,
        unitTitle: `${titlePrefix}기타 문제`,
        questions: ungroupedQuestions,
        incorrectCount: ungroupedQuestions.filter((q) => incorrectIdSet.has(q.id)).length,
      });
    });

    return groups;
  }, [currentTopicUnits, topicQuestions, incorrectIdSet, currentTopicId, topicMap]);

  const topicsWithQuestions = useMemo(() => {
    return topics
      .map((topic) => ({
        topic,
        questionCount: visibleQuestions.filter((q) => q.topicId === topic.id).length,
      }))
      .filter(({ questionCount }) => questionCount > 0);
  }, [topics, visibleQuestions]);

  const renderUnitGroups = () => {
    if (unitReviewGroups.length === 0) {
      return (
        <View style={styles.emptyReviewBox}>
          <StateIllustration
            kind={mode === 'review' ? 'reviewComplete' : 'emptyLibrary'}
            width={104}
            style={styles.emptyReviewIllustration}
          />
          <Text style={styles.emptyReviewTitle}>
            {mode === 'review' ? '지금은 복습할 오답이 없습니다' : '아직 보관된 문제가 없습니다'}
          </Text>
          <Text style={styles.emptyReviewSubtitle}>
            {mode === 'review'
              ? '새로운 시험을 마치면 틀린 문제가 이곳에 정리됩니다.'
              : '과목과 목차에서 단원을 선택해 첫 문제를 만들어 보세요.'}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.reviewUnitNest}>
        {unitReviewGroups.map((group) => {
          const isGroupExpanded = expandedReviewUnitId === group.unitId;

          return (
            <View key={group.unitId} style={styles.unitReviewGroupCard}>
              <TouchableOpacity
                style={styles.unitReviewGroupHeader}
                onPress={() => setExpandedReviewUnitId(isGroupExpanded ? null : group.unitId)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.unitReviewGroupTitle} numberOfLines={2}>
                    {group.unitTitle}
                  </Text>
                  <Text style={styles.unitReviewGroupSubtitle}>
                    보관 {group.questions.length}문항 {group.incorrectCount > 0 ? `· 🚨 오답 ${group.incorrectCount}개` : ''}
                  </Text>
                </View>
                <Text style={styles.accordionArrowText}>{isGroupExpanded ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {isGroupExpanded && (
                <View style={styles.unitQuestionsContainer}>
                  {group.questions.map((q, qIndex) => {
                    const isExplOpen = expandedQuestionExplId === q.id;
                    const isIncorrect = incorrectIdSet.has(q.id);
                    const isSaved = customNoteIds.has(q.id);

                    return (
                      <View key={`${q.id}-${qIndex}`} style={styles.questionReviewCard}>
                        <View style={styles.questionReviewHeaderRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                            <Text style={styles.questionNumBadge}>Q{qIndex + 1}</Text>
                            {isIncorrect && (
                              <View style={styles.incorrectBadge}>
                                <Text style={styles.incorrectBadgeText}>오답</Text>
                              </View>
                            )}
                            {hasMissingOptions(q) && (
                              <View style={styles.missingOptionsBadge}>
                                <Text style={styles.missingOptionsBadgeText}>{MISSING_OPTIONS_LABEL}</Text>
                              </View>
                            )}
                          </View>

                          <TouchableOpacity
                            style={[styles.bookmarkBtn, isSaved && styles.bookmarkBtnActive]}
                            onPress={() => handleToggleCustomNote(q.id)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.bookmarkBtnText, isSaved && styles.bookmarkBtnTextActive]}>
                              {isSaved ? '저장됨' : '오답노트 저장'}
                            </Text>
                          </TouchableOpacity>

                          {onDeleteQuestion && (
                            <TouchableOpacity style={styles.deleteQMiniBtn} onPress={() => onDeleteQuestion(q.id)}>
                              <Text style={styles.deleteQMiniBtnText}>✕</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        <MathText style={styles.questionStemText} text={q.stem} />

                        <View style={styles.optionsReviewBox}>
                          {q.options.map((opt, oIdx) => {
                            const isCorrectOpt = opt.id === q.answerOptionId;
                            return (
                              <View
                                key={opt.id}
                                style={[styles.optionReviewRow, isCorrectOpt && styles.optionReviewRowCorrect]}
                              >
                                <Text
                                  style={[styles.optionReviewNumber, isCorrectOpt && styles.optionReviewNumberCorrect]}
                                >
                                  {oIdx + 1}
                                </Text>
                                <Text style={[styles.optionReviewText, isCorrectOpt && styles.optionReviewTextCorrect]}>
                                  {opt.text}
                                </Text>
                                {isCorrectOpt && <Text style={styles.correctOptTag}>✓ 정답</Text>}
                              </View>
                            );
                          })}
                        </View>

                        <TouchableOpacity
                          style={styles.explToggleBtn}
                          onPress={() => setExpandedQuestionExplId(isExplOpen ? null : q.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.explToggleBtnText}>
                            {isExplOpen ? '정답 및 해설 닫기 ▲' : '정답 및 상세 해설 보기 ▼'}
                          </Text>
                        </TouchableOpacity>

                        {isExplOpen && (
                          <View style={styles.explContentBox}>
                            <Text style={styles.explTitle}>[공식 정답 및 상세 해설]</Text>
                            <MathText
                              style={styles.explText}
                              text={q.explanation || '해설 정보가 등록되어 있지 않습니다.'}
                            />
                            <CurrentReferenceNotice reference={q.currentReference} />
                            {q.deepReasoningHint ? (
                              <View style={styles.misconceptionBox}>
                                <Text style={styles.misconceptionTitle}>빈출 오답 및 함정 분석</Text>
                                <MathText style={styles.misconceptionText} text={q.deepReasoningHint} />
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
        })}
      </View>
    );
  };

  return (
    <View style={styles.reviewHouseCard}>
      {/* 상단 안내 */}
      <View style={styles.reviewHouseHeader}>
        <Text style={styles.reviewHouseEyebrow}>{mode === 'review' ? 'REVIEW' : 'QUESTION BANK'}</Text>
        <Text style={styles.reviewHouseTitle}>{mode === 'review' ? '복습할 문제' : '문제 보관함'}</Text>
        <Text style={styles.reviewHouseSubtitle}>
          {mode === 'review'
            ? `다시 확인할 오답 ${incorrectQuestions.length}문항을 과목과 단원별로 모았습니다.`
            : `출제한 ${questions.length}문항을 단원별로 확인하고 필요한 문제를 오답노트에 저장하세요.`}
        </Text>
      </View>

      {/* 전체 > 과목 > 단원 > 문제 순서의 세로형 계층 */}
      {visibleQuestions.length === 0 ? (
        renderUnitGroups()
      ) : (
        <View style={styles.reviewTopicStack}>
          {mode === 'review' ? (
            <View>
              <TouchableOpacity
                style={[
                  styles.reviewParentTab,
                  activeReviewTopicId === ALL_TOPICS_ID && styles.reviewParentTabActive,
                ]}
                onPress={() => {
                  setActiveReviewTopicId((current) =>
                    current === ALL_TOPICS_ID ? null : ALL_TOPICS_ID,
                  );
                  setExpandedReviewUnitId(null);
                  setExpandedQuestionExplId(null);
                }}
                activeOpacity={0.78}
              >
                <View style={styles.reviewParentTabCopy}>
                  <Text
                    style={[
                      styles.reviewParentTabTitle,
                      activeReviewTopicId === ALL_TOPICS_ID && styles.reviewParentTabTitleActive,
                    ]}
                  >
                    전체 문제
                  </Text>
                  <Text style={styles.reviewParentTabMeta}>
                    모든 과목 · {visibleQuestions.length}문항
                  </Text>
                </View>
                <Text style={styles.reviewParentTabArrow}>
                  {activeReviewTopicId === ALL_TOPICS_ID ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>
              {activeReviewTopicId === ALL_TOPICS_ID && renderUnitGroups()}
            </View>
          ) : null}

          {topicsWithQuestions.map(({ topic, questionCount }) => {
            const isActive = activeReviewTopicId === topic.id;
            return (
              <View key={topic.id}>
                <TouchableOpacity
                  style={[styles.reviewParentTab, isActive && styles.reviewParentTabActive]}
                  onPress={() => {
                    setActiveReviewTopicId((current) => (current === topic.id ? null : topic.id));
                    setExpandedReviewUnitId(null);
                    setExpandedQuestionExplId(null);
                  }}
                  activeOpacity={0.78}
                >
                  <View style={styles.reviewParentTabCopy}>
                    <Text
                      style={[
                        styles.reviewParentTabTitle,
                        isActive && styles.reviewParentTabTitleActive,
                      ]}
                      numberOfLines={2}
                    >
                      {topic.name}
                    </Text>
                    <Text style={styles.reviewParentTabMeta}>
                      {questionCount}문항 · 눌러서 단원 보기
                    </Text>
                  </View>
                  <Text style={styles.reviewParentTabArrow}>{isActive ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {isActive && renderUnitGroups()}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

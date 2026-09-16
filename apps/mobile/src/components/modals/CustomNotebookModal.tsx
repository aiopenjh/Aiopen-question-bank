import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { QuestionRevision, Topic } from '../../contracts/types';
import { getCustomNoteQuestionIds, toggleCustomNoteQuestion } from '../../data/db';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { styles } from './customNotebookStyles';
import { UniversalModal as Modal } from '../common/UniversalModal';
import { CurrentReferenceNotice } from '../common/CurrentReferenceNotice';

export interface CustomNotebookModalProps {
  visible: boolean;
  onClose: () => void;
  questions: QuestionRevision[];
  topics: Topic[];
  onCustomNoteChanged?: () => void;
}

export const CustomNotebookModal: React.FC<CustomNotebookModalProps> = ({
  visible,
  onClose,
  questions,
  topics,
  onCustomNoteChanged,
}) => {
  const [customNoteIds, setCustomNoteIds] = useState<Set<string>>(new Set());
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [expandedExplIds, setExpandedExplIds] = useState<Set<string>>(new Set());

  // 오른쪽으로 넘기면 이전 화면으로 복귀
  const swipeHandlers = useSwipeGesture({
    onSwipeRight: onClose,
  });

  // 북마크 ID 로드
  const reloadBookmarks = async () => {
    const ids = await getCustomNoteQuestionIds();
    setCustomNoteIds(new Set(ids));
  };

  useEffect(() => {
    if (visible) {
      reloadBookmarks();
    }
  }, [visible]);

  // 북마크 토글
  const handleToggle = async (questionId: string) => {
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

  // 해설 개별 토글
  const toggleExpl = (qId: string) => {
    setExpandedExplIds((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  // 전체 해설 모두 열기/닫기
  const toggleAllExpl = (openAll: boolean) => {
    if (openAll) {
      setExpandedExplIds(new Set(filteredQuestions.map((q) => q.id)));
    } else {
      setExpandedExplIds(new Set());
    }
  };

  // 사용자가 직접 저장한 문제만 나만의 오답노트에 표시
  const allSavedQuestions = useMemo(() => {
    return questions.filter((q) => customNoteIds.has(q.id));
  }, [questions, customNoteIds]);

  // 과목 필터링 적용된 문제들
  const filteredQuestions = useMemo(() => {
    if (!selectedTopicId) return allSavedQuestions;
    return allSavedQuestions.filter((q) => q.topicId === selectedTopicId);
  }, [allSavedQuestions, selectedTopicId]);

  // 과목 매핑
  const topicMap = useMemo(() => new Map(topics.map((t) => [t.id, t.name])), [topics]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} {...swipeHandlers}>
        <StatusBar barStyle="dark-content" />

        {/* 상단 조용한 헤더 바 */}
        <View style={styles.header}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.headerBadge}>📖 집중 복습실</Text>
            </View>
            <Text style={styles.headerTitle}>나만의 오답노트</Text>
            <Text style={styles.headerSub}>
              직접 골라 저장한 {allSavedQuestions.length}문항을 내 방식대로 복습합니다.
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>← 뒤로가기</Text>
          </TouchableOpacity>
        </View>

        {/* 과목 필터 칩 바 */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <TouchableOpacity
              style={[styles.topicChip, selectedTopicId === null && styles.topicChipActive]}
              onPress={() => setSelectedTopicId(null)}
            >
              <Text style={[styles.topicChipText, selectedTopicId === null && styles.topicChipTextActive]}>
                전체 ({allSavedQuestions.length})
              </Text>
            </TouchableOpacity>

            {topics.map((t) => {
              const count = allSavedQuestions.filter((q) => q.topicId === t.id).length;
              if (count === 0) return null;
              const isActive = selectedTopicId === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.topicChip, isActive && styles.topicChipActive]}
                  onPress={() => setSelectedTopicId(t.id)}
                >
                  <Text style={[styles.topicChipText, isActive && styles.topicChipTextActive]}>
                    {t.name} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {filteredQuestions.length > 0 && (
            <View style={styles.utilRow}>
              <Text style={styles.utilCountText}>총 {filteredQuestions.length}개의 핵심 문제</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => toggleAllExpl(true)} style={styles.utilBtn}>
                  <Text style={styles.utilBtnText}>모든 해설 열기</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => toggleAllExpl(false)} style={styles.utilBtn}>
                  <Text style={styles.utilBtnText}>모든 해설 접기</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* 문제 목록 본문 */}
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyPadding}>
          {filteredQuestions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🌱</Text>
              <Text style={styles.emptyTitle}>
                {allSavedQuestions.length === 0
                  ? '아직 나만의 오답노트에 담긴 문제가 없습니다.'
                  : '선택한 과목에 담긴 오답노트 문제가 없습니다.'}
              </Text>
              <Text style={styles.emptyDesc}>
                과목 자료함의 문제 목록에서 [☆ 기억하기]를 누르면 언제든 이곳에서 조용하고 편안하게 복습할 수 있습니다.
              </Text>
            </View>
          ) : (
            filteredQuestions.map((q, idx) => {
              const isExplOpen = expandedExplIds.has(q.id);
              const topicName = q.topicId ? topicMap.get(q.topicId) : '자유 문제';

              return (
                <View key={`${q.id}-${idx}`} style={styles.questionCard}>
                  {/* 카드 헤더 */}
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Text style={styles.qNumBadge}>Q{idx + 1}</Text>
                      {topicName && <Text style={styles.topicBadge}>{topicName}</Text>}
                    </View>

                    {/* 기억 해제 버튼 */}
                    <TouchableOpacity
                      style={styles.unbookmarkBtn}
                      onPress={() => handleToggle(q.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.unbookmarkBtnText}>
                        오답노트에서 빼기
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* 지문 */}
                  <Text style={styles.stemText}>{q.stem}</Text>

                  {/* 4지선다 보기 */}
                  <View style={styles.optionsBox}>
                    {q.options.map((opt, oIdx) => {
                      const isCorrect = opt.id === q.answerOptionId;
                      return (
                        <View
                          key={opt.id}
                          style={[styles.optionRow, isCorrect && styles.optionRowCorrect]}
                        >
                          <Text style={[styles.optNum, isCorrect && styles.optNumCorrect]}>
                            {oIdx + 1}
                          </Text>
                          <Text style={[styles.optText, isCorrect && styles.optTextCorrect]}>
                            {opt.text}
                          </Text>
                          {isCorrect && <Text style={styles.correctBadge}>✓ 정답</Text>}
                        </View>
                      );
                    })}
                  </View>

                  {/* 해설 열람 토글 */}
                  <TouchableOpacity
                    style={styles.explToggleBtn}
                    onPress={() => toggleExpl(q.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.explToggleBtnText}>
                      {isExplOpen ? '💡 정답 및 해설 접기 ▲' : '💡 정답 및 상세 해설 보기 ▼'}
                    </Text>
                  </TouchableOpacity>

                  {isExplOpen && (
                    <View style={styles.explBox}>
                      <Text style={styles.explTitle}>[상세 정답 해설]</Text>
                      <Text style={styles.explBody}>{q.explanation || '해설이 등록되지 않았습니다.'}</Text>
                      <CurrentReferenceNotice reference={q.currentReference} />
                      {q.deepReasoningHint ? (
                        <View style={styles.hintBox}>
                          <Text style={styles.hintTitle}>⚠️ 빈출 오답 및 핵심 분석:</Text>
                          <Text style={styles.hintBody}>{q.deepReasoningHint}</Text>
                        </View>
                      ) : null}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};


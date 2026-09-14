import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QuestionRevision } from '../../contracts/types';
import { showAlert } from '../../utils/alert';

interface ExamSessionScreenProps {
  questions: QuestionRevision[];
  onExitExam: () => void;
  onCompleteExam: (
    results: Array<{ question: QuestionRevision; selectedOptionId: string; isCorrect: boolean }>
  ) => Promise<void>;
}

export const ExamSessionScreen: React.FC<ExamSessionScreenProps> = ({
  questions,
  onExitExam,
  onCompleteExam,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showHintModal, setShowHintModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!questions || questions.length === 0) return null;

  const q = questions[currentIndex];
  const currentSelectedOptionId = userAnswers[currentIndex] || null;

  // 문제 풀이 중 선지 선택 (즉시 채점 X, 답안 마킹만)
  function handleSelectOption(optionId: string) {
    if (isSubmitted) return;
    setUserAnswers((prev) => ({
      ...prev,
      [currentIndex]: optionId,
    }));
  }

  // 나가기 확인
  function handlePressExit() {
    if (isSubmitted) {
      onExitExam();
      return;
    }
    showAlert('시험 종료', '현재 시험을 종료하시겠습니까? (풀이 중인 답안은 채점되지 않습니다)', [
      { text: '계속 풀기', style: 'cancel' },
      { text: '나가기', style: 'destructive', onPress: onExitExam },
    ]);
  }

  // 이전 문제
  function handlePrevQuestion() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }

  // 다음 문제
  function handleNextQuestion() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }

  // 최종 답안 제출 및 채점
  async function handleSubmitExam() {
    const answeredCount = Object.keys(userAnswers).length;
    const unansweredCount = questions.length - answeredCount;

    if (unansweredCount > 0) {
      showAlert(
        '미답변 문항 확인',
        `아직 풀지 않은 문제가 ${unansweredCount}개 있습니다.\n그래도 최종 제출하여 채점하시겠습니까?`,
        [
          { text: '마저 풀기', style: 'cancel' },
          {
            text: '제출하고 채점하기',
            style: 'destructive',
            onPress: () => executeSubmission(),
          },
        ]
      );
      return;
    }

    await executeSubmission();
  }

  async function executeSubmission() {
    setIsSaving(true);
    try {
      const results = questions.map((item, idx) => {
        const selectedId = userAnswers[idx] || '';
        const isCorrect = selectedId === item.answerOptionId;
        return {
          question: item,
          selectedOptionId: selectedId,
          isCorrect,
        };
      });

      await onCompleteExam(results);
      setIsSubmitted(true);
      setCurrentIndex(0);
    } catch (err: any) {
      showAlert('오류', `채점 결과 저장 실패: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }

  // 채점 결과 통계
  const correctCount = questions.filter(
    (item, idx) => userAnswers[idx] === item.answerOptionId
  ).length;
  const scorePercent = Math.round((correctCount / questions.length) * 100);

  return (
    <SafeAreaView style={styles.examContainer}>
      <StatusBar barStyle="light-content" />

      {/* 헤더 바 */}
      <View style={styles.examHeader}>
        <TouchableOpacity onPress={handlePressExit} style={styles.backButton}>
          <Text style={styles.backButtonText}>✕ 나가기</Text>
        </TouchableOpacity>

        <Text style={styles.examProgressText}>
          {isSubmitted ? '📋 정답 및 종합 해설지' : `문제 ${currentIndex + 1} / ${questions.length}`}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {/* 문제 풀이 시 필요한 경우에만 우측 상단 힌트 제공 */}
          {!isSubmitted && (
            <TouchableOpacity
              style={styles.hintHeaderBtn}
              onPress={() => setShowHintModal(true)}
            >
              <Text style={styles.hintHeaderBtnText}>💡 힌트</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ============================================================ */}
      {/* 1. 실전 시험 모드 (isSubmitted === false)                     */}
      {/* ============================================================ */}
      {!isSubmitted ? (
        <>
          <ScrollView style={styles.examBody} contentContainerStyle={styles.examContentContainer}>
            {/* 문제 번호 및 마킹 상태 바 */}
            <View style={styles.quickNavRow}>
              {questions.map((_, idx) => {
                const isCurrent = currentIndex === idx;
                const isAnswered = !!userAnswers[idx];
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.quickNavDot,
                      isAnswered && styles.quickNavDotAnswered,
                      isCurrent && styles.quickNavDotCurrent,
                    ]}
                    onPress={() => setCurrentIndex(idx)}
                  >
                    <Text
                      style={[
                        styles.quickNavDotText,
                        isAnswered && styles.quickNavDotTextAnswered,
                        isCurrent && styles.quickNavDotTextCurrent,
                      ]}
                    >
                      {idx + 1}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 문제 지문 */}
            <View style={styles.questionCard}>
              <Text style={styles.questionIndexLabel}>Q{currentIndex + 1}.</Text>
              <Text style={styles.questionStem}>{q.stem}</Text>
            </View>

            {/* 4지선다 보기 (선택 마킹만, 정답 미노출) */}
            <View style={styles.optionsList}>
              {q.options.map((opt, idx) => {
                const isSelected = currentSelectedOptionId === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                    onPress={() => handleSelectOption(opt.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.optionIndexBadge, isSelected && styles.optionIndexBadgeSelected]}>
                      <Text style={[styles.optionIndexText, isSelected && styles.optionIndexTextSelected]}>
                        {idx + 1}
                      </Text>
                    </View>
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {opt.text}
                    </Text>
                    {isSelected && <Text style={styles.checkMark}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* 하단 내비게이션 및 제출 버튼 */}
          <View style={styles.examFooter}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <TouchableOpacity
                style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
                onPress={handlePrevQuestion}
                disabled={currentIndex === 0}
              >
                <Text style={[styles.navBtnText, currentIndex === 0 && styles.navBtnTextDisabled]}>
                  ◀ 이전
                </Text>
              </TouchableOpacity>

              {currentIndex < questions.length - 1 ? (
                <TouchableOpacity style={[styles.navBtn, styles.navBtnNext]} onPress={handleNextQuestion}>
                  <Text style={styles.navBtnNextText}>다음 문제 ▶</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.navBtn, styles.submitBtn]}
                  onPress={handleSubmitExam}
                  disabled={isSaving}
                >
                  <Text style={styles.submitBtnText}>
                    {isSaving ? '채점 중...' : '🎯 최종 제출 및 채점'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </>
      ) : (
        /* ============================================================ */
        /* 2. 최종 정답 및 종합 해설지 모드 (isSubmitted === true)       */
        /* ============================================================ */
        <ScrollView style={styles.examBody} contentContainerStyle={styles.reportContentContainer}>
          {/* 종합 성적 요약 카드 */}
          <View style={styles.reportScoreCard}>
            <View style={styles.reportScoreHeader}>
              <Text style={{ fontSize: 32 }}>{scorePercent >= 80 ? '🏆' : scorePercent >= 60 ? '🌿' : '🐣'}</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.reportScoreTitle}>
                  {scorePercent === 100 ? '완벽합니다! 100점 만점 🎉' : scorePercent >= 80 ? '훌륭한 성적입니다! 🌟' : '수고하셨습니다! 오답을 복습해 보세요 🌱'}
                </Text>
                <Text style={styles.reportScoreSub}>
                  맞힌 문제: <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>{correctCount}</Text> / {questions.length}문항 ({scorePercent}점)
                </Text>
              </View>
            </View>
            <Text style={styles.reportGuide}>
              틀린 문제의 원인과 정답 풀이를 아래에서 차례대로 꼼꼼히 확인해 보세요.
            </Text>
          </View>

          {/* 1번부터 끝번까지 문제 순서대로 나열하여 정답 및 해설 종합 제공 */}
          {questions.map((item, qIdx) => {
            const chosenId = userAnswers[qIdx] || '';
            const isQCorrect = chosenId === item.answerOptionId;
            const correctOpt = item.options.find((o) => o.id === item.answerOptionId);
            const chosenOpt = item.options.find((o) => o.id === chosenId);

            return (
              <View key={item.id} style={styles.reviewItemCard}>
                {/* 문항 헤더 */}
                <View style={styles.reviewItemHeader}>
                  <Text style={styles.reviewItemNumber}>문제 {qIdx + 1}번</Text>
                  <View style={[styles.resultBadge, isQCorrect ? styles.resultBadgeCorrect : styles.resultBadgeWrong]}>
                    <Text style={[styles.resultBadgeText, isQCorrect ? styles.resultBadgeTextCorrect : styles.resultBadgeTextWrong]}>
                      {isQCorrect ? '✅ 정답' : '❌ 오답'}
                    </Text>
                  </View>
                </View>

                {/* 지문 */}
                <Text style={styles.reviewStem}>{item.stem}</Text>

                {/* 4지선다 분석 목록 */}
                <View style={styles.reviewOptionsList}>
                  {item.options.map((opt, oIdx) => {
                    const isTheAnswer = opt.id === item.answerOptionId;
                    const isMyChoice = opt.id === chosenId;

                    let rowStyle = styles.reviewOptionRow;
                    if (isTheAnswer) {
                      rowStyle = { ...rowStyle, ...styles.reviewOptionRowCorrect };
                    } else if (isMyChoice && !isTheAnswer) {
                      rowStyle = { ...rowStyle, ...styles.reviewOptionRowWrong };
                    }

                    return (
                      <View key={opt.id} style={rowStyle}>
                        <View style={styles.reviewOptionTop}>
                          <Text style={styles.reviewOptionIndex}>{oIdx + 1}.</Text>
                          <Text style={[styles.reviewOptionText, isTheAnswer && styles.reviewOptionTextCorrect]}>
                            {opt.text}
                          </Text>
                          {isTheAnswer && (
                            <Text style={styles.correctTag}>[공식 정답]</Text>
                          )}
                          {isMyChoice && !isTheAnswer && (
                            <Text style={styles.myChoiceTag}>[내 선택]</Text>
                          )}
                        </View>
                        {opt.distractorRationale ? (
                          <Text style={styles.distractorRationaleText}>
                            ↳ 오답 이유: {opt.distractorRationale}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                {/* 1. 내가 왜 틀렸는지 확인하는 오답 분석 박스 (오답인 경우 집중 노출) */}
                {!isQCorrect && chosenOpt && (
                  <View style={styles.wrongAnalysisBox}>
                    <Text style={styles.wrongAnalysisTitle}>
                      ❌ 내가 선택한 오답 분석 (내 선택: {chosenOpt.text})
                    </Text>
                    <Text style={styles.wrongAnalysisText}>
                      {chosenOpt.distractorRationale || '문제의 핵심 조건이나 개념에 부합하지 않는 오답입니다.'}
                    </Text>
                  </View>
                )}

                {/* 2. 상세 문제 풀이 및 정답 해설 */}
                <View style={styles.explanationBox}>
                  <Text style={styles.explanationTitle}>💡 정답 및 문제 풀이</Text>
                  <Text style={styles.explanationText}>
                    {item.explanation
                      ? item.explanation
                          .replace(/\[출제\s*근거\s*팩트\s*:[^\]]*\]/gi, '')
                          .replace(/출제\s*근거\s*팩트\s*:[^\n]*/gi, '')
                          .trim()
                      : (correctOpt ? `${correctOpt.text}이(가) 올바른 정답입니다.` : '')}
                  </Text>
                </View>
              </View>
            );
          })}

          {/* 최종 복습 완료 버튼 */}
          <TouchableOpacity style={styles.finishReviewBtn} onPress={onExitExam}>
            <Text style={styles.finishReviewBtnText}>🎉 복습 완료 및 학습 맵으로 돌아가기</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* 우측 상단 수동 힌트 팝업 모달 */}
      <Modal visible={showHintModal} transparent animationType="fade" onRequestClose={() => setShowHintModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.hintModalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 24, marginRight: 8 }}>💡</Text>
              <Text style={styles.hintModalTitle}>문제 {currentIndex + 1}번 풀이 힌트</Text>
            </View>
            <Text style={styles.hintModalContent}>
              {q?.deepReasoningHint || q?.conceptDefinition || '핵심 원리와 표준 절차를 차근차근 떠올려보세요!'}
            </Text>
            <TouchableOpacity style={styles.closeHintBtn} onPress={() => setShowHintModal(false)}>
              <Text style={styles.closeHintBtnText}>닫고 문제 계속 풀기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  examContainer: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  examHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    padding: 6,
  },
  backButtonText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  examProgressText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold',
  },
  hintHeaderBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  hintHeaderBtnText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: 'bold',
  },
  examBody: {
    flex: 1,
  },
  examContentContainer: {
    padding: 18,
  },
  reportContentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  quickNavRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    justifyContent: 'center',
  },
  quickNavDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickNavDotAnswered: {
    backgroundColor: '#1e1b4b',
    borderColor: '#6366f1',
  },
  quickNavDotCurrent: {
    borderColor: '#38bdf8',
    borderWidth: 2,
  },
  quickNavDotText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
  },
  quickNavDotTextAnswered: {
    color: '#a5b4fc',
  },
  quickNavDotTextCurrent: {
    color: '#38bdf8',
    fontWeight: '900',
  },
  questionCard: {
    backgroundColor: '#131c31',
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  questionIndexLabel: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 6,
  },
  questionStem: {
    color: '#f8fafc',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  optionsList: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  optionButtonSelected: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  optionIndexBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionIndexBadgeSelected: {
    backgroundColor: '#38bdf8',
  },
  optionIndexText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  optionIndexTextSelected: {
    color: '#0f172a',
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
  },
  optionTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  checkMark: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  examFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#090d16',
  },
  navBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  navBtnText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: 'bold',
  },
  navBtnTextDisabled: {
    color: '#64748b',
  },
  navBtnNext: {
    backgroundColor: '#334155',
    borderColor: '#475569',
  },
  navBtnNextText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  submitBtn: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  // 종합 성적표 스타일
  reportScoreCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  reportScoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportScoreTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 4,
  },
  reportScoreSub: {
    fontSize: 14,
    color: '#cbd5e1',
  },
  reportGuide: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
  },
  reviewItemCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  reviewItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewItemNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#38bdf8',
  },
  resultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  resultBadgeCorrect: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  resultBadgeWrong: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  resultBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  resultBadgeTextCorrect: {
    color: '#34d399',
  },
  resultBadgeTextWrong: {
    color: '#f87171',
  },
  reviewStem: {
    fontSize: 15,
    color: '#f8fafc',
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 14,
  },
  reviewOptionsList: {
    gap: 8,
    marginBottom: 14,
  },
  reviewOptionRow: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  reviewOptionRowCorrect: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10b981',
  },
  reviewOptionRowWrong: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#ef4444',
  },
  reviewOptionTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewOptionIndex: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginRight: 6,
  },
  reviewOptionText: {
    flex: 1,
    fontSize: 13,
    color: '#cbd5e1',
  },
  reviewOptionTextCorrect: {
    color: '#a7f3d0',
    fontWeight: 'bold',
  },
  correctTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34d399',
    marginLeft: 6,
  },
  myChoiceTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#f87171',
    marginLeft: 6,
  },
  distractorRationaleText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
    paddingLeft: 16,
  },
  wrongAnalysisBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  wrongAnalysisTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#f87171',
    marginBottom: 4,
  },
  wrongAnalysisText: {
    fontSize: 12,
    color: '#fca5a5',
    lineHeight: 18,
  },
  explanationBox: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  explanationTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#818cf8',
    marginBottom: 4,
  },
  explanationText: {
    fontSize: 13,
    color: '#e2e8f0',
    lineHeight: 20,
  },
  finishReviewBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  finishReviewBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // 힌트 팝업 모달
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  hintModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  hintModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fbbf24',
  },
  hintModalContent: {
    fontSize: 13,
    color: '#f8fafc',
    lineHeight: 20,
    marginBottom: 16,
  },
  closeHintBtn: {
    backgroundColor: '#334155',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeHintBtnText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: 'bold',
  },
});

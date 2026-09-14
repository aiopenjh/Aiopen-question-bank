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
      <StatusBar barStyle="dark-content" />

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
                  맞힌 문제: <Text style={{ color: '#f43f5e', fontWeight: 'bold' }}>{correctCount}</Text> / {questions.length}문항 ({scorePercent}점)
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

                {/* 2. 오답 극복 핵심 개념 정리 (개념 고정 학습) */}
                {item.conceptDefinition ? (
                  <View style={styles.conceptBox}>
                    <Text style={styles.conceptBoxTitle}>📖 오답 극복 핵심 개념 정리</Text>
                    <Text style={styles.conceptBoxText}>{item.conceptDefinition}</Text>
                  </View>
                ) : null}

                {/* 3. 심화 원리 및 오답 방지 팁 */}
                {!isQCorrect && item.deepReasoningHint ? (
                  <View style={styles.hintBox}>
                    <Text style={styles.hintBoxTitle}>🔍 개념 고정 및 오답 방지 팁</Text>
                    <Text style={styles.hintBoxText}>{item.deepReasoningHint}</Text>
                  </View>
                ) : null}

                {/* 4. 상세 문제 풀이 및 정답 해설 */}
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
    backgroundColor: '#fff1f4',
  },
  examHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#fecdd3',
    backgroundColor: '#ffffff',
  },
  backButton: {
    padding: 6,
  },
  backButtonText: {
    color: '#be123c',
    fontSize: 13,
    fontWeight: 'bold',
  },
  examProgressText: {
    color: '#881337',
    fontSize: 15,
    fontWeight: 'bold',
  },
  hintHeaderBtn: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fda4af',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  hintHeaderBtnText: {
    color: '#e11d48',
    fontSize: 12,
    fontWeight: 'bold',
  },
  examBody: {
    flex: 1,
    backgroundColor: '#fff1f4',
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fecdd3',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  quickNavDotAnswered: {
    backgroundColor: '#fff1f2',
    borderColor: '#fda4af',
  },
  quickNavDotCurrent: {
    borderColor: '#f43f5e',
    borderWidth: 2,
    backgroundColor: '#ffe4e6',
  },
  quickNavDotText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '700',
  },
  quickNavDotTextAnswered: {
    color: '#e11d48',
  },
  quickNavDotTextCurrent: {
    color: '#881337',
    fontWeight: '900',
  },
  questionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#fecdd3',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  questionIndexLabel: {
    color: '#f43f5e',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 8,
  },
  questionStem: {
    color: '#1f2937',
    fontSize: 16,
    lineHeight: 25,
    fontWeight: '700',
  },
  optionsList: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#fecdd3',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  optionButtonSelected: {
    borderColor: '#f43f5e',
    backgroundColor: '#fff1f2',
    borderWidth: 2,
  },
  optionIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff5f7',
    borderWidth: 1,
    borderColor: '#fecdd3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionIndexBadgeSelected: {
    backgroundColor: '#f43f5e',
    borderColor: '#e11d48',
  },
  optionIndexText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: 'bold',
  },
  optionIndexTextSelected: {
    color: '#ffffff',
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
    lineHeight: 21,
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#881337',
    fontWeight: '700',
  },
  checkMark: {
    color: '#f43f5e',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  examFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#fecdd3',
    backgroundColor: '#ffffff',
  },
  navBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fda4af',
  },
  navBtnDisabled: {
    opacity: 0.35,
  },
  navBtnText: {
    color: '#be123c',
    fontSize: 14,
    fontWeight: 'bold',
  },
  navBtnTextDisabled: {
    color: '#94a3b8',
  },
  navBtnNext: {
    backgroundColor: '#f43f5e',
    borderColor: '#e11d48',
  },
  navBtnNextText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  submitBtn: {
    backgroundColor: '#f43f5e',
    borderColor: '#e11d48',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  // 종합 성적표 스타일
  reportScoreCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#fecdd3',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  reportScoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportScoreTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#881337',
    marginBottom: 4,
  },
  reportScoreSub: {
    fontSize: 14,
    color: '#475569',
  },
  reportGuide: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
    borderTopWidth: 1,
    borderTopColor: '#fecdd3',
    paddingTop: 10,
  },
  reviewItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#fecdd3',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  reviewItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reviewItemNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#881337',
  },
  resultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  resultBadgeCorrect: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  resultBadgeWrong: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  resultBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  resultBadgeTextCorrect: {
    color: '#059669',
  },
  resultBadgeTextWrong: {
    color: '#be123c',
  },
  reviewStem: {
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '600',
    lineHeight: 23,
    marginBottom: 14,
  },
  reviewOptionsList: {
    gap: 8,
    marginBottom: 14,
  },
  reviewOptionRow: {
    backgroundColor: '#fff5f7',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  reviewOptionRowCorrect: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  reviewOptionRowWrong: {
    backgroundColor: '#fff1f2',
    borderColor: '#f43f5e',
  },
  reviewOptionTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewOptionIndex: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
    marginRight: 6,
  },
  reviewOptionText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  reviewOptionTextCorrect: {
    color: '#065f46',
    fontWeight: 'bold',
  },
  correctTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    marginLeft: 6,
  },
  myChoiceTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#be123c',
    marginLeft: 6,
  },
  distractorRationaleText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    paddingLeft: 16,
  },
  wrongAnalysisBox: {
    backgroundColor: '#fff1f2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  wrongAnalysisTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#be123c',
    marginBottom: 4,
  },
  wrongAnalysisText: {
    fontSize: 12,
    color: '#881337',
    lineHeight: 18,
  },
  conceptBox: {
    backgroundColor: '#fff1f4',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  conceptBoxTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#be123c',
    marginBottom: 4,
  },
  conceptBoxText: {
    fontSize: 13,
    color: '#881337',
    lineHeight: 19,
  },
  hintBox: {
    backgroundColor: '#fff8f6',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  hintBoxTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#c2410c',
    marginBottom: 4,
  },
  hintBoxText: {
    fontSize: 13,
    color: '#7c2d12',
    lineHeight: 19,
  },
  explanationBox: {
    backgroundColor: '#fff5f7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  explanationTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#881337',
    marginBottom: 4,
  },
  explanationText: {
    fontSize: 13,
    color: '#1f2937',
    lineHeight: 20,
  },
  finishReviewBtn: {
    backgroundColor: '#f43f5e',
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  hintModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1.5,
    borderColor: '#fecdd3',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  hintModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#881337',
  },
  hintModalContent: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 18,
  },
  closeHintBtn: {
    backgroundColor: '#f43f5e',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeHintBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});

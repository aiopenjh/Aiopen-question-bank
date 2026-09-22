import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QuestionRevision } from '../../contracts/types';
import { showAlert } from '../../utils/alert';
import { styles } from './examStyles';
import { ExamActiveView } from './ExamActiveView';
import { ExamResultView } from './ExamResultView';
import { ExamHintModal } from './ExamHintModal';
import { ScratchpadPanel } from './ScratchpadPanel';

interface ExamSessionScreenProps {
  questions: QuestionRevision[];
  onExitExam: () => void;
  onCompleteExam: (
    results: Array<{ question: QuestionRevision; selectedOptionId: string; isCorrect: boolean }>
  ) => Promise<void>;
  onReinforceIncorrectConcepts?: () => Promise<void> | void;
}

export const ExamSessionScreen: React.FC<ExamSessionScreenProps> = ({
  questions,
  onExitExam,
  onCompleteExam,
  onReinforceIncorrectConcepts,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showHintModal, setShowHintModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showScratchpad, setShowScratchpad] = useState(false);

  if (!questions || questions.length === 0) return null;

  const q = questions[currentIndex];

  function handleSelectOption(optionId: string) {
    if (isSubmitted) return;
    setUserAnswers((prev) => ({
      ...prev,
      [currentIndex]: optionId,
    }));
  }

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

  function handlePrevQuestion() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }

  function handleNextQuestion() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }

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
          {!isSubmitted && (
            <>
              <TouchableOpacity
                style={styles.hintHeaderBtn}
                onPress={() => setShowScratchpad((prev) => !prev)}
              >
                <Text style={styles.hintHeaderBtnText}>📐 풀이공간</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.hintHeaderBtn}
                onPress={() => setShowHintModal(true)}
              >
                <Text style={styles.hintHeaderBtnText}>💡 힌트</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* 1. 실전 시험 모드 vs 2. 최종 정답/해설지 모드 */}
      {!isSubmitted ? (
        <ExamActiveView
          questions={questions}
          currentIndex={currentIndex}
          userAnswers={userAnswers}
          onSelectOption={handleSelectOption}
          onJumpToIndex={setCurrentIndex}
          onPrevQuestion={handlePrevQuestion}
          onNextQuestion={handleNextQuestion}
          onSubmitExam={handleSubmitExam}
          isSaving={isSaving}
        />
      ) : (
        <ExamResultView
          questions={questions}
          userAnswers={userAnswers}
          onExitExam={onExitExam}
          onReinforceIncorrectConcepts={onReinforceIncorrectConcepts}
        />
      )}

      {/* 힌트 모달 */}
      <ExamHintModal
        visible={showHintModal}
        onClose={() => setShowHintModal(false)}
        questionIndex={currentIndex}
        hintText={q?.deepReasoningHint}
        explanationText={q?.explanation}
      />

      {/* 풀이공간(Scratchpad) — 계산/풀이 보조용, 채점 미반영 */}
      {!isSubmitted && (
        <ScratchpadPanel visible={showScratchpad} onClose={() => setShowScratchpad(false)} />
      )}
    </SafeAreaView>
  );
};

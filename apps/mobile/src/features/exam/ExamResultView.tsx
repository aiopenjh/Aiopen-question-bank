import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { QuestionRevision } from '../../contracts/types';
import { styles } from './examStyles';
import { StateIllustration } from '../../components/common/StateIllustration';
import { CurrentReferenceNotice } from '../../components/common/CurrentReferenceNotice';

export interface ExamResultViewProps {
  questions: QuestionRevision[];
  userAnswers: Record<number, string>;
  onExitExam: () => void;
  onReinforceIncorrectConcepts?: (questions: QuestionRevision[]) => Promise<void> | void;
}

export const ExamResultView: React.FC<ExamResultViewProps> = ({
  questions,
  userAnswers,
  onExitExam,
  onReinforceIncorrectConcepts,
}) => {
  const correctCount = questions.filter(
    (item, idx) => userAnswers[idx] === item.answerOptionId
  ).length;
  const incorrectCount = questions.length - correctCount;
  const incorrectQuestions = questions.filter(
    (item, idx) => userAnswers[idx] !== item.answerOptionId
  );
  const scorePercent = Math.round((correctCount / questions.length) * 100);

  return (
    <ScrollView style={styles.examBody} contentContainerStyle={styles.reportContentContainer}>
      {/* 종합 성적 요약 카드 */}
      <View style={styles.reportScoreCard}>
        <View style={styles.reportScoreHeader}>
          <StateIllustration kind="reviewComplete" width={82} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.reportScoreTitle}>
              {scorePercent === 100
                ? '완벽합니다! 100점 만점 🎉'
                : scorePercent >= 80
                ? '훌륭한 성적입니다! 🌟'
                : '수고하셨습니다! 오답을 복습해 보세요 🌱'}
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

      {/* 문제별 정답 및 해설 종합 제공 */}
      {questions.map((item, qIdx) => {
        const chosenId = userAnswers[qIdx] || '';
        const isQCorrect = chosenId === item.answerOptionId;
        const chosenOpt = item.options.find((o) => o.id === chosenId);

        return (
          <View key={`${item.id}-${qIdx}`} style={styles.reviewItemCard}>
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

                return (
                  <View
                    key={opt.id}
                    style={[
                      styles.reviewOptionRow,
                      isTheAnswer && styles.reviewOptionRowCorrect,
                      isMyChoice && !isTheAnswer && styles.reviewOptionRowWrong,
                    ]}
                  >
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

            {/* 내가 왜 틀렸는지 확인하는 오답 분석 박스 */}
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

            {/* 오답 극복 핵심 개념 정리 */}
            {item.conceptDefinition ? (
              <View style={styles.conceptBox}>
                <Text style={styles.conceptBoxTitle}>📖 오답 극복 핵심 개념 정리</Text>
                <Text style={styles.conceptBoxText}>{item.conceptDefinition}</Text>
              </View>
            ) : null}

            {/* 정답 해설 및 도출 과정 */}
            <View style={styles.explanationBox}>
              <Text style={styles.explanationTitle}>💡 정답 해설 및 도출 과정</Text>
              <Text style={styles.explanationText}>
                {item.explanation
                  .replace(/\[출제\s*근거\s*팩트\s*:[^\]]*\]/gi, '')
                  .replace(/출제\s*근거\s*팩트\s*:[^\n]*/gi, '')
                  .trim()}
              </Text>
              <CurrentReferenceNotice reference={item.currentReference} />
            </View>
          </View>
        );
      })}

      {incorrectCount > 0 && onReinforceIncorrectConcepts ? (
        <TouchableOpacity
          style={styles.reinforceConceptBtn}
          onPress={() => onReinforceIncorrectConcepts(incorrectQuestions)}
          activeOpacity={0.82}
        >
          <Text style={styles.reinforceConceptBtnTitle}>틀린 {incorrectCount}문항 개념 보강</Text>
          <Text style={styles.reinforceConceptBtnText}>틀린 문제를 다시 풀며 핵심 개념을 확인합니다.</Text>
        </TouchableOpacity>
      ) : null}

      {/* 완료 버튼 */}
      <TouchableOpacity style={styles.finishReviewBtn} onPress={onExitExam}>
        <Text style={styles.finishReviewBtnText}>✨ 시험 복습 완료 및 학습 보관함으로 돌아가기</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

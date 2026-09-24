import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { AttemptCorrectionReason, QuestionRevision } from '../../contracts/types';
import { summarizeExamResults, ExamItemStatus } from '../../domain/exam_result_summary';
import { ATTEMPT_CORRECTION_REASONS, ATTEMPT_CORRECTION_REASON_LABELS } from '../../domain/attempt_outcome';
import { styles } from './examStyles';
import { StateIllustration } from '../../components/common/StateIllustration';
import { CurrentReferenceNotice } from '../../components/common/CurrentReferenceNotice';
import { colors } from '../../styles/designTokens';
import type { ExamAnswerResult } from './ExamSessionScreen';
import { MathText } from '../../components/common/MathText';
import { ReportQuestionButton } from './QuestionReportModal';

export interface ExamResultViewProps {
  questions: QuestionRevision[];
  userAnswers: Record<number, string>;
  results?: ExamAnswerResult[]; // short_answer/essay 채점 결과 포함 (없으면 multiple_choice 기준으로만 표시)
  /** 문항 번호(0부터) → 사용자 정정 사유 */
  corrections?: Record<number, AttemptCorrectionReason>;
  onCorrectResult?: (index: number, reason: AttemptCorrectionReason) => Promise<void> | void;
  onUndoCorrection?: (index: number) => Promise<void> | void;
  onExitExam: () => void;
  onReinforceIncorrectConcepts?: (questions: QuestionRevision[]) => Promise<void> | void;
  onReportQuestion?: (question: QuestionRevision) => void;
}

export const ExamResultView: React.FC<ExamResultViewProps> = ({
  questions,
  userAnswers,
  results,
  corrections = {},
  onCorrectResult,
  onUndoCorrection,
  onExitExam,
  onReinforceIncorrectConcepts,
  onReportQuestion,
}) => {
  const [reasonPickerIndex, setReasonPickerIndex] = useState<number | null>(null);
  const [correctionBusy, setCorrectionBusy] = useState(false);
  const summary = summarizeExamResults(questions, userAnswers, results, corrections);
  // 개념 보강 대상은 실제 오답(부분점수 포함)만. 채점 미완료·사용자 정정은 제외한다.
  const incorrectQuestions = questions.filter((_, idx) =>
    summary.statuses[idx] === 'incorrect' || summary.statuses[idx] === 'partial'
  );
  const incorrectCount = incorrectQuestions.length;
  const scorePercent = summary.scorePercent;
  const breakdown = [
    `정답 ${summary.correct}`,
    summary.corrected > 0 ? `정정 ${summary.corrected}` : null,
    `오답 ${summary.incorrect}`,
    summary.gradingFailed > 0 ? `채점 미완료 ${summary.gradingFailed}` : null,
  ].filter(Boolean).join(' · ');

  async function runCorrection(action: () => Promise<void> | void) {
    if (correctionBusy) return;
    setCorrectionBusy(true);
    try {
      await action();
    } finally {
      setCorrectionBusy(false);
      setReasonPickerIndex(null);
    }
  }

  return (
    <ScrollView style={styles.examBody} contentContainerStyle={styles.reportContentContainer}>
      {/* 종합 성적 요약 카드 */}
      <View style={styles.reportScoreCard}>
        <View style={styles.reportScoreHeader}>
          <StateIllustration kind="reviewComplete" width={82} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.reportScoreTitle}>
              {scorePercent === null
                ? '채점 가능한 문항이 없습니다'
                : scorePercent === 100
                ? '완벽합니다! 100점 만점 🎉'
                : scorePercent >= 80
                ? '훌륭한 성적입니다! 🌟'
                : '수고하셨습니다! 오답을 복습해 보세요 🌱'}
            </Text>
            {scorePercent === null ? (
              <Text style={styles.reportScoreSub}>
                전체 {questions.length}문항 채점 미완료 · 답안은 그대로 보관되어 있습니다.
              </Text>
            ) : (
              <>
                <Text style={styles.reportScoreSub}>
                  맞힌 문제: <Text style={{ color: '#f43f5e', fontWeight: 'bold' }}>{summary.correct + summary.corrected}</Text> / {summary.graded}문항 ({scorePercent}점)
                </Text>
                <Text style={styles.reportScoreBreakdown}>{breakdown}</Text>
                {summary.gradingFailed > 0 ? (
                  <Text style={styles.reportScoreBreakdown}>채점 미완료 문항은 오답이 아니며 점수 계산에서 제외했습니다.</Text>
                ) : null}
              </>
            )}
          </View>
        </View>
        <Text style={styles.reportGuide}>
          {scorePercent === null
            ? '모범답안과 해설을 확인한 뒤, 직접 정정할 수 있습니다.'
            : '틀린 문제의 원인과 정답 풀이를 아래에서 차례대로 꼼꼼히 확인해 보세요.'}
        </Text>
      </View>

      {/* 문제별 정답 및 해설 종합 제공 */}
      {questions.map((item, qIdx) => {
        const isCloze = item.questionType === 'cloze';
        const isSubjective = item.questionType === 'short_answer' || item.questionType === 'essay';
        const r = results?.[qIdx];
        const chosenId = userAnswers[qIdx] || '';
        const chosenOpt = item.options.find((o) => o.id === chosenId);

        const status: ExamItemStatus = summary.statuses[qIdx];
        const isQCorrect = status === 'correct';
        const isGradingFailed = isSubjective && r?.gradingStatus === 'failed'; // cloze는 로컬 채점이라 항상 성공
        const correctionReason = corrections[qIdx];
        const canCorrect = !!onCorrectResult &&
          (status === 'incorrect' || status === 'partial' || status === 'grading_failed');
        const badgeTone = status === 'correct' || status === 'corrected'
          ? 'correct'
          : status === 'grading_failed'
          ? 'neutral'
          : 'wrong';
        const badgeBoxStyle = badgeTone === 'correct'
          ? styles.resultBadgeCorrect
          : badgeTone === 'neutral'
          ? styles.resultBadgeNeutral
          : styles.resultBadgeWrong;
        const badgeTextStyle = badgeTone === 'correct'
          ? styles.resultBadgeTextCorrect
          : badgeTone === 'neutral'
          ? styles.resultBadgeTextNeutral
          : styles.resultBadgeTextWrong;
        const badgeLabel = {
          correct: '✅ 정답',
          corrected: '✅ 정정됨',
          partial: `🟡 부분점수 ${r?.gradingScore}점`,
          incorrect: '❌ 오답',
          grading_failed: '⚠️ 채점 미완료',
        }[status];

        return (
          <View key={`${item.id}-${qIdx}`} style={styles.reviewItemCard}>
            {/* 문항 헤더 */}
            <View style={styles.reviewItemHeader}>
              <Text style={styles.reviewItemNumber}>문제 {qIdx + 1}번</Text>
              <View style={[styles.resultBadge, badgeBoxStyle]}>
                <Text style={[styles.resultBadgeText, badgeTextStyle]}>{badgeLabel}</Text>
              </View>
            </View>

            {/* 지문 */}
            <MathText style={styles.reviewStem} text={item.stem} />

            {isCloze ? (
              <View style={{ gap: 8 }}>
                {(item.clozeBlanks || []).map((blank, bIdx) => {
                  const submitted = r?.clozeAnswers?.[bIdx] || '';
                  const met = r?.gradingChecklistResult?.find((cr) => cr.id === blank.id)?.met;
                  return (
                    <View key={blank.id} style={styles.reviewOptionRow}>
                      <Text style={{ fontSize: 13, color: met ? colors.mint : colors.danger, fontWeight: '700' }}>
                        {met ? '✓' : '✗'} {bIdx + 1}번 빈칸
                      </Text>
                      <Text style={styles.reviewOptionText}>내 답안: {submitted || '(답안 없음)'}</Text>
                      {!met && (
                        <Text style={styles.wrongAnalysisText}>정답: {blank.correctAnswers.join(' / ')}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : isSubjective ? (
              <View style={{ gap: 10 }}>
                <View style={styles.reviewOptionRow}>
                  <Text style={styles.wrongAnalysisTitle}>✍️ 내 답안</Text>
                  <Text style={styles.reviewOptionText}>{r?.answerText || '(답안 없음)'}</Text>
                </View>
                {isGradingFailed ? (
                  <View style={styles.wrongAnalysisBox}>
                    <Text style={styles.wrongAnalysisTitle}>⚠️ 채점 미완료</Text>
                    <Text style={styles.wrongAnalysisText}>
                      {r?.gradingFailedReason || 'AI 채점 요청이 실패했습니다.'} 답안은 그대로 보관되어 있습니다. 모범답안과 해설을 확인한 뒤 직접 정정할 수 있습니다.
                    </Text>
                  </View>
                ) : (
                  <>
                    {item.questionType === 'essay' && item.gradingChecklist && r?.gradingChecklistResult && (
                      <View style={{ gap: 4 }}>
                        {item.gradingChecklist.map((c) => {
                          const met = r.gradingChecklistResult?.find((cr) => cr.id === c.id)?.met;
                          return (
                            <Text key={c.id} style={{ fontSize: 13, color: met ? colors.mint : colors.danger }}>
                              {met ? '✓' : '✗'} {c.criterion} ({c.points}점)
                            </Text>
                          );
                        })}
                      </View>
                    )}
                  </>
                )}
              </View>
            ) : (
              <>
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
                          <MathText
                            style={[styles.reviewOptionText, isTheAnswer && styles.reviewOptionTextCorrect]}
                            text={opt.text}
                          />
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
              </>
            )}

            {/* 오답 극복 핵심 개념 정리 */}
            {item.conceptDefinition ? (
              <View style={styles.conceptBox}>
                <Text style={styles.conceptBoxTitle}>📖 오답 극복 핵심 개념 정리</Text>
                <Text style={styles.conceptBoxText}>{item.conceptDefinition}</Text>
              </View>
            ) : null}

            {/* 모범답안(주관식) + 정답 해설 및 도출 과정: 별도 카드로 나누지 않고 한 곳에 합쳐서
                모범답안 한 단어와 해설 문장이 서로 다른 박스에서 같은 내용을 반복하는 느낌을 없앤다. */}
            <View style={styles.explanationBox}>
              <Text style={styles.explanationTitle}>
                {item.modelAnswer ? '💡 모범답안 및 해설' : '💡 정답 해설 및 도출 과정'}
              </Text>
              {item.modelAnswer && !isGradingFailed ? (
                <Text style={[styles.explanationText, { fontWeight: '800', marginBottom: 4 }]}>
                  {item.modelAnswer}
                </Text>
              ) : null}
              <MathText
                style={styles.explanationText}
                text={item.explanation
                  .replace(/\[출제\s*근거\s*팩트\s*:[^\]]*\]/gi, '')
                  .replace(/출제\s*근거\s*팩트\s*:[^\n]*/gi, '')
                  .trim()}
              />
              <CurrentReferenceNotice reference={item.currentReference} />
              {onReportQuestion ? <ReportQuestionButton onPress={() => onReportQuestion(item)} /> : null}
            </View>

            {/* 사용자 정정: 원래 채점은 보존하고 이 화면·오답노트·복습 일정에만 반영 */}
            {status === 'corrected' && correctionReason ? (
              <View style={styles.correctionBox}>
                <Text style={styles.correctionTitle}>
                  ✅ 사용자 정정 · {ATTEMPT_CORRECTION_REASON_LABELS[correctionReason]}
                </Text>
                <Text style={styles.correctionText}>
                  원래 채점 결과와 공식 정답은 그대로 보관됩니다. 오답노트와 복습 일정에만 정답으로 반영되며, 레벨 31 이상 도전 통과와 랭킹에는 반영되지 않습니다.
                </Text>
                {onUndoCorrection ? (
                  <TouchableOpacity
                    style={styles.correctionSecondaryBtn}
                    disabled={correctionBusy}
                    onPress={() => runCorrection(() => onUndoCorrection(qIdx))}
                  >
                    <Text style={styles.correctionSecondaryBtnText}>정정 취소</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : canCorrect && reasonPickerIndex === qIdx ? (
              <View style={styles.correctionBox}>
                <Text style={styles.correctionTitle}>정답으로 정정하는 이유를 골라 주세요</Text>
                <Text style={styles.correctionText}>
                  AI 채점과 공식 정답은 그대로 보관됩니다. 정정 결과는 오답노트와 복습 일정에만 반영되고, 레벨 31 이상 도전 통과와 랭킹에는 반영되지 않습니다. 문제 내용은 외부로 전송되지 않습니다.
                </Text>
                {ATTEMPT_CORRECTION_REASONS.map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={styles.correctionReasonBtn}
                    disabled={correctionBusy}
                    onPress={() => runCorrection(() => onCorrectResult!(qIdx, reason))}
                  >
                    <Text style={styles.correctionReasonBtnText}>{ATTEMPT_CORRECTION_REASON_LABELS[reason]}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.correctionSecondaryBtn}
                  disabled={correctionBusy}
                  onPress={() => setReasonPickerIndex(null)}
                >
                  <Text style={styles.correctionSecondaryBtnText}>취소</Text>
                </TouchableOpacity>
              </View>
            ) : canCorrect ? (
              <TouchableOpacity
                style={styles.correctionSecondaryBtn}
                disabled={correctionBusy}
                onPress={() => setReasonPickerIndex(qIdx)}
              >
                <Text style={styles.correctionSecondaryBtnText}>내 답도 정답으로 정정</Text>
              </TouchableOpacity>
            ) : null}
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

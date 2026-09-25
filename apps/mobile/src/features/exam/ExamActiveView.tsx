import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Keyboard, Platform } from 'react-native';
import { QuestionRevision } from '../../contracts/types';
import { styles } from './examStyles';
import { colors } from '../../styles/designTokens';
import { MathText } from '../../components/common/MathText';

export interface ExamActiveViewProps {
  questions: QuestionRevision[];
  currentIndex: number;
  userAnswers: Record<number, string>;
  userClozeAnswers: Record<number, string[]>;
  onSelectOption: (optionId: string) => void;
  onAnswerTextChange: (text: string) => void;
  onClozeAnswerChange: (blankIndex: number, text: string) => void;
  onJumpToIndex: (index: number) => void;
  onPrevQuestion: () => void;
  onNextQuestion: () => void;
  onSubmitExam: () => void;
  isSaving: boolean;
}

// cloze 지문의 {{1}},{{2}}... 마커를 읽기 좋은 빈칸 표시로 바꿔서 보여준다(입력은 아래 별도 칸에서).
function renderClozeStemPreview(stem: string): string {
  return stem.replace(/\{\{(\d+)\}\}/g, (_match, n) => `( ${n} )`);
}

// 빈칸형 입력 전 안내. 저장된 정답 목록은 노출하지 않고 채점 기준만 알린다. 모든 빈칸형에 동일 적용.
export const CLOZE_ABBREVIATION_NOTICE = '정식 명칭으로 입력하세요. 약어는 정답으로 등록된 경우에만 인정됩니다.';

export const ExamActiveView: React.FC<ExamActiveViewProps> = ({
  questions,
  currentIndex,
  userAnswers,
  userClozeAnswers,
  onSelectOption,
  onAnswerTextChange,
  onClozeAnswerChange,
  onJumpToIndex,
  onPrevQuestion,
  onNextQuestion,
  onSubmitExam,
  isSaving,
}) => {
  const q = questions[currentIndex];
  const currentSelectedOptionId = userAnswers[currentIndex] || null;
  const currentClozeAnswers = userClozeAnswers[currentIndex] || [];
  const bodyRef = useRef<ScrollView>(null);
  const focusedInputRef = useRef<unknown>(null);

  function revealFocusedInput(node: unknown) {
    bodyRef.current?.scrollResponderScrollNativeHandleToKeyboard(node, 24, true);
  }

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      if (focusedInputRef.current !== null) revealFocusedInput(focusedInputRef.current);
    });
    return () => subscription.remove();
  }, []);

  function handleAnswerFocus(node: unknown) {
    focusedInputRef.current = node;
    if (Platform.OS === 'android') revealFocusedInput(node);
  }

  return (
    <>
      <ScrollView ref={bodyRef} style={styles.examBody} contentContainerStyle={styles.examContentContainer} keyboardShouldPersistTaps="handled">
        {/* 문제 번호 및 마킹 상태 바 */}
        <View style={styles.quickNavRow}>
          {questions.map((_, idx) => {
            const isCurrent = currentIndex === idx;
            const isAnswered =
              questions[idx].questionType === 'cloze'
                ? (userClozeAnswers[idx] || []).some((a) => (a || '').trim().length > 0)
                : !!userAnswers[idx];
            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.quickNavDot,
                  isAnswered && styles.quickNavDotAnswered,
                  isCurrent && styles.quickNavDotCurrent,
                ]}
                onPress={() => onJumpToIndex(idx)}
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
          <MathText
            style={styles.questionStem}
            text={q.questionType === 'cloze' ? renderClozeStemPreview(q.stem) : q.stem}
          />
        </View>

        {/* 4지선다 보기 (선택 마킹만, 정답 미노출) */}
        {q.questionType === 'multiple_choice' ? (
          <View style={styles.optionsList}>
            {q.options.map((opt, idx) => {
              const isSelected = currentSelectedOptionId === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                  onPress={() => onSelectOption(opt.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.optionIndexBadge, isSelected && styles.optionIndexBadgeSelected]}>
                    <Text style={[styles.optionIndexText, isSelected && styles.optionIndexTextSelected]}>
                      {idx + 1}
                    </Text>
                  </View>
                  <MathText
                    style={[styles.optionText, isSelected && styles.optionTextSelected]}
                    text={opt.text}
                  />
                  {isSelected && <Text style={styles.checkMark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : q.questionType === 'cloze' ? (
          // 빈칸형: 지문 안의 {{N}} 순서대로 빈칸마다 별도 입력칸. fontSize 16 고정(Law #6/#7)
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 13, color: colors.inkMuted }}>{CLOZE_ABBREVIATION_NOTICE}</Text>
            {(q.clozeBlanks || []).map((blank, idx) => (
              <View key={blank.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.optionIndexBadge}>
                  <Text style={styles.optionIndexText}>{idx + 1}</Text>
                </View>
                <TextInput
                  style={[
                    {
                      flex: 1,
                      minHeight: 48,
                      borderWidth: 1.5,
                      borderColor: colors.border,
                      borderRadius: 14,
                      padding: 14,
                      color: colors.ink,
                      backgroundColor: colors.surface,
                    },
                    styles.answerInputText,
                  ]}
                  placeholder={`${idx + 1}번 빈칸 답안`}
                  onFocus={(event) => handleAnswerFocus(event.target)}
                  value={currentClozeAnswers[idx] || ''}
                  onChangeText={(text) => onClozeAnswerChange(idx, text)}
                />
              </View>
            ))}
          </View>
        ) : (
          // 주관식(단답형/서술형): 자유 텍스트 입력. fontSize 16 고정(Law #6, 모바일 확대 방지)
          <View>
            <TextInput
              style={[
                {
                  minHeight: q.questionType === 'essay' ? 160 : 60,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  borderRadius: 14,
                  padding: 16,
                  color: colors.ink,
                  backgroundColor: colors.surface,
                  textAlignVertical: 'top',
                },
                styles.answerInputText,
              ]}
              multiline
              maxLength={q.maxAnswerLength || 2000}
              placeholder={q.questionType === 'essay' ? '서술형 답안을 입력하세요 (최대 2,000자)' : '단답형 답안을 입력하세요'}
              onFocus={(event) => handleAnswerFocus(event.target)}
              value={currentSelectedOptionId || ''}
              onChangeText={onAnswerTextChange}
            />
            {q.questionType === 'essay' && (
              <Text style={{ marginTop: 6, fontSize: 12, color: colors.inkMuted, textAlign: 'right' }}>
                {(currentSelectedOptionId || '').length} / {q.maxAnswerLength || 2000}자
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* 하단 내비게이션 및 제출 버튼 */}
      <View style={styles.examFooter}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <TouchableOpacity
            style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
            onPress={onPrevQuestion}
            disabled={currentIndex === 0}
          >
            <Text style={[styles.navBtnText, currentIndex === 0 && styles.navBtnTextDisabled]}>
              ◀ 이전
            </Text>
          </TouchableOpacity>

          {currentIndex < questions.length - 1 ? (
            <TouchableOpacity style={[styles.navBtn, styles.navBtnNext]} onPress={onNextQuestion}>
              <Text style={styles.navBtnNextText}>다음 문제 ▶</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navBtn, styles.submitBtn]}
              onPress={onSubmitExam}
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
  );
};

import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { QuestionRevision } from '../../contracts/types';
import { styles } from './libraryStyles';

export interface UnassignedQuestionsCardProps {
  questions: QuestionRevision[];
  onStartExamWithQuestions: (questions: QuestionRevision[]) => void;
  onDeleteQuestion?: (questionId: string) => Promise<void>;
}

export const UnassignedQuestionsCard: React.FC<UnassignedQuestionsCardProps> = ({
  questions,
  onStartExamWithQuestions,
  onDeleteQuestion,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedQuestionDetailId, setExpandedQuestionDetailId] = useState<string | null>(null);

  if (questions.length === 0) return null;

  return (
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
            AI 즉시 문제 출제로 생성된 문제 {questions.length}문항
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.toggleAccordionBtn, isExpanded && styles.toggleAccordionBtnActive]}
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <Text style={styles.toggleAccordionText}>
            {isExpanded ? '접기 ▲' : '열기 ▼'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.topicExamBtn}
        onPress={() => onStartExamWithQuestions(questions)}
      >
        <Text style={styles.topicExamBtnText}>
          🚀 자유 출제 전체 {questions.length}문제 CBT 시험 응시
        </Text>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.unitQuestionsContainer}>
          {questions.map((q, qIdx) => {
            const isDetailOpen = expandedQuestionDetailId === q.id;
            return (
              <View key={`${q.id}-${qIdx}`} style={styles.questionItemCard}>
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
                  onPress={() => setExpandedQuestionDetailId(isDetailOpen ? null : q.id)}
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
  );
};

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Source, QuestionRevision, Topic } from '../../contracts/types';

interface LibraryScreenProps {
  questions: QuestionRevision[];
  topics: Topic[];
  sources: Source[];
  sourceTitle: string;
  onChangeSourceTitle: (text: string) => void;
  sourceText: string;
  onChangeSourceText: (text: string) => void;
  onSaveSource: () => Promise<void>;
  onStartExamWithQuestions: (questions: QuestionRevision[]) => void;
  onDeleteQuestion?: (questionId: string) => Promise<void>;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  questions,
  topics,
  sources,
  sourceTitle,
  onChangeSourceTitle,
  sourceText,
  onChangeSourceText,
  onSaveSource,
  onStartExamWithQuestions,
  onDeleteQuestion,
}) => {
  const [selectedFilterTopicId, setSelectedFilterTopicId] = useState<string>('all');
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  // 주제별 필터링된 문제 목록
  const filteredQuestions =
    selectedFilterTopicId === 'all'
      ? questions
      : questions.filter((q) => q.topicId === selectedFilterTopicId);

  const getTopicName = (topicId?: string) => {
    if (!topicId) return '자유 학습';
    const found = topics.find((t) => t.id === topicId);
    return found ? found.name : '학습 주제';
  };

  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding}>
      {/* 1. AI 생성 문제 보관함 (문제 은행 / 시험지 아카이브) */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardSectionTitle}>
            📝 AI 출제 문제 보관함 (총 {questions.length}문항)
          </Text>
        </View>
        <Text style={styles.promptGuideText}>
          지금까지 출제된 모든 AI 문제가 안전하게 보관되어 있습니다. 언제든 원하는 과목을 골라 다시 시험을 볼 수 있습니다.
        </Text>

        {/* 과목 필터 탭 바 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedFilterTopicId === 'all' && styles.filterChipActive,
            ]}
            onPress={() => setSelectedFilterTopicId('all')}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedFilterTopicId === 'all' && styles.filterChipTextActive,
              ]}
            >
              전체 ({questions.length})
            </Text>
          </TouchableOpacity>

          {topics.map((t) => {
            const count = questions.filter((q) => q.topicId === t.id).length;
            const isActive = selectedFilterTopicId === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setSelectedFilterTopicId(t.id)}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {t.name} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 즉시 CBT 시험 풀기 액션 바 */}
        {filteredQuestions.length > 0 ? (
          <TouchableOpacity
            style={styles.primaryActionButton}
            onPress={() => onStartExamWithQuestions(filteredQuestions)}
          >
            <Text style={styles.primaryActionText}>
              🚀 {selectedFilterTopicId === 'all' ? '보관된 전체' : `[${getTopicName(selectedFilterTopicId)}]`}{' '}
              {filteredQuestions.length}문제 CBT 시험 풀기
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* 문제 목록 */}
        {filteredQuestions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 28, marginBottom: 8 }}>📭</Text>
            <Text style={styles.emptyText}>보관된 문제가 없습니다.</Text>
            <Text style={styles.emptySubText}>
              [🏠 학습 홈]에서 원하는 개념이나 주제를 입력하면 문제가 자동으로 이곳에 저장됩니다.
            </Text>
          </View>
        ) : (
          <View style={styles.questionsContainer}>
            {filteredQuestions.map((q, idx) => {
              const isExpanded = expandedQuestionId === q.id;
              const topicName = getTopicName(q.topicId);

              return (
                <View key={q.id} style={styles.questionCard}>
                  {/* 카드 헤더 */}
                  <View style={styles.questionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Text style={styles.questionBadge}>{topicName}</Text>
                      <Text style={styles.questionNumberText}>문제 {idx + 1}</Text>
                    </View>
                    {onDeleteQuestion && (
                      <TouchableOpacity
                        onPress={() => onDeleteQuestion(q.id)}
                        style={styles.deleteSmallBtn}
                      >
                        <Text style={styles.deleteSmallText}>삭제</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* 지문 */}
                  <Text style={styles.stemText}>{q.stem}</Text>

                  {/* 보기 목록 토글/미리보기 */}
                  <TouchableOpacity
                    style={styles.toggleDetailBtn}
                    onPress={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                  >
                    <Text style={styles.toggleDetailText}>
                      {isExpanded ? '▲ 정답 및 해설 접기' : '▼ 4지선다 보기 및 정답·해설 확인하기'}
                    </Text>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.detailBox}>
                      {/* 4지선다 */}
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
                              <View style={styles.optionTop}>
                                <Text style={[styles.optionIndex, isAnswer && styles.optionIndexCorrect]}>
                                  {oIdx + 1}.
                                </Text>
                                <Text style={[styles.optionText, isAnswer && styles.optionTextCorrect]}>
                                  {opt.text}
                                </Text>
                                {isAnswer && <Text style={styles.correctBadge}>[공식 정답]</Text>}
                              </View>
                              {opt.distractorRationale ? (
                                <Text style={styles.distractorText}>
                                  ↳ 오답 분석: {opt.distractorRationale}
                                </Text>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>

                      {/* 1줄 개념 정의 */}
                      {q.conceptDefinition ? (
                        <View style={styles.definitionBox}>
                          <Text style={styles.definitionTitle}>📌 1줄 핵심 개념 정의:</Text>
                          <Text style={styles.definitionText}>{q.conceptDefinition}</Text>
                        </View>
                      ) : null}

                      {/* 정답 해설 및 근거 */}
                      {q.explanation ? (
                        <View style={styles.explanationBox}>
                          <Text style={styles.explanationTitle}>📖 정답 해설 및 출제 근거:</Text>
                          <Text style={styles.explanationText}>{q.explanation}</Text>
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

      {/* 2. 교재 및 텍스트 자료 등록 카드 */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>📖 내 교재 및 텍스트 발췌 등록</Text>
        <View style={styles.capabilityBadgeReady}>
          <Text style={styles.capabilityBadgeReadyText}>🟢 로컬 즉시 사용 가능 (오프라인 100% 안전)</Text>
        </View>
        <Text style={styles.promptGuideText}>
          가지고 계신 교재의 본문이나 강의 요약 텍스트를 등록해 두시면 영구적인 출제 근거 팩트로 활용됩니다.
        </Text>

        <TextInput
          style={styles.inputField}
          placeholder="자료 제목 (예: 초등 3학년 1학기 수학 핵심 요약)"
          placeholderTextColor="#94a3b8"
          value={sourceTitle}
          onChangeText={onChangeSourceTitle}
        />

        <TextInput
          style={[styles.inputField, { height: 110 }]}
          placeholder="교재 발췌문 또는 요약 텍스트를 붙여넣으세요..."
          placeholderTextColor="#94a3b8"
          multiline
          value={sourceText}
          onChangeText={onChangeSourceText}
        />

        <TouchableOpacity style={styles.primaryActionButton} onPress={onSaveSource}>
          <Text style={styles.primaryActionText}>💾 자료함에 안전하게 저장하기</Text>
        </TouchableOpacity>

        {/* 보관된 자료 목록 */}
        {sources.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.cardSectionTitle, { fontSize: 13, color: '#94a3b8' }]}>
              등록된 교재 문서 ({sources.length}건)
            </Text>
            {sources.map((s) => (
              <View key={s.id} style={styles.sourceItemRow}>
                <Text style={styles.sourceItemIcon}>📄</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sourceItemTitle}>{s.title}</Text>
                  <Text style={styles.sourceItemDate}>{s.createdAt.slice(0, 10)} 등록</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  tabContent: {
    flex: 1,
  },
  scrollPadding: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
    letterSpacing: -0.3,
  },
  promptGuideText: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 19,
    marginBottom: 12,
  },
  filterScroll: {
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#312e81',
    borderColor: '#6366f1',
  },
  filterChipText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  primaryActionButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 10,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 4,
  },
  emptySubText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
  },
  questionsContainer: {
    marginTop: 6,
    gap: 12,
  },
  questionCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionBadge: {
    backgroundColor: '#1e293b',
    color: '#818cf8',
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4338ca',
  },
  questionNumberText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#cbd5e1',
  },
  deleteSmallBtn: {
    backgroundColor: '#450a0a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deleteSmallText: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '600',
  },
  stemText: {
    fontSize: 14,
    color: '#f8fafc',
    lineHeight: 21,
    fontWeight: '600',
    marginBottom: 10,
  },
  toggleDetailBtn: {
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  toggleDetailText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  detailBox: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
  },
  optionsList: {
    gap: 6,
    marginBottom: 10,
  },
  optionRow: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  optionRowCorrect: {
    backgroundColor: '#064e3b',
    borderColor: '#059669',
  },
  optionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionIndex: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  optionIndexCorrect: {
    color: '#a7f3d0',
  },
  optionText: {
    flex: 1,
    fontSize: 13,
    color: '#cbd5e1',
  },
  optionTextCorrect: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  correctBadge: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: 'bold',
  },
  distractorText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
    paddingLeft: 16,
    lineHeight: 16,
  },
  definitionBox: {
    backgroundColor: '#1e1b4b',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#4338ca',
    marginBottom: 8,
  },
  definitionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#a5b4fc',
    marginBottom: 4,
  },
  definitionText: {
    fontSize: 12,
    color: '#e0e7ff',
    lineHeight: 18,
  },
  explanationBox: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#475569',
  },
  explanationTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#cbd5e1',
    marginBottom: 4,
  },
  explanationText: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
  },
  capabilityBadgeReady: {
    backgroundColor: '#064e3b',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  capabilityBadgeReadyText: {
    color: '#a7f3d0',
    fontSize: 11,
    fontWeight: 'bold',
  },
  inputField: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  sourceItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  sourceItemIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  sourceItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f8fafc',
  },
  sourceItemDate: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
});

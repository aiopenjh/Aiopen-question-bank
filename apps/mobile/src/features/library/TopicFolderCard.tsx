import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Topic, Unit, QuestionRevision } from '../../contracts/types';
import { styles } from './libraryStyles';

export interface TopicFolderCardProps {
  topic: Topic;
  units: Unit[];
  questions: QuestionRevision[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onStartExamWithQuestions: (questions: QuestionRevision[]) => void;
  onGenerateCurriculumForTopic: (topicId: string, topicName: string) => Promise<void>;
  onDeduplicateUnits?: (topicId: string) => Promise<void>;
  onDeleteTopic: (topicId: string, topicName: string) => void;
  onDeleteUnit: (unitId: string) => Promise<void>;
  onUnitPress: (topic: Topic, unit: Unit) => void;
  isAiGenerating?: boolean;
  generatingUnitId?: string | null;
}

export const TopicFolderCard: React.FC<TopicFolderCardProps> = ({
  topic,
  units,
  questions,
  isExpanded,
  onToggleExpand,
  onStartExamWithQuestions,
  onGenerateCurriculumForTopic,
  onDeduplicateUnits,
  onDeleteTopic,
  onDeleteUnit,
  onUnitPress,
  isAiGenerating,
  generatingUnitId,
}) => {
  const topicUnits = units.filter((u) => u.topicId === topic.id);
  const topicQuestions = questions.filter((q) => q.topicId === topic.id);
  const hasDuplicates = new Set(topicUnits.map((u) => u.title.trim())).size < topicUnits.length;

  return (
    <View style={styles.topicHouseCard}>
      {/* 토픽 헤더 */}
      <View style={styles.topicHouseHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Text style={styles.categoryBadge}>{topic.category || '📚 일반'}</Text>
            <Text style={styles.topicHouseTitle}>{topic.name}</Text>
          </View>
          <Text style={styles.topicHouseSub}>
            단원 {topicUnits.length}개 · 보관된 문제 {topicQuestions.length}문항
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.toggleAccordionBtn, isExpanded && styles.toggleAccordionBtnActive]}
          onPress={onToggleExpand}
        >
          <Text style={styles.toggleAccordionText}>
            {isExpanded ? '접기 ▲' : '열기 ▼'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 과목 전체 즉시 CBT 버튼 */}
      {topicQuestions.length > 0 && (
        <TouchableOpacity
          style={styles.topicExamBtn}
          onPress={() => onStartExamWithQuestions(topicQuestions)}
        >
          <Text style={styles.topicExamBtnText}>
            🚀 [{topic.name}] 전체 {topicQuestions.length}문제 CBT 시험 응시
          </Text>
        </TouchableOpacity>
      )}

      {/* 펼쳤을 때: 커리큘럼 단원 및 단원별 문제집 */}
      {isExpanded && (
        <View style={styles.topicExpandedBody}>
          {/* 조작 버튼 바 */}
          <View style={styles.topicActionRow}>
            <TouchableOpacity
              style={[
                styles.actionPillBtn,
                isAiGenerating && { opacity: 0.7, backgroundColor: '#ffe4e6', borderColor: '#f43f5e' },
              ]}
              onPress={() => {
                if (isAiGenerating) return;
                onGenerateCurriculumForTopic(topic.id, topic.name);
              }}
              disabled={isAiGenerating}
              activeOpacity={0.7}
            >
              {isAiGenerating ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ActivityIndicator size="small" color="#e11d48" />
                  <Text style={[styles.actionPillText, { color: '#e11d48', fontWeight: 'bold' }]}>
                    ⏳ 목차 설계 중...
                  </Text>
                </View>
              ) : (
                <Text style={styles.actionPillText}>✨ AI 5단계 목차 생성</Text>
              )}
            </TouchableOpacity>
            {hasDuplicates && onDeduplicateUnits && (
              <TouchableOpacity
                style={[styles.actionPillBtn, { borderColor: '#ef4444' }]}
                onPress={() => onDeduplicateUnits(topic.id)}
              >
                <Text style={[styles.actionPillText, { color: '#fca5a5' }]}>🧹 중복 정리</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionPillBtn, { borderColor: '#fca5a5', backgroundColor: '#fff1f2' }]}
              onPress={() => onDeleteTopic(topic.id, topic.name)}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionPillText, { color: '#e11d48', fontWeight: 'bold' }]}>
                🗑️ 과목 전체 삭제
              </Text>
            </TouchableOpacity>
          </View>

          {/* 단원 목록 */}
          {topicUnits.length === 0 ? (
            <View style={styles.emptyUnitCard}>
              <Text style={styles.emptyUnitTitle}>등록된 단원이 없습니다.</Text>
              <Text style={styles.emptyUnitDesc}>
                [✨ AI 5단계 목차 생성]을 누르시면 공인 표준 5단계 목차가 자동 설계됩니다.
              </Text>
            </View>
          ) : (
            topicUnits.map((unit) => {
              const unitQuestions = questions.filter(
                (q) => q.topicId === topic.id && (q.unitId === unit.id || q.stem.includes(unit.title))
              );
              const isThisUnitGenerating = generatingUnitId === unit.id;

              return (
                <View key={unit.id} style={styles.unitHouseRow}>
                  {/* 상단: 단원 명칭 + 우측 삭제 아이콘 */}
                  <View style={styles.unitHeaderRow}>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => onUnitPress(topic, unit)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.unitTitleText}>
                        {unit.title}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => onDeleteUnit(unit.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={styles.unitDeleteTouch}
                    >
                      <Text style={styles.unitDeleteIcon}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 하단: 보관 문항 수 + 우측 [출제/풀기] 버튼 */}
                  <View style={styles.unitFooterRow}>
                    <Text style={styles.unitQuestionCountText}>
                      {unitQuestions.length > 0 ? `📚 보관된 문제: ${unitQuestions.length}문항` : '⚡ 출제 대기'}
                    </Text>

                    <TouchableOpacity
                      style={styles.unitQuizBtn}
                      onPress={() => onUnitPress(topic, unit)}
                      disabled={isAiGenerating}
                      activeOpacity={0.8}
                    >
                      {isThisUnitGenerating ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.unitQuizBtnText}>⚡ 출제 / 풀기</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}
    </View>
  );
};

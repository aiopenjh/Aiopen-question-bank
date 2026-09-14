import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Topic, QuestionRevision } from '../../contracts/types';

interface TopicSelectModalProps {
  visible: boolean;
  topics: Topic[];
  questions: QuestionRevision[];
  lastStudiedTopicId?: string | null;
  onSelectTopic: (topic: Topic) => void;
  onClose: () => void;
  onOpenLibrary?: () => void;
}

export const TopicSelectModal: React.FC<TopicSelectModalProps> = ({
  visible,
  topics,
  questions,
  lastStudiedTopicId,
  onSelectTopic,
  onClose,
  onOpenLibrary,
}) => {
  const [showAll, setShowAll] = useState(false);

  // 최근 학습한 대단원이 맨 위에 오도록 정렬
  const sortedTopics = [...topics].sort((a, b) => {
    if (a.id === lastStudiedTopicId) return -1;
    if (b.id === lastStudiedTopicId) return 1;
    return 0;
  });

  // 상위 5개만 표시 (더보기 토글 시 전체 표시)
  const displayedTopics = showAll ? sortedTopics : sortedTopics.slice(0, 5);
  const remainingCount = Math.max(0, sortedTopics.length - 5);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <Text style={styles.badge}>🎯 오늘의 학습 과목 선택</Text>
            <Text style={styles.title}>어떤 대단원을 학습할까요?</Text>
            <Text style={styles.subtitle}>
              오늘의 실전 문제를 풀이할 대단원(과목)을 선택해 주세요.
            </Text>
          </View>

          <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
            {displayedTopics.map((t) => {
              const isLastStudied = t.id === lastStudiedTopicId;
              const topicQuestions = questions.filter((q) => q.topicId === t.id);

              return (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.topicCard,
                    isLastStudied && styles.topicCardLastStudied,
                  ]}
                  onPress={() => onSelectTopic(t)}
                  activeOpacity={0.8}
                >
                  <View style={styles.topicHeaderRow}>
                    <Text style={styles.topicName}>{t.name}</Text>
                    {isLastStudied && (
                      <View style={styles.lastBadge}>
                        <Text style={styles.lastBadgeText}>⭐ 최근 학습 대단원</Text>
                      </View>
                    )}
                  </View>

                  {t.description ? (
                    <Text style={styles.topicDesc} numberOfLines={1}>
                      {t.description}
                    </Text>
                  ) : null}

                  <View style={styles.topicMetaRow}>
                    <Text style={styles.metaItem}>
                      📚 보유 문제 {topicQuestions.length}문항
                    </Text>
                    <Text style={[styles.selectCtaText, isLastStudied && { color: '#6ee7b7' }]}>
                      {isLastStudied ? '이어서 풀기 ➔' : '선택하여 풀기 ➔'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* 5개 초과 시 펼치기/접기 버튼 */}
            {sortedTopics.length > 5 && (
              <TouchableOpacity
                style={styles.expandToggleBtn}
                onPress={() => setShowAll(!showAll)}
                activeOpacity={0.8}
              >
                <Text style={styles.expandToggleBtnText}>
                  {showAll
                    ? '▲ 상위 5개만 접기'
                    : `➕ 다른 대단원 더보기 (${remainingCount}개 더 있음) ▼`}
                </Text>
              </TouchableOpacity>
            )}

            {/* 전체 과목 및 문제 보관함(자료함)으로 이동 버튼 */}
            {onOpenLibrary && (
              <TouchableOpacity
                style={styles.libraryNavBtn}
                onPress={onOpenLibrary}
                activeOpacity={0.8}
              >
                <Text style={styles.libraryNavBtnText}>
                  📂 전체 과목 자료함에서 문제 선택하러 가기 ➔
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeBtnText}>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    width: '100%',
    maxHeight: '80%',
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  badge: {
    color: '#818cf8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  listContainer: {
    marginBottom: 16,
  },
  topicCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  topicCardLastStudied: {
    backgroundColor: '#172554',
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  topicHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  topicName: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: 'bold',
    flex: 1,
  },
  lastBadge: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  lastBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  topicDesc: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 10,
    lineHeight: 18,
  },
  topicMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 10,
  },
  metaItem: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  selectCtaText: {
    color: '#818cf8',
    fontSize: 13,
    fontWeight: '700',
  },
  expandToggleBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  expandToggleBtnText: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: '700',
  },
  libraryNavBtn: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  libraryNavBtnText: {
    color: '#c7d2fe',
    fontSize: 13,
    fontWeight: '700',
  },
  closeBtn: {
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

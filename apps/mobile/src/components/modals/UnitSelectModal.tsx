import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Topic, Unit, QuestionRevision } from '../../contracts/types';

export interface UnitSelectModalProps {
  visible: boolean;
  topic: Topic | null;
  units: Unit[];
  questions: QuestionRevision[];
  onSelectUnitForGeneration: (topic: Topic, unit: Unit) => void;
  onSelectTopicOverviewForGeneration: (topic: Topic) => void;
  onStartExamWithExistingQuestions?: (questions: QuestionRevision[]) => void;
  onClose: () => void;
}

export const UnitSelectModal: React.FC<UnitSelectModalProps> = ({
  visible,
  topic,
  units,
  questions,
  onSelectUnitForGeneration,
  onSelectTopicOverviewForGeneration,
  onStartExamWithExistingQuestions,
  onClose,
}) => {
  if (!topic) return null;

  const topicUnits = units.filter((u) => u.topicId === topic.id);
  const topicQuestions = questions.filter((q) => q.topicId === topic.id);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* 헤더 */}
          <View style={styles.header}>
            <Text style={styles.badge}>🎯 실전 출제 영역 선택</Text>
            <Text style={styles.title}>어느 영역 문제를 생성해드릴까요?</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              [{topic.name}] 학습할 세부 단원을 선택해 주세요.
            </Text>
          </View>

          {/* 기존 문제가 이미 있는 경우 빠른 풀기 옵션 배너 */}
          {topicQuestions.length > 0 && onStartExamWithExistingQuestions && (
            <TouchableOpacity
              style={styles.existingFastCard}
              onPress={() => onStartExamWithExistingQuestions(topicQuestions)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.existingFastTitle}>💡 기존 보유 문제 바로 풀기</Text>
                <Text style={styles.existingFastSubtitle}>
                  새로 생성하지 않고 이미 저장된 {topicQuestions.length}문항을 즉시 풉니다.
                </Text>
              </View>
              <View style={styles.existingFastBtn}>
                <Text style={styles.existingFastBtnText}>바로 풀기 ➔</Text>
              </View>
            </TouchableOpacity>
          )}

          <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
            {/* 1. 전체 종합 출제 카드 */}
            <TouchableOpacity
              style={styles.overviewCard}
              onPress={() => onSelectTopicOverviewForGeneration(topic)}
              activeOpacity={0.8}
            >
              <View style={styles.overviewContent}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>🌟</Text>
                  <Text style={styles.overviewTitle}>전체 영역 핵심 종합 출제</Text>
                </View>
                <Text style={styles.overviewSubtitle}>
                  모든 단원의 핵심 개념을 종합하여 실전 모의고사로 출제합니다.
                </Text>
              </View>
              <View style={styles.overviewBtn}>
                <Text style={styles.overviewBtnText}>종합 출제 ➔</Text>
              </View>
            </TouchableOpacity>

            {/* 구분선 */}
            {topicUnits.length > 0 && (
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>세부 단원(영역)별 출제</Text>
                <View style={styles.dividerLine} />
              </View>
            )}

            {/* 2. 세부 단원 리스트 */}
            {topicUnits.map((u, idx) => {
              const unitQuestions = questions.filter((q) => q.unitId === u.id);
              const hasExisting = unitQuestions.length > 0;

              return (
                <View key={u.id} style={styles.unitCard}>
                  <View style={styles.unitInfoRow}>
                    <View style={styles.unitIndexBadge}>
                      <Text style={styles.unitIndexText}>{String(idx + 1).padStart(2, '0')}</Text>
                    </View>
                    <View style={{ flex: 1, paddingRight: 6 }}>
                      <Text style={styles.unitTitle} numberOfLines={2}>
                        {u.title}
                      </Text>
                      <View style={styles.unitMetaRow}>
                        {hasExisting ? (
                          <Text style={styles.unitMetaExisting}>
                            📚 보유: {unitQuestions.length}문항
                          </Text>
                        ) : (
                          <Text style={styles.unitMetaNew}>✨ 신규 문제 생성 대기</Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* 단원 액션 버튼 그룹 */}
                  <View style={styles.unitActionRow}>
                    {hasExisting && onStartExamWithExistingQuestions && (
                      <TouchableOpacity
                        style={styles.unitSolveExistingBtn}
                        onPress={() => onStartExamWithExistingQuestions(unitQuestions)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.unitSolveExistingText}>
                          📝 기존 {unitQuestions.length}문제 풀기
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.unitGenerateBtn}
                      onPress={() => onSelectUnitForGeneration(topic, u)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.unitGenerateBtnText}>⚡ AI 문제 생성</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {topicUnits.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>등록된 세부 단원이 없습니다.</Text>
                <TouchableOpacity
                  style={styles.emptyGenerateBtn}
                  onPress={() => onSelectTopicOverviewForGeneration(topic)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyGenerateBtnText}>
                    ⚡ [{topic.name}] 핵심 종합 문제 출제하기
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* 닫기 버튼 */}
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
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '100%',
    maxHeight: '85%',
    padding: 22,
    borderWidth: 1.5,
    borderColor: '#fecdd3',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 14,
  },
  badge: {
    color: '#e11d48',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    color: '#881337',
    fontSize: 19,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
  existingFastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  existingFastTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065f46',
  },
  existingFastSubtitle: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
  },
  existingFastBtn: {
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
  },
  existingFastBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  listContainer: {
    marginBottom: 12,
  },
  overviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff1f2',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#f43f5e',
    marginBottom: 10,
  },
  overviewContent: {
    flex: 1,
    paddingRight: 8,
  },
  overviewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#be123c',
  },
  overviewSubtitle: {
    fontSize: 11,
    color: '#9f1239',
    marginTop: 3,
    lineHeight: 15,
  },
  overviewBtn: {
    backgroundColor: '#e11d48',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  overviewBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#fecdd3',
  },
  dividerText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  unitCard: {
    backgroundColor: '#fff5f7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  unitInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  unitIndexBadge: {
    backgroundColor: '#ffe4e6',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  unitIndexText: {
    color: '#be123c',
    fontSize: 11,
    fontWeight: '800',
  },
  unitTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1f2937',
    lineHeight: 18,
  },
  unitMetaRow: {
    marginTop: 3,
  },
  unitMetaExisting: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  unitMetaNew: {
    fontSize: 11,
    color: '#e11d48',
    fontWeight: '500',
  },
  unitActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
  },
  unitSolveExistingBtn: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  unitSolveExistingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  unitGenerateBtn: {
    backgroundColor: '#f43f5e',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  unitGenerateBtnText: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  emptyCard: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff5f7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 10,
  },
  emptyGenerateBtn: {
    backgroundColor: '#f43f5e',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyGenerateBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  closeBtn: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: 'bold',
  },
});

import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator, ScrollView } from 'react-native';
import { LearnerKnowledgeLevel } from '../../contracts/types';
import { showAlert } from '../../utils/alert';

interface TopicModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateTopic: (
    name: string,
    description: string,
    options?: { autoCurriculum?: boolean; learnerLevel?: LearnerKnowledgeLevel; category?: string }
  ) => Promise<void>;
}

const CATEGORY_OPTIONS = [
  '💻 IT / 개발',
  '📐 수학',
  '🌐 언어 / 어학',
  '📊 경제 / 경영',
  '📚 일반 / 교양',
];

export const TopicModal: React.FC<TopicModalProps> = ({ visible, onClose, onCreateTopic }) => {
  const [topicName, setTopicName] = useState('');
  const [topicDesc, setTopicDesc] = useState('');
  const [category, setCategory] = useState('💻 IT / 개발');
  const [learnerLevel, setLearnerLevel] = useState<LearnerKnowledgeLevel>('basic');
  const [autoCurriculum, setAutoCurriculum] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const presets = ['Git / GitHub 마스터', '파이썬 프로그래밍', '수학 핵심 공식', '토익 필수 영단어', '경제학 기초'];

  async function handleCreate() {
    if (!topicName.trim()) {
      showAlert('알림', '학습할 주제 이름(예: Git, 수학 등)을 입력해 주세요.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onCreateTopic(topicName.trim(), topicDesc.trim(), {
        autoCurriculum,
        learnerLevel,
        category,
      });
      setTopicName('');
      setTopicDesc('');
      onClose();
    } catch (err: any) {
      showAlert('오류', `주제 생성 실패: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>✨ 새 학습 주제 만들기</Text>
          <Text style={styles.promptGuideText}>
            공부하고 싶은 대분류와 주제를 선택하면, AI가 체계적인 학습 목차(단원)를 자동으로 설계합니다.
          </Text>

          {/* 대단위 카테고리 선택 */}
          <Text style={styles.fieldLabel}>📂 대분류(과목 영역):</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {CATEGORY_OPTIONS.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.presetChip, category === cat && styles.presetChipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.presetChipText, category === cat && styles.presetChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 추천 주제 칩 */}
          <Text style={styles.fieldLabel}>💡 빠른 추천 주제:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {presets.map((p, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.presetChip, topicName === p && styles.presetChipActive]}
                onPress={() => {
                  setTopicName(p);
                  if (p.includes('Git') || p.includes('파이썬')) setCategory('💻 IT / 개발');
                  else if (p.includes('수학')) setCategory('📐 수학');
                  else if (p.includes('토익') || p.includes('영')) setCategory('🌐 언어 / 어학');
                  else if (p.includes('경제')) setCategory('📊 경제 / 경영');
                }}
              >
                <Text style={[styles.presetChipText, topicName === p && styles.presetChipTextActive]}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            style={styles.inputField}
            placeholder="주제 이름 (예: Git 협업 워크플로우, 미적분 기초 등)"
            placeholderTextColor="#94a3b8"
            value={topicName}
            onChangeText={setTopicName}
            editable={!isSubmitting}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
            onKeyPress={(e: any) => {
              if (e?.nativeEvent?.key === 'Enter' && !e?.nativeEvent?.shiftKey) {
                e?.preventDefault?.();
                handleCreate();
              }
            }}
          />

          {/* 학습자 수준 선택 (캘리브레이션) */}
          <Text style={styles.fieldLabel}>🎯 나의 시작 지식 수준:</Text>
          <View style={styles.levelRow}>
            {(
              [
                { key: 'beginner', label: '🐣 왕초보 입문' },
                { key: 'basic', label: '🌿 기본 개념' },
                { key: 'advanced', label: '🚀 실전 시험' },
                { key: 'master', label: '👑 심화 킬러' },
              ] as const
            ).map((item) => {
              const isSelected = learnerLevel === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.levelBtn, isSelected && styles.levelBtnActive]}
                  onPress={() => setLearnerLevel(item.key)}
                  disabled={isSubmitting}
                >
                  <Text style={[styles.levelBtnText, isSelected && styles.levelBtnTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* AI 커리큘럼 자동 생성 토글 */}
          <TouchableOpacity
            style={[styles.autoCurriculumCard, autoCurriculum && styles.autoCurriculumCardActive]}
            onPress={() => setAutoCurriculum(!autoCurriculum)}
            disabled={isSubmitting}
          >
            <Text style={{ fontSize: 18, marginRight: 8 }}>{autoCurriculum ? '⚡' : '⬜'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.autoCurriculumTitle, autoCurriculum && styles.autoCurriculumTitleActive]}>
                AI가 학습 단원(목차 5개) 자동 분할 생성
              </Text>
              <Text style={styles.autoCurriculumDesc}>
                {autoCurriculum
                  ? '입력하신 주제에 맞춰 AI가 논리적 5단계 목차를 즉시 구성합니다. (직접 입력 불필요)'
                  : '직접 빈 단원을 하나씩 추가합니다.'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#334155' }]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.actionBtnText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#6366f1' }]}
              onPress={handleCreate}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ActivityIndicator color="#ffffff" size="small" />
                  <Text style={styles.actionBtnText}>AI 커리큘럼 설계 중...</Text>
                </View>
              ) : (
                <Text style={styles.actionBtnText}>
                  {autoCurriculum ? '✨ AI 커리큘럼 생성' : '주제 생성'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 6,
  },
  promptGuideText: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 6,
  },
  presetChip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 6,
  },
  presetChipActive: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  presetChipText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  presetChipTextActive: {
    color: '#a5b4fc',
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
    marginBottom: 12,
  },
  levelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  levelBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    flexBasis: '48%',
    alignItems: 'center',
  },
  levelBtnActive: {
    borderColor: '#6366f1',
    backgroundColor: '#4338ca',
  },
  levelBtnText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  levelBtnTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  autoCurriculumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 4,
  },
  autoCurriculumCardActive: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  autoCurriculumTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 2,
  },
  autoCurriculumTitleActive: {
    color: '#a5b4fc',
  },
  autoCurriculumDesc: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

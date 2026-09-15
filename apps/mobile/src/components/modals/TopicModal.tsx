import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LearnerKnowledgeLevel } from '../../contracts/types';
import { showAlert } from '../../utils/alert';

export interface TopicModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateTopic: (
    name: string,
    description: string,
    options?: {
      autoCurriculum?: boolean;
      learnerLevel?: LearnerKnowledgeLevel;
      category?: string;
      customUnits?: string[];
    }
  ) => Promise<void>;
}

// 자유 선택 및 빠른 입력을 돕는 광범위한 카테고리 예시 칩들
const CATEGORY_SUGGESTIONS = [
  '⚖️ 법학/행정',
  '🎮 게임/개발',
  '💼 비즈니스/경영',
  '🌐 언어/어학',
  '📐 자연과학/수학',
  '🏥 의학/보건',
  '🎨 문화/예술',
  '📚 교양/자격증',
];

export const TopicModal: React.FC<TopicModalProps> = ({ visible, onClose, onCreateTopic }) => {
  const [topicName, setTopicName] = useState('');
  const [category, setCategory] = useState('');
  const [autoCurriculum, setAutoCurriculum] = useState(true);
  const [learnerLevel, setLearnerLevel] = useState<LearnerKnowledgeLevel>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreate() {
    const trimmedName = topicName.trim();
    if (!trimmedName) {
      showAlert('알림', '학습할 과목 이름(대주제)을 입력해 주세요.');
      return;
    }

    const finalCategory = category.trim() || '📚 일반';

    setIsSubmitting(true);
    try {
      await onCreateTopic(trimmedName, '', {
        autoCurriculum,
        learnerLevel,
        category: finalCategory,
      });

      // 초기화 및 닫기
      setTopicName('');
      setCategory('');
      setAutoCurriculum(true);
      onClose();
    } catch (err: any) {
      showAlert('오류', `과목 생성 실패: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 6 }}
          >
            <Text style={styles.modalTitle}>✨ 새 학습 과목 추가</Text>
            <Text style={styles.promptGuideText}>
              과목명과 분류를 입력하면, AI가 내용에 부합하는 체계적인 소단원 목차를 자동 생성합니다.
            </Text>

            {/* 1. 대주제 (과목명) */}
            <Text style={styles.fieldLabel}>🏷️ 과목 이름 (대주제) *</Text>
            <TextInput
              style={styles.inputField}
              placeholder="예: 법학개론, 게임개발 기초, 형법총론, 회계원리 등"
              placeholderTextColor="#fda4af"
              value={topicName}
              onChangeText={setTopicName}
              editable={!isSubmitting}
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />

            {/* 2. 과목 분류 (카테고리 - 직접 입력 + 빠른 선택 칩) */}
            <Text style={styles.fieldLabel}>📂 과목 분류 (카테고리)</Text>
            <TextInput
              style={[styles.inputField, { marginBottom: 8 }]}
              placeholder="직접 입력 (예: 법학, 게임개발, 회계, 자격증 등)"
              placeholderTextColor="#fda4af"
              value={category}
              onChangeText={setCategory}
              editable={!isSubmitting}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 14 }}
              onTouchStart={(e: any) => e.stopPropagation?.()}
              onTouchMove={(e: any) => e.stopPropagation?.()}
              onTouchEnd={(e: any) => e.stopPropagation?.()}
              {...({ 'data-horizontal-scroll': 'true' } as any)}
            >
              {CATEGORY_SUGGESTIONS.map((cat) => {
                const isSelected = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.presetChip, isSelected && styles.presetChipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.presetChipText, isSelected && styles.presetChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* 3. AI 목차 자동 생성 옵션 (방해되는 수동 입력창 제거 및 심플화) */}
            <TouchableOpacity
              style={[styles.autoCurriculumCard, autoCurriculum && styles.autoCurriculumCardActive]}
              onPress={() => setAutoCurriculum(!autoCurriculum)}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 18, marginRight: 10 }}>{autoCurriculum ? '⚡' : '⬜'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.autoCurriculumTitle, autoCurriculum && styles.autoCurriculumTitleActive]}>
                  AI 맞춤 목차 자동 생성 (권장)
                </Text>
                <Text style={styles.autoCurriculumDesc}>
                  {autoCurriculum
                    ? '입력하신 과목명에 맞추어 전문적이고 체계적인 소단원을 AI가 자동 설계합니다.'
                    : '소단원 없이 대주제만 먼저 등록합니다.'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* 4. 난이도 수준 선택 */}
            {autoCurriculum && (
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.fieldLabel}>🎯 난이도 수준</Text>
                <View style={styles.levelRow}>
                  {(
                    [
                      { key: 'beginner', label: '입문' },
                      { key: 'basic', label: '기본' },
                      { key: 'advanced', label: '실전' },
                      { key: 'master', label: '심화' },
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
              </View>
            )}

            {/* 하단 버튼 바 */}
            <View style={styles.actionBtnRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={onClose}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.submitBtn]}
                onPress={handleCreate}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ActivityIndicator color="#ffffff" size="small" />
                    <Text style={styles.submitBtnText}>AI 목차 설계 중...</Text>
                  </View>
                ) : (
                  <Text style={styles.submitBtnText}>✨ 과목 등록 완료</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    maxHeight: '90%',
    borderWidth: 1.5,
    borderColor: '#fecdd3',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#881337',
    marginBottom: 4,
  },
  promptGuideText: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#881337',
    marginBottom: 6,
  },
  inputField: {
    backgroundColor: '#fff5f7',
    borderWidth: 1.2,
    borderColor: '#fecdd3',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#881337',
    marginBottom: 12,
  },
  presetChip: {
    backgroundColor: '#fff5f7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecdd3',
    marginRight: 6,
  },
  presetChipActive: {
    borderColor: '#f43f5e',
    backgroundColor: '#ffe4e6',
  },
  presetChipText: {
    color: '#64748b',
    fontSize: 12,
  },
  presetChipTextActive: {
    color: '#be123c',
    fontWeight: 'bold',
  },
  autoCurriculumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  autoCurriculumCardActive: {
    backgroundColor: '#fff1f4',
    borderColor: '#f43f5e',
  },
  autoCurriculumTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 2,
  },
  autoCurriculumTitleActive: {
    color: '#881337',
  },
  autoCurriculumDesc: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15,
  },
  levelRow: {
    flexDirection: 'row',
    gap: 6,
  },
  levelBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecdd3',
    backgroundColor: '#fff5f7',
    alignItems: 'center',
  },
  levelBtnActive: {
    backgroundColor: '#f43f5e',
    borderColor: '#f43f5e',
  },
  levelBtnText: {
    color: '#be123c',
    fontSize: 12,
    fontWeight: '600',
  },
  levelBtnTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#ffe4e6',
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  cancelBtnText: {
    color: '#be123c',
    fontSize: 13,
    fontWeight: 'bold',
  },
  submitBtn: {
    backgroundColor: '#f43f5e',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});

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
  Platform,
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
  const [unitMode, setUnitMode] = useState<'custom' | 'ai' | 'none'>('custom');
  const [customUnitsText, setCustomUnitsText] = useState('');
  const [learnerLevel, setLearnerLevel] = useState<LearnerKnowledgeLevel>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 템플릿 채우기 헬퍼
  const handleApplyTemplate = (type: '3step' | '5step') => {
    const base = topicName.trim() || '과목';
    if (type === '3step') {
      setCustomUnitsText(
        `1단원: ${base} 기초 및 핵심 개념\n2단원: ${base} 실전 응용과 핵심 사례\n3단원: ${base} 총정리 및 실전 문제풀이`
      );
    } else {
      setCustomUnitsText(
        `1단원: ${base} 개요와 기본 원리\n2단원: ${base} 핵심 이론 심화\n3단원: ${base} 주요 쟁점과 실무 적용\n4단원: ${base} 빈출 유형 및 심층 분석\n5단원: ${base} 실전 모의고사 종합 정리`
      );
    }
  };

  async function handleCreate() {
    const trimmedName = topicName.trim();
    if (!trimmedName) {
      showAlert('알림', '학습할 과목 이름(대주제)을 입력해 주세요.');
      return;
    }

    const finalCategory = category.trim() || '📚 일반';

    let customUnits: string[] | undefined = undefined;
    if (unitMode === 'custom') {
      const units = customUnitsText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (units.length === 0) {
        showAlert(
          '소제목 입력 안내',
          '직접 입력 모드에서는 최소 1개 이상의 소단원(목차)을 입력해 주시거나, [AI 맞춤 목차] 또는 [과목만 만들기]를 선택해 주세요.'
        );
        return;
      }
      customUnits = units;
    }

    setIsSubmitting(true);
    try {
      await onCreateTopic(trimmedName, '', {
        autoCurriculum: unitMode === 'ai',
        learnerLevel,
        category: finalCategory,
        customUnits,
      });

      // 초기화 및 닫기
      setTopicName('');
      setCategory('');
      setCustomUnitsText('');
      setUnitMode('custom');
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
            contentContainerStyle={{ paddingBottom: 10 }}
          >
            <Text style={styles.modalTitle}>✨ 새 학습 과목 추가</Text>
            <Text style={styles.promptGuideText}>
              원하는 모든 분야(법학, 게임개발, 자격증, 취미 등)의 대주제와 소제목을 자유롭게 구성하세요.
            </Text>

            {/* 1. 대주제 (과목명) */}
            <Text style={styles.fieldLabel}>🏷️ 과목 이름 (대주제) *</Text>
            <TextInput
              style={styles.inputField}
              placeholder="예: 법학개론, 게임개발 기초, 형법총론 등 자유 입력"
              placeholderTextColor="#fda4af"
              value={topicName}
              onChangeText={setTopicName}
              editable={!isSubmitting}
              returnKeyType="next"
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

            {/* 3. 소제목 / 세부 단원 구성 방식 (3가지 모드) */}
            <Text style={styles.fieldLabel}>📑 소제목(목차/단원) 구성 방식</Text>
            <View style={styles.modeTabsRow}>
              <TouchableOpacity
                style={[styles.modeTabBtn, unitMode === 'custom' && styles.modeTabBtnActive]}
                onPress={() => setUnitMode('custom')}
                disabled={isSubmitting}
              >
                <Text style={[styles.modeTabText, unitMode === 'custom' && styles.modeTabTextActive]}>
                  ✍️ 직접 소제목 입력
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTabBtn, unitMode === 'ai' && styles.modeTabBtnActive]}
                onPress={() => setUnitMode('ai')}
                disabled={isSubmitting}
              >
                <Text style={[styles.modeTabText, unitMode === 'ai' && styles.modeTabTextActive]}>
                  ⚡ AI 맞춤 추천
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTabBtn, unitMode === 'none' && styles.modeTabBtnActive]}
                onPress={() => setUnitMode('none')}
                disabled={isSubmitting}
              >
                <Text style={[styles.modeTabText, unitMode === 'none' && styles.modeTabTextActive]}>
                  📁 과목만 먼저 생성
                </Text>
              </TouchableOpacity>
            </View>

            {/* 모드별 상세 인터페이스 */}
            {unitMode === 'custom' && (
              <View style={styles.customUnitContainer}>
                <View style={styles.customUnitHeaderRow}>
                  <Text style={styles.customUnitHelperText}>
                    한 줄에 하나씩 소단원 제목을 입력하세요:
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={styles.templateBtn}
                      onPress={() => handleApplyTemplate('3step')}
                    >
                      <Text style={styles.templateBtnText}>+ 3단원 예시</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.templateBtn}
                      onPress={() => handleApplyTemplate('5step')}
                    >
                      <Text style={styles.templateBtnText}>+ 5단원 예시</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TextInput
                  style={styles.customUnitsTextArea}
                  multiline
                  numberOfLines={4}
                  placeholder={`예시:\n1단원: 총칙 및 법의 이념\n2단원: 권리와 의무의 주체\n3단원: 판례 분석 및 실전 연습`}
                  placeholderTextColor="#fda4af"
                  value={customUnitsText}
                  onChangeText={setCustomUnitsText}
                  editable={!isSubmitting}
                  textAlignVertical="top"
                />
              </View>
            )}

            {unitMode === 'ai' && (
              <View style={styles.aiUnitContainer}>
                <Text style={styles.aiUnitDesc}>
                  입력하신 과목명에 가장 알맞은 핵심 단원 3~5개를 AI가 자동으로 분석하여 구성합니다.
                </Text>
                <Text style={[styles.fieldLabel, { marginTop: 8, marginBottom: 4 }]}>🎯 난이도 수준:</Text>
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

            {unitMode === 'none' && (
              <View style={styles.noneUnitContainer}>
                <Text style={styles.noneUnitDesc}>
                  소단원 없이 대주제 과목만 등록합니다. 등록 후 과목자료함에서 원하는 단원을 직접 하나씩 추가할 수 있습니다.
                </Text>
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
                    <Text style={styles.submitBtnText}>과목 등록 중...</Text>
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
  modeTabsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  modeTabBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTabBtnActive: {
    borderColor: '#f43f5e',
    backgroundColor: '#fff1f4',
  },
  modeTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
  modeTabTextActive: {
    color: '#be123c',
    fontWeight: 'bold',
  },
  customUnitContainer: {
    backgroundColor: '#fff9fa',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.2,
    borderColor: '#fecdd3',
    marginBottom: 14,
  },
  customUnitHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 4,
  },
  customUnitHelperText: {
    fontSize: 11,
    color: '#9f1239',
    fontWeight: '600',
  },
  templateBtn: {
    backgroundColor: '#ffe4e6',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  templateBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#be123c',
  },
  customUnitsTextArea: {
    backgroundColor: '#ffffff',
    borderWidth: 1.2,
    borderColor: '#fda4af',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: '#881337',
    minHeight: 85,
    lineHeight: 18,
  },
  aiUnitContainer: {
    backgroundColor: '#fff9fa',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.2,
    borderColor: '#fecdd3',
    marginBottom: 14,
  },
  aiUnitDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  noneUnitContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  noneUnitDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
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

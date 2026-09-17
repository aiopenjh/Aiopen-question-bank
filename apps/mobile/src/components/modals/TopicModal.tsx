import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LearnerKnowledgeLevel, Source } from '../../contracts/types';
import { difficultyToLegacyLevel } from '../../domain/difficulty';
import { colors } from '../../styles/designTokens';
import { showAlert } from '../../utils/alert';
import { UniversalModal as Modal } from '../common/UniversalModal';
import { DifficultyLevelControl } from '../common/DifficultyLevelControl';
import { topicModalStyles as styles } from './TopicModal.styles';

export interface TopicModalProps {
  visible: boolean;
  onClose: () => void;
  initialTopicName?: string;
  sources?: Source[];
  isPdfReady?: (sourceId: string) => boolean;
  onCreateTopic: (
    name: string,
    description: string,
    options?: {
      autoCurriculum?: boolean;
      learnerLevel?: LearnerKnowledgeLevel;
      difficultyLevel?: number;
      category?: string;
      customUnits?: string[];
      sourceId?: string;
    }
  ) => Promise<void>;
}

const CATEGORY_SUGGESTIONS = [
  { icon: '⚖️', label: '법학·행정', value: '법학/행정' },
  { icon: '🎮', label: 'IT·개발', value: 'IT/개발' },
  { icon: '💼', label: '경영·경제', value: '비즈니스/경영' },
  { icon: '🌐', label: '언어·어학', value: '언어/어학' },
  { icon: '📐', label: '수학·과학', value: '자연과학/수학' },
  { icon: '🩺', label: '의학·보건', value: '의학/보건' },
  { icon: '🎨', label: '문화·예술', value: '문화/예술' },
  { icon: '📚', label: '교양·자격', value: '교양/자격증' },
] as const;

export const TopicModal: React.FC<TopicModalProps> = ({
  visible,
  onClose,
  initialTopicName = '',
  sources = [],
  isPdfReady,
  onCreateTopic,
}) => {
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const [topicName, setTopicName] = useState(initialTopicName);
  const [category, setCategory] = useState('');
  const [difficultyLevel, setDifficultyLevel] = useState(10);
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setTopicName(initialTopicName || '');
      setCategory('');
      setDifficultyLevel(10);
      setSelectedSourceId(undefined);
    }
  }, [visible, initialTopicName]);

  async function handleCreate() {
    const trimmedName = topicName.trim();
    if (!trimmedName) {
      showAlert('알림', '학습할 과목 이름을 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateTopic(trimmedName, '', {
        autoCurriculum: true,
        learnerLevel: difficultyToLegacyLevel(difficultyLevel),
        difficultyLevel,
        category: category.trim() || '일반',
        sourceId: selectedSourceId,
      });
      setTopicName('');
      setCategory('');
      onClose();
    } catch (err: any) {
      const choices = Array.isArray(err?.clarificationChoices)
        ? err.clarificationChoices.filter((choice: unknown) => typeof choice === 'string')
        : [];
      const message = choices.length > 0
        ? `${err?.message || '학습 주제를 확인해 주세요.'}\n\n가능한 해석:\n${choices
            .map((choice: string) => `• ${choice}`)
            .join('\n')}`
        : err?.message || '과목을 생성하지 못했습니다.';
      showAlert(
        err?.status === 'NEEDS_CLARIFICATION'
          ? '주제 확인 필요'
          : err?.status === 'REJECTED'
            ? '입력 확인 필요'
            : '과목 생성 실패',
        message
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.card, isCompact && styles.cardCompact]}
          onPress={(event) => event.stopPropagation?.()}
        >
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>NEW STUDY</Text>
              <Text style={styles.title}>새 학습 과목</Text>
              <Text style={styles.guide}>
                이름과 시작 수준을 정하면 AI가 단계별 목차를 설계해요.
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="과목 추가 닫기"
              style={styles.closeButton}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.fieldLabel}>과목 이름</Text>
            <TextInput
              style={styles.input}
              placeholder="예: 수학, 한국사, Python 비동기 프로그래밍"
              placeholderTextColor="#A9959C"
              value={topicName}
              onChangeText={setTopicName}
              editable={!isSubmitting}
              returnKeyType="next"
            />

            <View style={styles.fieldHeadingRow}>
              <Text style={styles.fieldLabel}>내 파일 불러오기</Text>
              <Text style={styles.optionalText}>선택 사항</Text>
            </View>
            {sources.length === 0 ? (
              <View style={styles.sourceEmptyCard}>
                <Text style={styles.sourceEmptyText}>
                  상단의 + 자료에서 PDF나 텍스트 자료를 먼저 등록할 수 있습니다.
                </Text>
              </View>
            ) : (
              <View style={styles.sourceList}>
                {sources.map((source) => {
                  const selected = selectedSourceId === source.id;
                  const needsOriginal = source.kind === 'pdf' && !isPdfReady?.(source.id);
                  return (
                    <TouchableOpacity
                      key={source.id}
                      style={[styles.sourceCard, selected && styles.sourceCardSelected]}
                      onPress={() => setSelectedSourceId(selected ? undefined : source.id)}
                      disabled={isSubmitting}
                    >
                      <View style={styles.sourceCardCopy}>
                        <Text style={[styles.sourceCardTitle, selected && styles.sourceCardTitleSelected]} numberOfLines={1}>
                          {source.kind === 'pdf' ? '📄' : '📝'} {source.title}
                        </Text>
                        <Text style={styles.sourceCardMeta} numberOfLines={1}>
                          {source.kind === 'pdf'
                            ? `${source.selectedPageStart || 1}~${source.selectedPageEnd || source.pageCount || '?'}쪽${needsOriginal ? ' · 원본 재선택 필요' : ' · 원본 연결됨'}`
                            : '저장된 텍스트 자료'}
                        </Text>
                      </View>
                      <View style={[styles.sourceCheck, selected && styles.sourceCheckSelected]}>
                        <Text style={styles.sourceCheckText}>{selected ? '✓' : ''}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={styles.fieldHeadingRow}>
              <Text style={styles.fieldLabel}>과목 분류</Text>
              <Text style={styles.optionalText}>선택 사항</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="직접 입력하거나 아래에서 선택"
              placeholderTextColor="#A9959C"
              value={category}
              onChangeText={setCategory}
              editable={!isSubmitting}
              returnKeyType="done"
            />
            <View style={styles.categoryGrid}>
              {CATEGORY_SUGGESTIONS.map((item) => {
                const isSelected = category === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.categoryChip,
                      isCompact && styles.categoryChipCompact,
                      isSelected && styles.categoryChipSelected,
                    ]}
                    onPress={() => setCategory(item.value)}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.categoryIcon}>{item.icon}</Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.categoryText, isSelected && styles.categoryTextSelected]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, styles.levelLabel]}>시작 난이도</Text>
            <DifficultyLevelControl
              value={difficultyLevel}
              onChange={setDifficultyLevel}
              disabled={isSubmitting}
              compact={isCompact}
            />

            <View style={styles.aiNote}>
              <Text style={styles.aiNoteIcon}>✦</Text>
              <Text style={styles.aiNoteText}>
                선택한 레벨을 시작점으로 5개 학습 단원을 구성합니다. 정답률로 레벨이 자동 변경되지는 않습니다.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.submitButton]}
              onPress={handleCreate}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <View style={styles.submittingRow}>
                  <ActivityIndicator color={colors.white} size="small" />
                  <Text style={styles.submitButtonText}>목차 설계 중</Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>과목 만들기</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

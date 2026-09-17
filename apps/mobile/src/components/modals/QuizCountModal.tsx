import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LearnerKnowledgeLevel } from '../../contracts/types';
import {
  difficultyToLegacyLevel,
  getDifficultyProfile,
  legacyLevelToDifficulty,
} from '../../domain/difficulty';
import { colors } from '../../styles/designTokens';
import { UniversalModal as Modal } from '../common/UniversalModal';
import { DifficultyLevelControl } from '../common/DifficultyLevelControl';
import { quizCountModalStyles as styles } from './QuizCountModal.styles';
import { showAlert } from '../../utils/alert';

export interface QuizCountModalOptions {
  learnerLevel?: LearnerKnowledgeLevel;
  difficultyLevel?: number;
  shouldReplaceExisting?: boolean;
}

interface QuizCountModalProps {
  visible: boolean;
  unitTitle?: string;
  topicName?: string;
  existingCount?: number;
  initialLevel?: LearnerKnowledgeLevel;
  initialDifficultyLevel?: number;
  onClose: () => void;
  onSelectCount: (count: number, options?: QuizCountModalOptions) => void;
  onSaveDifficulty: (difficultyLevel: number) => Promise<void>;
  onOpenBackup?: () => void;
}

const COUNT_OPTIONS = [
  { count: 3, title: '3문제', meta: '빠른 확인', description: '핵심 개념을 짧게 점검해요.', recommended: false },
  { count: 5, title: '5문제', meta: '추천', description: '개념과 응용을 균형 있게 풀어요.', recommended: true },
] as const;

export const QuizCountModal: React.FC<QuizCountModalProps> = ({
  visible,
  unitTitle,
  topicName,
  existingCount = 0,
  initialLevel = 'basic',
  initialDifficultyLevel,
  onClose,
  onSelectCount,
  onSaveDifficulty,
  onOpenBackup,
}) => {
  const fixedDifficulty = initialDifficultyLevel ?? legacyLevelToDifficulty(initialLevel);
  const canAdjustDifficulty = existingCount > 0;
  const [selectedDifficulty, setSelectedDifficulty] = useState(fixedDifficulty);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const closeModal = () => { if (!savingRef.current) onClose(); };

  useEffect(() => {
    if (visible) {
      setSelectedDifficulty(fixedDifficulty);
    }
  }, [visible, fixedDifficulty]);

  const selectedProfile = getDifficultyProfile(selectedDifficulty);
  const isModifiedFromDefault = selectedDifficulty !== fixedDifficulty;

  const applyLevelChange = async (count: number, replaceExisting: boolean) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      await onSaveDifficulty(selectedDifficulty);
      onSelectCount(count, {
        learnerLevel: difficultyToLegacyLevel(selectedDifficulty),
        difficultyLevel: selectedDifficulty,
        shouldReplaceExisting: replaceExisting,
      });
    } catch {
      showAlert('레벨 저장 실패', '레벨을 저장하지 못했습니다. 기존 레벨과 문제는 유지됩니다. 다시 시도해 주세요.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleSelectCount = (count: number) => {
    if (savingRef.current) return;
    if (!canAdjustDifficulty || selectedDifficulty === fixedDifficulty) {
      onSelectCount(count, {
        learnerLevel: difficultyToLegacyLevel(selectedDifficulty),
        difficultyLevel: selectedDifficulty,
        shouldReplaceExisting: false,
      });
      return;
    }

    showAlert(
      '레벨 변경',
      `레벨 ${fixedDifficulty}에서 레벨 ${selectedDifficulty}(으)로 변경합니다.\n\n기존문제삭제는 새 문제 생성이 성공한 뒤 이 단원의 기존 ${existingCount}문제에만 적용됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '기존문제유지 + 레벨변경',
          onPress: () => { void applyLevelChange(count, false); },
        },
        {
          text: '기존문제삭제 + 레벨변경',
          style: 'destructive',
          onPress: () => { void applyLevelChange(count, true); },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeModal}>
      <Pressable style={styles.overlay} onPress={closeModal}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation?.()}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>QUIZ SETUP</Text>
              <Text style={styles.title}>이번에는 얼마나 풀까요?</Text>
              {unitTitle ? (
                <Text style={styles.subtitle} numberOfLines={2}>
                  {topicName ? `${topicName} · ` : ''}{unitTitle}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="출제 설정 닫기"
              style={styles.closeButton}
              onPress={closeModal}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.currentLevelRow}>
              <View style={styles.levelMark}>
                <Text style={styles.levelMarkText}>Lv</Text>
              </View>
              <View style={styles.currentLevelCopy}>
                <Text style={styles.currentLevelLabel}>현재 난이도</Text>
                <Text style={styles.currentLevelValue}>
                  레벨 {selectedDifficulty} · {selectedProfile.bandLabel}
                </Text>
              </View>
              <Text style={styles.originTag}>{canAdjustDifficulty ? '추가 출제' : '첫 출제 고정'}</Text>
            </View>

            {canAdjustDifficulty ? (
              <>
                <View style={styles.sectionHeadingRow}>
                  <Text style={styles.sectionTitle}>추가 문제 난이도</Text>
                  {isModifiedFromDefault ? (
                    <TouchableOpacity onPress={() => setSelectedDifficulty(fixedDifficulty)}>
                      <Text style={styles.resetText}>저장 레벨로 되돌리기</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.sectionHint}>이 단원에만 저장</Text>
                  )}
                </View>
                <DifficultyLevelControl
                  value={selectedDifficulty}
                  onChange={setSelectedDifficulty}
                  compact
                />
                <Text style={styles.adjustableLevelNote}>
                  원하는 레벨을 고른 뒤 3문제 또는 5문제를 누르면 기존 문제 처리 방식을 확인합니다.
                </Text>
              </>
            ) : (
              <Text style={styles.lockedLevelNote}>
                새 과목을 만들 때 선택한 난이도로 첫 문제가 출제됩니다.
              </Text>
            )}

            <Text style={[styles.sectionTitle, styles.countSectionTitle]}>문항 수</Text>
            <Text style={styles.privacyNote}>
              API 요청 제한을 줄이기 위해 한 번에 3~5문항을 권장하며, 하루 누적 15문항을 넘기면 추가 확인을 받습니다.
            </Text>
            <View style={styles.countList}>
              {COUNT_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item.count}
                  disabled={isSaving}
                  style={[styles.countCard, item.recommended && styles.countCardRecommended]}
                  onPress={() => handleSelectCount(item.count)}
                  activeOpacity={0.82}
                >
                  <View style={styles.countNumberBox}>
                    <Text style={styles.countNumber}>{item.count}</Text>
                  </View>
                  <View style={styles.countCopy}>
                    <View style={styles.countTitleRow}>
                      <Text style={styles.countTitle}>{item.title}</Text>
                      <View style={[styles.countMeta, item.recommended && styles.countMetaRecommended]}>
                        <Text style={[styles.countMetaText, item.recommended && styles.countMetaTextRecommended]}>
                          {item.meta}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.countDescription}>{item.description}</Text>
                  </View>
                  <Text style={styles.countArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>

            {existingCount >= 30 && onOpenBackup ? (
              <TouchableOpacity
                style={styles.backupNotice}
                onPress={() => {
                  onClose();
                  onOpenBackup();
                }}
              >
                <Text style={styles.backupNoticeIcon}>🛡️</Text>
                <View style={styles.backupNoticeCopy}>
                  <Text style={styles.backupNoticeTitle}>문제가 많이 쌓였어요</Text>
                  <Text style={styles.backupNoticeText}>기기 변경에 대비해 백업 파일을 만들어 두세요.</Text>
                </View>
                <Text style={styles.backupNoticeAction}>백업</Text>
              </TouchableOpacity>
            ) : null}

            <Text style={styles.privacyNote}>생성된 문제는 이 기기의 개인 문제은행에만 보관됩니다.</Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

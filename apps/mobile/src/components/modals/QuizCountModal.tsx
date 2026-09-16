import React, { useEffect, useState } from 'react';
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
  onOpenBackup?: () => void;
}

const COUNT_OPTIONS = [
  { count: 3, title: '3문제', meta: '빠른 확인', description: '핵심 개념을 짧게 점검해요.', recommended: false },
  { count: 5, title: '5문제', meta: '추천', description: '개념과 응용을 균형 있게 풀어요.', recommended: true },
  { count: 10, title: '10문제', meta: '집중 학습', description: '단원을 충분히 연습해요.', recommended: false },
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
  onOpenBackup,
}) => {
  const fixedDifficulty = initialDifficultyLevel ?? legacyLevelToDifficulty(initialLevel);
  const canAdjustDifficulty = existingCount > 0;
  const [selectedDifficulty, setSelectedDifficulty] = useState(fixedDifficulty);
  const [shouldReplace, setShouldReplace] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedDifficulty(fixedDifficulty);
      setShouldReplace(false);
    }
  }, [visible, fixedDifficulty]);

  const selectedProfile = getDifficultyProfile(selectedDifficulty);
  const isModifiedFromDefault = selectedDifficulty !== fixedDifficulty;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
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
              onPress={onClose}
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
                      <Text style={styles.resetText}>과목 기본값으로</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.sectionHint}>이번 출제에만 적용</Text>
                  )}
                </View>
                <DifficultyLevelControl
                  value={selectedDifficulty}
                  onChange={setSelectedDifficulty}
                  compact
                />
                <Text style={styles.adjustableLevelNote}>
                  추가 출제 난이도만 바뀌며 과목의 시작 난이도는 유지됩니다.
                </Text>
              </>
            ) : (
              <Text style={styles.lockedLevelNote}>
                새 과목을 만들 때 선택한 난이도로 첫 문제가 출제됩니다.
              </Text>
            )}

            {existingCount > 0 ? (
              <View style={styles.existingSection}>
                <View style={styles.sectionHeadingRow}>
                  <Text style={styles.sectionTitle}>기존 {existingCount}문제</Text>
                  <Text style={styles.sectionHint}>처리 방식</Text>
                </View>
                <View style={styles.replaceRow}>
                  <TouchableOpacity
                    style={[styles.replaceButton, !shouldReplace && styles.replaceButtonActive]}
                    onPress={() => setShouldReplace(false)}
                  >
                    <Text style={[styles.replaceText, !shouldReplace && styles.replaceTextActive]}>
                      유지하고 추가
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.replaceButton, shouldReplace && styles.replaceButtonDanger]}
                    onPress={() => setShouldReplace(true)}
                  >
                    <Text style={[styles.replaceText, shouldReplace && styles.replaceTextDanger]}>
                      지우고 교체
                    </Text>
                  </TouchableOpacity>
                </View>
                {shouldReplace ? (
                  <Text style={styles.replaceWarning}>
                    기존 문제를 비운 뒤 선택한 난이도로 새로 만듭니다.
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Text style={[styles.sectionTitle, styles.countSectionTitle]}>문항 수</Text>
            <View style={styles.countList}>
              {COUNT_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item.count}
                  style={[styles.countCard, item.recommended && styles.countCardRecommended]}
                  onPress={() =>
                    onSelectCount(item.count, {
                      learnerLevel: difficultyToLegacyLevel(selectedDifficulty),
                      difficultyLevel: selectedDifficulty,
                      shouldReplaceExisting: shouldReplace,
                    })
                  }
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

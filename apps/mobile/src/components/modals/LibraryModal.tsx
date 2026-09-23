/**
 * Library Modal Wrapper Component
 */

import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  QuestionRevision,
  Topic,
  Unit,
} from '../../contracts/types';
import { GeneratingWaitStatus } from '../../hooks/useQuizGeneration';
import { LoadingWaitOverlay } from './LoadingWaitOverlay';
import { LibraryScreen } from '../../features/library/LibraryScreen';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { appStyles as styles } from '../../styles/appStyles';

export interface LibraryModalProps {
  visible: boolean;
  onClose: () => void;
  questions: QuestionRevision[];
  topics: Topic[];
  units: Unit[];
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  onOpenTopicModal: () => void;
  onDeleteTopic: (id: string, name: string) => void;
  onDeleteUnit: (unitId: string) => Promise<void>;
  onGenerateCurriculumForTopic: (topicId: string, topicName: string) => Promise<void>;
  onQuickGenerateForUnit: (
    topicId: string,
    topicName: string,
    unitId: string,
    unitTitle: string
  ) => void;
  onDeduplicateUnits: (topicId: string) => Promise<void>;
  isAiGenerating: boolean;
  generatingUnitId: string | null;
  onStartExamWithQuestions: (questions: QuestionRevision[]) => void;
  onDeleteQuestion: (questionId: string) => Promise<void>;
  incorrectQuestions: QuestionRevision[];
  generatingWaitStatus?: GeneratingWaitStatus | null;
  onCancelGeneration?: () => void;
}

export const LibraryModal: React.FC<LibraryModalProps> = (props) => {
  // 오른쪽으로 스와이프하면 메인 화면으로 복귀
  const swipeHandlers = useSwipeGesture({
    onSwipeRight: props.onClose,
  });

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      onRequestClose={props.onClose}
    >
      <SafeAreaView style={styles.fullModalContainer} {...swipeHandlers}>
        <View style={styles.fullModalHeader}>
          {/* 1. 뒤로가기 버튼 */}
          <TouchableOpacity
            style={styles.fullModalBackBtn}
            onPress={props.onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.fullModalBackBtnText}>← 뒤로</Text>
          </TouchableOpacity>

          {/* 2. 화면 타이틀 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 18 }}>📚</Text>
            <Text style={styles.fullModalTitle}>과목 & 자료함</Text>
          </View>

          {/* 3. 저장 닫기 버튼 */}
          <TouchableOpacity
            style={styles.fullModalSaveBtn}
            onPress={props.onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.fullModalSaveBtnText}>💾 저장</Text>
          </TouchableOpacity>
        </View>
        <LibraryScreen
          questions={props.questions}
          topics={props.topics}
          units={props.units}
          refreshing={props.refreshing}
          onRefresh={props.onRefresh}
          onOpenTopicModal={props.onOpenTopicModal}
          onDeleteTopic={props.onDeleteTopic}
          onDeleteUnit={props.onDeleteUnit}
          onGenerateCurriculumForTopic={props.onGenerateCurriculumForTopic}
          onQuickGenerateForUnit={props.onQuickGenerateForUnit}
          onDeduplicateUnits={props.onDeduplicateUnits}
          isAiGenerating={props.isAiGenerating}
          generatingUnitId={props.generatingUnitId}
          onStartExamWithQuestions={props.onStartExamWithQuestions}
          onDeleteQuestion={props.onDeleteQuestion}
          incorrectQuestions={props.incorrectQuestions}
        />
        <LoadingWaitOverlay
          status={props.generatingWaitStatus || null}
          isAbsolute
          onCancel={props.onCancelGeneration}
        />
      </SafeAreaView>
    </Modal>
  );
};

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
  ManualCompletion,
  Source,
  ReviewState,
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
  completions: ManualCompletion[];
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  onOpenTopicModal: () => void;
  onOpenUnitModal: () => void;
  onDeleteTopic: (id: string, name: string) => void;
  onToggleUnitCompletion: (unitId: string) => Promise<void>;
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
  sources: Source[];
  sourceTitle: string;
  onChangeSourceTitle: (text: string) => void;
  sourceText: string;
  onChangeSourceText: (text: string) => void;
  onSaveSource: () => Promise<boolean>;
  onPickSourceFile: () => Promise<void>;
  selectedSourceTopicId: string | null;
  onSelectSourceTopicId: (topicId: string | null) => void;
  onDeleteSource: (sourceId: string) => Promise<void>;
  incorrectQuestions: QuestionRevision[];
  reviewStates: ReviewState[];
  generatingWaitStatus?: GeneratingWaitStatus | null;
  onOpenSourceModal: () => void;
  onOpenSettings?: () => void;
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
          completions={props.completions}
          refreshing={props.refreshing}
          onRefresh={props.onRefresh}
          onOpenSettings={props.onOpenSettings}
          onOpenTopicModal={props.onOpenTopicModal}
          onOpenUnitModal={props.onOpenUnitModal}
          onDeleteTopic={props.onDeleteTopic}
          onToggleUnitCompletion={props.onToggleUnitCompletion}
          onDeleteUnit={props.onDeleteUnit}
          onGenerateCurriculumForTopic={props.onGenerateCurriculumForTopic}
          onQuickGenerateForUnit={props.onQuickGenerateForUnit}
          onDeduplicateUnits={props.onDeduplicateUnits}
          isAiGenerating={props.isAiGenerating}
          generatingUnitId={props.generatingUnitId}
          onStartExamWithQuestions={props.onStartExamWithQuestions}
          onDeleteQuestion={props.onDeleteQuestion}
          sources={props.sources}
          sourceTitle={props.sourceTitle}
          onChangeSourceTitle={props.onChangeSourceTitle}
          sourceText={props.sourceText}
          onChangeSourceText={props.onChangeSourceText}
          onSaveSource={props.onSaveSource}
          onPickSourceFile={props.onPickSourceFile}
          selectedSourceTopicId={props.selectedSourceTopicId}
          onSelectSourceTopicId={props.onSelectSourceTopicId}
          onDeleteSource={props.onDeleteSource}
          incorrectQuestions={props.incorrectQuestions}
          reviewStates={props.reviewStates}
          onOpenSourceModal={props.onOpenSourceModal}
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

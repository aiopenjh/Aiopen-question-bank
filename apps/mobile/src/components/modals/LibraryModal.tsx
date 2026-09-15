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
import { LibraryScreen } from '../../features/library/LibraryScreen';
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
  onSaveSource: () => Promise<void>;
  onPickSourceFile: () => Promise<void>;
  selectedSourceTopicId: string | null;
  onSelectSourceTopicId: (topicId: string | null) => void;
  onDeleteSource: (sourceId: string) => Promise<void>;
  incorrectQuestions: QuestionRevision[];
  reviewStates: ReviewState[];
  onOpenSourceModal: () => void;
  onOpenSettings?: () => void;
}

export const LibraryModal: React.FC<LibraryModalProps> = (props) => {
  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      onRequestClose={props.onClose}
    >
      <SafeAreaView style={styles.fullModalContainer}>
        <View style={styles.fullModalHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 20 }}>📚</Text>
            <Text style={styles.fullModalTitle}>학습 과목 & 문제 자료함</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {props.onOpenSettings && (
              <TouchableOpacity
                style={styles.fullModalCloseBtn}
                onPress={props.onOpenSettings}
                activeOpacity={0.8}
              >
                <Text style={styles.fullModalCloseBtnText}>⚙️ 설정</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.fullModalSaveBtn}
              onPress={props.onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.fullModalSaveBtnText}>💾 닫기</Text>
            </TouchableOpacity>
          </View>
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
      </SafeAreaView>
    </Modal>
  );
};

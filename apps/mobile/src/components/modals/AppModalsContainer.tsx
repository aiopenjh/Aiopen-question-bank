/**
 * Common Application Modals Container Component
 * Groups and manages all secondary modal dialogs in one clean, declarative container.
 */

import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { UniversalModal as Modal } from '../common/UniversalModal';
import { Topic, Unit, QuestionRevision, Source, LearnerKnowledgeLevel } from '../../contracts/types';
import { AlertData } from '../../utils/alert';
import { appStyles as styles } from '../../styles/appStyles';

import { TopicModal } from './TopicModal';
import { UnitModal } from './UnitModal';
import { BackupModal } from './BackupModal';
import { QuizCountModal } from './QuizCountModal';
import { TopicSelectModal } from './TopicSelectModal';
import { UnitSelectModal } from './UnitSelectModal';
import { SourceUploadModal } from './SourceUploadModal';
import { UserManualModal } from './UserManualModal';
import { AppAlertModal } from './AppAlertModal';
import { LoadingWaitOverlay } from './LoadingWaitOverlay';

export interface AppModalsContainerProps {
  // 1. TopicModal
  topicModalVisible: boolean;
  initialTopicName?: string;
  onCloseTopicModal: () => void;
  onCreateTopic: (name: string, description: string, options?: any) => Promise<void>;

  // 2. UnitModal
  unitModalVisible: boolean;
  onCloseUnitModal: () => void;
  onCreateUnit: (title: string, depth: 1 | 2 | 3) => Promise<void>;

  // 3. BackupModal
  backupModalVisible: boolean;
  backupText: string;
  onChangeBackupText: (text: string) => void;
  onCloseBackupModal: () => void;
  onRestoreBackup: () => Promise<void>;
  onRestoreFromFile: () => Promise<void>;

  // 4. QuizCountModal
  quizCountModalVisible: boolean;
  pendingQuizUnit: {
    topicId: string;
    topicName: string;
    unitId: string;
    unitTitle: string;
    existingCount?: number;
    initialLevel?: LearnerKnowledgeLevel;
  } | null;
  onCloseQuizCountModal: () => void;
  onSelectQuizCount: (count: number, options?: any) => void;
  onOpenBackup: () => Promise<void>;

  // 5. TopicSelectModal
  isTopicSelectModalVisible: boolean;
  topics: Topic[];
  questions: QuestionRevision[];
  lastStudiedTopicId: string | null;
  onSelectTopic: (topic: Topic) => void | Promise<void>;
  onCloseTopicSelectModal: () => void;
  onOpenLibrary: () => void;

  // 6. UnitSelectModal
  isUnitSelectModalVisible: boolean;
  unitSelectTopic: Topic | null;
  units: Unit[];
  onSelectUnitForGeneration: (topic: Topic, unit: Unit) => void;
  onSelectTopicOverviewForGeneration: (topic: Topic) => void;
  onStartExamWithExistingQuestions: (qs: QuestionRevision[]) => void;
  onCloseUnitSelectModal: () => void;

  // 7. SourceUploadModal
  isSourceUploadModalOpen: boolean;
  sources: Source[];
  sourceTitle: string;
  sourceText?: string;
  selectedSourceTopicId: string | null;
  onSelectSourceTopicId: (topicId: string | null) => void;
  onChangeSourceTitle: (text: string) => void;
  onPickSourceFile: () => Promise<void>;
  onSaveSource: () => Promise<void>;
  onDeleteSource: (sourceId: string) => Promise<void>;
  onCloseSourceUploadModal: () => void;
  onOpenUserManual: () => void;

  // 8. UserManualModal
  isUserManualOpen: boolean;
  onCloseUserManual: () => void;

  // 9. AI Generation Wait Status
  generatingWaitStatus: {
    active: boolean;
    count: number;
    title?: string;
    message?: string;
  } | null;
  onCancelGeneration?: () => void;

  // 9. AppAlertModal
  appAlert: AlertData | null;
  onCloseAlert: () => void;
}

export const AppModalsContainer: React.FC<AppModalsContainerProps> = ({
  topicModalVisible,
  initialTopicName,
  onCloseTopicModal,
  onCreateTopic,
  unitModalVisible,
  onCloseUnitModal,
  onCreateUnit,
  backupModalVisible,
  backupText,
  onChangeBackupText,
  onCloseBackupModal,
  onRestoreBackup,
  onRestoreFromFile,
  quizCountModalVisible,
  pendingQuizUnit,
  onCloseQuizCountModal,
  onSelectQuizCount,
  onOpenBackup,
  isTopicSelectModalVisible,
  topics,
  questions,
  lastStudiedTopicId,
  onSelectTopic,
  onCloseTopicSelectModal,
  onOpenLibrary,
  isUnitSelectModalVisible,
  unitSelectTopic,
  units,
  onSelectUnitForGeneration,
  onSelectTopicOverviewForGeneration,
  onStartExamWithExistingQuestions,
  onCloseUnitSelectModal,
  isSourceUploadModalOpen,
  sources,
  sourceTitle,
  sourceText,
  selectedSourceTopicId,
  onSelectSourceTopicId,
  onChangeSourceTitle,
  onPickSourceFile,
  onSaveSource,
  onDeleteSource,
  onCloseSourceUploadModal,
  onOpenUserManual,
  isUserManualOpen,
  onCloseUserManual,
  generatingWaitStatus,
  onCancelGeneration,
  appAlert,
  onCloseAlert,
}) => {
  return (
    <>
      <TopicModal
        visible={topicModalVisible}
        initialTopicName={initialTopicName}
        onClose={onCloseTopicModal}
        onCreateTopic={onCreateTopic}
      />

      <UnitModal
        visible={unitModalVisible}
        onClose={onCloseUnitModal}
        onCreateUnit={onCreateUnit}
      />

      <BackupModal
        visible={backupModalVisible}
        backupText={backupText}
        onChangeBackupText={onChangeBackupText}
        onClose={onCloseBackupModal}
        onRestore={onRestoreBackup}
        onRestoreFromFile={onRestoreFromFile}
      />

      <QuizCountModal
        visible={quizCountModalVisible}
        topicName={pendingQuizUnit?.topicName}
        unitTitle={pendingQuizUnit?.unitTitle}
        existingCount={pendingQuizUnit?.existingCount}
        initialLevel={pendingQuizUnit?.initialLevel}
        onClose={onCloseQuizCountModal}
        onSelectCount={onSelectQuizCount}
        onOpenBackup={onOpenBackup}
      />

      <TopicSelectModal
        visible={isTopicSelectModalVisible}
        topics={topics}
        questions={questions}
        lastStudiedTopicId={lastStudiedTopicId}
        onSelectTopic={onSelectTopic}
        onClose={onCloseTopicSelectModal}
        onOpenLibrary={onOpenLibrary}
      />

      <UnitSelectModal
        visible={isUnitSelectModalVisible}
        topic={unitSelectTopic}
        units={units}
        questions={questions}
        onSelectUnitForGeneration={onSelectUnitForGeneration}
        onSelectTopicOverviewForGeneration={onSelectTopicOverviewForGeneration}
        onStartExamWithExistingQuestions={onStartExamWithExistingQuestions}
        onClose={onCloseUnitSelectModal}
      />

      <SourceUploadModal
        visible={isSourceUploadModalOpen}
        topics={topics}
        sources={sources}
        sourceTitle={sourceTitle}
        sourceText={sourceText}
        selectedSourceTopicId={selectedSourceTopicId}
        onSelectSourceTopicId={onSelectSourceTopicId}
        onChangeSourceTitle={onChangeSourceTitle}
        onPickSourceFile={onPickSourceFile}
        onSaveSource={onSaveSource}
        onDeleteSource={onDeleteSource}
        onClose={onCloseSourceUploadModal}
      />

      <UserManualModal
        visible={isUserManualOpen}
        onClose={onCloseUserManual}
      />

      {/* AI 문제 출제 대기 안내 모달 */}
      {generatingWaitStatus?.active && (
        <Modal visible transparent animationType="fade">
          <LoadingWaitOverlay status={generatingWaitStatus} onCancel={onCancelGeneration} />
        </Modal>
      )}

      {/* Global In-App Alert Modal */}
      <AppAlertModal alert={appAlert} onClose={onCloseAlert} />
    </>
  );
};

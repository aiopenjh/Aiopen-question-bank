import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StatusBar, ActivityIndicator, LogBox } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { showAlert, registerAlertListener, AlertData } from './src/utils/alert';
import {
  scheduleWeekdayStudyAlarms,
  registerNotificationResponseListener,
  checkInAppScheduledAlarm,
} from './src/utils/notifications';

// 고객/사용자 모바일 화면에 개발/경고 노란색 팝업(LogBox toast) 노출 방지
LogBox.ignoreAllLogs(true);

import { Topic } from './src/contracts/types';
import {
  generateUUID,
  getIncorrectQuestions,
  getAttempts,
  getReviewStates,
  getQuestions,
  getUnits,
} from './src/data/db';
import { getLocalDateString } from './src/domain/routine';
import { filterDueReviewQuestions } from './src/domain/spaced_repetition';

// Clean Modular Custom Hooks & Styles
import { appStyles as styles } from './src/styles/appStyles';
import { useAppData } from './src/hooks/useAppData';
import { useExamSession } from './src/hooks/useExamSession';
import { useQuizGeneration } from './src/hooks/useQuizGeneration';
import { usePromptGeneration } from './src/hooks/usePromptGeneration';
import { useSourceManager } from './src/hooks/useSourceManager';
import { useAppBackup } from './src/hooks/useAppBackup';
import { useSwipeGesture } from './src/hooks/useSwipeGesture';
import { useAppUpdate } from './src/hooks/useAppUpdate';

// Clean Modular Components & Feature Screens
import { Header } from './src/components/common/Header';
import { UpdateNotificationBanner } from './src/components/common/UpdateNotificationBanner';
import { AppModalsContainer } from './src/components/modals/AppModalsContainer';
import { LibraryModal } from './src/components/modals/LibraryModal';
import { SettingsModal } from './src/components/modals/SettingsModal';
import { AppAlertModal } from './src/components/modals/AppAlertModal';
import { StudyMapScreen } from './src/features/study/StudyMapScreen';
import { ExamSessionScreen } from './src/features/exam/ExamSessionScreen';

export default function App() {
  // 1. Core Data Hook
  const {
    loading,
    refreshing,
    routine,
    topics,
    setTopics,
    selectedTopicId,
    setSelectedTopicId,
    selectedUnitId,
    setSelectedUnitId,
    units,
    setUnits,
    completions,
    questions,
    setQuestions,
    attempts,
    setAttempts,
    reviewStates,
    setReviewStates,
    incorrectQuestions,
    setIncorrectQuestions,
    apiKey,
    setApiKey,
    sources,
    setSources,
    lastStudiedTopicId,
    setLastStudiedTopicId,
    alarmConfig,
    setAlarmConfig,
    handleChangeAlarmConfig,
    handleChangeTargetQuestionCount,
    loadAppData,
    handlePullRefresh,
    handleCreateTopic,
    handleDeleteTopic,
    handleCreateUnit,
    handleDeleteUnit,
    handleToggleUnitCompletion,
    handleDeleteQuestion,
    handleSaveApiKey,
    handleDeleteApiKey,
    handleSaveSettings,
  } = useAppData({
    onAfterTopicCreated: (created, generatedCount) => {
      setTopicModalVisible(false);
      if (isLibraryOpen) {
        showAlert(
          '과목 등록 완료',
          generatedCount > 0
            ? `[${created.name}] 과목과 ${generatedCount}개 학습 단원이 구성되었습니다.`
            : `[${created.name}] 과목이 등록되었습니다.`
        );
      } else {
        setUnitSelectTopic(created);
        setIsUnitSelectModalVisible(true);
      }
    },
  });

  // 2. Modals Visibility State
  const [topicModalVisible, setTopicModalVisible] = useState(false);
  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [isTopicSelectModalVisible, setIsTopicSelectModalVisible] = useState(false);
  const [isUnitSelectModalVisible, setIsUnitSelectModalVisible] = useState(false);
  const [unitSelectTopic, setUnitSelectTopic] = useState<Topic | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSourceUploadModalOpen, setIsSourceUploadModalOpen] = useState(false);
  const [isUserManualOpen, setIsUserManualOpen] = useState(false);

  // 3. Backup Hook
  const {
    backupModalVisible,
    setBackupModalVisible,
    backupText,
    setBackupText,
    handleExportBackup,
    handleRestoreFromFile,
    handleRestoreBackup,
    handleResetAllData,
  } = useAppBackup({ onRefreshData: loadAppData });

  // 4. Source Material Hook
  const {
    sourceTitle,
    setSourceTitle,
    sourceText,
    setSourceText,
    sourceTopicId,
    setSourceTopicId,
    handlePickSourceFile,
    handleSaveSource,
    handleDeleteSource,
  } = useSourceManager({ topics, setSources });

  // 5. Modular Exam Session Hook
  const {
    examSessionActive,
    examQuestions,
    startExam,
    handleCompleteExam,
    exitExamSession,
  } = useExamSession({
    questions,
    reviewStates,
    units,
    topics,
    selectedTopicId,
    selectedUnitId,
    setSelectedTopicId,
    setLastStudiedTopicId,
    onRefreshData: async () => {
      const [updatedAttempts, updatedRS, updatedInQ] = await Promise.all([
        getAttempts(),
        getReviewStates(),
        getIncorrectQuestions(),
      ]);
      setAttempts(updatedAttempts);
      setReviewStates(updatedRS);
      setIncorrectQuestions(updatedInQ);
    },
  });

  // 6. Modular AI Quiz Generation Hook
  const {
    isGenerating,
    setIsGenerating,
    isCurriculumGenerating,
    generatingUnitId,
    generatingWaitStatus,
    setGeneratingWaitStatus,
    quizCountModalVisible,
    setQuizCountModalVisible,
    pendingQuizUnit,
    handlePromptQuizCount,
    handleSelectQuizCount,
    handleGenerateMoreQuestions,
    handleApplyScaffolding,
    handleGenerateCurriculumForTopic,
    handleDeduplicateUnits,
    handleCancelGeneration,
  } = useQuizGeneration({
    apiKey,
    topics,
    units,
    questions,
    selectedTopicId,
    selectedUnitId,
    lastStudiedTopicId,
    incorrectQuestions,
    startExam,
    onOpenSettings: () => setIsSettingsOpen(true),
    onOpenTopicModal: () => setTopicModalVisible(true),
    onRefreshData: async () => {
      const [allQ, upUnits] = await Promise.all([getQuestions(), getUnits()]);
      setQuestions(allQ);
      setUnits(upUnits);
    },
    setUnits,
    setQuestions,
    onCloseLibrary: () => setIsLibraryOpen(false),
  });

  // 7. Quick Prompt Generation Hook
  const { handleQuickPromptGenerate } = usePromptGeneration({
    topics,
    setTopics,
    units,
    setUnits,
    setSelectedTopicId,
    setSelectedUnitId,
    setQuestions,
    startExam,
    onOpenSettings: () => setIsSettingsOpen(true),
    setIsGenerating,
    setGeneratingWaitStatus,
  });

  // 8. Global In-App Alert Modal State
  const [appAlert, setAppAlert] = useState<AlertData | null>(null);
  useEffect(() => {
    return registerAlertListener((data) => setAppAlert(data));
  }, []);

  // 9. Web PWA Auto-Update Detection
  const appUpdate = useAppUpdate();

  // 9. Push Alarms & Notification Response Listener
  const handleStartExamRef = useRef(handleStartExamWithAutoGenerate);
  useEffect(() => {
    handleStartExamRef.current = handleStartExamWithAutoGenerate;
  });

  useEffect(() => {
    scheduleWeekdayStudyAlarms();
    const unsubscribe = registerNotificationResponseListener(() => {
      handleStartExamRef.current?.();
    });

    checkInAppScheduledAlarm((slotLabel) => {
      showAlert(
        `⏰ [평일 ${slotLabel}] 정기 학습 시간입니다!`,
        '오늘의 실전 문제를 풀고 학습을 이어가시겠습니까?',
        [
          { text: '나중에', style: 'cancel' },
          { text: '지금 문제 풀기', onPress: () => handleStartExamRef.current?.() },
        ]
      );
    });

    return () => unsubscribe();
  }, []);

  // 10. 파생 상태 및 메인 화면 좌/우 넘기기(스와이프) 제스처 훅 (조기 리턴 방지 필수)
  const topicQuestions = selectedTopicId ? questions.filter((q) => q.topicId === selectedTopicId) : questions;
  const dueQuestions = filterDueReviewQuestions(topicQuestions.length > 0 ? topicQuestions : questions, reviewStates);
  const todayAttempts = attempts.filter((att) => att.submittedAt.startsWith(getLocalDateString()));
  const topicIncorrect = selectedTopicId
    ? incorrectQuestions.filter((q) => q.topicId === selectedTopicId)
    : incorrectQuestions;

  const mainSwipeHandlers = useSwipeGesture({
    onSwipeLeft: () => setIsLibraryOpen(true),
    onSwipeRight: () => setIsSettingsOpen(true),
  });

  async function handleStartExamWithAutoGenerate() {
    if (topics.length === 0) {
      showAlert('알림', '먼저 학습할 주제(대단원)를 등록해 주세요.', [
        { text: '닫기', style: 'cancel' },
        { text: '대단원 만들기', onPress: () => setTopicModalVisible(true) },
      ]);
      return;
    }
    if (topics.length >= 2) {
      setIsTopicSelectModalVisible(true);
      return;
    }
    await executeStartExamForTopic(topics[0]);
  }

  async function executeStartExamForTopic(topic: Topic) {
    setIsTopicSelectModalVisible(false);
    setSelectedTopicId(topic.id);
    setLastStudiedTopicId(topic.id);
    setUnitSelectTopic(topic);
    setIsUnitSelectModalVisible(true);
  }

  const handleStartDueReview = () => {
    if (dueQuestions.length === 0) {
      showAlert('복습 완료', '오늘 기한이 도래한 복습 문제가 없습니다!');
      return;
    }
    startExam(dueQuestions);
  };

  const handleStartIncorrectReview = async () => {
    const incorrect = await getIncorrectQuestions();
    if (incorrect.length === 0) {
      showAlert('오답 없음', '오답노트에 등록된 문제가 없습니다!');
      return;
    }
    startExam(incorrect);
  };

  // 어플 이름 터치 시 메인(홈) 화면으로 완전 복귀
  const handleGoHome = () => {
    setIsLibraryOpen(false);
    setIsSettingsOpen(false);
    setIsSourceUploadModalOpen(false);
    setIsUserManualOpen(false);
    setTopicModalVisible(false);
    setUnitModalVisible(false);
    setIsTopicSelectModalVisible(false);
    setIsUnitSelectModalVisible(false);
    handlePullRefresh();
  };

  // -------------------------------------------------------------
  // Render
  // -------------------------------------------------------------
  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#f43f5e" />
          <Text style={styles.loadingText}>데이터를 불러오는 중입니다...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // 독립 시험장 (CBT)
  if (examSessionActive && examQuestions.length > 0) {
    return (
      <SafeAreaProvider>
        <ExamSessionScreen
          questions={examQuestions}
          onExitExam={exitExamSession}
          onCompleteExam={handleCompleteExam}
        />
        <AppAlertModal alert={appAlert} onClose={() => setAppAlert(null)} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <Header
          hasApiKey={apiKey.length > 8}
          questionCount={questions.length}
          onOpenLibrary={() => setIsLibraryOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenSourceUpload={() => setIsSourceUploadModalOpen(true)}
          onGoHome={handleGoHome}
        />

        {/* 🚀 실시간 새 버전 자동 감지 배너 (1초 갱신) */}
        <UpdateNotificationBanner
          hasUpdate={appUpdate.hasUpdate}
          latestVersion={appUpdate.latestVersion}
          onApplyUpdate={appUpdate.applyUpdate}
        />

        <View style={styles.mainContent} {...mainSwipeHandlers}>
          <StudyMapScreen
            routine={routine}
            todayAttemptsCount={todayAttempts.length}
            dueQuestionsCount={dueQuestions.length}
            incorrectQuestionsCount={topicIncorrect.length}
            refreshing={refreshing}
            onRefresh={handlePullRefresh}
            onStartExam={handleStartExamWithAutoGenerate}
            onStartMoreQuestions={handleGenerateMoreQuestions}
            onStartDueReview={handleStartDueReview}
            onStartIncorrectReview={handleStartIncorrectReview}
            onGoToScaffolding={handleApplyScaffolding}
            onQuickPromptGenerate={handleQuickPromptGenerate}
            isAiGenerating={isCurriculumGenerating || generatingUnitId !== null || isGenerating}
            apiKey={apiKey}
            topicName={topics.find((t) => t.id === (selectedTopicId || lastStudiedTopicId))?.name}
            onOpenLibrary={() => setIsLibraryOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        </View>

        {/* 📚 자료함 (문제 보관함 & 교재) 새창 팝업 모달 */}
        <LibraryModal
          visible={isLibraryOpen}
          onClose={() => setIsLibraryOpen(false)}
          onOpenSettings={() => { setIsLibraryOpen(false); setIsSettingsOpen(true); }}
          questions={questions}
          topics={topics}
          units={units}
          completions={completions}
          refreshing={refreshing}
          onRefresh={handlePullRefresh}
          onOpenTopicModal={() => setTopicModalVisible(true)}
          onOpenUnitModal={() => setUnitModalVisible(true)}
          onDeleteTopic={handleDeleteTopic}
          onToggleUnitCompletion={handleToggleUnitCompletion}
          onDeleteUnit={handleDeleteUnit}
          onGenerateCurriculumForTopic={handleGenerateCurriculumForTopic}
          onQuickGenerateForUnit={(tId, tName, uId, uTitle) => handlePromptQuizCount(tId, tName, uId, uTitle)}
          onDeduplicateUnits={handleDeduplicateUnits}
          isAiGenerating={isCurriculumGenerating || generatingUnitId !== null || isGenerating}
          generatingUnitId={generatingUnitId}
          generatingWaitStatus={generatingWaitStatus}
          onStartExamWithQuestions={(qs) => { setIsLibraryOpen(false); startExam(qs); }}
          onDeleteQuestion={handleDeleteQuestion}
          sources={sources}
          sourceTitle={sourceTitle}
          onChangeSourceTitle={setSourceTitle}
          sourceText={sourceText}
          onChangeSourceText={setSourceText}
          onSaveSource={handleSaveSource}
          onPickSourceFile={handlePickSourceFile}
          selectedSourceTopicId={sourceTopicId}
          onSelectSourceTopicId={setSourceTopicId}
          onDeleteSource={handleDeleteSource}
          incorrectQuestions={incorrectQuestions}
          reviewStates={reviewStates}
          onOpenSourceModal={() => setIsSourceUploadModalOpen(true)}
          onCancelGeneration={handleCancelGeneration}
        />

        {/* ⚙️ 환경설정 새창 팝업 모달 */}
        <SettingsModal
          visible={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          apiKey={apiKey}
          onChangeApiKey={setApiKey}
          onSaveApiKey={handleSaveApiKey}
          onDeleteApiKey={handleDeleteApiKey}
          alarmConfig={alarmConfig}
          onChangeAlarmConfig={handleChangeAlarmConfig}
          targetQuestionCount={routine?.targetQuestionCount ?? 3}
          onChangeTargetQuestionCount={handleChangeTargetQuestionCount}
          onExportBackup={handleExportBackup}
          onOpenRestoreModal={() => {
            setBackupText('');
            setBackupModalVisible(true);
          }}
          onResetAllData={handleResetAllData}
          onSaveSettings={() => handleSaveSettings(() => setIsSettingsOpen(false))}
          onOpenUserManual={() => setIsUserManualOpen(true)}
          hasUpdate={appUpdate.hasUpdate}
          isCheckingUpdate={appUpdate.isChecking}
          latestVersion={appUpdate.latestVersion}
          onCheckForUpdate={() => appUpdate.checkForUpdate(true)}
          onApplyUpdate={appUpdate.applyUpdate}
        />

        {/* 공통 모달 컨테이너 (8종 모달 일원화) */}
        <AppModalsContainer
          topicModalVisible={topicModalVisible}
          onCloseTopicModal={() => setTopicModalVisible(false)}
          onCreateTopic={handleCreateTopic}
          unitModalVisible={unitModalVisible}
          onCloseUnitModal={() => setUnitModalVisible(false)}
          onCreateUnit={handleCreateUnit}
          backupModalVisible={backupModalVisible}
          backupText={backupText}
          onChangeBackupText={setBackupText}
          onCloseBackupModal={() => setBackupModalVisible(false)}
          onRestoreBackup={handleRestoreBackup}
          onRestoreFromFile={handleRestoreFromFile}
          quizCountModalVisible={quizCountModalVisible}
          pendingQuizUnit={pendingQuizUnit}
          onCloseQuizCountModal={() => setQuizCountModalVisible(false)}
          onSelectQuizCount={handleSelectQuizCount}
          onOpenBackup={handleExportBackup}
          isTopicSelectModalVisible={isTopicSelectModalVisible}
          topics={topics}
          questions={questions}
          lastStudiedTopicId={lastStudiedTopicId}
          onSelectTopic={executeStartExamForTopic}
          onCloseTopicSelectModal={() => setIsTopicSelectModalVisible(false)}
          onOpenLibrary={() => {
            setIsTopicSelectModalVisible(false);
            setIsLibraryOpen(true);
          }}
          isUnitSelectModalVisible={isUnitSelectModalVisible}
          unitSelectTopic={unitSelectTopic}
          units={units}
          onSelectUnitForGeneration={(topic, unit) => {
            setIsUnitSelectModalVisible(false);
            handlePromptQuizCount(topic.id, topic.name, unit.id, unit.title);
          }}
          onSelectTopicOverviewForGeneration={(topic) => {
            setIsUnitSelectModalVisible(false);
            handlePromptQuizCount(topic.id, topic.name, generateUUID(), `${topic.name} 핵심 종합`);
          }}
          onStartExamWithExistingQuestions={(qs) => {
            setIsUnitSelectModalVisible(false);
            startExam(qs);
          }}
          onCloseUnitSelectModal={() => setIsUnitSelectModalVisible(false)}
          isSourceUploadModalOpen={isSourceUploadModalOpen}
          sources={sources}
          sourceTitle={sourceTitle}
          sourceText={sourceText}
          selectedSourceTopicId={sourceTopicId}
          onSelectSourceTopicId={setSourceTopicId}
          onChangeSourceTitle={setSourceTitle}
          onPickSourceFile={handlePickSourceFile}
          onSaveSource={async () => {
            await handleSaveSource();
            setIsSourceUploadModalOpen(false);
          }}
          onDeleteSource={handleDeleteSource}
          onCloseSourceUploadModal={() => setIsSourceUploadModalOpen(false)}
          onOpenUserManual={() => setIsUserManualOpen(true)}
          isUserManualOpen={isUserManualOpen}
          onCloseUserManual={() => setIsUserManualOpen(false)}
          generatingWaitStatus={generatingWaitStatus}
          onCancelGeneration={handleCancelGeneration}
          appAlert={appAlert}
          onCloseAlert={() => setAppAlert(null)}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StatusBar,
  ActivityIndicator,
  LogBox,
  Animated,
  Platform,
  StyleSheet,
} from 'react-native';
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
import { useCurriculumManager } from './src/hooks/useCurriculumManager';
import { usePromptGeneration } from './src/hooks/usePromptGeneration';
import { useSourceManager } from './src/hooks/useSourceManager';
import { useAppBackup } from './src/hooks/useAppBackup';
import { useAppUpdate } from './src/hooks/useAppUpdate';
import { useBookPagerGesture } from './src/hooks/useBookPagerGesture';

// Clean Modular Components & Feature Screens
import { Header } from './src/components/common/Header';
import { UpdateNotificationBanner } from './src/components/common/UpdateNotificationBanner';
import { AppModalsContainer } from './src/components/modals/AppModalsContainer';
import { AppAlertModal } from './src/components/modals/AppAlertModal';
import { StudyMapScreen } from './src/features/study/StudyMapScreen';
import { LibraryScreen } from './src/features/library/LibraryScreen';
import { SettingsScreen } from './src/features/settings/SettingsScreen';
import { ExamSessionScreen } from './src/features/exam/ExamSessionScreen';

export default function App() {
  // 0. Book Pager Gesture & Navigation Hook ([0: 메인] -> [1: 과목자료함] -> [2: 설정])
  const {
    currentPage,
    containerWidth,
    translateX,
    goToPage,
    panResponder,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    onLayoutContainer,
  } = useBookPagerGesture(0);

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
      // 추가 팝업(단원 선택 모달) 없이, 즉시 과목자료함(Page 1)으로 이동하여 1~5단원 목차를 바로 보여줌!
      goToPage(1, true);
      showAlert(
        '과목 등록 완료',
        generatedCount > 0
          ? `[${created.name}] 과목과 1~${generatedCount}단계 목차가 자동 구성되었습니다.\n\n원하시는 단원의 [⚡ 출제 / 풀기]를 눌러 바로 시작하세요!`
          : `[${created.name}] 과목이 등록되었습니다.`
      );
    },
  });

  // 2. Modals Visibility State
  const [topicModalVisible, setTopicModalVisible] = useState(false);
  const [initialTopicName, setInitialTopicName] = useState('');
  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [isTopicSelectModalVisible, setIsTopicSelectModalVisible] = useState(false);
  const [isUnitSelectModalVisible, setIsUnitSelectModalVisible] = useState(false);
  const [unitSelectTopic, setUnitSelectTopic] = useState<Topic | null>(null);
  const [isSourceUploadModalOpen, setIsSourceUploadModalOpen] = useState(false);
  const [isUserManualOpen, setIsUserManualOpen] = useState(false);

  const handleOpenTopicModal = (name?: string) => {
    setInitialTopicName(name || '');
    setTopicModalVisible(true);
  };

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

  const handleExitExam = useCallback(() => {
    exitExamSession();
    // 시험 종료 시 문제 출제/선택을 시작했던 과목보관함(Page 1)으로 확실하고 부드럽게 복귀
    goToPage(1, false);
  }, [exitExamSession]);

  // 6. Modular AI Quiz Generation Hook (단원 문제 출제 전담)
  const {
    isGenerating,
    setIsGenerating,
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
    handleCancelGeneration: cancelQuizGeneration,
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
    onOpenSettings: () => goToPage(2),
    onOpenTopicModal: () => setTopicModalVisible(true),
    setQuestions,
  });

  // 6-1. Modular Curriculum Manager Hook (5단계/30단계 목차 설계 & 확장 전담)
  const {
    isCurriculumGenerating,
    handleGenerateCurriculumForTopic,
    handleDeduplicateUnits,
    cancelCurriculumGeneration,
  } = useCurriculumManager({
    units,
    questions,
    setUnits,
    startExam,
    setGeneratingWaitStatus,
  });

  const handleCancelGeneration = useCallback(() => {
    cancelQuizGeneration();
    cancelCurriculumGeneration();
  }, [cancelQuizGeneration, cancelCurriculumGeneration]);

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
    onOpenSettings: () => goToPage(2),
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

  // 10. 파생 상태
  const topicQuestions = selectedTopicId ? questions.filter((q) => q.topicId === selectedTopicId) : questions;
  const dueQuestions = filterDueReviewQuestions(topicQuestions.length > 0 ? topicQuestions : questions, reviewStates);
  const todayAttempts = attempts.filter((att) => att.submittedAt.startsWith(getLocalDateString()));
  const topicIncorrect = selectedTopicId
    ? incorrectQuestions.filter((q) => q.topicId === selectedTopicId)
    : incorrectQuestions;

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
    goToPage(0);
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

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <Header
          currentPage={currentPage}
          onSelectPage={(p) => goToPage(p, true)}
          hasApiKey={apiKey.length > 8}
          questionCount={questions.length}
          onOpenSourceUpload={() => setIsSourceUploadModalOpen(true)}
          onGoHome={handleGoHome}
        />

        {/* 🚀 실시간 새 버전 자동 감지 배너 (1회 닫기 즉시 영구 해제) */}
        <UpdateNotificationBanner
          hasUpdate={appUpdate.hasUpdate}
          latestVersion={appUpdate.latestVersion}
          onApplyUpdate={appUpdate.applyUpdate}
          onDismiss={appUpdate.dismissUpdate}
        />

        {/* 📖 자연스러운 책 넘김 수평 페이저: [0: 메인] -> [1: 과목자료함] -> [2: 설정] */}
        <View
          style={[
            styles.mainContent,
            {
              overflow: 'hidden',
              ...(Platform.OS === 'web'
                ? ({
                    touchAction: 'pan-y',
                    WebkitTouchCallout: 'none',
                  } as any)
                : {}),
            },
          ]}
          onLayout={onLayoutContainer}
          {...(Platform.OS !== 'web' ? panResponder.panHandlers : {})}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <Animated.View
            style={{
              flexDirection: 'row',
              width: containerWidth * 3,
              height: '100%',
              flexShrink: 0,
              transform: [{ translateX }],
              ...(Platform.OS === 'web'
                ? ({
                    willChange: 'transform',
                    transformStyle: 'preserve-3d',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                  } as any)
                : {}),
            }}
          >
            {/* 1. Page 0: 메인 (맨 왼쪽 고정, 왼쪽으로 더 갈 수 없음) */}
            <View
              style={{
                width: containerWidth,
                minWidth: containerWidth,
                maxWidth: containerWidth,
                flexShrink: 0,
                flexGrow: 0,
                height: '100%',
                ...(Platform.OS === 'web'
                  ? ({
                      transformStyle: 'preserve-3d',
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                    } as any)
                  : {}),
              }}
            >
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
                onOpenTopicModal={handleOpenTopicModal}
                onQuickPromptGenerate={handleQuickPromptGenerate}
                isAiGenerating={isCurriculumGenerating || generatingUnitId !== null || isGenerating}
                apiKey={apiKey}
                topicName={topics.find((t) => t.id === (selectedTopicId || lastStudiedTopicId))?.name}
                onOpenLibrary={() => goToPage(1, true)}
                onOpenSettings={() => goToPage(2, true)}
              />
            </View>

            {/* 2. Page 1: 과목자료함 (중간 페이지) */}
            <View
              style={{
                width: containerWidth,
                minWidth: containerWidth,
                maxWidth: containerWidth,
                flexShrink: 0,
                flexGrow: 0,
                height: '100%',
                ...(Platform.OS === 'web'
                  ? ({
                      transformStyle: 'preserve-3d',
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                    } as any)
                  : {}),
              }}
            >
              <LibraryScreen
                questions={questions}
                topics={topics}
                units={units}
                completions={completions}
                refreshing={refreshing}
                onRefresh={handlePullRefresh}
                onOpenTopicModal={() => handleOpenTopicModal('')}
                onOpenUnitModal={() => setUnitModalVisible(true)}
                onDeleteTopic={handleDeleteTopic}
                onToggleUnitCompletion={handleToggleUnitCompletion}
                onDeleteUnit={handleDeleteUnit}
                onGenerateCurriculumForTopic={handleGenerateCurriculumForTopic}
                onQuickGenerateForUnit={(tId, tName, uId, uTitle) => handlePromptQuizCount(tId, tName, uId, uTitle)}
                onDeduplicateUnits={handleDeduplicateUnits}
                isAiGenerating={isCurriculumGenerating || generatingUnitId !== null || isGenerating}
                generatingUnitId={generatingUnitId}
                onStartExamWithQuestions={(qs) => {
                  startExam(qs);
                }}
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
                onOpenSettings={() => goToPage(2, true)}
              />
            </View>

            {/* 3. Page 2: 설정 (맨 오른쪽 고정, 마지막 페이지) */}
            <View
              style={{
                width: containerWidth,
                minWidth: containerWidth,
                maxWidth: containerWidth,
                flexShrink: 0,
                flexGrow: 0,
                height: '100%',
                ...(Platform.OS === 'web'
                  ? ({
                      transformStyle: 'preserve-3d',
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                    } as any)
                  : {}),
              }}
            >
              <SettingsScreen
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
                onOpenUserManual={() => setIsUserManualOpen(true)}
                hasUpdate={appUpdate.hasUpdate}
                isCheckingUpdate={appUpdate.isChecking}
                latestVersion={appUpdate.latestVersion}
                onCheckForUpdate={() => appUpdate.checkForUpdate(true)}
                onApplyUpdate={appUpdate.applyUpdate}
              />
            </View>
          </Animated.View>
        </View>

        {/* 공통 모달 컨테이너 (8종 모달 일원화) */}
        <AppModalsContainer
          topicModalVisible={topicModalVisible}
          initialTopicName={initialTopicName}
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
            goToPage(1);
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

      {/* 독립 시험장 (CBT) - 메인 화면 unmount 없이 최상위 오버레이로 안전하게 렌더링 */}
      {examSessionActive && examQuestions.length > 0 && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, backgroundColor: '#ffffff' }]}>
          <ExamSessionScreen
            questions={examQuestions}
            onExitExam={handleExitExam}
            onCompleteExam={handleCompleteExam}
          />
        </View>
      )}
    </SafeAreaProvider>
  );
}

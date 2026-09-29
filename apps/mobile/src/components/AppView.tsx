import { useState, useEffect, useRef } from 'react';
import { View, Text, StatusBar, ActivityIndicator, Animated, Platform, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { generateUUID } from '../data/db';
import { appStyles as styles } from '../styles/appStyles';
import { Header } from '../components/common/Header';
import { UpdateNotificationBanner } from '../components/common/UpdateNotificationBanner';
import { AppModalsContainer } from '../components/modals/AppModalsContainer';
import { AppAlertModal } from '../components/modals/AppAlertModal';
import { AiDataNoticeModal } from '../components/modals/AiDataNoticeModal';
import { StudyMapScreen } from '../features/study/StudyMapScreen';
import { LibraryScreen } from '../features/library/LibraryScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { FeedbackModal } from '../features/study/FeedbackCard';
import { ExamSessionScreen } from '../features/exam/ExamSessionScreen';
import { DAILY_GOAL_DEFAULT } from '../domain/daily_goal';
import { AppController } from '../hooks/useAppController';
import { StorageSafeModeScreen } from './common/StorageSafeModeScreen';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';

export function AppView({ controller }: { controller: AppController }) {  const {
    loading, storageError, currentPage, goToPage, apiKey, setApiKey, setIsSourceUploadModalOpen,
    appUpdate, containerWidth, translateX, panResponder, handleTouchStart,
    handleTouchMove, handleTouchEnd, onLayoutContainer, routine, todayAttempts, dueQuestions,
    refreshing, handlePullRefresh, handleStartExamWithAutoGenerate,
    handleStartDueReview, handleOpenCustomNotebook, handleOpenTopicModal,
    isCurriculumGenerating, generatingUnitId, isGenerating, topics, selectedTopicId,
    lastStudiedTopicId, questions, units, setUnitModalVisible, handleDeleteTopic,
    handleDeleteUnit, handleGenerateCurriculumForTopic,
    handlePromptQuizCount, handleDeduplicateUnits, startExam, handleDeleteQuestion, sources,
    sourceTitle, setSourceTitle, sourceText, sourceFileName, sourcePageCount, isSourceFileLoading,
    sourcePageStart, setSourcePageStart, sourcePageEnd, setSourcePageEnd,
    handleSaveSource, handlePickSourceFile, handleReconnectSource, hasPdfInMemory,
    setSourceTopicId, handleDeleteSource, incorrectQuestions,
    openCustomNotebookRequest, handleSaveApiKey, handleDeleteApiKey, alarmConfig,
    handleChangeAlarmConfig, handleChangeTargetQuestionCount, backupText, setBackupText,
    setBackupModalVisible, handleExportBackup, handleResetAllData, setIsUserManualOpen,
    topicModalVisible, initialTopicName, setTopicModalVisible, handleCreateTopic, unitModalVisible,
    handleCreateUnit, backupModalVisible, handleRestoreBackup, handleRestoreFromFile,
    quizCountModalVisible, pendingQuizUnit, setQuizCountModalVisible, handleSelectQuizCount, handleSaveUnitDifficulty,
    isTopicSelectModalVisible, setIsTopicSelectModalVisible, executeStartExamForTopic,
    isUnitSelectModalVisible, setIsUnitSelectModalVisible, unitSelectTopic, isSourceUploadModalOpen,
    isUserManualOpen, generatingWaitStatus, handleCancelGeneration, examSessionActive, examSessionRunId,
    examQuestions, handleExitExam, handleCompleteExam, handleReinforceIncorrectConcepts,
    examCorrections, correctExamResult, undoExamResultCorrection,
    handleQuestionHintSaved,
    appAlert, setAppAlert,
  } = controller;
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const libraryBackHandlerRef = useRef<(() => boolean) | null>(null);
  // Retain visited pages so paging and modal state survive navigation.
  const [visitedPages, setVisitedPages] = useState(() => new Set([currentPage]));
  useEffect(() => {
    setVisitedPages(previous => previous.has(currentPage)
      ? previous : new Set([...previous, currentPage]));
  }, [currentPage]);
  // 설정(2) → 과목자료함(1) → 홈(0). 홈에서는 가로채지 않아 Android 기본 종료를 허용한다.
  // 시험 중에는 ExamSessionScreen이 처리한다.
  useAndroidBackHandler(() => {
    if (loading || storageError || examSessionActive) return false;
    if (currentPage === 1 && libraryBackHandlerRef.current?.()) return true;
    if (currentPage <= 0) return false;
    goToPage(currentPage - 1, true);
    return true;
  });
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

  if (storageError) {
    return <StorageSafeModeScreen error={storageError} onRetry={() => void controller.loadAppData(false)} />;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <Header
          currentPage={currentPage}
          onSelectPage={(p) => goToPage(p, true)}
          hasApiKey={apiKey.length > 8}
          onOpenSourceUpload={() => setIsSourceUploadModalOpen(true)}
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
              {(currentPage === 0 || visitedPages.has(0)) && <StudyMapScreen
                routine={routine}
                todayAttemptsCount={todayAttempts.length}
                dueQuestionsCount={dueQuestions.length}
                refreshing={refreshing}
                onRefresh={handlePullRefresh}
                onStartExam={handleStartExamWithAutoGenerate}
                onStartDueReview={handleStartDueReview}
                onOpenCustomNotebook={handleOpenCustomNotebook}
                onOpenTopicModal={handleOpenTopicModal}
                topicName={topics.find((t) => t.id === (selectedTopicId || lastStudiedTopicId))?.name}
              />}
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
              {(currentPage === 1 || visitedPages.has(1)) && <LibraryScreen
                isActive={currentPage === 1}
                androidBackHandlerRef={libraryBackHandlerRef}
                questions={questions}
                topics={topics}
                units={units}
                refreshing={refreshing}
                onRefresh={handlePullRefresh}
                onOpenTopicModal={() => handleOpenTopicModal('')}
                onDeleteTopic={handleDeleteTopic}
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
                incorrectQuestions={incorrectQuestions}
                openCustomNotebookRequest={openCustomNotebookRequest}
              />}
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
              {(currentPage === 2 || visitedPages.has(2)) && <SettingsScreen
                apiKey={apiKey}
                onChangeApiKey={setApiKey}
                onSaveApiKey={handleSaveApiKey}
                onDeleteApiKey={handleDeleteApiKey}
                alarmConfig={alarmConfig}
                onChangeAlarmConfig={handleChangeAlarmConfig}
                targetQuestionCount={routine?.targetQuestionCount ?? DAILY_GOAL_DEFAULT}
                onChangeTargetQuestionCount={handleChangeTargetQuestionCount}
                onExportBackup={handleExportBackup}
                topics={topics}
                units={units}
                questions={questions}
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
                onOpenFeedback={() => setFeedbackVisible(true)}
                refreshing={refreshing}
                onRefresh={handlePullRefresh}
              />}
            </View>
          </Animated.View>
        </View>

        <FeedbackModal visible={feedbackVisible} onClose={() => setFeedbackVisible(false)} />

        {/* 공통 모달 컨테이너 (8종 모달 일원화) */}
        <AppModalsContainer
          topicModalVisible={topicModalVisible}
          initialTopicName={initialTopicName}
          isPdfReady={hasPdfInMemory}
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
          onSaveUnitDifficulty={handleSaveUnitDifficulty}
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
          sourceFileName={sourceFileName}
          sourcePageCount={sourcePageCount}
          isSourceFileLoading={isSourceFileLoading}
          sourcePageStart={sourcePageStart}
          sourcePageEnd={sourcePageEnd}
          onChangeSourcePageStart={setSourcePageStart}
          onChangeSourcePageEnd={setSourcePageEnd}
          onSelectSourceTopicId={setSourceTopicId}
          onChangeSourceTitle={setSourceTitle}
          onPickSourceFile={handlePickSourceFile}
          onSaveSource={handleSaveSource}
          onDeleteSource={handleDeleteSource}
          onReconnectSource={handleReconnectSource}
          onCloseSourceUploadModal={() => setIsSourceUploadModalOpen(false)}
          isUserManualOpen={isUserManualOpen}
          onCloseUserManual={() => setIsUserManualOpen(false)}
          generatingWaitStatus={generatingWaitStatus}
          onCancelGeneration={handleCancelGeneration}
        />
      </SafeAreaView>

      {/* 독립 시험장 (CBT) - 메인 화면 unmount 없이 최상위 오버레이로 안전하게 렌더링 */}
      {examSessionActive && examSessionRunId && examQuestions.length > 0 && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, backgroundColor: '#ffffff' }]}>
          <ExamSessionScreen
            key={examSessionRunId}
            questions={examQuestions}
            onExitExam={handleExitExam}
            onCompleteExam={(results) => handleCompleteExam(results, examSessionRunId)}
            corrections={examCorrections}
            onCorrectResult={correctExamResult}
            onUndoCorrection={undoExamResultCorrection}
            onReinforceIncorrectConcepts={handleReinforceIncorrectConcepts}
            onHintSaved={handleQuestionHintSaved}
          />
        </View>
      )}

      {/* 모든 화면과 시험장보다 위에서 동작하는 전역 확인 팝업 */}
      <AppAlertModal alert={appAlert} onClose={() => setAppAlert(null)} />
      <AiDataNoticeModal />
    </SafeAreaProvider>
  );
}


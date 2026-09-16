import React from 'react';
import { View, Text, StatusBar, ActivityIndicator, Animated, Platform, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { generateUUID } from '../data/db';
import { showAlert } from '../utils/alert';
import { appStyles as styles } from '../styles/appStyles';
import { Header } from '../components/common/Header';
import { UpdateNotificationBanner } from '../components/common/UpdateNotificationBanner';
import { AppModalsContainer } from '../components/modals/AppModalsContainer';
import { AppAlertModal } from '../components/modals/AppAlertModal';
import { StudyMapScreen } from '../features/study/StudyMapScreen';
import { LibraryScreen } from '../features/library/LibraryScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { ExamSessionScreen } from '../features/exam/ExamSessionScreen';
import { RankingSyncModal } from '../components/modals/RankingSyncModal';
import { countTodayCompletedQuestions } from '../domain/ranking';
import { getLocalDateString } from '../domain/routine';
import { AppController } from '../hooks/useAppController';

export function AppView({ controller }: { controller: AppController }) {  const {
    loading, currentPage, goToPage, apiKey, setApiKey, setIsSourceUploadModalOpen,
    handleGoHome, appUpdate, containerWidth, translateX, panResponder, handleTouchStart,
    handleTouchMove, handleTouchEnd, onLayoutContainer, routine, todayAttempts, dueQuestions,
    refreshing, handlePullRefresh, handleStartExamWithAutoGenerate, handleGenerateMoreQuestions,
    handleStartDueReview, handleOpenCustomNotebook, handleOpenTopicModal, handleQuickPromptGenerate,
    isCurriculumGenerating, generatingUnitId, isGenerating, topics, selectedTopicId,
    lastStudiedTopicId, questions, units, completions, setUnitModalVisible, handleDeleteTopic,
    handleToggleUnitCompletion, handleDeleteUnit, handleGenerateCurriculumForTopic,
    handlePromptQuizCount, handleDeduplicateUnits, startExam, handleDeleteQuestion, sources,
    sourceTitle, setSourceTitle, sourceText, setSourceText, handleSaveSource, handlePickSourceFile,
    sourceTopicId, setSourceTopicId, handleDeleteSource, incorrectQuestions, reviewStates,
    openCustomNotebookRequest, handleSaveApiKey, handleDeleteApiKey, alarmConfig,
    handleChangeAlarmConfig, handleChangeTargetQuestionCount, backupText, setBackupText,
    setBackupModalVisible, handleExportBackup, handleResetAllData, setIsUserManualOpen,
    topicModalVisible, initialTopicName, setTopicModalVisible, handleCreateTopic, unitModalVisible,
    handleCreateUnit, backupModalVisible, handleRestoreBackup, handleRestoreFromFile,
    quizCountModalVisible, pendingQuizUnit, setQuizCountModalVisible, handleSelectQuizCount,
    isTopicSelectModalVisible, setIsTopicSelectModalVisible, executeStartExamForTopic,
    isUnitSelectModalVisible, setIsUnitSelectModalVisible, unitSelectTopic, isSourceUploadModalOpen,
    isUserManualOpen, generatingWaitStatus, handleCancelGeneration, examSessionActive,
    examQuestions, handleExitExam, handleCompleteExam, handleReinforceIncorrectConcepts,
    appAlert, setAppAlert,
    rankingProfile, handleRankingProfileChange, rankingSyncModalVisible, setRankingSyncModalVisible,
  } = controller;
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
                refreshing={refreshing}
                onRefresh={handlePullRefresh}
                onStartExam={handleStartExamWithAutoGenerate}
                onStartMoreQuestions={handleGenerateMoreQuestions}
                onStartDueReview={handleStartDueReview}
                onOpenCustomNotebook={handleOpenCustomNotebook}
                onOpenTopicModal={handleOpenTopicModal}
                onQuickPromptGenerate={handleQuickPromptGenerate}
                isAiGenerating={isCurriculumGenerating || generatingUnitId !== null || isGenerating}
                apiKey={apiKey}
                topicName={topics.find((t) => t.id === (selectedTopicId || lastStudiedTopicId))?.name}
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
                isActive={currentPage === 1}
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
                openCustomNotebookRequest={openCustomNotebookRequest}
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
                refreshing={refreshing}
                onRefresh={handlePullRefresh}
                rankingProfile={rankingProfile}
                onRankingProfileChange={handleRankingProfileChange}
                onOpenRankingSyncModal={() => setRankingSyncModalVisible(true)}
              />
            </View>
          </Animated.View>
        </View>

        <RankingSyncModal
          visible={rankingSyncModalVisible}
          rankingProfile={rankingProfile}
          todaySolvedCount={countTodayCompletedQuestions(todayAttempts)}
          localDate={getLocalDateString()}
          onClose={() => setRankingSyncModalVisible(false)}
          onSynced={(result) => {
            // 계획서 §3.2: 3문제 이상/미만에 따라 안내를 나눈다.
            const streakLine = result.qualifiedConsistency
              ? `꾸준함 기록에도 참여해 현재 ${result.currentStreak}일 연속입니다.`
              : `꾸준함은 오늘 ${3 - result.solvedCount}문제를 더 풀면 인정됩니다.`;
            showAlert(
              '연동 완료',
              `오늘 완료 ${result.solvedCount}문제가 반영되었습니다.\n${streakLine}\n\n누적 ${result.totalSolved}문제 · 최다 문제 풀이 ${result.solvedRank}위 · 꾸준함 ${result.consistencyRank}위`
            );
          }}
        />

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
        />
      </SafeAreaView>

      {/* 독립 시험장 (CBT) - 메인 화면 unmount 없이 최상위 오버레이로 안전하게 렌더링 */}
      {examSessionActive && examQuestions.length > 0 && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, backgroundColor: '#ffffff' }]}>
          <ExamSessionScreen
            questions={examQuestions}
            onExitExam={handleExitExam}
            onCompleteExam={handleCompleteExam}
            onReinforceIncorrectConcepts={handleReinforceIncorrectConcepts}
          />
        </View>
      )}

      {/* 모든 화면과 시험장보다 위에서 동작하는 전역 확인 팝업 */}
      <AppAlertModal alert={appAlert} onClose={() => setAppAlert(null)} />
    </SafeAreaProvider>
  );
}


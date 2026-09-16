import { useState, useEffect, useRef, useCallback } from 'react';
import { Topic } from '../contracts/types';
import { showAlert, registerAlertListener, AlertData } from '../utils/alert';
import {
  scheduleWeekdayStudyAlarms,
  registerNotificationResponseListener,
  checkInAppScheduledAlarm,
} from '../utils/notifications';
import {
  getIncorrectQuestions,
  getAttempts,
  getReviewStates,
} from '../data/db';
import { getLocalDateString } from '../domain/routine';
import { filterDueReviewQuestions } from '../domain/spaced_repetition';
import { useAppData } from './useAppData';
import { useExamSession } from './useExamSession';
import { useQuizGeneration } from './useQuizGeneration';
import { useCurriculumManager } from './useCurriculumManager';
import { usePromptGeneration } from './usePromptGeneration';
import { useSourceManager } from './useSourceManager';
import { useAppBackup } from './useAppBackup';
import { useAppUpdate } from './useAppUpdate';
import { useBookPagerGesture } from './useBookPagerGesture';

export function useAppController() {
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
      // 과목 생성 후 자료함으로 이동하여 생성된 단원 목차를 보여줍니다.
      goToPage(1, true);
      showAlert(
        '과목 등록 완료',
        generatedCount > 0
          ? `[${created.name}] 과목과 ${generatedCount}개 단원 목차가 자동 구성되었습니다.\n\n원하시는 단원의 [⚡ 출제 / 풀기]를 눌러 바로 시작하세요!`
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
  const [openCustomNotebookRequest, setOpenCustomNotebookRequest] = useState(0);

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
    setUnits,
  });

  // 6-1. Modular Curriculum Manager Hook (5개 단원 단위 목차 설계 및 30단원 이후 확장)
  const {
    isCurriculumGenerating,
    handleGenerateCurriculumForTopic,
    handleDeduplicateUnits,
    cancelCurriculumGeneration,
  } = useCurriculumManager({
    topics,
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
  const handleScheduledStudyRef = useRef(handleStartScheduledStudy);
  useEffect(() => {
    handleScheduledStudyRef.current = handleStartScheduledStudy;
  });

  useEffect(() => {
    scheduleWeekdayStudyAlarms();
    const unsubscribe = registerNotificationResponseListener(() => {
      handleScheduledStudyRef.current?.();
    });

    const triggerAlarmCheck = () => {
      checkInAppScheduledAlarm((slotLabel) => {
        showAlert(
          `⏰ [${slotLabel}] 정기 학습 시간입니다!`,
          '학습할 과목과 단원을 선택하시겠습니까?',
          [
            { text: '나중에', style: 'cancel' },
            { text: '단원 선택', onPress: () => handleScheduledStudyRef.current?.() },
          ]
        );
      });
    };

    // 앱 마운트 시 즉시 확인
    triggerAlarmCheck();

    // 앱 실행 중 정기 시간(예: 8시) 도래를 30초마다 실시간 감지!
    const alarmInterval = setInterval(triggerAlarmCheck, 30000);

    return () => {
      unsubscribe();
      clearInterval(alarmInterval);
    };
  }, []);

  // 10. 파생 상태
  const dueQuestions = filterDueReviewQuestions(questions, reviewStates);
  const todayAttempts = attempts.filter((att) => att.submittedAt.startsWith(getLocalDateString()));

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

  function handleStartScheduledStudy() {
    handleStartExamWithAutoGenerate();
  }

  const handleOpenCustomNotebook = () => {
    setOpenCustomNotebookRequest((request) => request + 1);
    goToPage(1, true);
  };

  const handleReinforceIncorrectConcepts = async () => {
    exitExamSession();
    await handleApplyScaffolding();
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
  return {
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
  };
}

export type AppController = ReturnType<typeof useAppController>;

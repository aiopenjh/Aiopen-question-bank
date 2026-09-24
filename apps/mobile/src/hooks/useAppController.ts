import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { selectIncorrectQuestions } from '../domain/question_history';
import { QuestionRevision, Topic } from '../contracts/types';
import { showAlert, registerAlertListener, AlertData } from '../utils/alert';
import {
  scheduleWeekdayStudyAlarms,
  registerNotificationResponseListener,
  checkInAppScheduledAlarm,
} from '../utils/notifications';
import {
  getAttempts,
  getReviewStates,
  getAttemptCorrections,
  getSourceTextForSource,
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
    sourceFileName,
    sourcePageCount,
    isSourceFileLoading,
    sourcePageStart,
    setSourcePageStart,
    sourcePageEnd,
    setSourcePageEnd,
    handlePickSourceFile,
    handleSaveSource,
    handleReconnectSource,
    hasPdfInMemory,
    getDocumentInputForSource,
    getDocumentInputForTopic,
    handleDeleteSource,
  } = useSourceManager({ topics, setSources });

  const handleCreateTopicWithSource: typeof handleCreateTopic = async (name, description, options) => {
    const selectedSource = options?.sourceId
      ? sources.find((source) => source.id === options.sourceId)
      : undefined;
    const sourceDocument = selectedSource?.kind === 'pdf'
      ? await getDocumentInputForSource(selectedSource.id)
      : undefined;
    const selectedSourceText = selectedSource?.kind !== 'pdf'
      ? await getSourceTextForSource(selectedSource?.id || '')
      : undefined;
    if (selectedSource?.kind === 'pdf' && !sourceDocument) {
      throw new Error(
        `“${selectedSource.fileName || selectedSource.title}” 원본을 저장하지 않았습니다. + 자료에서 원본 선택을 누른 뒤 다시 시도해 주세요.`
      );
    }
    await handleCreateTopic(name, description, {
      ...options,
      sourceDocument: sourceDocument || undefined,
      sourceText: selectedSourceText || undefined,
    });
  };

  // 5. Modular Exam Session Hook
  const {
    examSessionActive,
    examSessionRunId,
    examQuestions,
    examCorrections,
    startExam,
    handleCompleteExam,
    correctExamResult,
    undoExamResultCorrection,
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
      const [updatedAttempts, updatedRS, corrections] = await Promise.all([
        getAttempts(),
        getReviewStates(),
        getAttemptCorrections(),
      ]);
      setAttempts(updatedAttempts);
      setReviewStates(updatedRS);
      setIncorrectQuestions(selectIncorrectQuestions(questions, updatedAttempts, corrections));
    },
  });

  const handleExitExam = useCallback(() => {
    exitExamSession();
    // 시험 종료 시 문제 출제/선택을 시작했던 과목보관함(Page 1)으로 확실하고 부드럽게 복귀
    goToPage(1, false);
  }, [exitExamSession]);

  // 기존 문제에 온디맨드로 생성한 AI 힌트는 저장소(question_repository.updateQuestionHint)뿐
  // 아니라 앱이 들고 있는 questions 상태도 즉시 갱신해야 한다. 그렇지 않으면 시험을 나갔다가
  // 다시 들어올 때 startExam()이 갱신 전 questions 배열을 그대로 스냅샷하여, 이미 저장된
  // 힌트가 다시 "AI 힌트 만들기" 버튼으로 보이고 중복 API 호출로 이어질 수 있다.
  const handleQuestionHintSaved = useCallback((questionId: string, hint: string) => {
    setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, deepReasoningHint: hint } : q)));
  }, [setQuestions]);

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
    handleSaveUnitDifficulty,
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
    getDocumentInputForTopic,
    onOpenSourceManager: () => setIsSourceUploadModalOpen(true),
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
    getDocumentInputForTopic,
    onOpenSourceManager: () => setIsSourceUploadModalOpen(true),
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

  // 랭킹은 별도 랭킹 창에서 자체 상태로 동작하므로 여기서 다루지 않는다
  // (docs/ranking/RANKING_FEATURE_PLAN.md §3.3).

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
  const today = getLocalDateString();
  const dueQuestions = useMemo(
    () => filterDueReviewQuestions(questions, reviewStates, today),
    [questions, reviewStates, today]
  );
  const todayAttempts = useMemo(() => attempts.filter((att) => {
    const submittedAt = new Date(att.submittedAt);
    return !Number.isNaN(submittedAt.getTime()) && getLocalDateString(submittedAt) === today;
  }), [attempts, today]);

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

  const handleReinforceIncorrectConcepts = async (currentExamMistakes: QuestionRevision[]) => {
    await handleApplyScaffolding(currentExamMistakes);
  };

  return {
    loading, currentPage, goToPage, apiKey, setApiKey, setIsSourceUploadModalOpen,
    appUpdate, containerWidth, translateX, panResponder, handleTouchStart,
    handleTouchMove, handleTouchEnd, onLayoutContainer, routine, todayAttempts, dueQuestions,
    refreshing, handlePullRefresh, handleStartExamWithAutoGenerate, handleGenerateMoreQuestions,
    handleStartDueReview, handleOpenCustomNotebook, handleOpenTopicModal, handleQuickPromptGenerate,
    isCurriculumGenerating, generatingUnitId, isGenerating, topics, selectedTopicId,
    lastStudiedTopicId, questions, units, completions, setUnitModalVisible, handleDeleteTopic,
    handleToggleUnitCompletion, handleDeleteUnit, handleGenerateCurriculumForTopic,
    handlePromptQuizCount, handleDeduplicateUnits, startExam, handleDeleteQuestion, sources,
    sourceTitle, setSourceTitle, sourceText, setSourceText, sourceFileName, sourcePageCount, isSourceFileLoading,
    sourcePageStart, setSourcePageStart, sourcePageEnd, setSourcePageEnd,
    handleSaveSource, handlePickSourceFile, handleReconnectSource, hasPdfInMemory,
    sourceTopicId, setSourceTopicId, handleDeleteSource, incorrectQuestions, reviewStates,
    openCustomNotebookRequest, handleSaveApiKey, handleDeleteApiKey, alarmConfig,
    handleChangeAlarmConfig, handleChangeTargetQuestionCount, backupText, setBackupText,
    setBackupModalVisible, handleExportBackup, handleResetAllData, setIsUserManualOpen,
    topicModalVisible, initialTopicName, setTopicModalVisible, handleCreateTopic: handleCreateTopicWithSource, unitModalVisible,
    handleCreateUnit, backupModalVisible, handleRestoreBackup, handleRestoreFromFile,
    quizCountModalVisible, pendingQuizUnit, setQuizCountModalVisible, handleSelectQuizCount, handleSaveUnitDifficulty,
    isTopicSelectModalVisible, setIsTopicSelectModalVisible, executeStartExamForTopic,
    isUnitSelectModalVisible, setIsUnitSelectModalVisible, unitSelectTopic, isSourceUploadModalOpen,
    isUserManualOpen, generatingWaitStatus, handleCancelGeneration, examSessionActive, examSessionRunId,
    examQuestions, handleExitExam, handleCompleteExam, handleReinforceIncorrectConcepts,
    examCorrections, correctExamResult, undoExamResultCorrection,
    handleQuestionHintSaved,
    appAlert, setAppAlert,
  };
}

export type AppController = ReturnType<typeof useAppController>;

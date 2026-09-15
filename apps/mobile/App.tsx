import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StatusBar,
  ActivityIndicator,
  LogBox,
  Dimensions,
  Animated,
  PanResponder,
  Platform,
  Easing,
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
import { usePromptGeneration } from './src/hooks/usePromptGeneration';
import { useSourceManager } from './src/hooks/useSourceManager';
import { useAppBackup } from './src/hooks/useAppBackup';
import { useAppUpdate } from './src/hooks/useAppUpdate';

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
  // 0. Book Pager State (0: 메인, 1: 과목자료함, 2: 설정)
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    return Dimensions.get('window').width || 380;
  });

  const translateX = useRef(new Animated.Value(0)).current;
  const currentPageRef = useRef(0);
  const containerWidthRef = useRef(containerWidth);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    containerWidthRef.current = containerWidth;
  }, [containerWidth]);

  const isTransitioning = useRef<boolean>(false);
  const gestureStartPage = useRef<number>(0);

  const goToPage = (page: number, animated = true) => {
    const target = Math.max(0, Math.min(2, page));
    setCurrentPage(target);
    currentPageRef.current = target;
    const targetOffset = -target * containerWidthRef.current;

    if (animated) {
      isTransitioning.current = true;
      Animated.timing(translateX, {
        toValue: targetOffset,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        isTransitioning.current = false;
      });
    } else {
      translateX.setValue(targetOffset);
      isTransitioning.current = false;
    }
  };

  // 터치 기반 실시간 좌우 스와이프 제스처 컨트롤러 (웹 및 모바일 완전 호환)
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isSwipingHorizontal = useRef<boolean>(false);
  const isScrollingVertical = useRef<boolean>(false);

  // 내부 가로 스크롤(과목 필터 칩, 복습 칩 등) 터치 감지 헬퍼
  const isInsideHorizontalScroll = (target: any): boolean => {
    try {
      let el = target as HTMLElement | null;
      while (el && el !== document.body) {
        if (el.getAttribute?.('data-horizontal-scroll') === 'true') {
          return true;
        }
        if (typeof window !== 'undefined' && window.getComputedStyle) {
          const style = window.getComputedStyle(el);
          if (
            style &&
            (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
            el.scrollWidth > el.clientWidth
          ) {
            return true;
          }
        }
        el = el.parentElement;
      }
    } catch {
      // ignore
    }
    return false;
  };

  const handleTouchStart = (e: any) => {
    if (isTransitioning.current) return;
    if (!e.touches || e.touches.length !== 1) return;
    // 과목/카테고리 칩 등 내부 가로 스크롤 영역 터치 시 책 넘김 제스처 개입 완전 차단!
    if (Platform.OS === 'web' && e.target && isInsideHorizontalScroll(e.target)) {
      touchStartX.current = null;
      return;
    }
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    gestureStartPage.current = currentPageRef.current;
    isSwipingHorizontal.current = false;
    isScrollingVertical.current = false;
  };

  const handleTouchMove = (e: any) => {
    if (isTransitioning.current) return;
    if (touchStartX.current === null || !e.touches || isScrollingVertical.current) return;

    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current!;

    // 세로 스크롤 우선 보호: 세로 이동 감지 시 수평 스와이프를 완전히 차단하여 내부 스크롤 버벅임 방지
    if (!isSwipingHorizontal.current) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        isScrollingVertical.current = true;
        return;
      }
      // 명확한 가로 스와이프만 인식 (최소 25px & 가로가 세로의 1.8배 이상)
      if (Math.abs(dx) > 25 && Math.abs(dx) > Math.abs(dy) * 1.8) {
        isSwipingHorizontal.current = true;
      }
    }

    if (isSwipingHorizontal.current) {
      if (e.cancelable) {
        e.preventDefault?.();
      }
      const currentBase = -gestureStartPage.current * containerWidthRef.current;
      if (gestureStartPage.current === 0 && dx > 0) {
        translateX.setValue(currentBase + dx * 0.15);
      } else if (gestureStartPage.current === 2 && dx < 0) {
        translateX.setValue(currentBase + dx * 0.15);
      } else {
        translateX.setValue(currentBase + dx);
      }
    }
  };

  const handleTouchEnd = (e: any) => {
    if (isSwipingHorizontal.current && touchStartX.current !== null) {
      const touch = e.changedTouches ? e.changedTouches[0] : null;
      const endX = touch ? touch.clientX : touchStartX.current;
      const dx = endX - touchStartX.current;
      const startPage = gestureStartPage.current;

      // 시작 페이지(startPage) 기준으로 정확히 1페이지만 이동 (과목자료함 건너뛰기 원천 차단)
      if (dx < -50 && startPage < 2) {
        goToPage(startPage + 1);
      } else if (dx > 50 && startPage > 0) {
        goToPage(startPage - 1);
      } else {
        goToPage(startPage);
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
    isSwipingHorizontal.current = false;
    isScrollingVertical.current = false;
  };

  // React Native PanResponder (네이티브 모바일 전용 수평 제스처 컨트롤러)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (Platform.OS === 'web' || isTransitioning.current) return false;
        const { dx, dy } = gestureState;
        return Math.abs(dx) > 25 && Math.abs(dx) > Math.abs(dy) * 1.8;
      },
      onPanResponderGrant: () => {
        gestureStartPage.current = currentPageRef.current;
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        const { dx } = gestureState;
        const currentBase = -gestureStartPage.current * containerWidthRef.current;
        if (gestureStartPage.current === 0 && dx > 0) {
          translateX.setValue(currentBase + dx * 0.15);
        } else if (gestureStartPage.current === 2 && dx < 0) {
          translateX.setValue(currentBase + dx * 0.15);
        } else {
          translateX.setValue(currentBase + dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, vx } = gestureState;
        const startPage = gestureStartPage.current;
        if (dx < -50 || (dx < -25 && vx < -0.35)) {
          if (startPage < 2) {
            goToPage(startPage + 1);
          } else {
            goToPage(startPage);
          }
        } else if (dx > 50 || (dx > 25 && vx > 0.35)) {
          if (startPage > 0) {
            goToPage(startPage - 1);
          } else {
            goToPage(startPage);
          }
        } else {
          goToPage(startPage);
        }
      },
    })
  ).current;

  // 데스크톱 / 노트북 트랙패드 수평 스크롤 연동 (500ms 쿨다운 락으로 1페이지씩만 안전 전환)
  const isWheelLocked = useRef<boolean>(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onWheel = (e: WheelEvent) => {
      if (isWheelLocked.current || isTransitioning.current) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.8 && Math.abs(e.deltaX) > 35) {
        isWheelLocked.current = true;
        const startPage = currentPageRef.current;
        if (e.deltaX > 35 && startPage < 2) {
          goToPage(startPage + 1);
        } else if (e.deltaX < -35 && startPage > 0) {
          goToPage(startPage - 1);
        }
        setTimeout(() => {
          isWheelLocked.current = false;
        }, 500);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel);
    };
  }, []);

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
      if (currentPage === 1) {
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
    onOpenSettings: () => goToPage(2),
    onOpenTopicModal: () => setTopicModalVisible(true),
    onRefreshData: async () => {
      const [allQ, upUnits] = await Promise.all([getQuestions(), getUnits()]);
      setQuestions(allQ);
      setUnits(upUnits);
    },
    setUnits,
    setQuestions,
    onCloseLibrary: () => goToPage(0),
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
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && Math.abs(w - containerWidth) > 1) {
              setContainerWidth(w);
              translateX.setValue(-currentPageRef.current * w);
            }
          }}
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
                onStartExamWithQuestions={(qs) => {
                  goToPage(0, false);
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
    </SafeAreaProvider>
  );
}

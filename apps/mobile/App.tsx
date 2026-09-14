import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  StatusBar,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  LogBox,
  Platform,
  Share,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { showAlert, registerAlertListener, AlertData } from './src/utils/alert';
import {
  scheduleWeekdayStudyAlarms,
  registerNotificationResponseListener,
  checkInAppScheduledAlarm,
  AlarmConfig,
  DEFAULT_ALARM_CONFIG,
  getAlarmConfig,
  saveAlarmConfig,
} from './src/utils/notifications';

// 고객/사용자 모바일 화면에 개발/경고 노란색 팝업(LogBox toast) 노출 방지
LogBox.ignoreAllLogs(true);
import {
  initializeDatabase,
  getRoutine,
  saveRoutine,
  getTopics,
  createTopic,
  deleteTopic,
  getUnits,
  createUnit,
  deleteUnit,
  replaceTopicUnits,
  deduplicateTopicUnits,
  toggleUnitCompletion,
  markUnitAsCompleted,
  getManualCompletions,
  getQuestions,
  deleteQuestion,
  getAttempts,
  saveAttempt,
  getEncryptedApiKey,
  saveEncryptedApiKey,
  addSource,
  deleteSource,
  getSources,
  generateUUID,
  getCurrentISOTime,
  getReviewStates,
  saveReviewState,
  getIncorrectQuestions,
  getLastStudiedTopicId,
  saveLastStudiedTopicId,
  exportBackupJSON,
  restoreBackupJSON,
  clearAllData,
} from './src/data/db';
import {
  Topic,
  Unit,
  RoutineRevision,
  QuestionRevision,
  Attempt,
  ManualCompletion,
  Source,
  SourceRevision,
  SourceChunk,
  ReviewState,
  LearnerKnowledgeLevel,
  detectCategoryForTopic,
} from './src/contracts/types';
import {
  getLocalDateString,
} from './src/domain/routine';
import {
  analyzeUserIntent,
  generateFactBasedQuestions,
  generateCurriculumUnits,
} from './src/domain/generator';
import { filterDueReviewQuestions } from './src/domain/spaced_repetition';
import { compressBackupToZip, decompressBackupPayload, u8ToBase64, base64ToU8, unzipSync, strFromU8 } from './src/utils/backupArchive';

// Clean Modular Custom Hooks & Styles
import { appStyles as styles } from './src/styles/appStyles';
import { useExamSession } from './src/hooks/useExamSession';
import { useQuizGeneration } from './src/hooks/useQuizGeneration';

// Clean Modular Components
import { Header } from './src/components/common/Header';
import { TopicModal } from './src/components/modals/TopicModal';
import { UnitModal } from './src/components/modals/UnitModal';
import { BackupModal } from './src/components/modals/BackupModal';
import { QuizCountModal } from './src/components/modals/QuizCountModal';
import { TopicSelectModal } from './src/components/modals/TopicSelectModal';
import { UnitSelectModal } from './src/components/modals/UnitSelectModal';
import { AppAlertModal } from './src/components/modals/AppAlertModal';
import { SourceUploadModal } from './src/components/modals/SourceUploadModal';

// Clean Modular Feature Screens
import { StudyMapScreen } from './src/features/study/StudyMapScreen';
import { LibraryScreen } from './src/features/library/LibraryScreen';
import { SettingsScreen } from './src/features/settings/SettingsScreen';
import { ExamSessionScreen } from './src/features/exam/ExamSessionScreen';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Core Data States
  const [routine, setRoutine] = useState<RoutineRevision | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [completions, setCompletions] = useState<ManualCompletion[]>([]);
  const [questions, setQuestions] = useState<QuestionRevision[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [reviewStates, setReviewStates] = useState<ReviewState[]>([]);
  const [incorrectQuestions, setIncorrectQuestions] = useState<QuestionRevision[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [sources, setSources] = useState<Source[]>([]);

  // Modals Visibility
  const [topicModalVisible, setTopicModalVisible] = useState(false);
  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [backupText, setBackupText] = useState('');
  const [isTopicSelectModalVisible, setIsTopicSelectModalVisible] = useState(false);
  const [isUnitSelectModalVisible, setIsUnitSelectModalVisible] = useState(false);
  const [unitSelectTopic, setUnitSelectTopic] = useState<Topic | null>(null);
  const [lastStudiedTopicId, setLastStudiedTopicId] = useState<string | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSourceUploadModalOpen, setIsSourceUploadModalOpen] = useState(false);
  const [alarmConfig, setAlarmConfig] = useState<AlarmConfig>(DEFAULT_ALARM_CONFIG);

  // Modular Exam Session Hook
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

  // Modular AI Quiz Generation Hook
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
    handleQuickGenerateForUnit,
    handleGenerateMoreQuestions,
    handleApplyScaffolding,
    handleGenerateCurriculumForTopic,
    handleDeduplicateUnits,
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

  // Library Input State
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [sourceTopicId, setSourceTopicId] = useState<string | null>(null);

  // Global In-App Alert Modal State
  const [appAlert, setAppAlert] = useState<AlertData | null>(null);

  useEffect(() => {
    return registerAlertListener((data) => {
      setAppAlert(data);
    });
  }, []);

  useEffect(() => {
    loadAppData();
  }, []);

  async function handlePullRefresh() {
    setRefreshing(true);
    try {
      await loadAppData(true);
    } finally {
      setRefreshing(false);
    }
  }

  async function loadAppData(isPullRefresh: boolean = false) {
    try {
      if (!isPullRefresh) {
        setLoading(true);
      }
      await initializeDatabase();

      const [r, t, u, c, q, a, rStates, inQ, key, s, savedLastTId, aConfig] = await Promise.all([
        getRoutine(),
        getTopics(),
        getUnits(),
        getManualCompletions(),
        getQuestions(),
        getAttempts(),
        getReviewStates(),
        getIncorrectQuestions(),
        getEncryptedApiKey(),
        getSources(),
        getLastStudiedTopicId(),
        getAlarmConfig(),
      ]);

      setRoutine(r);
      setTopics(t);

      // 마지막 학습 대단원 복원 및 우선 선택
      let activeTopicId: string | null = null;
      if (savedLastTId && t.some((item) => item.id === savedLastTId)) {
        activeTopicId = savedLastTId;
      } else if (t.length > 0) {
        activeTopicId = t[0].id;
      }
      setSelectedTopicId(activeTopicId);
      setLastStudiedTopicId(savedLastTId);

      setUnits(u);
      setCompletions(c);
      setQuestions(q);
      setAttempts(a);
      setReviewStates(rStates);
      setIncorrectQuestions(inQ);
      setApiKey(key || '');
      setSources(s);
      setAlarmConfig(aConfig);

    } catch (err) {
      console.error('앱 데이터 로드 실패:', err);
    } finally {
      if (!isPullRefresh) {
        setLoading(false);
      }
    }
  }

  // 알람 및 푸시 탭 리스너
  const handleStartExamRef = useRef(handleStartExamWithAutoGenerate);
  useEffect(() => {
    handleStartExamRef.current = handleStartExamWithAutoGenerate;
  });

  useEffect(() => {
    // 1. 평일 오전 8시, 저녁 8시 정기 학습 알람 등록
    scheduleWeekdayStudyAlarms();

    // 2. 알람 탭(푸시 클릭) 시 즉시 시험 풀이 진입
    const unsubscribe = registerNotificationResponseListener(() => {
      handleStartExamRef.current?.();
    });

    // 3. 앱 실행 시 포그라운드 정기 알람 시간 도래 확인
    checkInAppScheduledAlarm((slotLabel) => {
      showAlert(
        `⏰ [평일 ${slotLabel}] 정기 학습 시간입니다!`,
        '오늘의 실전 문제를 풀고 학습을 이어가시겠습니까?',
        [
          { text: '나중에', style: 'cancel' },
          {
            text: '지금 문제 풀기',
            onPress: () => {
              handleStartExamRef.current?.();
            },
          },
        ]
      );
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // -------------------------------------------------------------
  // 주제(Topic) 및 단원(Unit) 핸들러
  // -------------------------------------------------------------
  async function handleCreateTopic(
    name: string,
    description: string,
    options?: { autoCurriculum?: boolean; learnerLevel?: LearnerKnowledgeLevel; category?: string }
  ) {
    const created = await createTopic(name, description, options?.category || '📚 일반');

    let generatedCount = 0;
    if (options?.autoCurriculum !== false) {
      try {
        const generatedUnits = await generateCurriculumUnits({
          topicName: name,
          topicDescription: description,
          learnerLevel: options?.learnerLevel,
        });

        for (const u of generatedUnits) {
          await createUnit({
            topicId: created.id,
            title: u.title,
            depth: u.depth,
          });
        }
        generatedCount = generatedUnits.length;
      } catch (err) {
        console.warn('단원 자동 생성 중 오류:', err);
      }
    }

    const [updatedTopics, updatedUnits] = await Promise.all([getTopics(), getUnits()]);
    setTopics(updatedTopics);
    setUnits(updatedUnits);
    setSelectedTopicId(created.id);
    setSelectedUnitId(null);
    setLastStudiedTopicId(created.id);
    await saveLastStudiedTopicId(created.id);

    setTopicModalVisible(false);

    if (isLibraryOpen) {
      if (generatedCount > 0) {
        showAlert(
          '과목 등록 완료',
          `[${created.name}] 과목과 ${generatedCount}개 학습 단원이 구성되었습니다.`
        );
      } else {
        showAlert('과목 등록 완료', `[${created.name}] 과목이 등록되었습니다.`);
      }
    } else {
      // 대단원이 없는 상태에서 문제풀기를 눌러 새로 생성했을 때:
      // 일일이 과목 자료함으로 가지 않고, 즉시 단원(영역) 선택 모달을 띄워 출제로 원스톱 직행!
      setUnitSelectTopic(created);
      setIsUnitSelectModalVisible(true);
    }
  }



  async function handleDeleteTopic(topicId: string, topicName: string) {
    showAlert(
      '주제 삭제',
      `[${topicName}] 주제와 연관된 모든 단원 및 문제가 삭제됩니다. 계속하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            await deleteTopic(topicId);
            const [t, u, q, inQ] = await Promise.all([
              getTopics(),
              getUnits(),
              getQuestions(),
              getIncorrectQuestions(),
            ]);
            setTopics(t);
            setUnits(u);
            setQuestions(q);
            setIncorrectQuestions(inQ);
            setSelectedTopicId(t.length > 0 ? t[0].id : null);
            setSelectedUnitId(null);
          },
        },
      ]
    );
  }

  async function handleCreateUnit(title: string, depth: 1 | 2 | 3) {
    if (!selectedTopicId) return;
    await createUnit({
      topicId: selectedTopicId,
      title,
      depth,
    });
    const updatedUnits = await getUnits();
    setUnits(updatedUnits);
  }

  async function handleDeleteUnit(unitId: string) {
    await deleteUnit(unitId);
    const updatedUnits = await getUnits();
    setUnits(updatedUnits);
    if (selectedUnitId === unitId) {
      setSelectedUnitId(null);
    }
  }

  async function handleToggleUnitCompletion(unitId: string) {
    await toggleUnitCompletion(unitId, 'owner-default');
    const updated = await getManualCompletions();
    setCompletions(updated);
  }


  async function handleStartExamWithAutoGenerate() {
    if (topics.length === 0) {
      showAlert('알림', '먼저 학습할 주제(대단원)를 등록해 주세요.', [
        { text: '닫기', style: 'cancel' },
        { text: '대단원 만들기', onPress: () => setTopicModalVisible(true) },
      ]);
      return;
    }

    // 대단원이 2개 이상(예: 언어, 수학 등)이면 사용자에게 선택 창을 띄움
    // (가장 최근에 학습했던 대단원을 최상단에 우선 표시)
    if (topics.length >= 2) {
      setIsTopicSelectModalVisible(true);
      return;
    }

    // 대단원이 1개인 경우 바로 시작
    await executeStartExamForTopic(topics[0]);
  }

  async function executeStartExamForTopic(topic: Topic) {
    setIsTopicSelectModalVisible(false);
    setSelectedTopicId(topic.id);
    setLastStudiedTopicId(topic.id);
    await saveLastStudiedTopicId(topic.id);

    // 대단원이 선택되면 자동으로 "어느 영역 문제를 생성해드릴까요?" 모달을 띄워 영역 선택 및 출제로 연결
    setUnitSelectTopic(topic);
    setIsUnitSelectModalVisible(true);
  }


  // -------------------------------------------------------------
  // 교재/발췌 자료 파일 첨부 & 등록 핸들러
  // -------------------------------------------------------------
  async function handlePickSourceFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      const fileName = file.name;
      const ext = fileName.split('.').pop()?.toLowerCase() || '';

      // 1. 한글 파일(.hwp, .hwpx) 차단 및 친절한 변환 가이드
      if (ext === 'hwp' || ext === 'hwpx') {
        showAlert(
          '⚠️ 한글 문서(.hwp) 변환 안내',
          '한글 문서(.hwp)는 AI 엔진이 바로 읽을 수 없는 고유 바이너리 규격입니다.\n\n한글 프로그램에서 [파일 > 다른 이름으로 저장 > PDF 또는 텍스트(.txt)]로 변환하신 후 첨부해 주세요!'
        );
        return;
      }

      let extractedText = '';

      // 2. ZIP 압축 파일 (내부 txt, md, json, pdf 등 자동 압축 해제)
      if (ext === 'zip') {
        let u8: Uint8Array;
        if (Platform.OS === 'web' && (file as any).file) {
          const buf = await (file as any).file.arrayBuffer();
          u8 = new Uint8Array(buf);
        } else {
          const b64 = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          u8 = base64ToU8(b64);
        }
        const unzipped = unzipSync(u8);
        let foundCount = 0;
        for (const name of Object.keys(unzipped)) {
          const innerExt = name.split('.').pop()?.toLowerCase();
          if (innerExt === 'txt' || innerExt === 'md' || innerExt === 'json' || innerExt === 'csv') {
            extractedText += `[${name}]\n` + strFromU8(unzipped[name]) + '\n\n';
            foundCount++;
          } else if (innerExt === 'pdf') {
            extractedText += `[압축 내 PDF 교재: ${name}]\n`;
            foundCount++;
          }
        }
        if (foundCount === 0) {
          extractedText = `[ZIP 아카이브: ${fileName}] (${Object.keys(unzipped).length}개 파일 포함)`;
        }
      } else if (ext === 'txt' || ext === 'md' || ext === 'csv' || ext === 'json') {
        // 3. 텍스트 / 마크다운 문서
        if (Platform.OS === 'web' && (file as any).file) {
          extractedText = await (file as any).file.text();
        } else {
          extractedText = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
        }
      } else if (ext === 'pdf') {
        // 4. PDF 교재 문서
        const sizeKb = file.size ? Math.round(file.size / 1024) : 0;
        extractedText = `[PDF 교재: ${fileName} (${sizeKb}KB)]\n해당 PDF 교재의 학습 내용에 기반하여 문제가 정밀 출제됩니다.`;
      } else {
        extractedText = `[첨부 파일: ${fileName}]`;
      }

      // 제목 자동 기입 (확장자 제거)
      const cleanTitle = fileName.replace(/\.[^/.]+$/, '');
      setSourceTitle(cleanTitle);
      setSourceText(extractedText);

      showAlert(
        '📁 파일 불러오기 완료',
        `"${fileName}" 파일 내용이 준비되었습니다.\n\n적용할 학습 과목(대단원)을 선택하신 후 [💾 교재 자료 등록하기]를 눌러주세요!`
      );
    } catch (err: any) {
      console.warn('파일 첨부 실패:', err);
      showAlert('오류', `파일을 불러오는 중 오류가 발생했습니다: ${err?.message || '알 수 없는 오류'}`);
    }
  }

  async function handleSaveSource() {
    if (!sourceTitle.trim()) {
      showAlert('알림', '자료 제목을 입력해 주세요.');
      return;
    }

    const targetTopic = topics.find((t) => t.id === sourceTopicId);
    const finalTitle = targetTopic
      ? `[${targetTopic.name}] ${sourceTitle.trim()}`
      : sourceTitle.trim();

    const sourceId = generateUUID();
    const revId = generateUUID();

    const newSource: Source = {
      id: sourceId,
      ownerId: 'owner-default',
      kind: 'text',
      title: finalTitle,
      visibility: 'private',
      allowExternalProcessing: false,
      archivedAt: null,
      createdAt: getCurrentISOTime(),
    };

    const newRev: SourceRevision = {
      id: revId,
      sourceId,
      hash: 'sha256-' + Date.now(),
      provenance: targetTopic ? `[${targetTopic.name}] 연계 교재 자료` : '교재 및 텍스트 발췌',
      originalFileRef: null,
      createdAt: getCurrentISOTime(),
    };

    const content = sourceText.trim() || sourceTitle.trim();
    const newChunk: SourceChunk = {
      id: generateUUID(),
      revisionId: revId,
      rawText: content,
      normalizedText: content.replace(/\s+/g, ' '),
      locator: { kind: 'text', blockIndex: 0 },
      extractionStatus: 'success',
    };

    await addSource(newSource, newRev, [newChunk]);
    const updatedSources = await getSources();
    setSources(updatedSources);

    showAlert('등록 완료', `"${finalTitle}" 교재 자료가 안전하게 로컬 저장소에 보관되었습니다.`);
    setSourceTitle('');
    setSourceText('');
  }

  async function handleDeleteSource(sourceId: string) {
    showAlert('자료 삭제', '이 교재 자료를 보관함에서 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제하기',
        style: 'destructive',
        onPress: async () => {
          await deleteSource(sourceId);
          const updatedSources = await getSources();
          setSources(updatedSources);
          showAlert('삭제 완료', '교재 자료가 삭제되었습니다.');
        },
      },
    ]);
  }

  async function handleDeleteQuestion(questionId: string) {
    showAlert('문제 삭제', '이 문제를 보관함에서 영구 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제하기',
        style: 'destructive',
        onPress: async () => {
          await deleteQuestion(questionId);
          const allQ = await getQuestions();
          setQuestions(allQ);
          showAlert('삭제 완료', '문제가 보관함에서 삭제되었습니다.');
        },
      },
    ]);
  }

  // -------------------------------------------------------------
  // 설정 & 보안 저장 핸들러
  // -------------------------------------------------------------
  async function handleSaveApiKey(keyToSave?: string) {
    const targetKey = (typeof keyToSave === 'string' ? keyToSave : apiKey).trim();
    if (!targetKey) {
      showAlert('알림', '저장할 API Key를 입력해 주세요.');
      return;
    }
    await saveEncryptedApiKey(targetKey);
    setApiKey(targetKey);
    showAlert(
      '🔒 보안 암호화 저장 완료',
      'API Key가 안전하게 보관되었습니다.\n이제 AI 맞춤 문제 출제를 바로 이용하실 수 있습니다!'
    );
  }

  async function handleDeleteApiKey() {
    await saveEncryptedApiKey('');
    setApiKey('');
    showAlert('삭제 완료', '저장된 API Key가 안전하게 파기되었습니다.');
  }

  async function handleSaveSettingsAndClose() {
    try {
      const trimmed = apiKey.trim();
      if (trimmed) {
        await saveEncryptedApiKey(trimmed);
      }
      await saveAlarmConfig(alarmConfig);
      showAlert('저장 완료', '설정 사항 및 알람 시간이 안전하게 저장되었습니다.');
      setIsSettingsOpen(false);
    } catch (err: any) {
      showAlert('오류', `저장 중 오류 발생: ${err?.message || '알 수 없는 오류'}`);
    }
  }


  async function handleExportBackup() {
    let json = '';
    try {
      json = await exportBackupJSON();
      const dateStr = new Date().toISOString().slice(0, 10);
      const zipFileName = `Celueste_Study_Backup_${dateStr}.zip`;
      const zipBytes = compressBackupToZip(json);

      if (Platform.OS === 'web') {
        // 웹 브라우저: .zip 압축 파일 직접 다운로드
        const blob = new Blob([zipBytes.buffer as ArrayBuffer], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = zipFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showAlert('압축 백업 완료', `85~90% 용량이 압축된 백업 파일(${zipFileName})이 다운로드되었습니다.`);
      } else {
        // 모바일 (Android/iOS): 압축 파일 생성 후 공유 시트로 전송 (카톡/메일/클라우드 저장 등)
        const fileUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${zipFileName}`;
        const base64 = u8ToBase64(zipBytes);
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/zip',
            dialogTitle: '학습 데이터 압축 백업 파일 공유/저장',
            UTI: 'public.zip-archive',
          });
        } else {
          // 공유 기능 미지원 기기 폴백
          setBackupText(json);
          setBackupModalVisible(true);
        }
      }
    } catch (err: any) {
      console.warn('압축 백업 파일 생성 및 공유 실패:', err);
      if (json) {
        setBackupText(json);
        setBackupModalVisible(true);
      } else {
        showAlert('오류', `백업 생성 중 오류 발생: ${err?.message || '알 수 없는 오류'}`);
      }
    }
  }

  async function handleRestoreFromFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      let content = '';

      if (Platform.OS === 'web' && (file as any).file) {
        const arrayBuffer = await (file as any).file.arrayBuffer();
        const u8 = new Uint8Array(arrayBuffer);
        content = decompressBackupPayload(u8);
      } else {
        // 모바일: ZIP 압축 파일 여부 자동 감지 및 압축 해제
        try {
          const base64 = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const u8 = base64ToU8(base64);
          content = decompressBackupPayload(u8);
        } catch {
          content = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
        }
      }

      if (!content || !content.trim()) {
        showAlert('오류', '선택한 파일의 내용이 비어 있거나 올바르지 않습니다.');
        return;
      }

      const res = await restoreBackupJSON(content);
      showAlert(res.success ? '압축 해제 및 복원 완료' : '복원 실패', res.message);
      if (res.success) {
        await loadAppData();
        setBackupModalVisible(false);
        setBackupText('');
      }
    } catch (err: any) {
      console.warn('파일 복원 실패:', err);
      showAlert('복원 실패', `백업 파일을 읽거나 압축을 푸는 중 오류가 발생했습니다: ${err?.message || '파일 오류'}`);
    }
  }

  async function handleRestoreBackup() {
    if (!backupText.trim()) {
      showAlert('알림', '복원할 백업 JSON 데이터를 입력(붙여넣기)해 주세요.');
      return;
    }
    const res = await restoreBackupJSON(backupText);
    showAlert(res.success ? '복원 완료' : '복원 실패', res.message);
    if (res.success) {
      await loadAppData();
      setBackupModalVisible(false);
      setBackupText('');
    }
  }

  function handleResetAllData() {
    showAlert('전체 초기화', '모든 주제, 단원, 문제 및 학습 기록이 삭제됩니다. 계속하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '완전 초기화',
        style: 'destructive',
        onPress: async () => {
          await clearAllData();
          await loadAppData();
          showAlert('초기화 완료', '모든 데이터가 깨끗하게 정리되었습니다.');
        },
      },
    ]);
  }

  // -------------------------------------------------------------
  // 렌더링
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
        {/* CBT 시험장 내 전용 인앱 알림 모달 (나가기 확인창 등 정상 작동 보장) */}
        <AppAlertModal alert={appAlert} onClose={() => setAppAlert(null)} />
      </SafeAreaProvider>
    );
  }

  const currentTopic = topics.find((t) => t.id === selectedTopicId);
  const topicUnits = units.filter((u) => u.topicId === selectedTopicId);
  const topicQuestions = selectedTopicId ? questions.filter((q) => q.topicId === selectedTopicId) : questions;
  const dueQuestions = filterDueReviewQuestions(topicQuestions.length > 0 ? topicQuestions : questions, reviewStates);
  const todayAttempts = attempts.filter((att) => att.submittedAt.startsWith(getLocalDateString()));

  const topicIncorrect = selectedTopicId
    ? incorrectQuestions.filter((q) => q.topicId === selectedTopicId)
    : incorrectQuestions;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

      <Header
        hasApiKey={apiKey.length > 8}
        questionCount={questions.length}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <View style={styles.mainContent}>
        <StudyMapScreen
            routine={routine}
            todayAttemptsCount={todayAttempts.length}
            dueQuestionsCount={dueQuestions.length}
            incorrectQuestionsCount={topicIncorrect.length}
            refreshing={refreshing}
            onRefresh={handlePullRefresh}
            onStartExam={handleStartExamWithAutoGenerate}
            onStartMoreQuestions={handleGenerateMoreQuestions}
            onStartDueReview={() => {
              if (dueQuestions.length === 0) {
                showAlert('복습 완료', '오늘 기한이 도래한 복습 문제가 없습니다!');
                return;
              }
              startExam(dueQuestions);
            }}
            onStartIncorrectReview={async () => {
              const incorrect = await getIncorrectQuestions();
              if (incorrect.length === 0) {
                showAlert('오답 없음', '오답노트에 등록된 문제가 없습니다!');
                return;
              }
              startExam(incorrect);
            }}
            onGoToScaffolding={handleApplyScaffolding}
            onOpenSourceUpload={() => setIsSourceUploadModalOpen(true)}
            onQuickPromptGenerate={async (prompt) => {
              try {
                setIsGenerating(true);
                setGeneratingWaitStatus({
                  active: true,
                  count: 3,
                  title: prompt,
                  message: '⚡ AI 맞춤 문제 출제 중입니다 (약 10초 내외 소요)...',
                });
                // 1. 사용자 프롬프트로부터 순수 도메인 의도 분석 (기존 선택된 주제 오염 방지)
                const intent = analyzeUserIntent(prompt);
                const category = detectCategoryForTopic(`${prompt} ${intent.domain}`);

                // 2. 정확히 일치하는 기존 학습 주제가 있는지 검색 (억지 부분 일치 추론 방지)
                let targetTopic = topics.find(
                  (t) => t.name.trim().toLowerCase() === intent.domain.trim().toLowerCase()
                );

                let targetUnitId: string | undefined;
                let targetUnitTitle: string | undefined;

                if (!targetTopic) {
                  // 대단위에 새로운 과목 주제 자동 등록 및 기본 단원 자동 생성
                  targetTopic = await createTopic(intent.domain, `${category} 맞춤 커리큘럼`, category);
                  const newUnit = await createUnit({
                    topicId: targetTopic.id,
                    title: `${intent.domain} 핵심 종합`,
                    depth: 1,
                  });
                  targetUnitId = newUnit.id;
                  targetUnitTitle = newUnit.title;

                  const [upTopics, upUnits] = await Promise.all([getTopics(), getUnits()]);
                  setTopics(upTopics);
                  setUnits(upUnits);
                  setSelectedTopicId(targetTopic.id);
                  setSelectedUnitId(newUnit.id);
                } else {
                  setSelectedTopicId(targetTopic.id);
                  const tUnits = units.filter((u) => u.topicId === targetTopic!.id);
                  if (tUnits.length > 0) {
                    targetUnitId = tUnits[0].id;
                    targetUnitTitle = tUnits[0].title;
                    setSelectedUnitId(tUnits[0].id);
                  } else {
                    const newUnit = await createUnit({
                      topicId: targetTopic.id,
                      title: `${targetTopic.name} 핵심 종합`,
                      depth: 1,
                    });
                    targetUnitId = newUnit.id;
                    targetUnitTitle = newUnit.title;
                    const upUnits = await getUnits();
                    setUnits(upUnits);
                    setSelectedUnitId(newUnit.id);
                  }
                }

                const outcome = await generateFactBasedQuestions({
                  intent,
                  ownerId: 'owner-default',
                  topicId: targetTopic.id,
                  topicName: targetTopic.name,
                  unitId: targetUnitId,
                  unitTitle: targetUnitTitle || intent.domain,
                  customContext: prompt,
                });
                if (outcome.status === 'NEEDS_CONNECTION') {
                  showAlert('⚠️ API 키 필요', outcome.message, [
                    { text: '닫기' },
                    { text: '설정 열기', onPress: () => setIsSettingsOpen(true) },
                  ]);
                  return;
                }
                if (outcome.status === 'FAILED') {
                  showAlert('출제 실패', outcome.message);
                  return;
                }
                const allQ = await getQuestions();
                setQuestions(allQ);
                startExam(outcome.questions);
              } catch (err: any) {
                showAlert('출제 오류', err.message);
              } finally {
                setIsGenerating(false);
                setGeneratingWaitStatus(null);
              }
            }}
            isAiGenerating={isCurriculumGenerating || generatingUnitId !== null || isGenerating}
          />
        </View>

        {/* 📚 자료함 (문제 보관함 & 교재) 새창 팝업 모달 */}
        <Modal
          visible={isLibraryOpen}
          animationType="slide"
          onRequestClose={() => setIsLibraryOpen(false)}
        >
          <SafeAreaView style={styles.fullModalContainer}>
            <View style={styles.fullModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 20 }}>📚</Text>
                <Text style={styles.fullModalTitle}>학습 과목 & 문제 자료함</Text>
              </View>
              <TouchableOpacity
                style={styles.fullModalSaveBtn}
                onPress={() => setIsLibraryOpen(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.fullModalSaveBtnText}>💾 저장</Text>
              </TouchableOpacity>
            </View>
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
              onQuickGenerateForUnit={(topicId, topicName, unitId, unitTitle) => {
                handlePromptQuizCount(topicId, topicName, unitId, unitTitle);
              }}
              onDeduplicateUnits={handleDeduplicateUnits}
              isAiGenerating={isCurriculumGenerating || generatingUnitId !== null || isGenerating}
              generatingUnitId={generatingUnitId}
              onStartExamWithQuestions={(qs) => {
                setIsLibraryOpen(false);
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
            />
          </SafeAreaView>
        </Modal>

        {/* ⚙️ 환경설정 새창 팝업 모달 */}
        <Modal
          visible={isSettingsOpen}
          animationType="slide"
          onRequestClose={() => setIsSettingsOpen(false)}
        >
          <SafeAreaView style={styles.fullModalContainer}>
            <View style={styles.fullModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 20 }}>⚙️</Text>
                <Text style={styles.fullModalTitle}>환경설정 & AI 모델 관리</Text>
              </View>
              <TouchableOpacity
                style={styles.fullModalSaveBtn}
                onPress={handleSaveSettingsAndClose}
                activeOpacity={0.8}
              >
                <Text style={styles.fullModalSaveBtnText}>💾 저장</Text>
              </TouchableOpacity>
            </View>
            <SettingsScreen
              apiKey={apiKey}
              onChangeApiKey={setApiKey}
              onSaveApiKey={handleSaveApiKey}
              onDeleteApiKey={handleDeleteApiKey}
              alarmConfig={alarmConfig}
              onChangeAlarmConfig={setAlarmConfig}
              onExportBackup={handleExportBackup}
              onOpenRestoreModal={() => {
                setBackupText('');
                setBackupModalVisible(true);
              }}
              onResetAllData={handleResetAllData}
            />
          </SafeAreaView>
        </Modal>

      {/* 공통 모달들 */}
      <TopicModal
        visible={topicModalVisible}
        onClose={() => setTopicModalVisible(false)}
        onCreateTopic={handleCreateTopic}
      />

      <UnitModal
        visible={unitModalVisible}
        onClose={() => setUnitModalVisible(false)}
        onCreateUnit={handleCreateUnit}
      />

      <BackupModal
        visible={backupModalVisible}
        backupText={backupText}
        onChangeBackupText={setBackupText}
        onClose={() => setBackupModalVisible(false)}
        onRestore={handleRestoreBackup}
        onRestoreFromFile={handleRestoreFromFile}
      />

      <QuizCountModal
        visible={quizCountModalVisible}
        topicName={pendingQuizUnit?.topicName}
        unitTitle={pendingQuizUnit?.unitTitle}
        existingCount={pendingQuizUnit?.existingCount}
        onClose={() => setQuizCountModalVisible(false)}
        onSelectCount={handleSelectQuizCount}
        onOpenBackup={handleExportBackup}
      />

      {/* 대단원(과목) 선택 모달 - 최근 학습 대단원 우선 노출 (상위 5개 표시 & 더보기 지원) */}
      <TopicSelectModal
        visible={isTopicSelectModalVisible}
        topics={topics}
        questions={questions}
        lastStudiedTopicId={lastStudiedTopicId}
        onSelectTopic={executeStartExamForTopic}
        onClose={() => setIsTopicSelectModalVisible(false)}
        onOpenLibrary={() => {
          setIsTopicSelectModalVisible(false);
          setIsLibraryOpen(true);
        }}
      />

      {/* 🎯 단원(영역) 선택 모달 - 어느 영역 문제를 생성해드릴까요? */}
      <UnitSelectModal
        visible={isUnitSelectModalVisible}
        topic={unitSelectTopic}
        units={units}
        questions={questions}
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
        onClose={() => setIsUnitSelectModalVisible(false)}
      />

      {/* 📁 내자료업로드 새창(모달) */}
      <SourceUploadModal
        visible={isSourceUploadModalOpen}
        topics={topics}
        sources={sources}
        sourceTitle={sourceTitle}
        selectedSourceTopicId={sourceTopicId}
        onSelectSourceTopicId={setSourceTopicId}
        onChangeSourceTitle={setSourceTitle}
        onPickSourceFile={handlePickSourceFile}
        onSaveSource={async () => {
          await handleSaveSource();
          setIsSourceUploadModalOpen(false);
        }}
        onDeleteSource={handleDeleteSource}
        onClose={() => setIsSourceUploadModalOpen(false)}
      />

      {/* AI 문제 출제 대기 안내 모달 */}
      {generatingWaitStatus?.active && (
        <Modal visible transparent animationType="fade">
          <View style={styles.loadingWaitOverlay}>
            <View style={styles.loadingWaitCard}>
              <ActivityIndicator size="large" color="#f43f5e" style={{ marginBottom: 14 }} />
              <Text style={styles.loadingWaitTitle}>
                {generatingWaitStatus.count === 3
                  ? '⚡ 3문제 빠른 출제 중...'
                  : generatingWaitStatus.count === 5
                  ? '🎯 5문제 정밀 출제 중...'
                  : '🏆 10문제 마스터 시험지 생성 중...'}
              </Text>
              {generatingWaitStatus.title ? (
                <Text style={styles.loadingWaitSubtitle} numberOfLines={1}>
                  학습 범위: {generatingWaitStatus.title}
                </Text>
              ) : null}
              <Text style={styles.loadingWaitMessage}>
                {generatingWaitStatus.message}
              </Text>

              <View style={styles.loadingWaitNoteBox}>
                <Text style={styles.loadingWaitNoteText}>
                  {generatingWaitStatus.count === 3
                    ? '⚡ 약 10초 내외 생성 후 바로 시험장으로 연결됩니다.'
                    : generatingWaitStatus.count === 5
                    ? '🎯 5문제는 정밀 해설 구성을 위해 약 15~20초 소요됩니다.'
                    : '🏆 10문제는 심층 오답 분석 작성을 위해 약 25~35초 소요됩니다.'}
                </Text>
                <Text style={[styles.loadingWaitNoteText, { color: '#be123c', marginTop: 4, fontWeight: 'bold' }]}>
                  ※ 생성된 문제는 스마트폰 로컬 DB에 안전하게 보존되어 누적됩니다.
                </Text>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Global In-App Alert Modal */}
      <AppAlertModal alert={appAlert} onClose={() => setAppAlert(null)} />
    </SafeAreaView>
  </SafeAreaProvider>
  );
}


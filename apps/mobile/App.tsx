import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  StatusBar,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  LogBox,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { showAlert, registerAlertListener, AlertData } from './src/utils/alert';

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
  getPreferredAiModel,
  savePreferredAiModel,
  addSource,
  getSources,
  generateUUID,
  getCurrentISOTime,
  getReviewStates,
  saveReviewState,
  getIncorrectQuestions,
  exportBackupJSON,
  restoreBackupJSON,
  clearAllData,
} from './src/data/db';
import {
  Topic,
  Unit,
  RoutineRevision,
  RoutinePreset,
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
  isStudyDay,
  getLocalDateString,
} from './src/domain/routine';
import {
  analyzeUserIntent,
  generateFactBasedQuestions,
  generateCurriculumUnits,
  distributeQuestionAnswersRandomly,
  ScopedIntent,
} from './src/domain/generator';
import { calculateNextReviewState, filterDueReviewQuestions } from './src/domain/spaced_repetition';
import { buildAdaptiveScaffoldingSpec } from './src/domain/adaptive_scaffolding';

// Clean Modular Components
import { Header } from './src/components/common/Header';
import { TopicModal } from './src/components/modals/TopicModal';
import { UnitModal } from './src/components/modals/UnitModal';
import { BackupModal } from './src/components/modals/BackupModal';
import { QuizCountModal } from './src/components/modals/QuizCountModal';
import { AppAlertModal } from './src/components/modals/AppAlertModal';

// Clean Modular Feature Screens
import { StudyMapScreen } from './src/features/study/StudyMapScreen';
import { LibraryScreen } from './src/features/library/LibraryScreen';
import { SettingsScreen } from './src/features/settings/SettingsScreen';
import { ExamSessionScreen } from './src/features/exam/ExamSessionScreen';

export default function App() {
  const [loading, setLoading] = useState(true);

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
  const [preferredModel, setPreferredModel] = useState('gemini-3.5-flash');
  const [sources, setSources] = useState<Source[]>([]);

  // Modals Visibility
  const [topicModalVisible, setTopicModalVisible] = useState(false);
  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [backupText, setBackupText] = useState('');
  const [quizCountModalVisible, setQuizCountModalVisible] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pendingQuizUnit, setPendingQuizUnit] = useState<{
    topicId: string;
    topicName: string;
    unitId: string;
    unitTitle: string;
  } | null>(null);

  // Exam / CBT Session State
  const [examSessionActive, setExamSessionActive] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [examQuestions, setExamQuestions] = useState<QuestionRevision[]>([]);

  // AI Prompt & Scaffolding State
  const [promptInput, setPromptInput] = useState('');
  const [analyzedIntent, setAnalyzedIntent] = useState<ScopedIntent | null>(null);
  const [scaffoldingContext, setScaffoldingContext] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingUnitId, setGeneratingUnitId] = useState<string | null>(null);
  const [isCurriculumGenerating, setIsCurriculumGenerating] = useState(false);
  const [generatingWaitStatus, setGeneratingWaitStatus] = useState<{
    active: boolean;
    count: number;
    title: string;
    message: string;
  } | null>(null);

  // Library Input State
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceText, setSourceText] = useState('');

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

  async function loadAppData() {
    try {
      setLoading(true);
      await initializeDatabase();

      const [r, t, u, c, q, a, rStates, inQ, key, s, pModel] = await Promise.all([
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
        getPreferredAiModel(),
      ]);

      setRoutine(r);
      setTopics(t);
      if (t.length > 0 && !selectedTopicId) {
        setSelectedTopicId(t[0].id);
      }
      setUnits(u);
      setCompletions(c);
      setQuestions(q);
      setAttempts(a);
      setReviewStates(rStates);
      setIncorrectQuestions(inQ);
      setApiKey(key || '');
      setSources(s);
      setPreferredModel(pModel || 'gemini-3.5-flash');

    } catch (err) {
      console.error('앱 데이터 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }

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

    if (generatedCount > 0) {
      showAlert(
        '주제 등록 완료',
        `[${created.name}] 주제와 ${generatedCount}개 학습 목차가 구성되었습니다.`
      );
    } else {
      showAlert('주제 등록 완료', `[${created.name}] 주제가 등록되었습니다.`);
    }
  }

  async function executeCurriculumGeneration(topicId: string, topicName: string, shouldReplace = false) {
    setIsCurriculumGenerating(true);
    try {
      const generatedUnits = await generateCurriculumUnits({ topicName });
      if (shouldReplace) {
        await replaceTopicUnits(topicId, generatedUnits);
      } else {
        // 중복 방지: 이미 존재하는 동일 단원명은 추가하지 않음
        const currentUnits = await getUnits(topicId);
        const existingTitles = new Set(currentUnits.map((u) => u.title.trim()));
        for (const u of generatedUnits) {
          if (!existingTitles.has(u.title.trim())) {
            await createUnit({ topicId, title: u.title, depth: u.depth });
          }
        }
      }

      const updatedUnits = await getUnits();
      setUnits(updatedUnits);
      showAlert(
        '목차 생성 완료',
        `[${topicName}]의 5단계 목차가 구성되었습니다.`
      );
    } catch (err: any) {
      showAlert('오류', `AI 커리큘럼 생성 실패: ${err?.message || '알 수 없는 오류'}`);
    } finally {
      setIsCurriculumGenerating(false);
    }
  }

  async function handleGenerateCurriculumForTopic(topicId: string, topicName: string) {
    const existing = units.filter((u) => u.topicId === topicId);
    // 단원이 1개 이하이거나 (예: 즉시 출제 시 만들어진 기본 단원 1개), 단원 목록이 비어있으면 불필요한 경고창 없이 즉시 5단계 표준 목차 자동 생성!
    if (existing.length <= 1) {
      await executeCurriculumGeneration(topicId, topicName, true);
      return;
    }

    // 이미 사용자가 2개 이상의 단원을 구성해둔 경우에만 선택 팝업 제공
    showAlert(
      '🌳 AI 5단계 목차 자동 구성',
      `이미 [${topicName}]에 ${existing.length}개의 단원이 등록되어 있습니다.\n\n어떤 방식으로 목차를 구성하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '기존 단원에 추가하기',
          onPress: () => executeCurriculumGeneration(topicId, topicName, false),
        },
        {
          text: '5단계 표준으로 새로 교체',
          style: 'destructive',
          onPress: () => executeCurriculumGeneration(topicId, topicName, true),
        },
      ]
    );
  }

  async function handleDeduplicateUnits(topicId: string) {
    try {
      const cleaned = await deduplicateTopicUnits(topicId);
      const updatedUnits = await getUnits();
      setUnits(updatedUnits);
      showAlert(
        '🧹 중복 단원 정리 완료',
        `중복된 단원을 모두 정리하여 ${cleaned.length}개의 고유 단원으로 깔끔하게 정돈했습니다!`
      );
    } catch (err: any) {
      showAlert('오류', `단원 정리 실패: ${err?.message || '알 수 없는 오류'}`);
    }
  }

  function handlePromptQuizCount(
    topicId: string,
    topicName: string,
    unitId: string,
    unitTitle: string
  ) {
    setPendingQuizUnit({ topicId, topicName, unitId, unitTitle });
    setQuizCountModalVisible(true);
  }

  async function handleSelectQuizCount(count: number) {
    setQuizCountModalVisible(false);
    if (!pendingQuizUnit) return;
    const { topicId, topicName, unitId, unitTitle } = pendingQuizUnit;
    await handleQuickGenerateForUnit(topicId, topicName, unitId, unitTitle, count);
  }

  async function handleQuickGenerateForUnit(
    topicId: string,
    topicName: string,
    unitId: string,
    unitTitle: string,
    targetCount: number = 3
  ) {
    setGeneratingUnitId(unitId);
    setGeneratingWaitStatus({
      active: true,
      count: targetCount,
      title: unitTitle,
      message:
        targetCount === 3
          ? '⚡ 3문제를 생성 중입니다 (약 10초 내외 소요)...'
          : targetCount === 5
          ? '🎯 5문제를 정밀 출제 중입니다 (약 15~20초 소요)...'
          : '🏆 10문제 시험지를 출제 중입니다 (약 30~45초 소요)...',
    });
    try {
      const scoped = analyzeUserIntent(`[${unitTitle}] 핵심 개념 ${targetCount}문제 출제`, topicName, {
        learnerLevel: 'basic',
        targetCount,
      });

      const outcome = await generateFactBasedQuestions({
        intent: scoped,
        ownerId: 'owner-default',
        topicId,
        unitId,
        unitTitle,
      });

      if (outcome.status === 'NEEDS_CONNECTION') {
        showAlert(
          '⚠️ AI 출제 엔진 연결 필요',
          `${outcome.message}\n\n${outcome.requiredAction}`,
          [
            { text: '닫기', style: 'cancel' },
            { text: '설정 열기', onPress: () => setIsSettingsOpen(true) },
          ]
        );
        return;
      }

      if (outcome.status === 'FAILED') {
        showAlert('AI 출제 실패', outcome.message, [
          { text: '닫기', style: 'cancel' },
          { text: '설정 열기', onPress: () => setIsSettingsOpen(true) },
        ]);
        return;
      }

      const allQ = await getQuestions();
      setQuestions(allQ);

      // 시험 세션 즉시 시작!
      startExam(outcome.questions);
    } catch (err: any) {
      showAlert('오류', `단원 문제 출제 실패: ${err?.message || '네트워크 응답 오류'}`);
    } finally {
      setGeneratingUnitId(null);
      setGeneratingWaitStatus(null);
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

  // -------------------------------------------------------------
  // 시험 및 CBT 풀이 핸들러
  // -------------------------------------------------------------
  function startExam(filteredQuestions?: QuestionRevision[]) {
    let list = filteredQuestions;
    if (!list || list.length === 0) {
      // 1순위: 선택된 단원의 문제
      if (selectedUnitId) {
        list = questions.filter((q) => q.unitId === selectedUnitId);
      }
      // 2순위: 선택된 주제의 문제
      if (!list || list.length === 0) {
        list = selectedTopicId ? questions.filter((q) => q.topicId === selectedTopicId) : questions;
      }
    }
    if (!list || list.length === 0) {
      list = questions;
    }

    if (list.length === 0) {
      showAlert(
        '출제된 문제 없음',
        '현재 풀 수 있는 문제가 없습니다.\n[AI 출제] 탭에서 주제나 단원에 맞는 문제를 먼저 생성해 보세요!'
      );
      return;
    }

    // 셔플: 정답 번호가 1번이나 2번에 고정되지 않도록 균등 무작위 분산 배치 적용
    const randomizedQuestions = distributeQuestionAnswersRandomly(list);

    setExamQuestions(randomizedQuestions);
    setCurrentQuestionIndex(0);
    setSelectedOptionId(null);
    setIsAnswerRevealed(false);
    setExamSessionActive(true);
  }

  async function handleStartExamWithAutoGenerate() {
    const currentTopic = topics.find((t) => t.id === selectedTopicId) || topics[0];
    const topicQuestions = currentTopic
      ? questions.filter((q) => q.topicId === currentTopic.id)
      : questions;

    if (topicQuestions.length > 0) {
      startExam(topicQuestions);
      return;
    }

    if (!currentTopic) {
      showAlert('알림', '먼저 학습할 주제를 등록해 주세요.', [
        { text: '닫기', style: 'cancel' },
        { text: '주제 만들기', onPress: () => setTopicModalVisible(true) },
      ]);
      return;
    }

    // 문제가 없을 때 AI 즉시 출제 제안
    showAlert(
      '✨ AI 즉시 출제',
      `[${currentTopic.name}] 주제의 풀이 문제가 아직 없습니다.\nAI 출제 엔진으로 3문제를 지금 즉시 출제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '⚡ 3문제 즉시 출제',
          onPress: async () => {
            const firstUnit = units.find((u) => u.topicId === currentTopic.id);
            await handleQuickGenerateForUnit(
              currentTopic.id,
              currentTopic.name,
              firstUnit?.id || generateUUID(),
              firstUnit?.title || '핵심 종합'
            );
          },
        },
      ]
    );
  }

  // -------------------------------------------------------------
  // 목표 달성 후 '문제 더 풀어보기': 같은 개념 범위 신규 3문제 재생성
  // -------------------------------------------------------------
  async function handleGenerateMoreQuestions() {
    const currentTopic = topics.find((t) => t.id === selectedTopicId) || topics[0];
    if (!currentTopic) {
      showAlert('알림', '먼저 학습할 주제를 등록해 주세요.', [
        { text: '닫기', style: 'cancel' },
        { text: '주제 만들기', onPress: () => setTopicModalVisible(true) },
      ]);
      return;
    }

    const targetUnit =
      units.find((u) => u.id === selectedUnitId) ||
      units.find((u) => u.topicId === currentTopic.id);

    // 기존 출제된 문제들을 파악하여 중복 방지 컨텍스트 구성
    const existingQuestions = questions.filter((q) => q.topicId === currentTopic.id);

    // API 키 미등록 시 사실대로 고지하고 기존 문제 복습 진행 여부 확인
    if (!apiKey || apiKey.trim().length <= 8) {
      showAlert(
        'API 키 미등록',
        '새로운 문제를 생성하기 위한 AI API 키가 등록되지 않아 문제를 만들지 못했습니다.\n\n기존에 학습했던 문제를 복습하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: 'API 키 설정', onPress: () => setIsSettingsOpen(true) },
          ...(existingQuestions.length > 0
            ? [{ text: '기존 문제 복습하기', onPress: () => startExam(existingQuestions) }]
            : []),
        ]
      );
      return;
    }

    const existingSummary = existingQuestions
      .slice(-4)
      .map((q, idx) => `${idx + 1}. ${q.stem.slice(0, 80)}`)
      .join('\n');

    const customContext = `[추가 자율 학습: 동일 개념 범위 신규 출제 지침]
학습자가 현재 [${currentTopic.name}${targetUnit ? ` - ${targetUnit.title}` : ''}] 개념 범위를 집중 학습 중이며, 목표 달성 후 추가 연습 문제를 요청했습니다.
반드시 아래 지침을 준수하여 동일한 개념과 범위 내에서 신선한 4지선다형 실전 문제를 3문항 출제하세요:

1. [개념 일관성]: 다루는 학습 개념과 출제 범위는 [${currentTopic.name}${targetUnit ? ` - ${targetUnit.title}` : ''}]와 정확히 동일해야 합니다.
2. [중복 배제]: 아래 기존 문제들과 똑같은 문장이나 선지를 재탕하지 말고, 동일한 개념을 다른 각도의 상황, 변형 보기, 실무 적용 사례로 재구성하여 출제하세요.
${existingSummary ? `\n[기존 출제 문제 참고 (중복 방지)]:\n${existingSummary}` : ''}
3. [품질 및 해설]: 각 문항마다 오답 선지가 왜 틀렸는지와 정답의 핵심 원리를 명쾌하게 해설하세요.`;

    setIsGenerating(true);
    setGeneratingWaitStatus({
      active: true,
      count: 3,
      title: `${currentTopic.name} 추가 학습`,
      message: '⚡ 같은 개념 범위에서 새로운 문제를 출제 중입니다 (약 10초 내외 소요)...',
    });

    try {
      const targetUnitId = targetUnit?.id || generateUUID();
      const targetUnitTitle = targetUnit?.title || `${currentTopic.name} 핵심 종합`;

      const scoped = analyzeUserIntent(
        `[${currentTopic.name}] ${targetUnitTitle} 동일 개념 추가 심화 문제 출제`,
        currentTopic.name,
        {
          learnerLevel: 'basic',
          targetCount: 3,
        }
      );

      const outcome = await generateFactBasedQuestions({
        intent: scoped,
        ownerId: 'owner-default',
        topicId: currentTopic.id,
        unitId: targetUnitId,
        unitTitle: targetUnitTitle,
        customContext,
      });

      if (outcome.status === 'NEEDS_CONNECTION') {
        showAlert(
          'API 키 미등록',
          '새로운 문제를 생성하기 위한 AI API 키가 등록되지 않아 문제를 만들지 못했습니다.\n\n기존에 학습했던 문제를 복습하시겠습니까?',
          [
            { text: '취소', style: 'cancel' },
            { text: '설정 열기', onPress: () => setIsSettingsOpen(true) },
            ...(existingQuestions.length > 0
              ? [{ text: '기존 문제 복습하기', onPress: () => startExam(existingQuestions) }]
              : []),
          ]
        );
        return;
      }

      if (outcome.status === 'FAILED') {
        showAlert(
          '문제 생성 실패',
          `새로운 문제를 만들지 못했습니다.\n(${outcome.message})\n\n기존에 학습했던 문제를 복습하시겠습니까?`,
          [
            { text: '취소', style: 'cancel' },
            { text: '설정 열기', onPress: () => setIsSettingsOpen(true) },
            ...(existingQuestions.length > 0
              ? [{ text: '기존 문제 복습하기', onPress: () => startExam(existingQuestions) }]
              : []),
          ]
        );
        return;
      }

      const allQ = await getQuestions();
      setQuestions(allQ);

      // 즉시 새로 출제된 문제로 CBT 시험 시작!
      startExam(outcome.questions);
    } catch (err: any) {
      showAlert(
        '문제 생성 실패',
        `새로운 문제를 만들지 못했습니다.\n(${err?.message || '네트워크 오류'})\n\n기존에 학습했던 문제를 복습하시겠습니까?`,
        [
          { text: '취소', style: 'cancel' },
          { text: '설정 열기', onPress: () => setIsSettingsOpen(true) },
          ...(existingQuestions.length > 0
            ? [{ text: '기존 문제 복습하기', onPress: () => startExam(existingQuestions) }]
            : []),
        ]
      );
    } finally {
      setIsGenerating(false);
      setGeneratingWaitStatus(null);
    }
  }

  async function handleCompleteExam(
    results: Array<{ question: QuestionRevision; selectedOptionId: string; isCorrect: boolean }>
  ) {
    for (const item of results) {
      const attemptId = generateUUID();
      const attempt: Attempt = {
        id: attemptId,
        sessionItemId: generateUUID(),
        submissionKey: `sub-${item.question.id}-${getLocalDateString()}-${attemptId.slice(0, 6)}`,
        answerOptionId: item.selectedOptionId,
        isCorrect: item.isCorrect,
        submittedAt: getCurrentISOTime(),
      };
      await saveAttempt(attempt);

      const currentRS = reviewStates.find((rs) => rs.questionRevisionId === item.question.id);
      const nextRS = calculateNextReviewState({
        ownerId: 'owner-default',
        questionRevisionId: item.question.id,
        currentReviewState: currentRS,
        isCorrect: item.isCorrect,
        attemptId,
      });
      await saveReviewState(nextRS);
    }

    const sessionUnitId = results[0]?.question.unitId;
    const targetUnit = units.find((u) => u.id === sessionUnitId);
    if (targetUnit) {
      await markUnitAsCompleted(targetUnit.id);
      const updatedCompletions = await getManualCompletions();
      setCompletions(updatedCompletions);
    }

    const [updatedAttempts, updatedRS, updatedInQ] = await Promise.all([
      getAttempts(),
      getReviewStates(),
      getIncorrectQuestions(),
    ]);
    setAttempts(updatedAttempts);
    setReviewStates(updatedRS);
    setIncorrectQuestions(updatedInQ);
  }

  // -------------------------------------------------------------
  // AI 출제 및 적응형 하향 비계 핸들러
  // -------------------------------------------------------------
  function handleAnalyzePrompt(options?: { learnerLevel?: LearnerKnowledgeLevel; knownScope?: string }) {
    if (!promptInput.trim()) {
      showAlert('알림', '질문이나 공부하고 싶은 내용을 입력해 주세요.');
      return;
    }
    const currentTopic = topics.find((t) => t.id === selectedTopicId);
    const scoped = analyzeUserIntent(promptInput, currentTopic?.name, options);
    setAnalyzedIntent(scoped);
  }

  // 2. 적응형 하향 비계 (Scaffolding) 원클릭 세팅
  async function handleApplyScaffolding() {
    const currentTopic = topics.find((t) => t.id === selectedTopicId);
    const topicIncorrect = selectedTopicId
      ? incorrectQuestions.filter((q) => q.topicId === selectedTopicId)
      : incorrectQuestions;
    const targetMistakes = topicIncorrect.length > 0 ? topicIncorrect : incorrectQuestions;

    if (!targetMistakes || targetMistakes.length === 0) {
      showAlert('알림', '현재 등록된 오답 문제가 없습니다. 모든 문제를 완벽히 맞히셨습니다!');
      return;
    }

    // API 키 미등록 시 사실대로 고지하고 기존 오답노트 복습 여부 확인
    if (!apiKey || apiKey.trim().length <= 8) {
      showAlert(
        'API 키 미등록',
        'AI 맞춤 보충 문제를 출제하기 위한 API 키가 등록되어 있지 않아 새 문제를 만들지 못했습니다.\n\n기존에 틀렸던 오답 문제를 다시 복습하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: 'API 키 설정', onPress: () => setIsSettingsOpen(true) },
          { text: '기존 오답 다시 풀기', onPress: () => startExam(targetMistakes) },
        ]
      );
      return;
    }

    const pkg = buildAdaptiveScaffoldingSpec({
      incorrectQuestions: targetMistakes,
      topicName: currentTopic?.name || '자유 학습',
    });

    setIsGenerating(true);
    setGeneratingWaitStatus({
      active: true,
      count: 3,
      title: currentTopic?.name || '오답 개념 집중 보충',
      message: '⚡ 틀린 문제를 분석하여 맞춤 보충 문제를 준비 중입니다 (약 10초 내외 소요)...',
    });

    try {
      if (pkg) {
        const activeTopic = topics.find((t) => t.id === selectedTopicId) || topics[0];
        const targetTopicId = activeTopic ? activeTopic.id : generateUUID();
        const outcome = await generateFactBasedQuestions({
          intent: pkg.intent,
          ownerId: 'owner-default',
          topicId: targetTopicId,
          customContext: pkg.scaffoldingContext,
        });

        if (outcome.status === 'READY' && outcome.questions.length > 0) {
          const allQ = await getQuestions();
          setQuestions(allQ);
          startExam(outcome.questions);
          return;
        }

        if (outcome.status === 'NEEDS_CONNECTION') {
          showAlert(
            'API 키 미등록',
            'AI 맞춤 보충 문제를 출제하기 위한 API 키가 등록되어 있지 않아 새 문제를 만들지 못했습니다.\n\n기존에 틀렸던 오답 문제를 다시 복습하시겠습니까?',
            [
              { text: '취소', style: 'cancel' },
              { text: '설정 열기', onPress: () => setIsSettingsOpen(true) },
              { text: '기존 오답 다시 풀기', onPress: () => startExam(targetMistakes) },
            ]
          );
          return;
        }

        if (outcome.status === 'FAILED') {
          showAlert(
            '문제 생성 실패',
            `오답 맞춤 보충 문제를 출제하지 못했습니다.\n(${outcome.message})\n\n기존에 틀렸던 오답 문제를 다시 복습하시겠습니까?`,
            [
              { text: '취소', style: 'cancel' },
              { text: '설정 열기', onPress: () => setIsSettingsOpen(true) },
              { text: '기존 오답 다시 풀기', onPress: () => startExam(targetMistakes) },
            ]
          );
          return;
        }
      }
    } catch (err: any) {
      showAlert(
        '문제 생성 실패',
        `오답 맞춤 보충 문제를 출제하지 못했습니다.\n(${err?.message || '네트워크 오류'})\n\n기존에 틀렸던 오답 문제를 다시 복습하시겠습니까?`,
        [
          { text: '취소', style: 'cancel' },
          { text: '설정 열기', onPress: () => setIsSettingsOpen(true) },
          { text: '기존 오답 다시 풀기', onPress: () => startExam(targetMistakes) },
        ]
      );
    } finally {
      setIsGenerating(false);
      setGeneratingWaitStatus(null);
    }
  }

  async function handleCreateQuestions() {
    if (!analyzedIntent) return;
    setIsGenerating(true);
    try {
      const activeTopic = topics.find((t) => t.id === selectedTopicId) || topics[0];
      const targetTopicId = activeTopic ? activeTopic.id : generateUUID();
      const targetUnit = units.find((u) => u.id === selectedUnitId);

      const outcome = await generateFactBasedQuestions({
        intent: analyzedIntent,
        ownerId: 'owner-default',
        topicId: targetTopicId,
        unitId: selectedUnitId || undefined,
        unitTitle: targetUnit?.title,
        customContext: scaffoldingContext || undefined,
      });

      if (outcome.status === 'NEEDS_CONNECTION') {
        showAlert(
          '⚠️ AI 출제 엔진 연결 필요',
          `${outcome.message}\n\n${outcome.requiredAction}`,
          [
            { text: '닫기', style: 'cancel' },
            { text: '설정창 열기', onPress: () => setIsSettingsOpen(true) },
          ]
        );
        return;
      }

      if (outcome.status === 'FAILED') {
        showAlert('출제 실패', outcome.message);
        return;
      }

      const allQ = await getQuestions();
      setQuestions(allQ);
      setScaffoldingContext(null); // 컨텍스트 소진 후 리셋

      showAlert(
        '출제 완료!',
        `[${analyzedIntent.domain}] 분야의 사실 검증된 문제 ${outcome.questions.length}문항이 출제되었습니다.${
          targetUnit ? `\n(배속 단원: ${targetUnit.title})` : ''
        }\n바로 풀어보시겠습니까?`,
        [
          { text: '나중에 풀기', style: 'cancel' },
          { text: '지금 풀기', onPress: () => startExam(outcome.questions) },
        ]
      );
    } catch (err: any) {
      showAlert('오류', `출제 요청 중 예외 발생: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  }

  // -------------------------------------------------------------
  // 자료 등록 핸들러
  // -------------------------------------------------------------
  async function handleSaveSource() {
    if (!sourceTitle.trim() || !sourceText.trim()) {
      showAlert('알림', '자료 제목과 본문 내용을 모두 입력해 주세요.');
      return;
    }
    const sourceId = generateUUID();
    const revId = generateUUID();

    const newSource: Source = {
      id: sourceId,
      ownerId: 'owner-default',
      kind: 'text',
      title: sourceTitle.trim(),
      visibility: 'private',
      allowExternalProcessing: false,
      archivedAt: null,
      createdAt: getCurrentISOTime(),
    };

    const newRev: SourceRevision = {
      id: revId,
      sourceId,
      hash: 'sha256-' + Date.now(),
      provenance: '직접 입력 텍스트 발췌',
      originalFileRef: null,
      createdAt: getCurrentISOTime(),
    };

    const newChunk: SourceChunk = {
      id: generateUUID(),
      revisionId: revId,
      rawText: sourceText.trim(),
      normalizedText: sourceText.trim().replace(/\s+/g, ' '),
      locator: { kind: 'text', blockIndex: 0 },
      extractionStatus: 'success',
    };

    await addSource(newSource, newRev, [newChunk]);
    const updatedSources = await getSources();
    setSources(updatedSources);

    showAlert('등록 완료', '내 텍스트 자료가 안전하게 로컬 저장소에 보관되었습니다.');
    setSourceTitle('');
    setSourceText('');
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

  async function handleChangeRoutinePreset(presetKey: string) {
    if (!routine) return;
    const item = (routine as any)[presetKey];
    const updated: RoutineRevision = {
      ...routine,
      id: generateUUID(),
      preset: presetKey as RoutinePreset,
      activeDays: item ? item.days : [1, 3, 5],
      effectiveDate: getLocalDateString(),
    };
    await saveRoutine(updated);
    setRoutine(updated);
  }

  async function handleExportBackup() {
    const json = await exportBackupJSON();
    setBackupText(json);
    setBackupModalVisible(true);
  }

  async function handleRestoreBackup() {
    const res = await restoreBackupJSON(backupText);
    showAlert(res.success ? '복원 완료' : '복원 실패', res.message);
    if (res.success) {
      await loadAppData();
      setBackupModalVisible(false);
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
          <ActivityIndicator size="large" color="#6366f1" />
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
          onExitExam={() => setExamSessionActive(false)}
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
  const scaffoldingPackage = buildAdaptiveScaffoldingSpec({
    incorrectQuestions: topicIncorrect.length > 0 ? topicIncorrect : incorrectQuestions,
    topicName: currentTopic?.name || '자유 학습',
  });

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

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

          {/* 우측 하단 설정 링크 플로팅 버튼 */}
          <TouchableOpacity
            style={styles.floatingSettingsBtn}
            onPress={() => setIsSettingsOpen(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.floatingSettingsIcon}>⚙️</Text>
            <Text style={styles.floatingSettingsText}>설정</Text>
          </TouchableOpacity>
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
                style={styles.fullModalCloseBtn}
                onPress={() => setIsLibraryOpen(false)}
              >
                <Text style={styles.fullModalCloseBtnText}>✕ 닫기</Text>
              </TouchableOpacity>
            </View>
            <LibraryScreen
              questions={questions}
              topics={topics}
              units={units}
              completions={completions}
              onOpenTopicModal={() => setTopicModalVisible(true)}
              onOpenUnitModal={() => setUnitModalVisible(true)}
              onDeleteTopic={handleDeleteTopic}
              onToggleUnitCompletion={handleToggleUnitCompletion}
              onDeleteUnit={handleDeleteUnit}
              onGenerateCurriculumForTopic={handleGenerateCurriculumForTopic}
              onQuickGenerateForUnit={(topicId, topicName, unitId, unitTitle) => {
                setIsLibraryOpen(false);
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
                style={styles.fullModalCloseBtn}
                onPress={() => setIsSettingsOpen(false)}
              >
                <Text style={styles.fullModalCloseBtnText}>✕ 닫기</Text>
              </TouchableOpacity>
            </View>
            <SettingsScreen
              apiKey={apiKey}
              onChangeApiKey={setApiKey}
              onSaveApiKey={handleSaveApiKey}
              onDeleteApiKey={handleDeleteApiKey}
              preferredModel={preferredModel}
              onChangePreferredModel={async (model) => {
                setPreferredModel(model);
                await savePreferredAiModel(model);
                showAlert(
                  'AI 모델 설정',
                  `출제 모델이 [${model}]로 지정되었습니다.\n(연결 실패 시 가짜 문제 출제 없이 상태를 보고합니다)`
                );
              }}
              routine={routine}
              onChangeRoutinePreset={handleChangeRoutinePreset}
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
      />

      <QuizCountModal
        visible={quizCountModalVisible}
        topicName={pendingQuizUnit?.topicName}
        unitTitle={pendingQuizUnit?.unitTitle}
        onClose={() => setQuizCountModalVisible(false)}
        onSelectCount={handleSelectQuizCount}
      />

      {/* AI 문제 출제 대기 안내 모달 */}
      {generatingWaitStatus?.active && (
        <Modal visible transparent animationType="fade">
          <View style={styles.loadingWaitOverlay}>
            <View style={styles.loadingWaitCard}>
              <ActivityIndicator size="large" color="#6366f1" style={{ marginBottom: 14 }} />
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
                    : '🏆 10문제는 심층 오답 분석 작성을 위해 약 30~45초 소요됩니다.'}
                </Text>
                <Text style={[styles.loadingWaitNoteText, { color: '#38bdf8', marginTop: 4, fontWeight: 'bold' }]}>
                  ※ 멈춤이나 오류 없이 안전하게 시험장으로 연결됩니다.
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  mainContent: {
    flex: 1,
  },
  loadingWaitOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingWaitCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1e293b',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#6366f1',
  },
  loadingWaitTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 6,
    textAlign: 'center',
  },
  loadingWaitSubtitle: {
    fontSize: 12,
    color: '#818cf8',
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  loadingWaitMessage: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 16,
  },
  loadingWaitNoteBox: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  loadingWaitNoteText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 16,
  },
  fullModalContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  fullModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  fullModalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  fullModalCloseBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fullModalCloseBtnText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  floatingSettingsBtn: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#475569',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  floatingSettingsIcon: {
    fontSize: 16,
  },
  floatingSettingsText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: 'bold',
  },
});

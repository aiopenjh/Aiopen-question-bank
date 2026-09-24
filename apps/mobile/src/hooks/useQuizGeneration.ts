import { useState, useCallback, useRef } from 'react';
import { AiDocumentInput, Topic, Unit, QuestionRevision, LearnerKnowledgeLevel } from '../contracts/types';
import {
  analyzeUserIntent,
  generateFactBasedQuestions,
} from '../domain/generator';
import {
  getQuestions,
  addQuestions,
  saveQuestionsForUnit,
  generateUUID,
  createUnit,
  deleteUnit,
  getUnits,
  getSourceTextForTopic,
  getLinkedSourceForTopic,
  updateUnitDifficulty,
  getAttempts,
} from '../data/db';
import { showAlert } from '../utils/alert';
import { difficultyToLegacyLevel, legacyLevelToDifficulty } from '../domain/difficulty';
import { buildUnitGenerationContext, formatIntentMessage } from './quizGenerationContext';
import { getLocalDateString } from '../domain/routine';
import { CHALLENGE_START_LEVEL, getUnlockedChallengeLevel } from '../domain/challenge_progress';
import type { ExamStartOptions } from './useExamSession';

const DAILY_FREE_QUESTION_GUIDE = 15;

function isCreatedToday(createdAt: string): boolean {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? false : getLocalDateString(date) === getLocalDateString();
}

export interface GeneratingWaitStatus {
  active: boolean;
  count: number;
  title: string;
  message: string;
}

export interface PendingQuizUnit {
  topicId: string;
  topicName: string;
  unitId: string;
  unitTitle: string;
  existingCount?: number;
  initialLevel?: LearnerKnowledgeLevel;
  initialDifficultyLevel?: number;
}

export interface UseQuizGenerationProps {
  apiKey: string;
  topics: Topic[];
  units: Unit[];
  questions: QuestionRevision[];
  selectedTopicId: string | null;
  selectedUnitId: string | null;
  lastStudiedTopicId: string | null;
  incorrectQuestions: QuestionRevision[];
  startExam: (questions: QuestionRevision[], options?: ExamStartOptions) => void;
  onOpenSettings: () => void;
  onOpenTopicModal: () => void;
  setQuestions: (questions: QuestionRevision[]) => void;
  setUnits: (units: Unit[]) => void;
  getDocumentInputForTopic: (topicId: string) => Promise<AiDocumentInput | null>;
  onOpenSourceManager: () => void;
}

export function useQuizGeneration({
  apiKey,
  topics,
  units,
  questions,
  selectedTopicId,
  selectedUnitId,
  lastStudiedTopicId,
  incorrectQuestions,
  startExam,
  onOpenSettings,
  onOpenTopicModal,
  setQuestions,
  setUnits,
  getDocumentInputForTopic,
  onOpenSourceManager,
}: UseQuizGenerationProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingUnitId, setGeneratingUnitId] = useState<string | null>(null);
  const [generatingWaitStatus, setGeneratingWaitStatus] = useState<GeneratingWaitStatus | null>(null);

  const [quizCountModalVisible, setQuizCountModalVisible] = useState(false);
  const [pendingQuizUnit, setPendingQuizUnit] = useState<PendingQuizUnit | null>(null);

  // 문제 출제 취소 제어용 ref
  const abortRef = useRef(false);
  const requestControllerRef = useRef<AbortController | null>(null);
  const budgetOverrideRef = useRef(false);

  const handleCancelGeneration = useCallback(() => {
    abortRef.current = true;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setIsGenerating(false);
    setGeneratingUnitId(null);
    setGeneratingWaitStatus(null);
    showAlert('출제 취소', '문제 출제가 취소되었습니다.');
  }, []);

  const handlePromptQuizCount = useCallback(
    (topicId: string, topicName: string, unitId: string, unitTitle: string) => {
      const currentTopic = topics.find((t) => t.id === topicId);
      const currentUnit = units.find((u) => u.id === unitId && u.topicId === topicId);
      const existingCount = questions.filter(
        (q) => q.topicId === topicId && q.unitId === unitId
      ).length;
      setPendingQuizUnit({
        topicId,
        topicName,
        unitId,
        unitTitle,
        existingCount,
        initialLevel: currentTopic?.learnerLevel || 'basic',
        initialDifficultyLevel:
          currentUnit?.difficultyLevel ?? currentTopic?.difficultyLevel ?? legacyLevelToDifficulty(currentTopic?.learnerLevel),
      });
      setQuizCountModalVisible(true);
    },
    [questions, topics, units]
  );

  const handleSaveUnitDifficulty = useCallback(async (difficultyLevel: number) => {
    if (!pendingQuizUnit) throw new Error('변경할 단원을 찾지 못했습니다.');
    if (difficultyLevel >= CHALLENGE_START_LEVEL &&
        difficultyLevel > getUnlockedChallengeLevel(await getAttempts(), pendingQuizUnit.topicId)) {
      throw new Error('이전 레벨을 먼저 통과해 주세요.');
    }
    await updateUnitDifficulty(pendingQuizUnit.topicId, pendingQuizUnit.unitId, difficultyLevel);
    setUnits(await getUnits());
  }, [pendingQuizUnit, setUnits]);

  const handleQuickGenerateForUnit = useCallback(
    async (
      topicId: string,
      topicName: string,
      unitId: string,
      unitTitle: string,
      targetCount: number = 3,
      options?: {
        learnerLevel?: LearnerKnowledgeLevel;
        difficultyLevel?: number;
        shouldReplaceExisting?: boolean;
      }
    ) => {
      abortRef.current = false;
      const requestController = new AbortController();
      requestControllerRef.current = requestController;
      setGeneratingUnitId(unitId);
      setGeneratingWaitStatus({
        active: true,
        count: targetCount,
        title: `${topicName} - ${unitTitle}`,
        message: '잠시만 기다려 주세요 ✨',
      });
      try {
        const currentTopic = topics.find((t) => t.id === topicId);
        const currentUnit = units.find((u) => u.id === unitId && u.topicId === topicId);
        const targetDifficulty =
          options?.difficultyLevel ??
          currentUnit?.difficultyLevel ??
          currentTopic?.difficultyLevel ??
          legacyLevelToDifficulty(currentTopic?.learnerLevel);
        const targetLevel = difficultyToLegacyLevel(targetDifficulty);

        const scoped = analyzeUserIntent(
          `[${topicName} - ${unitTitle}] 레벨 ${targetDifficulty} 난이도 개념 ${targetCount}문제 출제`,
          topicName,
          {
            learnerLevel: targetLevel,
            difficultyLevel: targetDifficulty,
            targetCount,
          }
        );

        // 학습자가 업로드한 교재/자료 텍스트 조회
        const sourceMaterial = await getSourceTextForTopic(topicId, topicName);
        const linkedSource = await getLinkedSourceForTopic(topicId);
        const documentInput = await getDocumentInputForTopic(topicId);
        if (linkedSource?.kind === 'pdf' && !documentInput) {
          showAlert(
            '원본 PDF를 다시 선택해 주세요',
            `Celueste는 저장 공간 보호를 위해 “${linkedSource.fileName || linkedSource.title}” 원본을 보관하지 않습니다.\n\n+ 자료에서 원본 선택을 누른 뒤 다시 출제해 주세요.`,
            [
              { text: '닫기', style: 'cancel' },
              { text: '+ 자료 열기', onPress: onOpenSourceManager },
            ]
          );
          return;
        }

        // 이 단원에 이미 저장된 문제 최신 DB에서 파악 -> 판박이 중복 방지 및 단원 내 다양한 개념 확장
        const allSavedQuestions = await getQuestions();
        const existingInUnit = allSavedQuestions.filter(
          (q) => q.topicId === topicId && q.unitId === unitId
        );
        const customContext = buildUnitGenerationContext(sourceMaterial || '', existingInUnit);
        const outcome = await generateFactBasedQuestions({
          intent: scoped,
          ownerId: 'owner-default',
          topicId,
          topicName,
          category: currentTopic?.category,
          unitId,
          unitTitle,
          customContext,
          documentInput: documentInput || undefined,
          signal: requestController.signal,
        });

        if (abortRef.current) {
          return;
        }

        if (outcome.status === 'NEEDS_CONNECTION') {
          showAlert(
            '⚠️ AI 출제 엔진 연결 필요',
            `${outcome.message}\n\n${outcome.requiredAction}`,
            [
              { text: '닫기', style: 'cancel' },
              { text: '설정 열기', onPress: onOpenSettings },
            ]
          );
          return;
        }

        if (outcome.status === 'NEEDS_CLARIFICATION' || outcome.status === 'REJECTED') {
          showAlert(
            outcome.status === 'NEEDS_CLARIFICATION' ? '주제 확인 필요' : '입력 확인 필요',
            formatIntentMessage(outcome.message, outcome.clarificationChoices)
          );
          return;
        }

        if (outcome.status === 'FAILED') {
          showAlert('AI 생성 요청 실패', outcome.message, [
            { text: '닫기', style: 'cancel' },
            { text: '설정 열기', onPress: onOpenSettings },
          ]);
          return;
        }

        const saveResult = await saveQuestionsForUnit(
          topicId,
          unitId,
          outcome.questions,
          options?.shouldReplaceExisting === true
        );
        if (!saveResult.committed || saveResult.saved.length === 0) {
          showAlert(
            '중복 문제 확인',
            options?.shouldReplaceExisting
              ? '새 문제에 중복 문항이 포함되어 기존 문제를 그대로 보존했습니다. 다시 출제해 주세요.'
              : '새로 생성된 문제가 기존 문제와 너무 비슷하여 저장하지 않았습니다.'
          );
          return;
        }

        const allQ = await getQuestions();
        setQuestions(allQ);

        // 출제 완료 시 CBT 시험장 즉시 입장 (과목보관함 위치 안전 유지)
        startExam(saveResult.saved, { challengeEligible: targetDifficulty >= CHALLENGE_START_LEVEL });
      } catch (err: any) {
        if (!abortRef.current) {
          showAlert('오류', `단원 문제 출제 실패: ${err?.message || '네트워크 응답 오류'}`);
        }
      } finally {
        if (requestControllerRef.current === requestController) {
          requestControllerRef.current = null;
        }
        setGeneratingUnitId(null);
        setGeneratingWaitStatus(null);
      }
    },
    [getDocumentInputForTopic, onOpenSettings, onOpenSourceManager, setQuestions, startExam, topics, units]
  );

  const handleSelectQuizCount = useCallback(
    async (
      count: number,
      options?: {
        learnerLevel?: LearnerKnowledgeLevel;
        difficultyLevel?: number;
        shouldReplaceExisting?: boolean;
      }
    ) => {
      setQuizCountModalVisible(false);
      if (!pendingQuizUnit) return;
      const { topicId, topicName, unitId, unitTitle } = pendingQuizUnit;
      const todayCount = questions.filter((question) => isCreatedToday(question.createdAt)).length;
      if (todayCount + count > DAILY_FREE_QUESTION_GUIDE) {
        showAlert(
          '오늘의 무료 사용 기준 안내',
          `오늘 생성한 문제는 ${todayCount}개입니다. ${count}문제를 추가하면 하루 권장 기준인 ${DAILY_FREE_QUESTION_GUIDE}문제를 넘습니다.\n\n추가 생성은 연결된 AI 서비스의 무료 할당량을 사용하거나 429 제한이 발생할 수 있습니다.`,
          [
            { text: '오늘은 그만 생성', style: 'cancel' },
            {
              text: '추가 생성',
              onPress: () => handleQuickGenerateForUnit(topicId, topicName, unitId, unitTitle, count, options),
            },
          ]
        );
        return;
      }
      await handleQuickGenerateForUnit(topicId, topicName, unitId, unitTitle, count, options);
    },
    [pendingQuizUnit, handleQuickGenerateForUnit, questions]
  );

  const handleGenerateMoreQuestions = useCallback(async () => {
    const todayCount = questions.filter((question) => isCreatedToday(question.createdAt)).length;
    if (!budgetOverrideRef.current && todayCount + 3 > DAILY_FREE_QUESTION_GUIDE) {
      showAlert(
        '오늘의 무료 사용 기준 안내',
        `오늘 생성한 문제는 ${todayCount}개입니다. 추가 출제 시 하루 권장 기준인 ${DAILY_FREE_QUESTION_GUIDE}문제를 넘고 연결된 AI 서비스의 무료 할당량 또는 429 제한에 영향을 줄 수 있습니다.`,
        [
          { text: '오늘은 그만 생성', style: 'cancel' },
          {
            text: '추가 생성',
            onPress: () => {
              budgetOverrideRef.current = true;
              void handleGenerateMoreQuestions();
            },
          },
        ]
      );
      return;
    }
    budgetOverrideRef.current = false;
    const currentTopic =
      topics.find((t) => t.id === selectedTopicId) ||
      topics.find((t) => t.id === lastStudiedTopicId) ||
      topics[0];
    if (!currentTopic) {
      showAlert('알림', '먼저 학습할 주제를 등록해 주세요.', [
        { text: '닫기', style: 'cancel' },
        { text: '주제 만들기', onPress: onOpenTopicModal },
      ]);
      return;
    }

    const targetUnit =
      units.find((u) => u.id === selectedUnitId && u.topicId === currentTopic.id) ||
      units.find((u) => u.topicId === currentTopic.id);

    const existingQuestions = questions.filter((q) => q.topicId === currentTopic.id);

    if (!apiKey || apiKey.trim().length <= 8) {
      showAlert(
        'AI 연결 필요',
        '새로운 문제를 만들기 위한 AI 연결이 없어 문제를 만들지 못했습니다.\n\n기존에 학습했던 문제를 복습하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: 'AI 연결 설정', onPress: onOpenSettings },
          ...(existingQuestions.length > 0
            ? [{ text: '기존 문제 복습하기', onPress: () => startExam(existingQuestions) }]
            : []),
        ]
      );
      return;
    }

    abortRef.current = false;
    const requestController = new AbortController();
    requestControllerRef.current = requestController;
    setIsGenerating(true);
    setGeneratingWaitStatus({
      active: true,
      count: 3,
      title: `${currentTopic.name} 추가 학습`,
      message: '잠시만 기다려 주세요 ✨',
    });

    let newlyCreatedUnitId: string | null = null;
    let questionsPersisted = false;
    try {
      const targetUnitId = targetUnit?.id || generateUUID();
      const targetUnitTitle = targetUnit?.title || `${currentTopic.name} 핵심 종합`;

      const targetDifficulty = targetUnit?.difficultyLevel ?? currentTopic.difficultyLevel ?? legacyLevelToDifficulty(currentTopic.learnerLevel);
      const scoped = analyzeUserIntent(
        `[${currentTopic.name}] ${targetUnitTitle} 동일 개념 추가 심화 문제 출제`,
        currentTopic.name,
        {
          learnerLevel: difficultyToLegacyLevel(targetDifficulty),
          difficultyLevel: targetDifficulty,
          targetCount: 3,
        }
      );

      const sourceMaterial = await getSourceTextForTopic(currentTopic.id, currentTopic.name);
      const linkedSource = await getLinkedSourceForTopic(currentTopic.id);
      const documentInput = await getDocumentInputForTopic(currentTopic.id);
      if (linkedSource?.kind === 'pdf' && !documentInput) {
        showAlert(
          '원본 PDF를 다시 선택해 주세요',
          `Celueste는 PDF 원본을 저장하지 않습니다. + 자료에서 “${linkedSource.fileName || linkedSource.title}” 원본을 다시 선택해 주세요.`,
          [
            { text: '닫기', style: 'cancel' },
            { text: '+ 자료 열기', onPress: onOpenSourceManager },
          ]
        );
        return;
      }
      const allSavedQuestions = await getQuestions();
      const existingInTargetUnit = allSavedQuestions.filter(
        (q) => q.topicId === currentTopic.id && q.unitId === targetUnitId
      );
      const customContext = buildUnitGenerationContext(sourceMaterial || '', existingInTargetUnit);

      const outcome = await generateFactBasedQuestions({
        intent: scoped,
        ownerId: 'owner-default',
        topicId: currentTopic.id,
        topicName: currentTopic.name,
        category: currentTopic.category,
        unitId: targetUnitId,
        unitTitle: targetUnitTitle,
        customContext,
        documentInput: documentInput || undefined,
        signal: requestController.signal,
      });

      if (abortRef.current) {
        return;
      }

      if (outcome.status === 'NEEDS_CONNECTION') {
        showAlert(
          'AI 연결 필요',
          '새로운 문제를 만들기 위한 AI 연결이 없어 문제를 만들지 못했습니다.\n\n기존에 학습했던 문제를 복습하시겠습니까?',
          [
            { text: '취소', style: 'cancel' },
            { text: 'AI 연결 설정', onPress: onOpenSettings },
            ...(existingQuestions.length > 0
              ? [{ text: '기존 문제 복습하기', onPress: () => startExam(existingQuestions) }]
              : []),
          ]
        );
        return;
      }

      if (outcome.status === 'NEEDS_CLARIFICATION' || outcome.status === 'REJECTED') {
        showAlert(
          outcome.status === 'NEEDS_CLARIFICATION' ? '주제 확인 필요' : '입력 확인 필요',
          formatIntentMessage(outcome.message, outcome.clarificationChoices)
        );
        return;
      }

      if (outcome.status === 'FAILED') {
        showAlert('AI 생성 요청 실패', outcome.message, [
          { text: '닫기', style: 'cancel' },
          { text: '설정 열기', onPress: onOpenSettings },
        ]);
        return;
      }


      let resolvedUnitId = targetUnit?.id;
      if (!resolvedUnitId) {
        const createdUnit = await createUnit({
          topicId: currentTopic.id,
          title: targetUnitTitle,
          depth: 1,
        });
        resolvedUnitId = createdUnit.id;
        newlyCreatedUnitId = createdUnit.id;
        setUnits(await getUnits());
      }
      const questionsToSave = outcome.questions.map((question) => ({
        ...question,
        unitId: resolvedUnitId,
      }));
      const savedQuestions = await addQuestions(questionsToSave);
      if (savedQuestions.length === 0) {
        if (newlyCreatedUnitId) {
          await deleteUnit(newlyCreatedUnitId);
          setUnits(await getUnits());
        }
        showAlert('중복 문제 확인', '새로 생성된 문제가 기존 문제와 너무 비슷하여 저장하지 않았습니다.');
        return;
      }
      questionsPersisted = true;

      const allQ = await getQuestions();
      setQuestions(allQ);

      // 즉시 새로 출제된 문제로 CBT 시험 시작
      startExam(savedQuestions, { challengeEligible: targetDifficulty >= CHALLENGE_START_LEVEL });
    } catch (err: any) {
      if (newlyCreatedUnitId && !questionsPersisted) {
        try {
          await deleteUnit(newlyCreatedUnitId);
          setUnits(await getUnits());
        } catch {
          // 원래 생성 오류를 사용자에게 유지하여 전달합니다.
        }
      }
      showAlert(
        '문제 생성 실패',
        `새로운 문제를 만들지 못했습니다.\n(${err?.message || '네트워크 오류'})\n\n기존에 학습했던 문제를 복습하시겠습니까?`,
        [
          { text: '취소', style: 'cancel' },
          { text: '설정 열기', onPress: onOpenSettings },
          ...(existingQuestions.length > 0
            ? [{ text: '기존 문제 복습하기', onPress: () => startExam(existingQuestions) }]
            : []),
        ]
      );
    } finally {
      if (requestControllerRef.current === requestController) {
        requestControllerRef.current = null;
      }
      setIsGenerating(false);
      setGeneratingWaitStatus(null);
    }
  }, [
    apiKey,
    topics,
    selectedTopicId,
    lastStudiedTopicId,
    units,
    selectedUnitId,
    questions,
    onOpenTopicModal,
    onOpenSettings,
    startExam,
    setQuestions,
    setUnits,
    getDocumentInputForTopic,
    onOpenSourceManager,
  ]);

  const handleApplyScaffolding = useCallback(async (currentExamMistakes?: QuestionRevision[]) => {
    const topicIncorrect = selectedTopicId
      ? incorrectQuestions.filter((q) => q.topicId === selectedTopicId)
      : incorrectQuestions;
    const targetMistakes = currentExamMistakes?.length
      ? currentExamMistakes
      : topicIncorrect.length > 0
        ? topicIncorrect
        : incorrectQuestions;

    if (!targetMistakes || targetMistakes.length === 0) {
      showAlert('알림', '현재 등록된 오답 문제가 없습니다. 모든 문제를 완벽히 맞히셨습니다!');
      return;
    }

    // 내가 틀렸던 바로 그 오답 문제들로 즉시 CBT 시험 및 개념 복습 시작
    startExam(targetMistakes);
  }, [selectedTopicId, incorrectQuestions, startExam]);

  return {
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
    handleQuickGenerateForUnit,
    handleGenerateMoreQuestions,
    handleApplyScaffolding,
    handleCancelGeneration,
  };
}

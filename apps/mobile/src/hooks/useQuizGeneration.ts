import { useState, useCallback, useRef } from 'react';
import { Topic, Unit, QuestionRevision, LearnerKnowledgeLevel } from '../contracts/types';
import {
  analyzeUserIntent,
  generateFactBasedQuestions,
} from '../domain/generator';
import {
  getQuestions,
  addQuestions,
  deleteQuestionsForUnit,
  generateUUID,
  getSourceTextForTopic,
} from '../data/db';
import { showAlert } from '../utils/alert';

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
  startExam: (questions: QuestionRevision[]) => void;
  onOpenSettings: () => void;
  onOpenTopicModal: () => void;
  setQuestions: (questions: QuestionRevision[]) => void;
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
}: UseQuizGenerationProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingUnitId, setGeneratingUnitId] = useState<string | null>(null);
  const [generatingWaitStatus, setGeneratingWaitStatus] = useState<GeneratingWaitStatus | null>(null);

  const [quizCountModalVisible, setQuizCountModalVisible] = useState(false);
  const [pendingQuizUnit, setPendingQuizUnit] = useState<PendingQuizUnit | null>(null);

  // 문제 출제 취소 제어용 ref
  const abortRef = useRef(false);

  const handleCancelGeneration = useCallback(() => {
    abortRef.current = true;
    setIsGenerating(false);
    setGeneratingUnitId(null);
    setGeneratingWaitStatus(null);
    showAlert('출제 취소', '문제 출제가 취소되었습니다.');
  }, []);

  const handlePromptQuizCount = useCallback(
    (topicId: string, topicName: string, unitId: string, unitTitle: string) => {
      const currentTopic = topics.find((t) => t.id === topicId);
      const existingCount = questions.filter(
        (q) => q.topicId === topicId && (q.unitId === unitId || q.stem.includes(unitTitle))
      ).length;
      setPendingQuizUnit({
        topicId,
        topicName,
        unitId,
        unitTitle,
        existingCount,
        initialLevel: currentTopic?.learnerLevel || 'basic',
      });
      setQuizCountModalVisible(true);
    },
    [questions, topics]
  );

  const handleQuickGenerateForUnit = useCallback(
    async (
      topicId: string,
      topicName: string,
      unitId: string,
      unitTitle: string,
      targetCount: number = 3,
      options?: { learnerLevel?: LearnerKnowledgeLevel; shouldReplaceExisting?: boolean }
    ) => {
      abortRef.current = false;
      setGeneratingUnitId(unitId);
      setGeneratingWaitStatus({
        active: true,
        count: targetCount,
        title: `${topicName} - ${unitTitle}`,
        message: '잠시만 기다려 주세요 ✨',
      });
      try {
        const targetLevel = options?.learnerLevel || 'basic';
        const levelText =
          targetLevel === 'beginner'
            ? '입문 기초'
            : targetLevel === 'advanced'
            ? '실전'
            : targetLevel === 'master'
            ? '심화'
            : '표준 정규';

        const scoped = analyzeUserIntent(
          `[${topicName} - ${unitTitle}] ${levelText} 난이도 개념 ${targetCount}문제 출제`,
          topicName,
          {
            learnerLevel: targetLevel,
            targetCount,
          }
        );

        // 학습자가 업로드한 교재/자료 텍스트 조회
        const sourceMaterial = await getSourceTextForTopic(topicId, topicName);

        // 이 단원에 이미 저장된 문제 최신 DB에서 파악 -> 판박이 중복 방지 및 단원 내 다양한 개념 확장
        const allSavedQuestions = await getQuestions();
        const existingInUnit = allSavedQuestions.filter(
          (q) => q.topicId === topicId && (q.unitId === unitId || q.stem.includes(unitTitle))
        );
        const existingSummary = existingInUnit
          .slice(-15)
          .map((q) => `• ${q.stem}`)
          .join('\n');

        const contextParts: string[] = [];
        if (sourceMaterial && sourceMaterial.trim().length > 0) {
          contextParts.push(
            `[학습자가 직접 첨부한 교재/자료 핵심 내용 (★최우선 반영 필수★)]:\n${sourceMaterial}\n※ 반드시 학습자가 첨부한 위 교재 내용과 핵심 개념을 직접 활용하여 시험 문제를 정밀 출제해 주십시오.`
          );
        }
        if (existingSummary) {
          contextParts.push(
            `[이 단원에 이미 출제된 기존 문제 목록 (판박이 복사 재탕 절대 금지 & 개념 범위 확장)]:\n${existingSummary}\n※ 핵심 지침:\n1. 위 기존 문제들과 문장 구조나 지문이 똑같은 판박이 재탕 문항은 절대 출제하지 마십시오.\n2. 특정 대표 개념 하나만 반복하지 말고, 이 단원 내의 다양한 다른 세부 개념, 원리, 공식, 이론들을 골고루 탐색하여 출제하십시오.\n3. 단원의 중요 핵심 개념을 다루더라도 구체적 사례 제시, 긍정/부정 비틀기 등 다른 각도로 꼬아낸 변형 문제는 자연스럽게 허용됩니다.`
          );
        }

        const customContext = contextParts.length > 0 ? contextParts.join('\n\n') : undefined;
        const currentTopic = topics.find((t) => t.id === topicId);
        const outcome = await generateFactBasedQuestions({
          intent: scoped,
          ownerId: 'owner-default',
          topicId,
          topicName,
          category: currentTopic?.category,
          unitId,
          unitTitle,
          customContext,
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

        if (outcome.status === 'FAILED') {
          showAlert('AI 출제 실패', outcome.message, [
            { text: '닫기', style: 'cancel' },
            { text: '설정 열기', onPress: onOpenSettings },
          ]);
          return;
        }

        if (outcome.questions && outcome.questions.length > 0) {
          if (options?.shouldReplaceExisting) {
            // 사용자의 선택: 기존 문제를 비우고, 선택한 새 난이도 문제로 완전 교체!
            await deleteQuestionsForUnit(topicId, unitId, unitTitle);
            await addQuestions(outcome.questions);
          } else {
            // 기본: 기존 문제를 보존하고 누적 보관 (100% 완전 일치 판박이 복사본만 정밀 필터링)
            const existingStemSet = new Set(
              existingInUnit.map((q) => q.stem.replace(/[\s\p{P}]/gu, '').toLowerCase())
            );
            const freshQuestions = outcome.questions.filter((q) => {
              const normalized = q.stem.replace(/[\s\p{P}]/gu, '').toLowerCase();
              return !existingStemSet.has(normalized);
            });
            const questionsToAdd = freshQuestions.length > 0 ? freshQuestions : outcome.questions;
            await addQuestions(questionsToAdd);
          }
        }

        const allQ = await getQuestions();
        setQuestions(allQ);

        // 출제 완료 시 CBT 시험장 즉시 입장 (과목보관함 위치 안전 유지)
        startExam(outcome.questions);
      } catch (err: any) {
        if (!abortRef.current) {
          showAlert('오류', `단원 문제 출제 실패: ${err?.message || '네트워크 응답 오류'}`);
        }
      } finally {
        setGeneratingUnitId(null);
        setGeneratingWaitStatus(null);
      }
    },
    [onOpenSettings, setQuestions, startExam, topics]
  );

  const handleSelectQuizCount = useCallback(
    async (
      count: number,
      options?: { learnerLevel?: LearnerKnowledgeLevel; shouldReplaceExisting?: boolean }
    ) => {
      setQuizCountModalVisible(false);
      if (!pendingQuizUnit) return;
      const { topicId, topicName, unitId, unitTitle } = pendingQuizUnit;
      await handleQuickGenerateForUnit(topicId, topicName, unitId, unitTitle, count, options);
    },
    [pendingQuizUnit, handleQuickGenerateForUnit]
  );

  const handleGenerateMoreQuestions = useCallback(async () => {
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
      units.find((u) => u.id === selectedUnitId) ||
      units.find((u) => u.topicId === currentTopic.id);

    const existingQuestions = questions.filter((q) => q.topicId === currentTopic.id);

    if (!apiKey || apiKey.trim().length <= 8) {
      showAlert(
        'API 키 미등록',
        '새로운 문제를 생성하기 위한 AI API 키가 등록되지 않아 문제를 만들지 못했습니다.\n\n기존에 학습했던 문제를 복습하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: 'API 키 설정', onPress: onOpenSettings },
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

    abortRef.current = false;
    setIsGenerating(true);
    setGeneratingWaitStatus({
      active: true,
      count: 3,
      title: `${currentTopic.name} 추가 학습`,
      message: '잠시만 기다려 주세요 ✨',
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

      const sourceMaterial = await getSourceTextForTopic(currentTopic.id, currentTopic.name);
      const allSavedQuestions = await getQuestions();
      const existingInTargetUnit = allSavedQuestions.filter(
        (q) => q.topicId === currentTopic.id && (q.unitId === targetUnitId || (targetUnitTitle && q.stem.includes(targetUnitTitle)))
      );
      const existingSummary = existingInTargetUnit
        .slice(-15)
        .map((q) => `• ${q.stem}`)
        .join('\n');

      const contextParts: string[] = [];
      if (sourceMaterial && sourceMaterial.trim().length > 0) {
        contextParts.push(
          `[학습자가 직접 첨부한 교재/자료 핵심 내용 (★최우선 반영 필수★)]:\n${sourceMaterial}\n※ 반드시 학습자가 첨부한 위 교재 내용과 핵심 개념을 직접 활용하여 시험 문제를 정밀 출제해 주십시오.`
        );
      }
      if (existingSummary) {
        contextParts.push(
          `[이 단원에 이미 출제된 기존 문제 목록 (판박이 복사 재탕 절대 금지 & 개념 범위 확장)]:\n${existingSummary}\n※ 핵심 지침:\n1. 위 기존 문제들과 문장 구조나 지문이 똑같은 판박이 재탕 문항은 절대 출제하지 마십시오.\n2. 특정 대표 개념 하나만 반복하지 말고, 이 단원 내의 다양한 다른 세부 개념, 원리, 공식, 이론들을 골고루 탐색하여 출제하십시오.\n3. 단원의 중요 핵심 개념을 다룰 때 구체적 사례 제시, 긍정/부정 비틀기 등 다른 각도로 꼬아낸 변형 문제는 자연스럽게 허용됩니다.`
        );
      }

      const customContext = contextParts.length > 0 ? contextParts.join('\n\n') : undefined;

      const outcome = await generateFactBasedQuestions({
        intent: scoped,
        ownerId: 'owner-default',
        topicId: currentTopic.id,
        topicName: currentTopic.name,
        category: currentTopic.category,
        unitId: targetUnitId,
        unitTitle: targetUnitTitle,
        customContext,
      });

      if (abortRef.current) {
        return;
      }

      if (outcome.status === 'NEEDS_CONNECTION') {
        showAlert(
          'API 키 미등록',
          '새로운 문제를 생성하기 위한 AI API 키가 등록되지 않아 문제를 만들지 못했습니다.\n\n기존에 학습했던 문제를 복습하시겠습니까?',
          [
            { text: '취소', style: 'cancel' },
            { text: 'API 키 설정', onPress: onOpenSettings },
            ...(existingQuestions.length > 0
              ? [{ text: '기존 문제 복습하기', onPress: () => startExam(existingQuestions) }]
              : []),
          ]
        );
        return;
      }

      if (outcome.status === 'FAILED') {
        showAlert('AI 출제 실패', outcome.message, [
          { text: '닫기', style: 'cancel' },
          { text: '설정 열기', onPress: onOpenSettings },
        ]);
        return;
      }

      if (outcome.questions && outcome.questions.length > 0) {
        // 기존 지문과 100% 완전 일치하는 판박이 복사본 필터링 (변형된 문제는 정상 허용)
        const existingStemSet = new Set(
          existingInTargetUnit.map((q) => q.stem.replace(/[\s\p{P}]/gu, '').toLowerCase())
        );
        const freshQuestions = outcome.questions.filter((q) => {
          const normalized = q.stem.replace(/[\s\p{P}]/gu, '').toLowerCase();
          return !existingStemSet.has(normalized);
        });
        const questionsToAdd = freshQuestions.length > 0 ? freshQuestions : outcome.questions;
        await addQuestions(questionsToAdd);
      }

      const allQ = await getQuestions();
      setQuestions(allQ);

      // 즉시 새로 출제된 문제로 CBT 시험 시작
      startExam(outcome.questions);
    } catch (err: any) {
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
  ]);

  const handleApplyScaffolding = useCallback(async () => {
    const topicIncorrect = selectedTopicId
      ? incorrectQuestions.filter((q) => q.topicId === selectedTopicId)
      : incorrectQuestions;
    const targetMistakes = topicIncorrect.length > 0 ? topicIncorrect : incorrectQuestions;

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
    handleQuickGenerateForUnit,
    handleGenerateMoreQuestions,
    handleApplyScaffolding,
    handleCancelGeneration,
  };
}

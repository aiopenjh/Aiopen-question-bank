import { useState, useCallback, useRef } from 'react';
import { Topic, Unit, QuestionRevision } from '../contracts/types';
import {
  analyzeUserIntent,
  generateFactBasedQuestions,
  generateCurriculumUnits,
} from '../domain/generator';
import {
  getQuestions,
  addQuestions,
  getUnits,
  replaceTopicUnits,
  createUnit,
  deduplicateTopicUnits,
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
  onRefreshData: () => Promise<void>;
  setUnits: (units: Unit[]) => void;
  setQuestions: (questions: QuestionRevision[]) => void;
  onCloseLibrary?: () => void;
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
  onRefreshData,
  setUnits,
  setQuestions,
  onCloseLibrary,
}: UseQuizGenerationProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCurriculumGenerating, setIsCurriculumGenerating] = useState(false);
  const [generatingUnitId, setGeneratingUnitId] = useState<string | null>(null);
  const [generatingWaitStatus, setGeneratingWaitStatus] = useState<GeneratingWaitStatus | null>(null);

  const [quizCountModalVisible, setQuizCountModalVisible] = useState(false);
  const [pendingQuizUnit, setPendingQuizUnit] = useState<PendingQuizUnit | null>(null);

  // 문제 출제 취소 제어용 ref
  const abortRef = useRef(false);

  const handleCancelGeneration = useCallback(() => {
    abortRef.current = true;
    setIsGenerating(false);
    setIsCurriculumGenerating(false);
    setGeneratingUnitId(null);
    setGeneratingWaitStatus(null);
    showAlert('출제 취소', '문제 출제가 취소되었습니다.');
  }, []);

  const handlePromptQuizCount = useCallback(
    (topicId: string, topicName: string, unitId: string, unitTitle: string) => {
      const existingCount = questions.filter(
        (q) => q.topicId === topicId && (q.unitId === unitId || q.stem.includes(unitTitle))
      ).length;
      setPendingQuizUnit({ topicId, topicName, unitId, unitTitle, existingCount });
      setQuizCountModalVisible(true);
    },
    [questions]
  );

  const handleQuickGenerateForUnit = useCallback(
    async (
      topicId: string,
      topicName: string,
      unitId: string,
      unitTitle: string,
      targetCount: number = 3
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
        const scoped = analyzeUserIntent(
          `[${topicName} - ${unitTitle}] 핵심 개념 ${targetCount}문제 출제`,
          topicName,
          {
            learnerLevel: 'basic',
            targetCount,
          }
        );

        // 학습자가 업로드한 교재/자료 텍스트 조회
        const sourceMaterial = await getSourceTextForTopic(topicId, topicName);

        // 이 단원에 이미 저장된 문제 파악 -> 중복 방지 및 50~100문제 누적 출제 컨텍스트 전달
        const existingInUnit = questions.filter(
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
            `[이 단원에 이미 출제되어 보관 중인 기존 문제 목록 (중복 출제 엄격 금지)]:\n${existingSummary}\n※ 학습자가 이 단원에서 50~100문제 이상 대량의 문제은행을 영구 누적 보존할 수 있도록, 위 기존 문제와 겹치지 않는 새로운 발문과 개념 범위를 확장하여 독창적으로 출제해 주세요.`
          );
        }

        const customContext = contextParts.length > 0 ? contextParts.join('\n\n') : undefined;

        const outcome = await generateFactBasedQuestions({
          intent: scoped,
          ownerId: 'owner-default',
          topicId,
          topicName,
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
          await addQuestions(outcome.questions);
        }

        const allQ = await getQuestions();
        setQuestions(allQ);

        // 출제 완료 시 자료함 닫고 CBT 시험장 즉시 입장
        onCloseLibrary?.();
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
    [onOpenSettings, setQuestions, startExam, onCloseLibrary]
  );

  const handleSelectQuizCount = useCallback(
    async (count: number) => {
      setQuizCountModalVisible(false);
      if (!pendingQuizUnit) return;
      const { topicId, topicName, unitId, unitTitle } = pendingQuizUnit;
      await handleQuickGenerateForUnit(topicId, topicName, unitId, unitTitle, count);
    },
    [pendingQuizUnit, handleQuickGenerateForUnit]
  );

  const executeCurriculumGeneration = useCallback(
    async (
      topicId: string,
      topicName: string,
      options?: {
        startUnitIndex?: number;
        stageName?: string;
        shouldReplace?: boolean;
        existingTitles?: string[];
      }
    ) => {
      const {
        startUnitIndex = 1,
        stageName,
        shouldReplace = false,
        existingTitles = [],
      } = options || {};

      abortRef.current = false;
      setIsCurriculumGenerating(true);
      setGeneratingWaitStatus({
        active: true,
        count: 0,
        title: `${topicName} 5단계 목차`,
        message: '잠시만 기다려 주세요 ✨',
      });
      try {
        const generatedUnits = await generateCurriculumUnits({
          topicName,
          startUnitIndex,
          stageName,
          existingUnitTitles: existingTitles,
        });

        if (abortRef.current) {
          return;
        }

        if (shouldReplace) {
          await replaceTopicUnits(topicId, generatedUnits);
        } else {
          // 중복 방지: 이미 존재하는 동일 단원명은 추가하지 않음
          const currentUnits = await getUnits(topicId);
          const existingSet = new Set(currentUnits.map((u) => u.title.trim()));
          for (const u of generatedUnits) {
            if (!existingSet.has(u.title.trim())) {
              await createUnit({ topicId, title: u.title, depth: u.depth });
            }
          }
        }

        const updatedUnits = await getUnits();
        setUnits(updatedUnits);

        const startPad = String(startUnitIndex).padStart(2, '0');
        const endPad = String(startUnitIndex + 4).padStart(2, '0');

        if (startUnitIndex > 1) {
          showAlert(
            '🎉 다음 단계 목차 확장 완료',
            `[${topicName}]의 ${startPad}~${endPad}단원(${stageName || '다음 학습 단계'})이 성공적으로 추가되었습니다!\n\n새로 생성된 단원의 문제를 풀며 단계별로 학습을 이어가 보세요.`
          );
        } else {
          showAlert(
            '목차 생성 완료',
            `[${topicName}]의 1단계(01~05단원) 필수 과정이 구성되었습니다.\n\n각 단원의 [출제 / 풀기]를 눌러 문제를 학습해 보세요!`
          );
        }
      } catch (err: any) {
        showAlert('오류', `AI 커리큘럼 생성 실패: ${err?.message || '알 수 없는 오류'}`);
      } finally {
        setIsCurriculumGenerating(false);
        setGeneratingWaitStatus(null);
      }
    },
    [setUnits]
  );

  const handleGenerateCurriculumForTopic = useCallback(
    async (topicId: string, topicName: string) => {
      const existing = units.filter((u) => u.topicId === topicId);
      const topicQuestions = questions.filter((q) => q.topicId === topicId);

      // 단원이 아직 없거나 1개뿐인 경우 -> 1단계(01~05단원) 즉시 생성
      if (existing.length <= 1) {
        await executeCurriculumGeneration(topicId, topicName, {
          startUnitIndex: 1,
          stageName: '1단계: 입문/기초 핵심 표준 과정',
          shouldReplace: true,
        });
        return;
      }

      const existingTitles = existing.map((u) => u.title.trim());
      const nextStartIndex = existing.length + 1;
      const startPad = String(nextStartIndex).padStart(2, '0');
      const endPad = String(nextStartIndex + 4).padStart(2, '0');

      // 30단원 이상 도달 시: 30단계 마스터 축하 및 계속 추가 생성 선택 제공
      if (existing.length >= 30) {
        showAlert(
          '👑 30단계 초정밀 마스터 커리큘럼 완성',
          `[${topicName}]의 입문부터 실전 프로젝트까지 총 ${existing.length}개의 촘촘한 마이크로 커리큘럼이 완성되었습니다!\n\n현재 총 ${topicQuestions.length}문항이 저장되어 있습니다. 추가 단원을 더 생성하시겠습니까, 아니면 전체 CBT 모의고사를 보시겠습니까?`,
          [
            { text: '닫기', style: 'cancel' },
            ...(topicQuestions.length > 0
              ? [
                  {
                    text: `📝 전체 CBT 문제 풀기 (${topicQuestions.length}문항)`,
                    onPress: () => startExam(topicQuestions),
                  },
                ]
              : []),
            {
              text: `🚀 다음 ${startPad}~${endPad}단원 계속 확장`,
              onPress: () =>
                executeCurriculumGeneration(topicId, topicName, {
                  startUnitIndex: nextStartIndex,
                  stageName: `${Math.floor((nextStartIndex - 1) / 5) + 1}단계: 고난도 실전 심화 확장 과정`,
                  shouldReplace: false,
                  existingTitles,
                }),
            },
            {
              text: '처음부터 1단계로 새로고침',
              style: 'destructive',
              onPress: () =>
                executeCurriculumGeneration(topicId, topicName, {
                  startUnitIndex: 1,
                  stageName: '1단계: 입문/기초 핵심 표준 과정',
                  shouldReplace: true,
                }),
            },
          ]
        );
        return;
      }

      // 5단위 단계별(1~6단계, 30단원까지) 세분화된 단계명 산출
      const stageNumber = Math.floor((nextStartIndex - 1) / 5) + 1;
      const stageNames: Record<number, string> = {
        2: '2단계: 핵심 기본 개념 & 원리 이해',
        3: '3단계: 심화 이론 & 세부 유형 분석',
        4: '4단계: 실무 적용 & 실전 응용 사례',
        5: '5단계: 빈출 함정 극복 & 심층 추론',
        6: '6단계: 고난도 복합 융합 & 종합 마스터',
      };
      const nextStageName = stageNames[stageNumber] || `${stageNumber}단계: 실전 심화 연속 과정`;

      showAlert(
        `📚 촘촘한 마이크로 커리큘럼 확장 (${startPad}~${endPad}단원)`,
        `현재 ${existing.length}개 단원이 등록되어 있습니다.\n\n이전 단계 학습이 끝나셨다면, ${startPad}번 이후의 [${nextStageName}] 5개 단원을 촘촘하게 이어서 생성하시겠습니까?\n\n(또는 전체 CBT 문제를 먼저 풀며 검증 후 다음 과정으로 넘어가실 수도 있습니다.)`,
        [
          { text: '취소', style: 'cancel' },
          ...(topicQuestions.length > 0
            ? [
                {
                  text: `📝 전체 CBT 검증 후 넘어가기 (${topicQuestions.length}문항)`,
                  onPress: () => startExam(topicQuestions),
                },
              ]
            : []),
          {
            text: `🚀 다음 ${startPad}~${endPad}단원 생성`,
            onPress: () =>
              executeCurriculumGeneration(topicId, topicName, {
                startUnitIndex: nextStartIndex,
                stageName: nextStageName,
                shouldReplace: false,
                existingTitles,
              }),
          },
          {
            text: '1단계부터 새로고침',
            style: 'destructive',
            onPress: () =>
              executeCurriculumGeneration(topicId, topicName, {
                startUnitIndex: 1,
                stageName: '1단계: 입문/기초 핵심 표준 과정',
                shouldReplace: true,
              }),
          },
        ]
      );
    },
    [units, questions, executeCurriculumGeneration, startExam]
  );

  const handleDeduplicateUnits = useCallback(
    async (topicId: string) => {
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
    },
    [setUnits]
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
      const customContext = sourceMaterial && sourceMaterial.trim().length > 0
        ? `[학습자가 직접 첨부한 교재/자료 핵심 내용 (★최우선 반영 필수★)]:\n${sourceMaterial}\n※ 반드시 학습자가 첨부한 위 교재 내용과 핵심 개념을 직접 활용하여 시험 문제를 정밀 출제해 주십시오.`
        : undefined;

      const outcome = await generateFactBasedQuestions({
        intent: scoped,
        ownerId: 'owner-default',
        topicId: currentTopic.id,
        topicName: currentTopic.name,
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
            { text: '설정 열기', onPress: onOpenSettings },
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
        await addQuestions(outcome.questions);
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
    handleCancelGeneration,
  };
}

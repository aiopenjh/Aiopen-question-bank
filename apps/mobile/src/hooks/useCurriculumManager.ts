import { useState, useCallback, useRef } from 'react';
import { Unit, QuestionRevision } from '../contracts/types';
import { generateCurriculumUnits } from '../domain/generator';
import {
  getUnits,
  replaceTopicUnits,
  createUnit,
  deduplicateTopicUnits,
} from '../data/db';
import { showAlert } from '../utils/alert';

export interface UseCurriculumManagerProps {
  units: Unit[];
  questions: QuestionRevision[];
  setUnits: (units: Unit[]) => void;
  startExam: (questions: QuestionRevision[]) => void;
  setGeneratingWaitStatus: (
    status: { active: boolean; count: number; title: string; message: string } | null
  ) => void;
}

export interface UseCurriculumManagerReturn {
  isCurriculumGenerating: boolean;
  executeCurriculumGeneration: (
    topicId: string,
    topicName: string,
    options?: {
      startUnitIndex?: number;
      stageName?: string;
      shouldReplace?: boolean;
      existingTitles?: string[];
    }
  ) => Promise<void>;
  handleGenerateCurriculumForTopic: (topicId: string, topicName: string) => Promise<void>;
  handleDeduplicateUnits: (topicId: string) => Promise<void>;
  cancelCurriculumGeneration: () => void;
}

export function useCurriculumManager({
  units,
  questions,
  setUnits,
  startExam,
  setGeneratingWaitStatus,
}: UseCurriculumManagerProps): UseCurriculumManagerReturn {
  const [isCurriculumGenerating, setIsCurriculumGenerating] = useState(false);
  const abortRef = useRef(false);

  const cancelCurriculumGeneration = useCallback(() => {
    abortRef.current = true;
    setIsCurriculumGenerating(false);
    setGeneratingWaitStatus(null);
  }, [setGeneratingWaitStatus]);

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
    [setUnits, setGeneratingWaitStatus]
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

  return {
    isCurriculumGenerating,
    executeCurriculumGeneration,
    handleGenerateCurriculumForTopic,
    handleDeduplicateUnits,
    cancelCurriculumGeneration,
  };
}

/**
 * Quick Prompt AI Generation Hook
 * Generates questions directly from user-entered study prompt or query.
 */

import { useCallback } from 'react';
import { Topic, Unit, QuestionRevision, detectCategoryForTopic } from '../contracts/types';
import {
  createTopic,
  createUnit,
  getTopics,
  getUnits,
  getQuestions,
  getSourceTextForTopic,
} from '../data/db';
import { analyzeUserIntent, generateFactBasedQuestions } from '../domain/generator';
import { showAlert } from '../utils/alert';

export interface UsePromptGenerationProps {
  topics: Topic[];
  setTopics: (topics: Topic[]) => void;
  units: Unit[];
  setUnits: (units: Unit[]) => void;
  setSelectedTopicId: (id: string | null) => void;
  setSelectedUnitId: (id: string | null) => void;
  setQuestions: (questions: QuestionRevision[]) => void;
  startExam: (questions: QuestionRevision[]) => void;
  onOpenSettings: () => void;
  setIsGenerating: (generating: boolean) => void;
  setGeneratingWaitStatus: (status: any) => void;
}

export function usePromptGeneration({
  topics,
  setTopics,
  units,
  setUnits,
  setSelectedTopicId,
  setSelectedUnitId,
  setQuestions,
  startExam,
  onOpenSettings,
  setIsGenerating,
  setGeneratingWaitStatus,
}: UsePromptGenerationProps) {
  const handleQuickPromptGenerate = useCallback(
    async (prompt: string) => {
      try {
        setIsGenerating(true);
        setGeneratingWaitStatus({
          active: true,
          count: 3,
          title: prompt,
          message: '잠시만 기다려 주세요 ✨',
        });
        const intent = analyzeUserIntent(prompt);
        const category = detectCategoryForTopic(`${prompt} ${intent.domain}`);

        let targetTopic = topics.find(
          (t) => t.name.trim().toLowerCase() === intent.domain.trim().toLowerCase()
        );

        let targetUnitId: string | undefined;
        let targetUnitTitle: string | undefined;

        if (!targetTopic) {
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

        const sourceMaterial = await getSourceTextForTopic(targetTopic.id, targetTopic.name);
        const allSavedQuestions = await getQuestions();
        const existingInTargetUnit = allSavedQuestions.filter(
          (q) => q.topicId === targetTopic!.id && (q.unitId === targetUnitId || (targetUnitTitle && q.stem.includes(targetUnitTitle)))
        );
        const existingSummary = existingInTargetUnit
          .slice(-15)
          .map((q) => `• ${q.stem}`)
          .join('\n');

        const contextParts: string[] = [prompt];
        if (sourceMaterial && sourceMaterial.trim().length > 0) {
          contextParts.push(`[학습자가 첨부한 교재/자료 핵심 내용 (★출제 적극 반영 필수★)]:\n${sourceMaterial}`);
        }
        if (existingSummary) {
          contextParts.push(
            `[이 단원에 이미 출제된 기존 문제 목록 (판박이 복사 재탕 절대 금지 & 개념 범위 확장)]:\n${existingSummary}\n※ 핵심 지침:\n1. 위 기존 문제들과 문장 구조나 지문이 똑같은 판박이 재탕 문항은 절대 출제하지 마십시오.\n2. 특정 대표 개념 하나만 반복하지 말고, 이 단원 내의 다양한 다른 세부 개념, 원리, 공식, 이론들을 골고루 탐색하여 출제하십시오.\n3. 단원의 중요 핵심 개념을 다룰 때 구체적 사례 제시, 긍정/부정 비틀기 등 다른 각도로 꼬아낸 변형 문제는 자연스럽게 허용됩니다.`
          );
        }

        const customContext = contextParts.join('\n\n');

        const outcome = await generateFactBasedQuestions({
          intent,
          ownerId: 'owner-default',
          topicId: targetTopic.id,
          topicName: targetTopic.name,
          category: targetTopic.category,
          unitId: targetUnitId,
          unitTitle: targetUnitTitle || intent.domain,
          customContext,
        });

        if (outcome.status === 'NEEDS_CONNECTION') {
          showAlert('⚠️ API 키 필요', outcome.message, [
            { text: '닫기' },
            { text: '설정 열기', onPress: onOpenSettings },
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
    },
    [
      topics,
      setTopics,
      units,
      setUnits,
      setSelectedTopicId,
      setSelectedUnitId,
      setQuestions,
      startExam,
      onOpenSettings,
      setIsGenerating,
      setGeneratingWaitStatus,
    ]
  );

  return { handleQuickPromptGenerate };
}

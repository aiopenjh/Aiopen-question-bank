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
  addQuestions,
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
        const customContext = sourceMaterial && sourceMaterial.trim().length > 0
          ? `${prompt}\n\n[학습자가 첨부한 교재/자료 핵심 내용 (★출제 적극 반영 필수★)]:\n${sourceMaterial}`
          : prompt;

        const outcome = await generateFactBasedQuestions({
          intent,
          ownerId: 'owner-default',
          topicId: targetTopic.id,
          topicName: targetTopic.name,
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

        if (outcome.questions && outcome.questions.length > 0) {
          await addQuestions(outcome.questions);
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

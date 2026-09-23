/**
 * Quick Prompt AI Generation Hook
 * Generates questions directly from user-entered study prompt or query.
 */

import { useCallback } from 'react';
import { Topic, Unit, QuestionRevision, detectCategoryForTopic } from '../contracts/types';
import {
  addQuestions,
  createTopicWithUnits,
  createUnit,
  deleteTopic,
  generateUUID,
  getQuestions,
  getSourceTextForTopic,
  getTopics,
  getUnits,
} from '../data/db';
import { analyzeUserIntent, generateFactBasedQuestions } from '../domain/generator';
import { showAlert } from '../utils/alert';
import { CHALLENGE_START_LEVEL } from '../domain/challenge_progress';
import type { ExamStartOptions } from './useExamSession';

export interface UsePromptGenerationProps {
  topics: Topic[];
  setTopics: (topics: Topic[]) => void;
  units: Unit[];
  setUnits: (units: Unit[]) => void;
  setSelectedTopicId: (id: string | null) => void;
  setSelectedUnitId: (id: string | null) => void;
  setQuestions: (questions: QuestionRevision[]) => void;
  startExam: (questions: QuestionRevision[], options?: ExamStartOptions) => void;
  onOpenSettings: () => void;
  setIsGenerating: (generating: boolean) => void;
  setGeneratingWaitStatus: (status: any) => void;
}

function formatIntentMessage(message: string, choices: string[]): string {
  if (choices.length === 0) return message;
  return `${message}\n\n가능한 해석:\n${choices.map((choice) => `• ${choice}`).join('\n')}`;
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
      let newlyCreatedTopicId: string | null = null;
      try {
        setIsGenerating(true);
        setGeneratingWaitStatus({
          active: true,
          count: 3,
          title: prompt,
          message: '잠시만 기다려 주세요 ✨',
        });

        let intent = analyzeUserIntent(prompt);
        // 카테고리는 보관함 정리에만 사용하며 AI의 실제 출제 주제를 바꾸지 않습니다.
        const displayCategory = detectCategoryForTopic(`${prompt} ${intent.domain}`);
        let targetTopic = topics.find(
          (topic) => topic.name.trim().toLowerCase() === intent.domain.trim().toLowerCase()
        );
        if (targetTopic) {
          intent = analyzeUserIntent(prompt, targetTopic.name, {
            learnerLevel: targetTopic.learnerLevel,
            difficultyLevel: targetTopic.difficultyLevel,
          });
        }
        const existingUnits = targetTopic
          ? units.filter((unit) => unit.topicId === targetTopic!.id)
          : [];
        let targetUnit = existingUnits[0];

        // 판정이 끝나기 전에는 주제와 단원을 저장하지 않습니다.
        const provisionalTopicId = targetTopic?.id || generateUUID();
        const provisionalUnitId = targetUnit?.id || generateUUID();
        const targetUnitTitle = targetUnit?.title || `${intent.domain} 핵심 종합`;

        const sourceMaterial = targetTopic
          ? await getSourceTextForTopic(targetTopic.id, targetTopic.name)
          : '';
        const allSavedQuestions = await getQuestions();
        const existingInTargetUnit = targetTopic
          ? allSavedQuestions.filter(
              (question) =>
                question.topicId === targetTopic!.id &&
                question.unitId === targetUnit?.id
            )
          : [];
        const existingSummary = existingInTargetUnit
          .slice(-15)
          .map((question) => `• ${question.stem}`)
          .join('\n');

        const contextParts: string[] = [prompt];
        if (sourceMaterial.trim()) {
          contextParts.push(
            `[학습자가 첨부한 자료]:\n${sourceMaterial}\n※ 이 자료의 내용을 우선하여 문제를 작성하세요.`
          );
        }
        if (existingSummary) {
          contextParts.push(
            `[기존 문제 - 지문과 핵심 질문 중복 금지]:\n${existingSummary}`
          );
        }

        const outcome = await generateFactBasedQuestions({
          intent,
          ownerId: 'owner-default',
          topicId: provisionalTopicId,
          topicName: intent.domain,
          category: displayCategory,
          unitId: provisionalUnitId,
          unitTitle: targetUnitTitle,
          customContext: contextParts.join('\n\n'),
        });

        if (outcome.status === 'NEEDS_CONNECTION') {
          showAlert('⚠️ API 키 필요', outcome.message, [
            { text: '닫기' },
            { text: '설정 열기', onPress: onOpenSettings },
          ]);
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
          showAlert('AI 생성 요청 실패', outcome.message);
          return;
        }

        if (!targetTopic) {
          const created = await createTopicWithUnits({
            name: intent.domain,
            description: '사용자가 입력한 자유 학습 주제',
            category: displayCategory,
            learnerLevel: intent.learnerLevel,
            difficultyLevel: intent.difficultyLevel,
            units: [{ title: targetUnitTitle, depth: 1 }],
          });
          targetTopic = created.topic;
          targetUnit = created.units[0];
          newlyCreatedTopicId = created.topic.id;
        } else if (!targetUnit) {
          targetUnit = await createUnit({
            topicId: targetTopic.id,
            title: targetUnitTitle,
            depth: 1,
          });
        }

        const questionsToSave = outcome.questions.map((question) => ({
          ...question,
          topicId: targetTopic!.id,
          unitId: targetUnit!.id,
        }));
        const savedQuestions = await addQuestions(questionsToSave);
        if (savedQuestions.length === 0) {
          if (newlyCreatedTopicId) await deleteTopic(newlyCreatedTopicId);
          showAlert('중복 문제 확인', '새로 생성된 문제가 기존 문제와 너무 비슷하여 저장하지 않았습니다.');
          return;
        }

        const [updatedTopics, updatedUnits, updatedQuestions] = await Promise.all([
          getTopics(),
          getUnits(),
          getQuestions(),
        ]);
        setTopics(updatedTopics);
        setUnits(updatedUnits);
        setQuestions(updatedQuestions);
        setSelectedTopicId(targetTopic.id);
        setSelectedUnitId(targetUnit.id);
        startExam(savedQuestions, {
          challengeEligible: intent.difficultyLevel >= CHALLENGE_START_LEVEL,
        });
      } catch (err: any) {
        if (newlyCreatedTopicId) {
          try {
            await deleteTopic(newlyCreatedTopicId);
          } catch {
            // 원래 오류를 사용자에게 유지하여 전달합니다.
          }
        }
        showAlert('출제 오류', err?.message || '문제를 생성하지 못했습니다.');
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

/**
 * App Data & Entity Management Hook
 * Manages core entity state, initialization, pull-to-refresh, and CRUD operations.
 */

import { useState, useEffect } from 'react';
import {
  Topic,
  Unit,
  RoutineRevision,
  QuestionRevision,
  Attempt,
  ManualCompletion,
  Source,
  ReviewState,
  LearnerKnowledgeLevel,
} from '../contracts/types';
import {
  initializeDatabase,
  getRoutine,
  saveRoutine,
  getTopics,
  createTopicWithUnits,
  deleteTopic,
  getUnits,
  createUnit,
  deleteUnit,
  toggleUnitCompletion,
  getManualCompletions,
  getQuestions,
  deleteQuestion,
  getAttempts,
  getEncryptedApiKey,
  saveEncryptedApiKey,
  getSources,
  getReviewStates,
  getIncorrectQuestions,
  getLastStudiedTopicId,
  saveLastStudiedTopicId,
} from '../data/db';
import { generateCurriculumUnits } from '../domain/generator';
import { GeneratedUnitItem } from '../domain/curriculum_generator';
import {
  AlarmConfig,
  DEFAULT_ALARM_CONFIG,
  getAlarmConfig,
  saveAlarmConfig,
} from '../utils/notifications';
import { showAlert } from '../utils/alert';

export function useAppData(callbacks?: {
  onAfterTopicCreated?: (created: Topic, generatedCount: number) => void;
}) {
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
  const [lastStudiedTopicId, setLastStudiedTopicId] = useState<string | null>(null);
  const [alarmConfig, setAlarmConfig] = useState<AlarmConfig>(DEFAULT_ALARM_CONFIG);

  useEffect(() => {
    loadAppData();
  }, []);

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

  async function handlePullRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        loadAppData(true),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCreateTopic(
    name: string,
    description: string,
    options?: {
      autoCurriculum?: boolean;
      learnerLevel?: LearnerKnowledgeLevel;
      difficultyLevel?: number;
      category?: string;
      customUnits?: string[];
    }
  ) {
    const categoryName = options?.category?.trim() || '📚 일반';
    let generatedUnits: GeneratedUnitItem[] = [];

    // AI 주제 판정과 목차 검증이 끝나기 전에는 과목을 저장하지 않습니다.
    if ((!options?.customUnits || options.customUnits.length === 0) && options?.autoCurriculum !== false) {
      generatedUnits = await generateCurriculumUnits({
        topicName: name,
        topicDescription: description,
        category: categoryName,
        learnerLevel: options?.learnerLevel,
        difficultyLevel: options?.difficultyLevel,
      });
    }

    const unitsToCreate = options?.customUnits && options.customUnits.length > 0
      ? options.customUnits.map((title) => ({ title, depth: 1 as const }))
      : generatedUnits;
    const { topic: created, units: createdUnits } = await createTopicWithUnits({
      name,
      description,
      category: categoryName,
      learnerLevel: options?.learnerLevel,
      difficultyLevel: options?.difficultyLevel,
      units: unitsToCreate,
    });
    const generatedCount = createdUnits.length;

    const [updatedTopics, updatedUnits] = await Promise.all([getTopics(), getUnits()]);
    setTopics(updatedTopics);
    setUnits(updatedUnits);
    setSelectedTopicId(created.id);
    setSelectedUnitId(null);
    setLastStudiedTopicId(created.id);
    await saveLastStudiedTopicId(created.id);

    callbacks?.onAfterTopicCreated?.(created, generatedCount);
  }

  async function handleDeleteTopic(topicId: string, topicName: string) {
    showAlert(
      '⚠️ 과목 전체 영구 삭제',
      `선택하신 [${topicName}] 과목과 그 안에 포함된 모든 단원 및 보관된 문제 전체가 영구히 삭제됩니다.\n\n(단순 개별 문제 삭제가 아닌 '과목 자체'를 완전히 삭제하는 기능입니다)\n\n정말로 이 과목을 완전히 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '과목 전체 삭제',
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
    const unit = units.find((item) => item.id === unitId);
    if (!unit) return;
    const childIds = new Set([unitId]);
    let foundChild = true;
    while (foundChild) {
      foundChild = false;
      for (const item of units) {
        if (item.parentId && childIds.has(item.parentId) && !childIds.has(item.id)) {
          childIds.add(item.id);
          foundChild = true;
        }
      }
    }
    const questionCount = questions.filter(
      (question) => question.unitId && childIds.has(question.unitId)
    ).length;

    showAlert(
      '⚠️ 단원 전체 영구 삭제',
      `[${unit.title}] 단원과 하위 단원, 저장된 문제 ${questionCount}개 및 관련 풀이 기록이 모두 영구 삭제됩니다.\n\n삭제 후에는 복구할 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '단원 전체 삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUnit(unitId);
              const [nextUnits, nextQuestions, nextIncorrect, nextCompletions, nextReviewStates] =
                await Promise.all([
                  getUnits(),
                  getQuestions(),
                  getIncorrectQuestions(),
                  getManualCompletions(),
                  getReviewStates(),
                ]);
              setUnits(nextUnits);
              setQuestions(nextQuestions);
              setIncorrectQuestions(nextIncorrect);
              setCompletions(nextCompletions);
              setReviewStates(nextReviewStates);
              if (selectedUnitId && childIds.has(selectedUnitId)) {
                setSelectedUnitId(null);
              }
            } catch (error: any) {
              showAlert('삭제 실패', error?.message || '단원을 삭제하지 못했습니다.');
            }
          },
        },
      ]
    );
  }

  async function handleToggleUnitCompletion(unitId: string) {
    await toggleUnitCompletion(unitId, 'owner-default');
    const updated = await getManualCompletions();
    setCompletions(updated);
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

  async function handleSaveApiKey(keyToSave?: string) {
    const targetKey = (typeof keyToSave === 'string' ? keyToSave : apiKey).trim();
    if (!targetKey) {
      showAlert('알림', '저장할 API Key를 입력해 주세요.');
      return;
    }
    await saveEncryptedApiKey(targetKey);
    setApiKey(targetKey);
    showAlert(
      '🔒 보안 저장 완료',
      'API Key가 이 기기의 보안 저장소에 암호화되어 보관되었습니다.'
    );
  }

  async function handleDeleteApiKey() {
    await saveEncryptedApiKey('');
    setApiKey('');
    showAlert('삭제 완료', '저장된 API Key가 안전하게 파기되었습니다.');
  }

  async function handleChangeAlarmConfig(newConfig: AlarmConfig) {
    setAlarmConfig(newConfig);
    try {
      await saveAlarmConfig(newConfig);
    } catch (e) {
      console.warn('알람 설정 자동 저장 오류:', e);
    }
  }

  async function handleChangeTargetQuestionCount(count: number) {
    if (!routine) return;
    const nextCount = Math.max(1, count);
    const updated: RoutineRevision = {
      ...routine,
      targetQuestionCount: nextCount,
    };
    setRoutine(updated);
    try {
      await saveRoutine(updated);
    } catch (e) {
      console.warn('일일 목표 문항 수 저장 오류:', e);
    }
  }

  async function handleSaveSettings(onSuccess?: () => void) {
    try {
      const trimmed = apiKey.trim();
      if (trimmed) {
        await saveEncryptedApiKey(trimmed);
      }
      await saveAlarmConfig(alarmConfig);
      if (routine) {
        await saveRoutine(routine);
      }
      showAlert(
        '저장 완료',
        '설정 사항, 일일 목표 문항 수, 알람 스케줄이 안전하게 저장되었습니다.'
      );
      onSuccess?.();
    } catch (err: any) {
      showAlert('오류', `저장 중 오류 발생: ${err?.message || '알 수 없는 오류'}`);
    }
  }

  return {
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
  };
}

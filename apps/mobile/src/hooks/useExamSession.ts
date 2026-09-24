import { useState, useCallback, useRef } from 'react';
import {
  QuestionRevision,
  ReviewState,
  Unit,
  Attempt,
  Topic,
  AttemptCorrection,
  AttemptCorrectionReason,
} from '../contracts/types';
import { distributeQuestionAnswersRandomly } from '../domain/question_distribution';
import { calculateNextReviewState } from '../domain/spaced_repetition';
import { isGradingIncomplete } from '../domain/attempt_outcome';
import {
  saveAttempt,
  saveReviewState,
  markUnitAsCompleted,
  generateUUID,
  getCurrentISOTime,
  saveLastStudiedTopicId,
  getAttempts,
  saveAttemptCorrection,
  removeAttemptCorrection,
} from '../data/db';
import { showAlert } from '../utils/alert';
import { CHALLENGE_QUESTION_COUNT, CHALLENGE_START_LEVEL, getTopicChallengeLevels } from '../domain/challenge_progress';
import { syncRankingProgress } from '../domain/ranking_sync';

export interface UseExamSessionProps {
  questions: QuestionRevision[];
  reviewStates: ReviewState[];
  units: Unit[];
  topics?: Topic[];
  selectedTopicId: string | null;
  selectedUnitId: string | null;
  setSelectedTopicId: (id: string | null) => void;
  setLastStudiedTopicId: (id: string | null) => void;
  onRefreshData: () => Promise<void>;
}

/** 결과 화면의 사용자 정정·취소에 필요한 문항별 저장 정보 */
interface ResultRecord {
  attemptId: string;
  submissionKey: string;
  questionRevisionId: string;
  /** 시험 전 복습 상태 */
  reviewBefore: ReviewState | null;
  /** 시험 채점으로 저장한 복습 상태. 채점 미완료 문항은 복습 상태를 바꾸지 않으므로 null */
  reviewSaved: ReviewState | null;
  /** 정정으로 저장한 복습 상태 */
  reviewCorrected?: ReviewState;
}

export interface ExamStartOptions {
  /** 새로 생성된 레벨 31+ 문제만 순차 도전 통과 기록으로 인정한다. */
  challengeEligible?: boolean;
}

export function useExamSession({
  questions,
  reviewStates,
  units,
  topics = [],
  selectedTopicId,
  selectedUnitId,
  setSelectedTopicId,
  setLastStudiedTopicId,
  onRefreshData,
}: UseExamSessionProps) {
  const [examSessionActive, setExamSessionActive] = useState(false);
  const [examQuestions, setExamQuestions] = useState<QuestionRevision[]>([]);
  const [examSessionRunId, setExamSessionRunId] = useState<string | null>(null);
  const [examCorrections, setExamCorrections] = useState<Record<number, AttemptCorrectionReason>>({});
  const runRef = useRef<{
    id: string;
    startedAt: string;
    saving: boolean;
    completed: boolean;
    challengeEligible: boolean;
    correcting?: boolean;
    records?: ResultRecord[];
  } | null>(null);

  const startExam = useCallback(
    (filteredQuestions?: QuestionRevision[], options?: ExamStartOptions) => {
      let list = filteredQuestions;
      if (!list || list.length === 0) {
        // 1순위: 선택된 단원의 문제
        if (selectedUnitId) {
          list = questions.filter((q) => q.unitId === selectedUnitId);
        }
        // 2순위: 선택된 주제의 문제
        if (!list || list.length === 0) {
          if (selectedTopicId) {
            list = questions.filter((q) => q.topicId === selectedTopicId);
          } else {
            list = questions;
          }
        }
      }

      if (!list || list.length === 0) {
        const topicObj = topics.find((t) => t.id === selectedTopicId);
        showAlert(
          '출제된 문제 없음',
          topicObj
            ? `[${topicObj.name}] 과목에 출제된 문제가 아직 없습니다.\n'새 문제 출제'를 눌러 맞춤 문제를 먼저 생성해 보세요!`
            : '현재 풀 수 있는 문제가 없습니다.\n원하는 과목이나 단원의 문제를 먼저 출제해 보세요!'
        );
        return;
      }

      // 문제의 소속 대단원 파악하여 최근 학습 대단원으로 자동 기억 및 저장
      const firstQTopicId = list[0]?.topicId;
      if (firstQTopicId) {
        setSelectedTopicId(firstQTopicId);
        setLastStudiedTopicId(firstQTopicId);
        saveLastStudiedTopicId(firstQTopicId);
      }

      // 정답 번호가 한곳에 편중되지 않도록 균등 무작위 분산 배치 적용 (4지선다만 대상. 서술형/단답형은 options가 없어 그대로 유지)
      const mcList = list.filter((q) => q.questionType === 'multiple_choice');
      const distributedMc = distributeQuestionAnswersRandomly(mcList);
      let mcCursor = 0;
      const randomizedQuestions = list.map((q) =>
        q.questionType === 'multiple_choice' ? distributedMc[mcCursor++] : q
      );

      const runId = generateUUID();
      runRef.current = {
        id: runId,
        startedAt: getCurrentISOTime(),
        saving: false,
        completed: false,
        challengeEligible: options?.challengeEligible === true,
      };
      setExamSessionRunId(runId);
      setExamCorrections({});
      setExamQuestions(randomizedQuestions);
      setExamSessionActive(true);
    },
    [questions, selectedTopicId, selectedUnitId, setSelectedTopicId, setLastStudiedTopicId]
  );

  const handleCompleteExam = useCallback(
    async (
      results: Array<{
        question: QuestionRevision;
        selectedOptionId: string;
        isCorrect: boolean;
        answerText?: string;
        clozeAnswers?: string[];
        gradingStatus?: 'pending' | 'graded' | 'failed';
        gradingScore?: number;
        gradingChecklistResult?: { id: string; met: boolean }[];
        gradingFailedReason?: string;
      }>
    ) => {
      const run = runRef.current;
      if (!run || run.saving || run.completed) return;
      run.saving = true;
      try {
        const first = results[0]?.question;
        const isChallenge = run.challengeEligible &&
          results.length === CHALLENGE_QUESTION_COUNT &&
          examQuestions.length === CHALLENGE_QUESTION_COUNT && !!first?.topicId &&
          Number.isSafeInteger(first.difficultyLevel) && first.difficultyLevel! >= CHALLENGE_START_LEVEL &&
          new Set(results.map(item => item.question.id)).size === CHALLENGE_QUESTION_COUNT &&
          results.every(item => item.question.topicId === first.topicId &&
            item.question.difficultyLevel === first.difficultyLevel &&
            examQuestions.some(q => q.id === item.question.id));
        const before = isChallenge
          ? getTopicChallengeLevels(await getAttempts()).get(first.topicId!) ?? CHALLENGE_START_LEVEL - 1
          : 0;
        const records: ResultRecord[] = [];
        for (const [index, item] of results.entries()) {
          const attemptId = `${run.id}-${index}`;
          const attempt: Attempt = {
            id: attemptId,
            sessionItemId: generateUUID(),
            submissionKey: `sub-${item.question.id}-${run.id}`,
            answerOptionId: item.selectedOptionId,
            answerText: item.answerText,
            clozeAnswers: item.clozeAnswers,
            isCorrect: item.isCorrect,
            gradingStatus: item.gradingStatus,
            gradingScore: item.gradingScore,
            gradingChecklistResult: item.gradingChecklistResult,
            gradingFailedReason: item.gradingFailedReason,
            submittedAt: getCurrentISOTime(),
            ...(isChallenge ? { challenge: {
              version: 1 as const, runId: run.id, topicId: first.topicId!, level: first.difficultyLevel!,
              questionId: item.question.questionId || item.question.id, startedAt: run.startedAt,
            } } : {}),
          };
          await saveAttempt(attempt);

          const currentRS = reviewStates.find((rs) => rs.questionRevisionId === item.question.id);
          const record: ResultRecord = {
            attemptId,
            submissionKey: attempt.submissionKey,
            questionRevisionId: item.question.id,
            reviewBefore: currentRS ?? null,
            reviewSaved: null,
          };
          records.push(record);
          // 주관식 AI 채점 실패는 오답이 아니므로 복습 단계를 바꾸지 않는다(AGENTS.md §2-A-4).
          if (isGradingIncomplete(item)) continue;
          const nextRS = calculateNextReviewState({
            ownerId: 'owner-default',
            questionRevisionId: item.question.id,
            currentReviewState: currentRS,
            isCorrect: item.isCorrect,
            attemptId,
          });
          await saveReviewState(nextRS);
          record.reviewSaved = nextRS;
        }
        run.records = records;

        // 모든 문항이 채점 미완료면 단원 완료로 처리하지 않는다. 정상 채점 문항이 있으면 기존대로.
        const sessionUnitId = results[0]?.question.unitId;
        const targetUnit = units.find((u) => u.id === sessionUnitId);
        const hasGradedResult = results.some((item) => !isGradingIncomplete(item));
        if (targetUnit && hasGradedResult) await markUnitAsCompleted(targetUnit.id);

        await onRefreshData();
        if (isChallenge) {
          const cleared = getTopicChallengeLevels(await getAttempts()).get(first.topicId!) ?? CHALLENGE_START_LEVEL - 1;
          if (cleared > before) {
            showAlert('도전 통과', `레벨 ${cleared}을 통과했습니다. 이제 이 과목에서 레벨 ${cleared + 1}에 도전할 수 있어요.`);
          }
        }
        run.completed = true;
        // 랭킹 서버 상태가 시험 완료 화면을 지연시키지 않도록 백그라운드에서 연동한다.
        void syncRankingProgress().catch(() => undefined);
      } finally {
        run.saving = false;
      }
    },
    [reviewStates, units, onRefreshData, examQuestions]
  );

  /**
   * 결과 화면의 사용자 정정. 원래 채점(Attempt)은 그대로 두고 정정 기록만 추가하며,
   * 복습 일정은 이 문항을 맞힌 것으로 다시 계산한다. 순차 도전·랭킹에는 반영되지 않는다.
   */
  const correctExamResult = useCallback(
    async (index: number, reason: AttemptCorrectionReason) => {
      const run = runRef.current;
      const record = run?.records?.[index];
      if (!run || !run.completed || !record || run.correcting) return;
      run.correcting = true;
      try {
        const correction: AttemptCorrection = {
          id: generateUUID(),
          attemptId: record.attemptId,
          submissionKey: record.submissionKey,
          questionRevisionId: record.questionRevisionId,
          reason,
          correctedAt: getCurrentISOTime(),
        };
        const corrected = calculateNextReviewState({
          ownerId: 'owner-default',
          questionRevisionId: record.questionRevisionId,
          currentReviewState: record.reviewBefore,
          isCorrect: true,
          attemptId: record.attemptId,
        });
        const { reviewUpdated } = await saveAttemptCorrection(correction, {
          questionRevisionId: record.questionRevisionId,
          expected: record.reviewSaved ?? record.reviewBefore,
          next: corrected,
        });
        record.reviewCorrected = reviewUpdated ? corrected : undefined;
        setExamCorrections((prev) => ({ ...prev, [index]: reason }));
        await onRefreshData();
      } catch (err: unknown) {
        showAlert('정정 실패', err instanceof Error ? err.message : '정정 기록을 저장하지 못했습니다.');
      } finally {
        run.correcting = false;
      }
    },
    [onRefreshData]
  );

  /** 정정 취소: 정정 기록을 지우고, 정정으로 바꾼 복습 상태를 시험 채점 결과로 되돌린다. */
  const undoExamResultCorrection = useCallback(
    async (index: number) => {
      const run = runRef.current;
      const record = run?.records?.[index];
      if (!run || !record || run.correcting) return;
      run.correcting = true;
      try {
        await removeAttemptCorrection(
          record.submissionKey,
          record.reviewCorrected
            ? {
                questionRevisionId: record.questionRevisionId,
                expected: record.reviewCorrected,
                next: record.reviewSaved ?? record.reviewBefore,
              }
            : undefined
        );
        record.reviewCorrected = undefined;
        setExamCorrections((prev) => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
        await onRefreshData();
      } catch (err: unknown) {
        showAlert('정정 취소 실패', err instanceof Error ? err.message : '정정 기록을 되돌리지 못했습니다.');
      } finally {
        run.correcting = false;
      }
    },
    [onRefreshData]
  );

  const exitExamSession = useCallback(() => {
    setExamSessionActive(false);
  }, []);

  return {
    examSessionActive,
    examSessionRunId,
    examQuestions,
    examCorrections,
    startExam,
    handleCompleteExam,
    correctExamResult,
    undoExamResultCorrection,
    exitExamSession,
  };
}

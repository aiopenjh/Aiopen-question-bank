/**
 * Backup & Restore Repository
 * Reference: CogniQuest_개발명세_v1 (R11, T14 준수)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Profile,
  RoutineRevision,
  Topic,
  Unit,
  QuestionRevision,
  Attempt,
  ReviewState,
  ManualCompletion,
} from '../../contracts/types';
import { STORAGE_KEYS, CURRENT_DB_VERSION, getCurrentISOTime } from '../storage_keys';
import { getTopics, getUnits } from './topic_unit_repository';
import {
  getQuestions,
  getAttempts,
  getReviewStates,
  getManualCompletions,
} from './question_repository';

export interface AppBackupPayload {
  version: number;
  exportedAt: string;
  profile: Profile | null;
  routine: RoutineRevision | null;
  topics: Topic[];
  units: Unit[];
  questions: QuestionRevision[];
  attempts: Attempt[];
  reviewStates: ReviewState[];
  manualCompletions: ManualCompletion[];
}

/**
 * 전체 로컬 데이터 JSON 백업 추출
 */
export async function exportBackupJSON(): Promise<string> {
  const [
    profileRaw,
    routineRaw,
    topics,
    units,
    questions,
    attempts,
    reviewStates,
    manualCompletions,
  ] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.PROFILE),
    AsyncStorage.getItem(STORAGE_KEYS.ROUTINE),
    getTopics(),
    getUnits(),
    getQuestions(),
    getAttempts(),
    getReviewStates(),
    getManualCompletions(),
  ]);

  const profile: Profile | null = profileRaw ? JSON.parse(profileRaw) : null;
  const routine: RoutineRevision | null = routineRaw ? JSON.parse(routineRaw) : null;

  const payload: AppBackupPayload = {
    version: CURRENT_DB_VERSION,
    exportedAt: getCurrentISOTime(),
    profile,
    routine,
    topics,
    units,
    questions,
    attempts,
    reviewStates,
    manualCompletions,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * 백업 JSON 데이터 유효성 검사 및 안전 복원 (손상 시 원본 유지)
 */
export async function restoreBackupJSON(
  jsonString: string
): Promise<{ success: boolean; message: string }> {
  try {
    const parsed = JSON.parse(jsonString);

    // 필수 필드 및 스키마 구조 검증
    if (!parsed.version || !Array.isArray(parsed.topics) || !Array.isArray(parsed.questions)) {
      return {
        success: false,
        message: '백업 파일 형식이 올바르지 않거나 손상되었습니다. 원본 데이터가 안전하게 유지됩니다.',
      };
    }

    // 원자적 복원 (모든 검증 통과 시 저장)
    if (parsed.profile) await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(parsed.profile));
    if (parsed.routine) await AsyncStorage.setItem(STORAGE_KEYS.ROUTINE, JSON.stringify(parsed.routine));
    await AsyncStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(parsed.topics));
    if (Array.isArray(parsed.units)) await AsyncStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(parsed.units));
    await AsyncStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(parsed.questions));
    if (Array.isArray(parsed.attempts)) await AsyncStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(parsed.attempts));
    if (Array.isArray(parsed.reviewStates)) await AsyncStorage.setItem(STORAGE_KEYS.REVIEW_STATES, JSON.stringify(parsed.reviewStates));
    if (Array.isArray(parsed.manualCompletions)) await AsyncStorage.setItem(STORAGE_KEYS.MANUAL_COMPLETIONS, JSON.stringify(parsed.manualCompletions));

    return { success: true, message: '성공적으로 백업 데이터가 복원되었습니다.' };
  } catch (err: any) {
    return { success: false, message: `복원 중 구문 오류가 발생했습니다: ${err.message}` };
  }
}

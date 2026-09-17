/**
 * Local Persistent Storage Layer
 * Supports schema versioning, transaction isolation, and offline persistence.
 * Reference: CogniQuest_개발명세_v1/03_데이터와처리계약.md
 */

import AsyncStorage, { initializeAppStorage } from './app_storage';
import {
  Profile,
  RoutineRevision,
  Topic,
  Unit,
  QuestionRevision,
} from '../contracts/types';
import { getLocalDateString } from '../domain/routine';
import { saveLastStudiedTopicId } from './repositories/topic_unit_repository';
import {
  getEncryptedApiKey,
  saveEncryptedApiKey,
  deleteEncryptedApiKey,
} from '../integrations/secure_storage';

// 1. 스토리지 키 및 공통 식별자 유틸리티 re-export
export {
  STORAGE_KEYS,
  CURRENT_DB_VERSION,
  generateUUID,
  getCurrentISOTime,
} from './storage_keys';

import {
  STORAGE_KEYS,
  CURRENT_DB_VERSION,
  generateUUID,
  getCurrentISOTime,
} from './storage_keys';

// 2. 도메인별 리포지토리 함수 및 인터페이스 100% 하위 호환 re-export
export {
  getTopics,
  createTopic,
  createTopicWithUnits,
  addTopic,
  updateUnitDifficulty,
  deleteTopic,
  getUnits,
  createUnit,
  deleteUnit,
  replaceTopicUnits,
  deduplicateTopicUnits,
  getLastStudiedTopicId,
  saveLastStudiedTopicId,
} from './repositories/topic_unit_repository';

export {
  getManualCompletions,
  toggleUnitCompletion,
  markUnitAsCompleted,
  getQuestions,
  addQuestions,
  saveQuestionsForUnit,
  deleteQuestion,
  deleteQuestionsForUnit,
  getCustomNoteQuestionIds,
  toggleCustomNoteQuestion,
  getAttempts,
  saveAttempt,
  getReviewStates,
  saveReviewState,
  getIncorrectQuestions,
} from './repositories/question_repository';

export {
  getSources,
  addSource,
  deleteSource,
  getSourceChunks,
  getSourceTextForSource,
  getSourceTextForTopic,
  getTopicSourceLinks,
  linkSourceToTopic,
  getLinkedSourceForTopic,
} from './repositories/source_repository';

export {
  AppBackupPayload,
  exportBackupJSON,
  restoreBackupJSON,
} from './repositories/backup_repository';

export { getEncryptedApiKey, saveEncryptedApiKey, deleteEncryptedApiKey };

/**
 * 초기 시드 데이터 및 마이그레이션 실행
 */
export async function initializeDatabase(): Promise<void> {
  await initializeAppStorage();
  const versionStr = await AsyncStorage.getItem(STORAGE_KEYS.DB_VERSION);
  const version = versionStr ? parseInt(versionStr, 10) : 0;

  if (version < CURRENT_DB_VERSION) {
    await runMigrationClean();
    await AsyncStorage.setItem(STORAGE_KEYS.DB_VERSION, CURRENT_DB_VERSION.toString());
  }
}

async function runMigrationClean(): Promise<void> {
  // 1. 단일 프로필 생성 (이미 있으면 유지)
  let existingProfile = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE);
  let profileId = generateUUID();
  if (!existingProfile) {
    const initialProfile: Profile = {
      id: profileId,
      displayName: '나의 학습 공간',
      timezone: 'Asia/Seoul',
      createdAt: getCurrentISOTime(),
    };
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(initialProfile));
  } else {
    profileId = JSON.parse(existingProfile).id;
  }

  // 2. 기본 라이프스타일 루틴 설정 (이미 있으면 유지)
  let existingRoutine = await AsyncStorage.getItem(STORAGE_KEYS.ROUTINE);
  if (!existingRoutine) {
    const initialRoutine: RoutineRevision = {
      id: generateUUID(),
      ownerId: profileId,
      preset: 'daily',
      activeDays: [1, 2, 3, 4, 5, 6, 0], // 월~일 전 요일
      preferredTime: '09:00',
      timezone: 'Asia/Seoul',
      targetQuestionCount: 3, // 기본 일일 3문제
      effectiveDate: getLocalDateString(),
    };
    await AsyncStorage.setItem(STORAGE_KEYS.ROUTINE, JSON.stringify(initialRoutine));
  }

  // 3. 기본 탑재 과목: Python 비동기 프로그래밍 (신규 배포 기본 과목)
  const existingTopicsRaw = await AsyncStorage.getItem(STORAGE_KEYS.TOPICS);
  const existingTopics: Topic[] = existingTopicsRaw ? JSON.parse(existingTopicsRaw) : [];

  const hasAsyncTopic = existingTopics.some((t) => t.id === 'topic-python-async' || t.name.includes('Python 비동기'));

  if (!hasAsyncTopic) {
    const defaultTopicId = 'topic-python-async';
    const defaultTopic: Topic = {
      id: defaultTopicId,
      ownerId: profileId,
      name: 'Python 비동기 프로그래밍',
      category: '💻 IT/개발',
      description: 'asyncio, 코루틴, 이벤트 루프, Task 동시성 제어 등 파이썬 비동기 핵심',
      archivedAt: null,
      createdAt: getCurrentISOTime(),
    };

    const defaultUnits: Unit[] = [
      {
        id: 'unit-py-async-1',
        topicId: defaultTopicId,
        parentId: null,
        title: '1단계: 동기(Sync) vs 비동기(Async) 및 Event Loop 구조',
        depth: 1,
        orderIndex: 0,
        createdAt: getCurrentISOTime(),
      },
      {
        id: 'unit-py-async-2',
        topicId: defaultTopicId,
        parentId: null,
        title: '2단계: async def 코루틴 선언과 await 제어권 양보 원리',
        depth: 1,
        orderIndex: 1,
        createdAt: getCurrentISOTime(),
      },
      {
        id: 'unit-py-async-3',
        topicId: defaultTopicId,
        parentId: null,
        title: '3단계: asyncio.create_task()를 활용한 Task 스케줄링',
        depth: 1,
        orderIndex: 2,
        createdAt: getCurrentISOTime(),
      },
      {
        id: 'unit-py-async-4',
        topicId: defaultTopicId,
        parentId: null,
        title: '4단계: asyncio.gather()와 asyncio.wait() 다중 병렬 처리',
        depth: 1,
        orderIndex: 3,
        createdAt: getCurrentISOTime(),
      },
      {
        id: 'unit-py-async-5',
        topicId: defaultTopicId,
        parentId: null,
        title: '5단계: 비동기 I/O(aiohttp)와 Semaphore 동시성 제어',
        depth: 1,
        orderIndex: 4,
        createdAt: getCurrentISOTime(),
      },
    ];

    const defaultQuestions: QuestionRevision[] = [
      {
        id: 'q-py-async-1',
        questionId: 'q-py-async-1',
        revision: 1,
        specId: 'spec-default',
        topicId: defaultTopicId,
        unitId: 'unit-py-async-1',
        stem: 'Python의 비동기 프로그래밍 모듈인 asyncio에서 이벤트 루프(Event Loop)의 핵심 동작 원리로 가장 알맞은 것은?',
        options: [
          { id: 'opt-1-1', text: '각 코루틴마다 별도의 OS 스레드를 생성하여 멀티스레딩으로 실행한다.', isDistractor: true },
          { id: 'opt-1-2', text: '단일 스레드에서 대기 중인 코루틴을 순환하며, I/O 대기 시 제어권을 다른 태스크로 전환한다.', isDistractor: false },
          { id: 'opt-1-3', text: 'GIL(Global Interpreter Lock)을 완전히 우회하여 CPython 멀티코어 병렬 연산을 수행한다.', isDistractor: true },
          { id: 'opt-1-4', text: '코루틴 내의 모든 동기 블로킹 함수 호출을 자동으로 논블로킹으로 변환한다.', isDistractor: true },
        ],
        answerOptionId: 'opt-1-2',
        explanation: 'asyncio의 이벤트 루프는 단일 스레드 기반의 협동적 멀티태스킹(Cooperative Multitasking) 구조로 동작합니다. 코루틴이 await를 만나 I/O 대기 상태가 되면 제어권을 이벤트 루프로 양보하여 다른 작업을 처리함으로써 고효율 동시성을 구현합니다.',
        deepReasoningHint: '많은 초보자가 비동기를 멀티스레드로 오해하지만, asyncio는 단일 스레드에서 이벤트 루프가 작업 제어권을 번갈아가며 스케줄링하는 방식입니다.',
        status: 'ready_personal',
        createdAt: getCurrentISOTime(),
      },
      {
        id: 'q-py-async-2',
        questionId: 'q-py-async-2',
        revision: 1,
        specId: 'spec-default',
        topicId: defaultTopicId,
        unitId: 'unit-py-async-2',
        stem: "다음 중 Python에서 'async def'로 정의된 코루틴 함수를 올바르게 실행하는 방법이 아닌 것은?",
        options: [
          { id: 'opt-2-1', text: '다른 코루틴 함수 내부에서 await 키워드를 붙여 호출한다.', isDistractor: true },
          { id: 'opt-2-2', text: '최상위 진입점에서 asyncio.run() 함수에 전달하여 실행한다.', isDistractor: true },
          { id: 'opt-2-3', text: 'asyncio.create_task()에 전달하여 태스크로 등록 및 스케줄링한다.', isDistractor: true },
          { id: 'opt-2-4', text: '일반 동기 함수 안에서 my_coroutine()으로 직접 호출하여 반환값을 즉시 얻는다.', isDistractor: false },
        ],
        answerOptionId: 'opt-2-4',
        explanation: 'async def 함수를 일반 함수처럼 직접 호출하면 내부 코드가 실행되지 않고 단지 실행 가능한 <coroutine object>만 반환됩니다. 이를 실제로 구동하려면 await, asyncio.run(), 또는 asyncio.create_task()를 거쳐야 합니다.',
        deepReasoningHint: '코루틴 함수를 호출만 하고 await를 빼먹으면 RuntimeWarning: coroutine was never awaited 경고가 발생하며 코드가 실행되지 않습니다.',
        status: 'ready_personal',
        createdAt: getCurrentISOTime(),
      },
      {
        id: 'q-py-async-3',
        questionId: 'q-py-async-3',
        revision: 1,
        specId: 'spec-default',
        topicId: defaultTopicId,
        unitId: 'unit-py-async-4',
        stem: '여러 개의 비동기 코루틴 작업을 동시에 실행하고, 그 모든 결과를 하나의 순서화된 리스트로 수집할 때 사용하는 표준 함수는?',
        options: [
          { id: 'opt-3-1', text: 'asyncio.gather()', isDistractor: false },
          { id: 'opt-3-2', text: 'asyncio.sleep()', isDistractor: true },
          { id: 'opt-3-3', text: 'asyncio.to_thread()', isDistractor: true },
          { id: 'opt-3-4', text: 'asyncio.get_event_loop()', isDistractor: true },
        ],
        answerOptionId: 'opt-3-1',
        explanation: 'asyncio.gather(*coros_or_futures)는 여러 비동기 코루틴을 이벤트 루프에 동시에 띄우고, 모든 작업이 완료될 때까지 기다려 각 작업의 반환값을 호출 순서대로 리스트에 담아 반환합니다.',
        deepReasoningHint: '동시 다발적인 네트워크 요청이나 비동기 작업들의 결과를 한꺼번에 모아 처리할 때 가장 널리 쓰이는 표준 패턴입니다.',
        status: 'ready_personal',
        createdAt: getCurrentISOTime(),
      },
    ];

    const existingUnitsRaw = await AsyncStorage.getItem(STORAGE_KEYS.UNITS);
    const existingUnits: Unit[] = existingUnitsRaw ? JSON.parse(existingUnitsRaw) : [];

    const existingQuestionsRaw = await AsyncStorage.getItem(STORAGE_KEYS.QUESTIONS);
    const existingQuestions: QuestionRevision[] = existingQuestionsRaw ? JSON.parse(existingQuestionsRaw) : [];

    await AsyncStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify([...existingTopics, defaultTopic]));
    await AsyncStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify([...existingUnits, ...defaultUnits]));
    await AsyncStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify([...existingQuestions, ...defaultQuestions]));
    await saveLastStudiedTopicId(defaultTopicId);
  }

  // 기타 보조 컬렉션 초기화
  if (!(await AsyncStorage.getItem(STORAGE_KEYS.SOURCES))) await AsyncStorage.setItem(STORAGE_KEYS.SOURCES, JSON.stringify([]));
  if (!(await AsyncStorage.getItem(STORAGE_KEYS.SOURCE_REVISIONS))) await AsyncStorage.setItem(STORAGE_KEYS.SOURCE_REVISIONS, JSON.stringify([]));
  if (!(await AsyncStorage.getItem(STORAGE_KEYS.SOURCE_CHUNKS))) await AsyncStorage.setItem(STORAGE_KEYS.SOURCE_CHUNKS, JSON.stringify([]));
  if (!(await AsyncStorage.getItem(STORAGE_KEYS.SESSIONS))) await AsyncStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify([]));
  if (!(await AsyncStorage.getItem(STORAGE_KEYS.SESSION_ITEMS))) await AsyncStorage.setItem(STORAGE_KEYS.SESSION_ITEMS, JSON.stringify([]));
  if (!(await AsyncStorage.getItem(STORAGE_KEYS.ATTEMPTS))) await AsyncStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify([]));
  if (!(await AsyncStorage.getItem(STORAGE_KEYS.REVIEW_STATES))) await AsyncStorage.setItem(STORAGE_KEYS.REVIEW_STATES, JSON.stringify([]));
  if (!(await AsyncStorage.getItem(STORAGE_KEYS.MANUAL_COMPLETIONS))) await AsyncStorage.setItem(STORAGE_KEYS.MANUAL_COMPLETIONS, JSON.stringify([]));
}

// -------------------------------------------------------------
// Database Accessors & Core Methods
// -------------------------------------------------------------

export async function getProfile(): Promise<Profile | null> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE);
  return data ? JSON.parse(data) : null;
}

export async function getRoutine(): Promise<RoutineRevision | null> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.ROUTINE);
  return data ? JSON.parse(data) : null;
}

export async function saveRoutine(routine: RoutineRevision): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.ROUTINE, JSON.stringify(routine));
}

export async function clearAllData(): Promise<void> {
  await deleteEncryptedApiKey();
  await AsyncStorage.clear();
  await initializeDatabase();
}

export async function getGeminiApiKey(): Promise<string | null> {
  return await getEncryptedApiKey();
}

export async function saveGeminiApiKey(key: string): Promise<void> {
  await saveEncryptedApiKey(key);
}

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

export function isSupportedGeminiModel(model: string): boolean {
  const match = model.trim().toLowerCase().match(/^gemini-(\d+)(?:\.(\d+))?(?:-|$)/);
  if (!match) return false;

  const major = Number(match[1]);
  const minor = Number(match[2] ?? 0);
  return major > 3 || (major === 3 && minor >= 5);
}

export async function getPreferredAiModel(): Promise<string> {
  const model = await AsyncStorage.getItem(STORAGE_KEYS.PREFERRED_MODEL);
  return model && isSupportedGeminiModel(model) ? model.trim() : DEFAULT_GEMINI_MODEL;
}

export async function savePreferredAiModel(model: string): Promise<void> {
  const normalizedModel = model.trim();
  await AsyncStorage.setItem(
    STORAGE_KEYS.PREFERRED_MODEL,
    isSupportedGeminiModel(normalizedModel) ? normalizedModel : DEFAULT_GEMINI_MODEL
  );
}

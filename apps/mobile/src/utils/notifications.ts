import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../data/storage_keys';

const ALARM_SETTINGS_KEY = '@celueste:alarm_enabled';
const LAST_ALARM_PROMPT_KEY = '@celueste:last_in_app_alarm_prompt';

// Android Expo Go에서도 로컬 예약 알림은 지원된다.
// SDK 53 이후 제한되는 기능은 원격 푸시 알림이며 이 앱은 로컬 알림만 사용한다.
let Notifications: any = null;

if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (err) {
    console.warn('expo-notifications 모듈 로드 건너뜀:', err);
    Notifications = null;
  }
}

/**
 * 안드로이드 알림 채널 설정 (Android 8.0 이상 필수)
 */
export async function setupNotificationChannel(): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: '정기 학습 알람',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF69B4',
    });
  } catch (e) {
    console.warn('알림 채널 생성 실패:', e);
  }
}

/**
 * 웹 브라우저 (HTML5 Notification API) 권한 요청 및 확인
 */
export async function requestWebNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  try {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const result = await Notification.requestPermission();
      return result === 'granted';
    }
  } catch (err) {
    console.warn('웹 알림 권한 요청 중 오류:', err);
  }
  return false;
}

/**
 * 웹 브라우저 시스템 알림 발송
 */
export function sendWebNotification(title: string, body: string, onClick?: () => void): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }
  if (Notification.permission === 'granted') {
    try {
      const webBasePath = window.location.pathname.includes('/Aiopen-question-bank')
        ? '/Aiopen-question-bank'
        : '';
      const n = new Notification(title, {
        body,
        icon: `${webBasePath}/app-icon-192.png`,
      });
      if (onClick) {
        n.onclick = () => {
          window.focus();
          onClick();
          n.close();
        };
      }
    } catch (err) {
      console.warn('웹 알림 발송 실패:', err);
    }
  }
}

/**
 * 통합 알림 권한 확인 및 요청 (모바일 네이티브 + 웹 브라우저 통합)
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return await requestWebNotificationPermission();
  }
  if (!Notifications) return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (err) {
    console.warn('알림 권한 요청 실패:', err);
    return false;
  }
}

export type DayOfWeek = '월' | '화' | '수' | '목' | '금' | '토' | '일';
export const ALL_DAYS: DayOfWeek[] = ['월', '화', '수', '목', '금', '토', '일'];

export const DAY_MAP: Record<DayOfWeek, { jsDay: number; expoWeekday: number }> = {
  '월': { jsDay: 1, expoWeekday: 2 },
  '화': { jsDay: 2, expoWeekday: 3 },
  '수': { jsDay: 3, expoWeekday: 4 },
  '목': { jsDay: 4, expoWeekday: 5 },
  '금': { jsDay: 5, expoWeekday: 6 },
  '토': { jsDay: 6, expoWeekday: 7 },
  '일': { jsDay: 0, expoWeekday: 1 },
};

export interface AlarmConfig {
  morningEnabled: boolean;
  morningHour: number; // 8 ~ 11
  eveningEnabled: boolean;
  eveningHour: number; // 19 ~ 21
  selectedDays?: DayOfWeek[]; // 직접 선택된 요일 목록 (기본: 월~일)
  weekendEnabled?: boolean; // 하위 호환용
}

export const DEFAULT_ALARM_CONFIG: AlarmConfig = {
  morningEnabled: true,
  morningHour: 8,
  eveningEnabled: true,
  eveningHour: 20,
  selectedDays: ['월', '화', '수', '목', '금', '토', '일'],
  weekendEnabled: true,
};

export async function getAlarmConfig(): Promise<AlarmConfig> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ALARM_CONFIG);
    if (!raw) return DEFAULT_ALARM_CONFIG;
    const parsed = JSON.parse(raw);

    let selectedDays: DayOfWeek[] = ['월', '화', '수', '목', '금', '토', '일'];
    if (Array.isArray(parsed.selectedDays) && parsed.selectedDays.length > 0) {
      selectedDays = parsed.selectedDays;
    } else if (parsed.weekendEnabled !== undefined) {
      selectedDays = parsed.weekendEnabled ? ['월', '화', '수', '목', '금', '토', '일'] : ['월', '화', '수', '목', '금'];
    }

    return {
      morningEnabled: parsed.morningEnabled ?? true,
      morningHour: typeof parsed.morningHour === 'number' ? parsed.morningHour : 8,
      eveningEnabled: parsed.eveningEnabled ?? true,
      eveningHour: typeof parsed.eveningHour === 'number' ? parsed.eveningHour : 20,
      selectedDays,
      weekendEnabled: parsed.weekendEnabled ?? true,
    };
  } catch {
    return DEFAULT_ALARM_CONFIG;
  }
}

export async function saveAlarmConfig(config: AlarmConfig): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.ALARM_CONFIG, JSON.stringify(config));
  await scheduleWeekdayStudyAlarms(config);
}

/**
 * 정기 맞춤 알람 스케줄 등록
 */
export async function scheduleWeekdayStudyAlarms(customConfig?: AlarmConfig): Promise<void> {
  // 웹 브라우저 환경에서는 Web Notification 권한 요청
  if (Platform.OS === 'web') {
    await requestWebNotificationPermission();
    return;
  }

  if (!Notifications) return;

  try {
    await setupNotificationChannel();

    const config = customConfig || (await getAlarmConfig());

    const activeDays: DayOfWeek[] =
      config.selectedDays && config.selectedDays.length > 0
        ? config.selectedDays
        : config.weekendEnabled
        ? ALL_DAYS
        : ['월', '화', '수', '목', '금'];

    const isAnyTimeActive = config.morningEnabled || config.eveningEnabled;

    if (!isAnyTimeActive || activeDays.length === 0) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('모든 정기 알람이 비활성화되었습니다.');
      return;
    }

    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('알림 권한이 허용되지 않아 로컬 푸시 알람을 등록하지 않습니다.');
      return;
    }

    // 기존 스케줄 초기화 후 신규 등록
    await Notifications.cancelAllScheduledNotificationsAsync();

    for (const dayName of activeDays) {
      const mapping = DAY_MAP[dayName];
      if (!mapping) continue;
      const weekday = mapping.expoWeekday;

      // 1. 오전 알람 (기본 08:00)
      if (config.morningEnabled) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🌸 [Celueste] ${dayName}요일 오전 ${config.morningHour}시 문제 풀이 시간!`,
            body: '오늘 학습할 과목과 단원을 선택해 보세요.',
            data: { action: 'START_STUDY', timeSlot: 'morning' },
            sound: true,
            channelId: 'default',
          } as any,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday,
            hour: config.morningHour,
            minute: 0,
            repeats: true,
            channelId: 'default',
          } as any,
        });
      }

      // 2. 저녁 알람 (기본 20:00 / 저녁 8시)
      if (config.eveningEnabled) {
        const displayHour = config.eveningHour > 12 ? config.eveningHour - 12 : config.eveningHour;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🌙 [Celueste] ${dayName}요일 저녁 ${displayHour}시 집중 복습 시간!`,
            body: '오늘 학습할 과목과 단원을 선택해 보세요.',
            data: { action: 'START_STUDY', timeSlot: 'evening' },
            sound: true,
            channelId: 'default',
          } as any,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday,
            hour: config.eveningHour,
            minute: 0,
            repeats: true,
            channelId: 'default',
          } as any,
        });
      }
    }

    await AsyncStorage.setItem(ALARM_SETTINGS_KEY, 'true');
    console.log(
      `정기 학습 알람 등록 완료 (선택 요일: ${activeDays.join(', ')} | 오전: ${
        config.morningEnabled ? config.morningHour + '시' : '끔'
      }, 저녁: ${config.eveningEnabled ? config.eveningHour + '시' : '끔'})`
    );
  } catch (err) {
    console.warn('알람 스케줄링 중 오류 발생 (앱은 정상 작동 유지):', err);
  }
}

/**
 * 알람 탭 반응 리스너 등록 (터치 시 과목/단원 선택 화면 열기)
 */
export function registerNotificationResponseListener(onOpenStudySelection: () => void): () => void {
  if (Platform.OS === 'web' || !Notifications) {
    return () => {};
  }

  const handledResponseIds = new Set<string>();
  const handleResponse = (response: any) => {
    const data = response.notification.request.content.data;
    const responseId = response.notification.request.identifier;
    if (
      !handledResponseIds.has(responseId) &&
      (data?.action === 'START_STUDY' || data?.action === 'START_EXAM')
    ) {
      handledResponseIds.add(responseId);
      onOpenStudySelection();
    }
  };

  const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
  void Notifications.getLastNotificationResponseAsync()
    .then(async (response: any) => {
      if (!response) return;
      handleResponse(response);
      await Notifications.clearLastNotificationResponseAsync();
    })
    .catch((error: unknown) => {
      console.warn('마지막 알림 응답 확인 실패:', error);
    });

  return () => {
    subscription.remove();
  };
}

/**
 * 실시간 정기 시간 도래 감지 및 인앱 + 웹 알림 발송 (포그라운드 및 인터벌 실행)
 */
export async function checkInAppScheduledAlarm(onStartExam: (slotLabel: string) => void): Promise<void> {
  const config = await getAlarmConfig();
  if (!config.morningEnabled && !config.eveningEnabled) return;

  const now = new Date();
  const currentJsDay = now.getDay(); // 0: 일, 1: 월, ..., 6: 토

  const activeDays: DayOfWeek[] =
    config.selectedDays && config.selectedDays.length > 0
      ? config.selectedDays
      : config.weekendEnabled
      ? ALL_DAYS
      : ['월', '화', '수', '목', '금'];

  const isTodayActive = activeDays.some((d) => DAY_MAP[d]?.jsDay === currentJsDay);
  if (!isTodayActive) return;

  const hours = now.getHours();

  // 현재 시간이 설정된 오전 또는 저녁 시간과 일치하는지 확인 (해당 시간대 내 1회 보장)
  const isMorningSlot = config.morningEnabled && hours === config.morningHour;
  const isEveningSlot = config.eveningEnabled && hours === config.eveningHour;

  if (!isMorningSlot && !isEveningSlot) return;

  const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const slotKey = isMorningSlot
    ? `${todayStr}-morning-${config.morningHour}`
    : `${todayStr}-evening-${config.eveningHour}`;

  const lastPrompt = await AsyncStorage.getItem(LAST_ALARM_PROMPT_KEY);
  if (lastPrompt === slotKey) {
    return; // 오늘 이 시간대에는 이미 알림이 전송됨
  }

  await AsyncStorage.setItem(LAST_ALARM_PROMPT_KEY, slotKey);

  const displayHour = isMorningSlot
    ? `오전 ${config.morningHour}시`
    : `저녁 ${config.eveningHour > 12 ? config.eveningHour - 12 : config.eveningHour}시`;

  // 1. 웹 시스템 알림 전송 (브라우저가 다른 탭에 있거나 백그라운드일 때 유효)
  sendWebNotification(
    `⏰ [Celueste] ${displayHour} 정기 학습 시간입니다!`,
    '오늘 학습할 과목과 단원을 선택해 보세요.',
    () => onStartExam(displayHour)
  );

  // 2. 인앱 안내 모달 팝업 콜백 실행
  onStartExam(displayHour);
}

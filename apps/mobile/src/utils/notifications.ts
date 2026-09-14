import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRunningInExpoGo } from 'expo';

const ALARM_SETTINGS_KEY = '@celueste:alarm_enabled';
const LAST_ALARM_PROMPT_KEY = '@celueste:last_in_app_alarm_prompt';

// Expo Go (Android)에서는 SDK 53부터 푸시 알림 네이티브 모듈이 제외되어
// 직접 import/호출 시 빨간색 크래시 화면([runtime not ready])을 발생시킵니다.
// 이를 방지하기 위해 Expo Go 안드로이드 환경에서는 안전하게 모듈 로드를 우회합니다.
let Notifications: any = null;
const isExpoGoAndroid = Platform.OS === 'android' && isRunningInExpoGo();

if (!isExpoGoAndroid && Platform.OS !== 'web') {
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
 * 알림 권한 확인 및 요청
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web' || !Notifications) return false;
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

export interface AlarmConfig {
  morningEnabled: boolean;
  morningHour: number; // 8 ~ 11
  eveningEnabled: boolean;
  eveningHour: number; // 19 ~ 21
}

export const DEFAULT_ALARM_CONFIG: AlarmConfig = {
  morningEnabled: true,
  morningHour: 8,
  eveningEnabled: true,
  eveningHour: 20,
};

const ALARM_CONFIG_KEY = '@celueste:alarm_config_v2';

export async function getAlarmConfig(): Promise<AlarmConfig> {
  try {
    const raw = await AsyncStorage.getItem(ALARM_CONFIG_KEY);
    if (!raw) return DEFAULT_ALARM_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      morningEnabled: parsed.morningEnabled ?? true,
      morningHour: typeof parsed.morningHour === 'number' ? parsed.morningHour : 8,
      eveningEnabled: parsed.eveningEnabled ?? true,
      eveningHour: typeof parsed.eveningHour === 'number' ? parsed.eveningHour : 20,
    };
  } catch {
    return DEFAULT_ALARM_CONFIG;
  }
}

export async function saveAlarmConfig(config: AlarmConfig): Promise<void> {
  await AsyncStorage.setItem(ALARM_CONFIG_KEY, JSON.stringify(config));
  await scheduleWeekdayStudyAlarms(config);
}

/**
 * 평일 맞춤 알람 스케줄 등록 (오전 8~11시, 저녁 19~21시 업앤다운 및 개별 On/Off 지원)
 * - 대상: 월(2), 화(3), 수(4), 목(5), 금(6)
 */
export async function scheduleWeekdayStudyAlarms(customConfig?: AlarmConfig): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;

  try {
    await setupNotificationChannel();

    const config = customConfig || (await getAlarmConfig());

    // 둘 다 꺼져 있으면 기존 스케줄만 정리하고 종료
    if (!config.morningEnabled && !config.eveningEnabled) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('모든 평일 정기 알람이 비활성화되었습니다.');
      return;
    }

    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('알림 권한이 허용되지 않아 로컬 푸시 알람을 등록하지 않습니다.');
      return;
    }

    // 기존 스케줄 초기화 후 신규 등록
    await Notifications.cancelAllScheduledNotificationsAsync();

    const weekdays = [2, 3, 4, 5, 6]; // 월 ~ 금

    for (const weekday of weekdays) {
      // 1. 오전 알람 (활성화된 경우)
      if (config.morningEnabled) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🌸 [Celueste] 오전 ${config.morningHour}시 문제 풀이 시간!`,
            body: '오늘의 실전 문제를 풀고 활기찬 하루를 시작해 보세요! (터치하여 바로 시작)',
            data: { action: 'START_EXAM', timeSlot: 'morning' },
            sound: true,
            channelId: 'default',
          } as any,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday,
            hour: config.morningHour,
            minute: 0,
            channelId: 'default',
          } as any,
        });
      }

      // 2. 저녁 알람 (활성화된 경우)
      if (config.eveningEnabled) {
        const displayHour = config.eveningHour > 12 ? config.eveningHour - 12 : config.eveningHour;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🌙 [Celueste] 저녁 ${displayHour}시 집중 문제 풀이 시간!`,
            body: '오늘 하루의 학습 목표를 채우고 복습해 보세요! (터치하여 바로 시작)',
            data: { action: 'START_EXAM', timeSlot: 'evening' },
            sound: true,
            channelId: 'default',
          } as any,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday,
            hour: config.eveningHour,
            minute: 0,
            channelId: 'default',
          } as any,
        });
      }
    }

    await AsyncStorage.setItem(ALARM_SETTINGS_KEY, 'true');
    console.log(`평일 정기 학습 알람 등록 완료 (오전: ${config.morningEnabled ? config.morningHour + '시' : '꺼짐'}, 저녁: ${config.eveningEnabled ? config.eveningHour + '시' : '꺼짐'})`);
  } catch (err) {
    console.warn('알람 스케줄링 중 오류 발생 (앱은 정상 작동 유지):', err);
  }
}

/**
 * 알람 탭 반응 리스너 등록 (터치 시 문제 풀이 즉시 실행)
 */
export function registerNotificationResponseListener(onStartExam: () => void): () => void {
  if (Platform.OS === 'web' || !Notifications) {
    return () => {};
  }

  const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
    const data = response.notification.request.content.data;
    if (data?.action === 'START_EXAM') {
      onStartExam();
    }
  });

  return () => {
    subscription.remove();
  };
}

/**
 * 앱이 켜져 있을 때(포그라운드) 정기 시간(평일 설정 시간) 도래 감지 및 인앱 안내
 */
export async function checkInAppScheduledAlarm(onStartExam: (slotLabel: string) => void): Promise<void> {
  const config = await getAlarmConfig();
  if (!config.morningEnabled && !config.eveningEnabled) return;

  const now = new Date();
  const day = now.getDay(); // 0: 일, 1: 월, ..., 5: 금, 6: 토

  // 평일(월~금)만 적용
  if (day === 0 || day === 6) return;

  const hours = now.getHours();
  const minutes = now.getMinutes();

  // 설정된 오전/저녁 시간대(30분 이내) 체크
  const isMorningSlot = config.morningEnabled && hours === config.morningHour && minutes <= 30;
  const isEveningSlot = config.eveningEnabled && hours === config.eveningHour && minutes <= 30;

  if (!isMorningSlot && !isEveningSlot) return;

  const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const slotKey = isMorningSlot
    ? `${todayStr}-morning-${config.morningHour}`
    : `${todayStr}-evening-${config.eveningHour}`;

  const lastPrompt = await AsyncStorage.getItem(LAST_ALARM_PROMPT_KEY);
  if (lastPrompt === slotKey) {
    // 이미 오늘 이 시간대에 팝업을 띄웠음
    return;
  }

  await AsyncStorage.setItem(LAST_ALARM_PROMPT_KEY, slotKey);
  const displayHour = isMorningSlot
    ? `오전 ${config.morningHour}시`
    : `저녁 ${config.eveningHour > 12 ? config.eveningHour - 12 : config.eveningHour}시`;
  onStartExam(displayHour);
}

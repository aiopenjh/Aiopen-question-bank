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

/**
 * 평일 오전 8시, 저녁 8시 자동 알람 스케줄 등록
 * - 대상: 월(2), 화(3), 수(4), 목(5), 금(6)
 * - 시간: 08:00, 20:00
 */
export async function scheduleWeekdayStudyAlarms(): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;

  try {
    await setupNotificationChannel();

    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('알림 권한이 허용되지 않아 로컬 푸시 알람을 등록하지 않습니다.');
      return;
    }

    // 기존 스케줄 초기화 후 신규 등록
    await Notifications.cancelAllScheduledNotificationsAsync();

    const weekdays = [2, 3, 4, 5, 6]; // 월 ~ 금

    for (const weekday of weekdays) {
      // 1. 오전 8:00 알람
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌸 [Celueste] 아침 8시 문제 풀이 시간!',
          body: '오늘의 실전 문제를 풀고 활기찬 하루를 시작해 보세요! (터치하여 바로 시작)',
          data: { action: 'START_EXAM', timeSlot: 'morning' },
          sound: true,
          channelId: 'default',
        } as any,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour: 8,
          minute: 0,
          channelId: 'default',
        } as any,
      });

      // 2. 저녁 20:00 (저녁 8시) 알람
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌙 [Celueste] 저녁 8시 집중 문제 풀이 시간!',
          body: '오늘 하루의 학습 목표를 채우고 복습해 보세요! (터치하여 바로 시작)',
          data: { action: 'START_EXAM', timeSlot: 'evening' },
          sound: true,
          channelId: 'default',
        } as any,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour: 20,
          minute: 0,
          channelId: 'default',
        } as any,
      });
    }

    await AsyncStorage.setItem(ALARM_SETTINGS_KEY, 'true');
    console.log('평일 오전 8시/저녁 8시 정기 학습 알람 등록 완료');
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
 * 앱이 켜져 있을 때(포그라운드) 정기 시간(평일 8시, 20시) 도래 감지 및 인앱 안내
 */
export async function checkInAppScheduledAlarm(onStartExam: (slotLabel: string) => void): Promise<void> {
  const now = new Date();
  const day = now.getDay(); // 0: 일, 1: 월, ..., 5: 금, 6: 토

  // 평일(월~금)만 적용
  if (day === 0 || day === 6) return;

  const hours = now.getHours();
  const minutes = now.getMinutes();

  // 8:00 ~ 8:30 (아침), 20:00 ~ 20:30 (저녁) 구간 체크
  const isMorningSlot = hours === 8 && minutes <= 30;
  const isEveningSlot = hours === 20 && minutes <= 30;

  if (!isMorningSlot && !isEveningSlot) return;

  const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const slotKey = isMorningSlot ? `${todayStr}-morning` : `${todayStr}-evening`;

  const lastPrompt = await AsyncStorage.getItem(LAST_ALARM_PROMPT_KEY);
  if (lastPrompt === slotKey) {
    // 이미 오늘 이 시간대에 팝업을 띄웠음
    return;
  }

  await AsyncStorage.setItem(LAST_ALARM_PROMPT_KEY, slotKey);
  const slotLabel = isMorningSlot ? '오전 8시' : '저녁 8시';
  onStartExam(slotLabel);
}

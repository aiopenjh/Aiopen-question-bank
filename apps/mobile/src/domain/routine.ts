/**
 * Routine & Motivation Domain Logic
 * Reference: CogniQuest_개발명세_v1 & AGENTS.md
 */

import { RoutinePreset, RoutineRevision, ISODateString } from '../contracts/types';

export const ROUTINE_PRESETS: Record<RoutinePreset, { label: string; days: number[] }> = {
  mon_wed_fri: { label: '월 · 수 · 금 (격일)', days: [1, 3, 5] },
  weekdays: { label: '월 ~ 금 (평일 집중)', days: [1, 2, 3, 4, 5] },
  weekends: { label: '토 · 일 (주말 몰입)', days: [0, 6] },
  daily: { label: '월 ~ 일 (매일 꾸준)', days: [0, 1, 2, 3, 4, 5, 6] },
  custom: { label: '자유 요일 선택', days: [1, 3, 5] },
};

/**
 * 특정 날짜가 해당 루틴의 학습일인지 판단
 * Day of week: 0(일), 1(월), 2(화), 3(수), 4(목), 5(금), 6(토)
 */
export function isStudyDay(routine: RoutineRevision, date: Date = new Date()): boolean {
  const day = date.getDay();
  return routine.activeDays.includes(day);
}

/**
 * YYYY-MM-DD 날짜 문자열 변환 (로컬 기준)
 */
export function getLocalDateString(date: Date = new Date()): ISODateString {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface MentorMessage {
  type: 'praise' | 'encourage' | 'rest' | 'alert' | 'streak_praise';
  title: string;
  message: string;
  badge?: string;
}

/**
 * 사용자의 학습 상황에 따른 동기부여 AI 멘토 메시지 생성
 */
export function generateMentorMessage(params: {
  isStudyDayToday: boolean;
  todayCompletedCount: number;
  targetCount: number;
  streakDays: number;
  daysSinceLastActive: number;
  userName?: string;
}): MentorMessage {
  const { isStudyDayToday, todayCompletedCount, targetCount, streakDays, daysSinceLastActive, userName } = params;
  const greetingName = userName ? `${userName}님` : '학습자님';

  // 1. 3일 이상 미접속 시 유쾌한 비상 경고
  if (daysSinceLastActive >= 3) {
    return {
      type: 'alert',
      badge: '🚨 비상 경고',
      title: '복습할 문제가 기다리고 있습니다!',
      message: `${greetingName}, 벌써 ${daysSinceLastActive}일째 접속을 안 하고 계십니다! 뇌세포가 잊어버리기 전에 가벼운 3문제로 다시 깨워주세요!`,
    };
  }

  // 2. 오늘 목표 달성 완료
  if (todayCompletedCount >= targetCount && targetCount > 0) {
    if (streakDays >= 5) {
      return {
        type: 'streak_praise',
        badge: '🔥 5일 연속 달성',
        title: '완벽한 5일 연속 완주!',
        message: '대단하십니다! 5일 연속으로 달성하셨네요. 내일은 무리하지 마시고 커피 한잔하시며 가벼운 3문제로 기분 좋게 뇌를 깨워보세요.',
      };
    }
    return {
      type: 'praise',
      badge: '🎉 목표 달성',
      title: '오늘의 학습 목표 완료!',
      message: `오늘의 학습 목표를 훌륭히 달성하셨습니다! ${greetingName}의 보람찬 지적 여정을 진심으로 응원합니다.`,
    };
  }

  // 3. 오늘이 쉬는 날인 경우
  if (!isStudyDayToday) {
    return {
      type: 'rest',
      badge: '☕ 편안한 휴식일',
      title: '재충전의 날',
      message: '오늘은 약속하신 휴식일입니다. 푹 쉬시며 활력을 충전하세요. 원하시면 언제든 가벼운 퀴즈를 풀어보실 수 있습니다.',
    };
  }

  // 4. 오늘이 학습일이고 아직 미완료
  return {
    type: 'encourage',
    badge: '🔔 오늘의 퀘스트',
    title: '오늘은 문제 푸는 날입니다!',
    message: `${greetingName}, 오늘은 약속하신 학습의 날입니다! 오늘 목표(${targetCount}문제)를 향해 힘차게 시작해 볼까요?`,
  };
}

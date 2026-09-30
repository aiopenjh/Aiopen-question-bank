/**
 * 오늘(태평양 시간 기준) 모델별 AI 요청 횟수 저장소. 안내용 추정치이며 백업에 넣지 않는다.
 * 여러 채점 요청이 동시에 끝나도 횟수가 덮어써지지 않도록 기록을 한 줄로 이어서 처리한다.
 */
import AsyncStorage from '../app_storage';
import { STORAGE_KEYS } from '../storage_keys';
import {
  AiRequestEvent,
  AiRequestUsage,
  GEMINI_DAILY_REQUEST_LIMITS,
  getAiQuotaDay,
} from '../../domain/ai_usage';

let writeQueue: Promise<void> = Promise.resolve();

function readUsage(raw: string | null, day: string): AiRequestUsage {
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && parsed.day === day && parsed.counts && typeof parsed.counts === 'object') {
      const counts: Record<string, number> = {};
      for (const [model, value] of Object.entries(parsed.counts as Record<string, unknown>)) {
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) counts[model] = Math.floor(value);
      }
      return { day, counts };
    }
  } catch {
    // 손상된 기록은 새 날짜 기록으로 다시 시작한다.
  }
  return { day, counts: {} };
}

export async function getAiRequestUsage(now: Date = new Date()): Promise<AiRequestUsage> {
  await writeQueue;
  return readUsage(await AsyncStorage.getItem(STORAGE_KEYS.AI_REQUEST_USAGE), getAiQuotaDay(now));
}

export function recordAiRequest(event: AiRequestEvent, now: Date = new Date()): Promise<void> {
  const run = writeQueue.then(async () => {
    const usage = readUsage(await AsyncStorage.getItem(STORAGE_KEYS.AI_REQUEST_USAGE), getAiQuotaDay(now));
    const current = usage.counts[event.model] ?? 0;
    // 서버가 오늘 한도 소진을 알리면 이 기기에서 센 횟수가 적어도 한도에 닿은 것으로 맞춘다.
    usage.counts[event.model] = event.outcome === 'daily_exhausted'
      ? Math.max(current, GEMINI_DAILY_REQUEST_LIMITS[event.model] ?? current)
      : current + 1;
    await AsyncStorage.setItem(STORAGE_KEYS.AI_REQUEST_USAGE, JSON.stringify(usage));
  });
  writeQueue = run.catch(() => {});
  return run;
}

/**
 * 오늘(태평양 시간 기준) 모델별 AI 요청 횟수 저장소. 안내용 추정치이며 백업에 넣지 않는다.
 * 여러 채점 요청이 동시에 끝나도 횟수가 덮어써지지 않도록 기록을 한 줄로 이어서 처리한다.
 */
import AsyncStorage from '../app_storage';
import { STORAGE_KEYS } from '../storage_keys';
import { AiRequestEvent, AiRequestUsage, getAiQuotaDay } from '../../domain/ai_usage';

let writeQueue: Promise<void> = Promise.resolve();

function readUsage(raw: string | null, day: string): AiRequestUsage {
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && parsed.day === day && parsed.counts && typeof parsed.counts === 'object') {
      const counts: Record<string, number> = {};
      for (const [model, value] of Object.entries(parsed.counts as Record<string, unknown>)) {
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) counts[model] = Math.floor(value);
      }
      const exhausted = Array.isArray(parsed.exhausted)
        ? parsed.exhausted.filter((model: unknown): model is string => typeof model === 'string')
        : [];
      return { day, counts, exhausted };
    }
  } catch {
    // 손상된 기록은 새 날짜 기록으로 다시 시작한다.
  }
  return { day, counts: {}, exhausted: [] };
}

export async function getAiRequestUsage(now: Date = new Date()): Promise<AiRequestUsage> {
  await writeQueue;
  return readUsage(await AsyncStorage.getItem(STORAGE_KEYS.AI_REQUEST_USAGE), getAiQuotaDay(now));
}

export function recordAiRequest(event: AiRequestEvent, now: Date = new Date()): Promise<void> {
  const run = writeQueue.then(async () => {
    const usage = readUsage(await AsyncStorage.getItem(STORAGE_KEYS.AI_REQUEST_USAGE), getAiQuotaDay(now));
    if (event.outcome === 'daily_exhausted') {
      // 한도 소진은 횟수와 따로 기록해 안내 문구에는 이 기기에서 실제로 보낸 횟수만 보인다.
      const exhausted = new Set(usage.exhausted ?? []);
      exhausted.add(event.model);
      usage.exhausted = Array.from(exhausted);
    } else {
      usage.counts[event.model] = (usage.counts[event.model] ?? 0) + 1;
    }
    await AsyncStorage.setItem(STORAGE_KEYS.AI_REQUEST_USAGE, JSON.stringify(usage));
  });
  writeQueue = run.catch(() => {});
  return run;
}

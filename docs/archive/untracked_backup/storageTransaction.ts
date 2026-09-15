import AsyncStorage from '@react-native-async-storage/async-storage';

export const JOURNAL_KEY = '@cogniquest:write_journal_v1';
let tail: Promise<unknown> = Promise.resolve();
export function serializeStorage<T>(operation: () => Promise<T>): Promise<T> {
  const result = tail.then(operation);
  tail = result.catch(() => undefined);
  return result;
}

/** A durable before-image survives partial writes and app termination. */
export async function recoverStorageJournal(): Promise<void> {
  const raw = await AsyncStorage.getItem(JOURNAL_KEY);
  if (!raw) return;
  const journal = JSON.parse(raw);
  if (!Array.isArray(journal) || journal.some((p: unknown) => !Array.isArray(p) || p.length !== 2 || typeof p[0] !== 'string' || !p[0].startsWith('@cogniquest:') || p[0] === JOURNAL_KEY || (p[1] !== null && typeof p[1] !== 'string'))) {
    throw new Error('저장 복구 기록이 손상되었습니다. 데이터를 보존하고 복구를 중단했습니다.');
  }
  for (const [key, value] of journal) {
    if (value === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
  }
  await AsyncStorage.removeItem(JOURNAL_KEY);
}

/** Caller must hold serializeStorage lock. */
export async function writeStorageTransaction(values: [string, string | null][]): Promise<void> {
  await recoverStorageJournal();
  const before: [string, string | null][] = await Promise.all(values.map(async ([key]) => [key, await AsyncStorage.getItem(key)] as [string, string | null]));
  await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(before));
  try {
    for (const [key, value] of values) {
      if (value === null) await AsyncStorage.removeItem(key);
      else await AsyncStorage.setItem(key, value);
    }
    await AsyncStorage.removeItem(JOURNAL_KEY);
  } catch {
    try { await recoverStorageJournal(); }
    catch { throw new Error('저장에 실패했습니다. 복구 기록은 보존되어 있습니다. 앱을 다시 열어 복구한 뒤 재시도하세요.'); }
    throw new Error('저장에 실패하여 변경 전 데이터로 복구했습니다. 저장 공간을 확인하고 재시도하세요.');
  }
}

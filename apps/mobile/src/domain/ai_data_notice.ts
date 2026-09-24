/**
 * 첫 AI 요청 전 데이터 전송 안내. 확인한 문구 버전을 기기에 저장하고, 버전이 바뀌면 다시 묻는다.
 * 안내 화면(AiDataNoticeModal)이 없거나 사용자가 취소하면 false이며 요청을 보내지 않는다.
 */

import AsyncStorage from '../data/app_storage';
import { STORAGE_KEYS } from '../data/storage_keys';

export const AI_DATA_NOTICE_VERSION = '1';

type NoticeListener = (answer: (accepted: boolean) => void) => void;

let listener: NoticeListener | null = null;
let pending: Promise<boolean> | null = null;

export function registerAiDataNoticeListener(next: NoticeListener): () => void {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}

async function readAcceptedVersion(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.AI_DATA_NOTICE);
  } catch {
    return null; // 읽지 못하면 다시 안내한다.
  }
}

export async function ensureAiDataNoticeAccepted(): Promise<boolean> {
  if ((await readAcceptedVersion()) === AI_DATA_NOTICE_VERSION) return true;
  // 동시에 여러 요청(예: 여러 문항 채점)이 와도 안내는 한 번만 띄운다.
  pending ??= new Promise<boolean>((resolve) => {
    if (!listener) resolve(false);
    else listener(resolve);
  }).then(async (accepted) => {
    if (accepted) {
      // 저장에 실패해도 이번 요청은 진행하고, 다음 요청 때 다시 안내한다.
      await AsyncStorage.setItem(STORAGE_KEYS.AI_DATA_NOTICE, AI_DATA_NOTICE_VERSION).catch(() => undefined);
    }
    return accepted;
  }).finally(() => {
    pending = null;
  });
  return pending;
}

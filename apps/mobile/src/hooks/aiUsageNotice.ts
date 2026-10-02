import { getAiRequestUsage } from '../data/db';
import { getAiUsageWarning } from '../domain/ai_usage';
import { showAlert } from '../utils/alert';
import { isDesktopAiSelected } from '../integrations/desktop_ai_connector';

/**
 * 무료 한도에 가까우면 오늘 AI 요청 횟수를 알리는 안내창을 띄우고 true를 돌려준다.
 * 계속할지는 사용자가 고르며(계속 생성 → proceed), 기록을 읽지 못하면 안내 없이 false.
 * 요청 자체를 막지 않는다. 실제 한도는 사용자가 연결한 AI 서비스가 정한다.
 */
export async function showAiUsageNoticeIfNeeded(proceed: () => void): Promise<boolean> {
  // Saved Gemini-key estimates are not the signed-in account's subscription quota.
  if (await isDesktopAiSelected()) return false;
  let message: string | null = null;
  try {
    message = getAiUsageWarning(await getAiRequestUsage());
  } catch {
    return false;
  }
  if (!message) return false;
  showAlert('AI 요청 사용량 안내', message, [
    { text: '취소', style: 'cancel' },
    { text: '계속 생성', onPress: proceed },
  ]);
  return true;
}

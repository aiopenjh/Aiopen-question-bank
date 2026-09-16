import { useEffect, useState, useCallback } from 'react';
import { RankingProfile } from '../contracts/types';
import { getRankingProfile, saveRankingProfile, clearRankingProfile, getPendingSyncRequest } from '../data/db';

/**
 * 랭킹 참여 자격을 기기 저장소와 동기화하는 훅.
 * useAppBackup/useSourceManager와 같은 조립 패턴.
 */
export function useRankingProfile() {
  const [rankingProfile, setRankingProfile] = useState<RankingProfile | null>(null);
  const [rankingSyncModalVisible, setRankingSyncModalVisible] = useState(false);

  useEffect(() => {
    (async () => {
      const profile = await getRankingProfile();
      setRankingProfile(profile);
      if (!profile) return;
      // 계획서 §6: 실패한 연동 요청은 앱이 다음에 열린 뒤 사용자 동의를 거쳐 재시도한다.
      // 자동 전송하지 않고 연동 확인 모달을 다시 띄워 "연동하기"를 누르게 한다.
      const pending = await getPendingSyncRequest();
      if (pending) setRankingSyncModalVisible(true);
    })();
  }, []);

  const handleRankingProfileChange = useCallback(async (profile: RankingProfile | null) => {
    if (profile) {
      await saveRankingProfile(profile);
    } else {
      await clearRankingProfile();
    }
    setRankingProfile(profile);
  }, []);

  return {
    rankingProfile,
    handleRankingProfileChange,
    rankingSyncModalVisible,
    setRankingSyncModalVisible,
  };
}

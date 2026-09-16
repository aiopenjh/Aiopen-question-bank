import { useEffect, useState, useCallback } from 'react';
import { RankingProfile } from '../contracts/types';
import { getRankingProfile, saveRankingProfile, clearRankingProfile } from '../data/db';

/**
 * 랭킹 참여 자격을 기기 저장소와 동기화하는 훅.
 * useAppBackup/useSourceManager와 같은 조립 패턴.
 */
export function useRankingProfile() {
  const [rankingProfile, setRankingProfile] = useState<RankingProfile | null>(null);
  const [rankingSyncModalVisible, setRankingSyncModalVisible] = useState(false);

  useEffect(() => {
    getRankingProfile().then(setRankingProfile);
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

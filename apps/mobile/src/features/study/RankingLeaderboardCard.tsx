import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { colors, radius, spacing } from '../../styles/designTokens';
import { UniversalModal } from '../../components/common/UniversalModal';
import { getLeaderboard, LeaderboardResult, RANKING_API_BASE_URL } from '../../domain/ranking_client';
import { openRankingWindow } from '../ranking/openRankingWindow';
import { RankingWindowScreen } from '../ranking/RankingWindowScreen';

/**
 * 메인 화면 랭킹 카드. 계획서 §3.3 + FEATURE_PLAN §10 확정안.
 *
 * 카드는 현재 1위만 간결히 보여주고, 연동과 전체 랭킹은 누르면 열리는
 * 랭킹 창에서 처리한다. 웹은 별도 브라우저 창, 팝업 차단이나 네이티브는
 * 앱 안 전체화면으로 대체한다.
 * 서버가 아직 연결되지 않았으면(RANKING_API_BASE_URL 미설정) 렌더링하지 않는다.
 */
export const RankingLeaderboardCard: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardResult | null>(null);
  const [fallbackVisible, setFallbackVisible] = useState(false);

  const load = useCallback(() => {
    if (!RANKING_API_BASE_URL) return;
    getLeaderboard()
      .then(setLeaderboard)
      .catch(() => setLeaderboard(null));
  }, []);

  useEffect(() => {
    load();
    // 랭킹 창에서 연동을 마치고 돌아오면 1위가 바뀌었을 수 있으므로 다시 읽는다.
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [load]);

  if (!RANKING_API_BASE_URL) return null;

  const topSolved = leaderboard?.mostSolved?.[0];
  const topConsistent = leaderboard?.mostConsistent?.[0];
  const topChallenge = leaderboard?.mostKillerLevel?.[0];

  function handleOpen() {
    if (!openRankingWindow()) setFallbackVisible(true);
  }

  function handleCloseFallback() {
    setFallbackVisible(false);
    load();
  }

  return (
    <>
      <TouchableOpacity style={styles.card} onPress={handleOpen} activeOpacity={0.85}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>실시간 랭킹</Text>
          <Text style={styles.openHint}>연동 · 전체 보기 ›</Text>
        </View>

        <View style={styles.entryRow}>
          <Text style={styles.entryLabel}>🏆 최다 문제 풀이 왕</Text>
          {topSolved ? (
            <Text style={styles.entryValue} numberOfLines={1}>
              {topSolved.nickname} · {topSolved.value}문제
            </Text>
          ) : (
            <Text style={styles.entryEmpty}>아직 참여자 없음</Text>
          )}
        </View>

        <View style={styles.entryRow}>
          <Text style={styles.entryLabel}>🔥 꾸준함 왕</Text>
          {topConsistent ? (
            <Text style={styles.entryValue} numberOfLines={1}>
              {topConsistent.nickname} · {topConsistent.value}일 연속
            </Text>
          ) : (
            <Text style={styles.entryEmpty}>아직 참여자 없음</Text>
          )}
        </View>
        <View style={styles.entryRow}>
          <Text style={styles.entryLabel}>⚔️ 초고난도 도전</Text>
          {topChallenge ? (
            <Text style={styles.entryValue} numberOfLines={1}>
              {topChallenge.nickname} · Lv.{topChallenge.value}
            </Text>
          ) : (
            <Text style={styles.entryEmpty}>아직 참여자 없음</Text>
          )}
        </View>
      </TouchableOpacity>

      <UniversalModal visible={fallbackVisible} onClose={handleCloseFallback}>
        <RankingWindowScreen onClose={handleCloseFallback} />
      </UniversalModal>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: { fontSize: 14, fontWeight: '800', color: colors.ink },
  openHint: { fontSize: 12, fontWeight: '700', color: colors.primaryPressed },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  entryLabel: { fontSize: 12, fontWeight: '700', color: colors.inkMuted },
  entryValue: { fontSize: 13, fontWeight: '800', color: colors.ink, flexShrink: 1, marginLeft: 8 },
  entryEmpty: { fontSize: 12, color: colors.inkMuted },
});

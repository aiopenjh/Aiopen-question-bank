import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
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
  const [activeIndex, setActiveIndex] = useState(0);
  const slideY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

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
  const entries = useMemo(() => [
    {
      label: '최다 문제 풀이',
      icon: '🏆',
      value: topSolved ? `${topSolved.nickname} · ${topSolved.value}문제` : '아직 참여자 없음',
    },
    {
      label: '꾸준함',
      icon: '🔥',
      value: topConsistent ? `${topConsistent.nickname} · ${topConsistent.value}일 연속` : '아직 참여자 없음',
    },
    {
      label: '초고난도',
      icon: '⚔️',
      value: topChallenge ? `${topChallenge.nickname} · Lv.${topChallenge.value}` : '아직 참여자 없음',
    },
  ], [topChallenge, topConsistent, topSolved]);

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.parallel([
        Animated.timing(slideY, { toValue: -12, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => {
        setActiveIndex((current) => (current + 1) % entries.length);
        slideY.setValue(12);
        Animated.parallel([
          Animated.timing(slideY, { toValue: 0, duration: 260, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        ]).start();
      });
    }, 5000);

    return () => clearInterval(timer);
  }, [entries.length, opacity, slideY]);

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
        <View style={styles.tickerCopy}>
          <Animated.View style={{ opacity, transform: [{ translateY: slideY }] }}>
            <Text style={styles.entryLabel} numberOfLines={1}>
              {entries[activeIndex].icon} {entries[activeIndex].label} 1위
            </Text>
            <Text style={styles.entryValue} numberOfLines={1}>
              {entries[activeIndex].value}
            </Text>
          </Animated.View>
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
    borderRadius: radius.sm,
    width: '100%',
    height: 34,
    paddingHorizontal: 5,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  tickerCopy: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  entryLabel: { fontSize: 8, lineHeight: 10, fontWeight: '800', color: colors.ink },
  entryValue: { fontSize: 8, lineHeight: 10, fontWeight: '700', color: colors.inkMuted },
});

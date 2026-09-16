import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { colors, radius, spacing } from '../../styles/designTokens';
import { getLeaderboard, LeaderboardResult, RANKING_API_BASE_URL } from '../../domain/ranking_client';

type Tab = 'mostSolved' | 'mostConsistent';

/**
 * 메인 화면 랭킹 카드. 계획서 §3.3 + FEATURE_PLAN §10 확정안:
 * 동시 1위라도 두 항목을 각각 독립된 탭으로 분리해 표시한다.
 * 서버가 아직 연결되지 않았으면(RANKING_API_BASE_URL 미설정) 렌더링하지 않는다.
 */
export const RankingLeaderboardCard: React.FC = () => {
  const [tab, setTab] = useState<Tab>('mostSolved');
  const [leaderboard, setLeaderboard] = useState<LeaderboardResult | null>(null);

  useEffect(() => {
    if (!RANKING_API_BASE_URL) return;
    getLeaderboard()
      .then(setLeaderboard)
      .catch(() => setLeaderboard(null));
  }, []);

  if (!RANKING_API_BASE_URL) return null;

  return (
    <View style={styles.card}>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'mostSolved' && styles.tabButtonActive]}
          onPress={() => setTab('mostSolved')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, tab === 'mostSolved' && styles.tabTextActive]}>
            🏆 최다 문제 풀이 왕
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'mostConsistent' && styles.tabButtonActive]}
          onPress={() => setTab('mostConsistent')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, tab === 'mostConsistent' && styles.tabTextActive]}>
            🔥 꾸준함 왕
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'mostSolved' ? (
        leaderboard?.mostSolved ? (
          <View style={styles.resultRow}>
            <Text style={styles.nickname}>{leaderboard.mostSolved.nickname}</Text>
            <Text style={styles.value}>{leaderboard.mostSolved.totalSolved}문제</Text>
          </View>
        ) : (
          <Text style={styles.emptyText}>아직 참여자가 없습니다.</Text>
        )
      ) : leaderboard?.mostConsistent ? (
        <View style={styles.resultRow}>
          <Text style={styles.nickname}>{leaderboard.mostConsistent.nickname}</Text>
          <Text style={styles.value}>{leaderboard.mostConsistent.currentStreak}일 연속</Text>
        </View>
      ) : (
        <Text style={styles.emptyText}>아직 참여자가 없습니다.</Text>
      )}
    </View>
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
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  tabButtonActive: {
    backgroundColor: colors.primarySoft,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkMuted,
  },
  tabTextActive: {
    color: colors.primaryPressed,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  nickname: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryPressed,
  },
  emptyText: {
    fontSize: 12,
    color: colors.inkMuted,
    paddingVertical: 4,
  },
});

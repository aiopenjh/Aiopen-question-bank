import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../styles/designTokens';
import { showAlert } from '../../utils/alert';
import { useRankingWindow } from '../../hooks/useRankingWindow';
import { CONSISTENCY_MIN_QUESTIONS } from '../../domain/ranking';
import { LeaderboardEntry, RANKING_API_BASE_URL } from '../../domain/ranking_client';

type Tab = 'mostSolved' | 'mostConsistent';

export interface RankingWindowScreenProps {
  /** 앱 안 전체화면으로 띄웠을 때만 닫기 버튼을 노출한다. 별도 창이면 생략. */
  onClose?: () => void;
}

/**
 * 랭킹 창. 실시간 연동과 전체 랭킹 확인을 한곳에서 처리한다.
 * Reference: docs/ranking/RANKING_FEATURE_PLAN.md §3.1~§3.3
 */
export const RankingWindowScreen: React.FC<RankingWindowScreenProps> = ({ onClose }) => {
  const { profile, todaySolvedCount, leaderboard, lastSync, loading, busy, error, register, sync, withdraw } =
    useRankingWindow();
  const [tab, setTab] = useState<Tab>('mostSolved');
  const [nickname, setNickname] = useState('');

  async function handleRegister() {
    const trimmed = nickname.trim();
    if (trimmed.length < 2 || trimmed.length > 12) {
      showAlert('알림', '닉네임은 2~12자로 입력해 주세요.');
      return;
    }
    const result = await register(trimmed);
    if (result.ok) {
      setNickname('');
      showAlert(
        '랭킹 참여 완료',
        '복구 정보는 백업 파일에 포함됩니다. 백업 파일을 안전하게 보관해 주세요.'
      );
    }
  }

  async function handleSync() {
    const result = await sync();
    if (!result.ok) return;
    const { solvedCount, qualifiedConsistency, currentStreak, totalSolved, solvedRank, consistencyRank } =
      result.result;
    // 계획서 §3.2: 3문제 이상/미만에 따라 안내를 나눈다.
    const streakLine = qualifiedConsistency
      ? `꾸준함 기록에도 참여해 현재 ${currentStreak}일 연속입니다.`
      : `꾸준함은 오늘 ${CONSISTENCY_MIN_QUESTIONS - solvedCount}문제를 더 풀면 인정됩니다.`;
    showAlert(
      '연동 완료',
      `오늘 완료 ${solvedCount}문제가 반영되었습니다.\n${streakLine}\n\n` +
        `누적 ${totalSolved}문제 · 최다 문제 풀이 ${solvedRank}위 · 꾸준함 ${consistencyRank}위`
    );
  }

  function handleWithdraw() {
    showAlert(
      '랭킹 탈퇴',
      '탈퇴 요청 시 닉네임은 즉시 랭킹에서 사라지며, 3일 후 서버 기록이 완전히 삭제됩니다.\n\n3일 안에 다시 연동하면 탈퇴가 취소됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴 요청',
          style: 'destructive',
          onPress: async () => {
            const result = await withdraw();
            if (result.ok) showAlert('탈퇴 요청 완료', '3일 후 서버에서 기록이 삭제됩니다.');
          },
        },
      ]
    );
  }

  if (!RANKING_API_BASE_URL) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>랭킹 서버가 아직 연결되지 않았습니다.</Text>
        {onClose && (
          <TouchableOpacity style={styles.secondaryButton} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.secondaryButtonText}>닫기</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const rows: LeaderboardEntry[] =
    (tab === 'mostSolved' ? leaderboard?.mostSolved : leaderboard?.mostConsistent) ?? [];
  const unit = tab === 'mostSolved' ? '문제' : '일 연속';
  const myRank = lastSync && (tab === 'mostSolved' ? lastSync.solvedRank : lastSync.consistencyRank);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>공동 랭킹</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeText}>닫기</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={colors.primaryPressed} style={{ marginTop: spacing.lg }} />
      ) : (
        <>
          {profile ? (
            <View style={styles.card}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{profile.nickname} · 오늘 완료</Text>
                <Text style={styles.summaryValue}>{todaySolvedCount}문제</Text>
              </View>
              <Text style={styles.noticeText}>
                연동 시 오늘 완료한 문제 수와 꾸준함 참여 여부만 전송합니다. 문제 내용, 정답, 과목명과 API 키는
                전송하지 않습니다.
              </Text>
              <TouchableOpacity
                style={[styles.primaryButton, busy && styles.buttonDisabled]}
                onPress={handleSync}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>지금 연동하기</Text>
                )}
              </TouchableOpacity>
              {lastSync && (
                <Text style={styles.myStatText}>
                  누적 {lastSync.totalSolved}문제 · {lastSync.currentStreak}일 연속 · 최다 {lastSync.solvedRank}위 ·
                  꾸준함 {lastSync.consistencyRank}위
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>랭킹 참여 (선택)</Text>
              <Text style={styles.noticeText}>
                원하는 사용자끼리만 가볍게 학습 동기를 나눕니다. 참여하지 않아도 앱 사용에는 영향이 없습니다.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="공개 닉네임 (2~12자)"
                placeholderTextColor="#94a3b8"
                value={nickname}
                onChangeText={setNickname}
                maxLength={12}
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.primaryButton, (!nickname.trim() || busy) && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={busy || !nickname.trim()}
                activeOpacity={0.85}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>참여 등록</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

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
                <Text style={[styles.tabText, tab === 'mostConsistent' && styles.tabTextActive]}>🔥 꾸준함 왕</Text>
              </TouchableOpacity>
            </View>

            {rows.length === 0 ? (
              <Text style={styles.emptyText}>아직 참여자가 없습니다.</Text>
            ) : (
              rows.map((row) => (
                <View key={`${tab}-${row.rank}`} style={styles.rankRow}>
                  <Text style={styles.rankNumber}>{row.rank}</Text>
                  <Text style={styles.rankNickname} numberOfLines={1}>
                    {row.nickname}
                  </Text>
                  <Text style={styles.rankValue}>
                    {row.value}
                    {unit}
                  </Text>
                </View>
              ))
            )}

            {myRank != null && <Text style={styles.myStatText}>내 순위: {myRank}위</Text>}
          </View>

          {profile && (
            <TouchableOpacity style={styles.withdrawButton} onPress={handleWithdraw} activeOpacity={0.8}>
              <Text style={styles.withdrawButtonText}>랭킹 탈퇴</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surfaceMuted },
  pageContent: { padding: spacing.md, paddingBottom: spacing.xl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.surfaceMuted },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  pageTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  closeText: { fontSize: 14, fontWeight: '700', color: colors.inkMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  noticeText: { fontSize: 12, color: colors.inkMuted, lineHeight: 18, marginBottom: 10 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: { fontSize: 13, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  summaryValue: { fontSize: 15, fontWeight: '800', color: colors.primaryPressed },
  // fontSize 16 고정: 모바일 브라우저 확대 방지 (CLAUDE.md 제약 5)
  input: {
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.primaryPressed,
  },
  primaryButtonText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  buttonDisabled: { opacity: 0.6 },
  secondaryButton: {
    marginTop: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  tabButtonActive: { backgroundColor: colors.primarySoft },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.inkMuted },
  tabTextActive: { color: colors.primaryPressed },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rankNumber: { width: 28, fontSize: 13, fontWeight: '800', color: colors.primaryPressed },
  rankNickname: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink },
  rankValue: { fontSize: 13, fontWeight: '700', color: colors.inkMuted },
  myStatText: { fontSize: 12, color: colors.inkMuted, marginTop: 10, fontWeight: '600' },
  emptyText: { fontSize: 12, color: colors.inkMuted, paddingVertical: 6 },
  errorText: { fontSize: 12, color: colors.danger, marginBottom: spacing.md },
  withdrawButton: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 18 },
  withdrawButtonText: { fontSize: 13, fontWeight: '700', color: colors.danger },
});

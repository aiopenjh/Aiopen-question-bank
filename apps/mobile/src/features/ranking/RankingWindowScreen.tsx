import React, { useEffect, useState } from 'react';
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
import { showAlert, registerAlertListener, AlertData } from '../../utils/alert';
import { AppAlertModal } from '../../components/modals/AppAlertModal';
import { useRankingWindow } from '../../hooks/useRankingWindow';
import { CONSISTENCY_MIN_QUESTIONS } from '../../domain/ranking';
import { LeaderboardEntry, RANKING_API_BASE_URL } from '../../domain/ranking_client';
import { closeRankingWindow } from './openRankingWindow';

type Tab = 'mostSolved' | 'mostConsistent' | 'mostKillerLevel';

export interface RankingWindowScreenProps {
  /** 앱 안 전체화면의 닫기 동작. 별도 웹 창은 window.close()를 사용한다. */
  onClose?: () => void;
}

/**
 * 랭킹 창. 실시간 연동과 전체 랭킹 확인을 한곳에서 처리한다.
 * Reference: docs/ranking/RANKING_FEATURE_PLAN.md §3.1~§3.3
 */
export const RankingWindowScreen: React.FC<RankingWindowScreenProps> = ({ onClose }) => {
  const handleClose = onClose ?? closeRankingWindow;
  const {
    profile,
    todaySolvedCount,
    maxKillerLevel,
    leaderboard,
    lastSync,
    loading,
    busy,
    error,
    recoverySeed,
    pendingSync,
    register,
    withdraw,
    recoverFromBackup,
    dismissRecoverySeed,
  } = useRankingWindow();
  const [tab, setTab] = useState<Tab>('mostSolved');
  const [nickname, setNickname] = useState('');
  // 랭킹 창은 useAppController를 마운트하지 않으므로(§3.3, 학습 화면과 독립),
  // 탈퇴 확인 등 showAlert() 호출이 메인 화면과 같은 스타일로 뜨도록 이 창에서 직접 구독한다.
  const [windowAlert, setWindowAlert] = useState<AlertData | null>(null);
  useEffect(() => registerAlertListener((data) => setWindowAlert(data)), []);

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

  async function handleRecover() {
    const result = await recoverFromBackup();
    if (result.ok) {
      showAlert('랭킹 계정 복구 완료', '백업에 있던 랭킹 계정으로 다시 연결되었습니다.');
    } else {
      showAlert('복구 실패', `${result.message}\n\n계정이 이미 탈퇴 처리되었다면 새로 참여해 주세요.`);
    }
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
        <TouchableOpacity style={styles.secondaryButton} onPress={handleClose} activeOpacity={0.8}>
          <Text style={styles.secondaryButtonText}>닫기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const rows: LeaderboardEntry[] = leaderboard?.[tab] ?? [];
  const unit = tab === 'mostSolved' ? '문제' : tab === 'mostConsistent' ? '일 연속' : '레벨';
  const myRank =
    lastSync &&
    (tab === 'mostSolved'
      ? lastSync.solvedRank
      : tab === 'mostConsistent'
      ? lastSync.consistencyRank
      : lastSync.killerRank);

  return (
    <>
      <AppAlertModal alert={windowAlert} onClose={() => setWindowAlert(null)} />
      <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>랭킹에 도전해보세요 ✦</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="랭킹 창 닫기"
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={colors.primaryPressed} style={{ marginTop: spacing.lg }} />
      ) : (
        <>
          {!profile && recoverySeed && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>백업에서 랭킹 계정을 발견했습니다</Text>
              <Text style={styles.noticeText}>
                "{recoverySeed.nickname}" 계정의 누적 기록을 이 기기에서 이어서 쓸 수 있습니다. 탈퇴 후 유예 기간이
                지난 계정이면 복구가 실패할 수 있습니다.
              </Text>
              <TouchableOpacity
                style={[styles.primaryButton, busy && styles.buttonDisabled]}
                onPress={handleRecover}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>이 계정으로 복구하기</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={dismissRecoverySeed}
                disabled={busy}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryButtonText}>새로 참여하기</Text>
              </TouchableOpacity>
            </View>
          )}

          {profile ? (
            <View style={styles.card}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{profile.nickname} · 오늘 완료</Text>
                <Text style={styles.summaryValue}>{todaySolvedCount}문제</Text>
              </View>
              {maxKillerLevel > 0 && (
                <Text style={styles.noticeText}>최고 순차 통과 레벨: Lv.{maxKillerLevel}</Text>
              )}
              <Text style={styles.noticeText}>
                시험을 마치면 오늘 완료한 문제 수와 최고 순차 통과 레벨이 자동으로 연동됩니다. 하루 {CONSISTENCY_MIN_QUESTIONS}문제 이상이면 꾸준함에 반영됩니다. 문제 내용, 정답, 과목명과 API 키는
                전송하지 않습니다.
              </Text>
              <Text style={styles.syncStatusText}>
                {profile.lastSyncedDate
                  ? `마지막 연동: ${profile.lastSyncedDate} (${profile.lastSyncedSolvedCount ?? 0}문제)`
                  : '아직 한 번도 연동하지 않았습니다.'}
              </Text>
              {pendingSync && (
                <Text style={styles.pendingText}>
                  지난번 자동 연동이 실패해 대기 중입니다({pendingSync.localDate} ·{' '}
                  {pendingSync.solvedCount}문제). 다음 시험 완료 때 최신 값으로 다시 전송합니다.
                </Text>
              )}
              {lastSync && (
                <Text style={styles.myStatText}>
                  누적 {lastSync.totalSolved}문제 · {lastSync.currentStreak}일 연속 · 최다 {lastSync.solvedRank}위 ·
                  꾸준함 {lastSync.consistencyRank}위
                  {lastSync.maxKillerLevel > 0 ? ` · 초고난도 도전 ${lastSync.killerRank}위` : ''}
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
                onChangeText={(value) => setNickname(Array.from(value).slice(0, 12).join(''))}
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

          <Text style={styles.challengeLevelGuide}>
            최고 난이도는 Lv.31부터! 지금 도전해 보세요 ⚔️
          </Text>

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
              <TouchableOpacity
                style={[styles.tabButton, tab === 'mostKillerLevel' && styles.tabButtonActive]}
                onPress={() => setTab('mostKillerLevel')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, tab === 'mostKillerLevel' && styles.tabTextActive]}>
                  ⚔️ 초고난도 도전
                </Text>
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
    </>
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
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeText: { fontSize: 18, lineHeight: 22, fontWeight: '700', color: colors.inkMuted },
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
  syncStatusText: { fontSize: 11.5, color: colors.inkMuted, marginBottom: 10, fontStyle: 'italic' },
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
  challengeLevelGuide: {
    fontSize: 11,
    color: colors.inkMuted,
    opacity: 0.72,
    textAlign: 'center',
    marginTop: -6,
    marginBottom: 10,
  },
  pendingText: {
    fontSize: 12,
    color: colors.primaryPressed,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: 8,
    marginBottom: 10,
  },
  withdrawButton: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 18 },
  withdrawButtonText: { fontSize: 13, fontWeight: '700', color: colors.danger },
});

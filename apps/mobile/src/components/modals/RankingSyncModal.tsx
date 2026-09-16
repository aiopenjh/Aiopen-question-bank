import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { UniversalModal as Modal } from '../common/UniversalModal';
import { colors, radius, spacing } from '../../styles/designTokens';
import { RankingProfile } from '../../contracts/types';
import { syncToday, RankingApiRequestError, SyncTodayResult } from '../../domain/ranking_client';
import { CONSISTENCY_MIN_QUESTIONS } from '../../domain/ranking';
import { setPendingSyncRequest, clearPendingSyncRequest } from '../../data/db';

export interface RankingSyncModalProps {
  visible: boolean;
  rankingProfile: RankingProfile | null;
  todaySolvedCount: number;
  localDate: string;
  onClose: () => void;
  onSynced: (result: SyncTodayResult) => void;
}

/**
 * "오늘 학습 기록 연동" 확인창. 계획서 §3.2의 안내 문구를 그대로 사용한다.
 * 사용자가 "연동하기"를 누르기 전까지는 네트워크 요청이 발생하지 않는다.
 */
export const RankingSyncModal: React.FC<RankingSyncModalProps> = ({
  visible,
  rankingProfile,
  todaySolvedCount,
  localDate,
  onClose,
  onSynced,
}) => {
  const [syncing, setSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSync() {
    if (!rankingProfile) return;
    setSyncing(true);
    setErrorMessage(null);
    try {
      const result = await syncToday(rankingProfile, localDate, todaySolvedCount);
      await clearPendingSyncRequest();
      onSynced(result);
      onClose();
    } catch (err) {
      if (err instanceof RankingApiRequestError) {
        setErrorMessage(err.message);
        // 서버/네트워크 장애(0, 429, 5xx)만 기기에 대기시킨다.
        // 닉네임 충돌 등 사용자 조치가 필요한 4xx는 대기시키지 않는다 (계획서 §6).
        if (err.status === 0 || err.status === 429 || err.status >= 500) {
          await setPendingSyncRequest(localDate, todaySolvedCount);
        }
      } else {
        setErrorMessage('알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Modal visible={visible} onClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>오늘 학습 기록 연동</Text>

          <Text style={styles.body}>연동 시 오늘 완료한 문제 수와 꾸준함 참여 여부만 판별합니다.</Text>
          <Text style={styles.body}>
            오늘 {CONSISTENCY_MIN_QUESTIONS}문제 이상 풀었다면 꾸준함 기록에도 자동 참여합니다.
          </Text>
          <Text style={styles.body}>문제 내용, 정답, 과목명과 API 키는 전송하지 않습니다.</Text>
          <Text style={styles.body}>
            등록한 닉네임은 랭킹에 공개되며 현재 순위에 따라 표시 위치가 변경됩니다.
          </Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>오늘 완료</Text>
            <Text style={styles.summaryValue}>{todaySolvedCount}문제</Text>
          </View>

          {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={syncing} activeOpacity={0.8}>
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.syncButton, syncing && { opacity: 0.6 }]}
              onPress={handleSync}
              disabled={syncing}
              activeOpacity={0.85}
            >
              {syncing ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.syncButtonText}>연동하기</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(64, 58, 67, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 10,
  },
  body: {
    fontSize: 13,
    color: colors.inkMuted,
    lineHeight: 19,
    marginBottom: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.inkMuted,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 15,
    color: colors.ink,
    fontWeight: '800',
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  syncButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.primaryPressed,
  },
  syncButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});

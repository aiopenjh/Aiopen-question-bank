import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { showAlert } from '../../utils/alert';
import { styles } from './settingsStyles';
import { RankingProfile } from '../../contracts/types';
import { registerParticipant, requestWithdrawal, RankingApiRequestError } from '../../domain/ranking_client';

export interface RankingSectionProps {
  rankingProfile: RankingProfile | null;
  onRankingProfileChange: (profile: RankingProfile | null) => Promise<void>;
  onOpenSyncModal: () => void;
}

/**
 * 설정 > 랭킹 참여 섹션. 계획서 §3.1.
 * 등록 전에는 닉네임 입력만 노출하고, 서버 요청은 "등록" 버튼을 눌렀을 때만 발생한다.
 */
export const RankingSection: React.FC<RankingSectionProps> = ({
  rankingProfile,
  onRankingProfileChange,
  onOpenSyncModal,
}) => {
  const [nickname, setNickname] = useState('');
  const [registering, setRegistering] = useState(false);

  async function handleRegister() {
    const trimmed = nickname.trim();
    if (trimmed.length < 2 || trimmed.length > 12) {
      showAlert('알림', '닉네임은 2~12자로 입력해 주세요.');
      return;
    }
    setRegistering(true);
    try {
      const result = await registerParticipant(trimmed);
      await onRankingProfileChange({
        nickname: result.nickname,
        participantId: result.participantId,
        deviceToken: result.deviceToken,
        recoveryToken: result.recoveryToken,
      });
      setNickname('');
      showAlert(
        '랭킹 참여 완료',
        `"${result.nickname}"(으)로 등록되었습니다.\n\n복구 정보는 백업 파일에 포함됩니다. 백업 파일을 안전하게 보관해 주세요.`
      );
    } catch (err) {
      const message = err instanceof RankingApiRequestError ? err.message : '알 수 없는 오류가 발생했습니다.';
      showAlert('등록 실패', message);
    } finally {
      setRegistering(false);
    }
  }

  function handleWithdraw() {
    if (!rankingProfile) return;
    showAlert(
      '랭킹 탈퇴',
      '탈퇴 요청 시 닉네임은 즉시 랭킹에서 사라지며, 3일 후 서버 기록이 완전히 삭제됩니다.\n\n3일 안에 다시 연동하면 탈퇴가 취소됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴 요청',
          style: 'destructive',
          onPress: async () => {
            try {
              await requestWithdrawal(rankingProfile);
              await onRankingProfileChange(null);
              showAlert('탈퇴 요청 완료', '3일 후 서버에서 기록이 삭제됩니다.');
            } catch (err) {
              const message =
                err instanceof RankingApiRequestError ? err.message : '알 수 없는 오류가 발생했습니다.';
              showAlert('탈퇴 요청 실패', message);
            }
          },
        },
      ]
    );
  }

  if (rankingProfile) {
    return (
      <View style={styles.card}>
        <View style={styles.apiSummaryRow}>
          <View style={styles.apiSummaryCopy}>
            <View style={styles.apiTitleRow}>
              <Text style={styles.apiTitle}>랭킹 참여 중</Text>
              <View style={styles.connectedBadge}>
                <Text style={styles.connectedBadgeText}>{rankingProfile.nickname}</Text>
              </View>
            </View>
            <Text style={styles.apiProviderText}>
              문제 내용, 정답, 과목명과 API 키는 전송하지 않습니다.
            </Text>
          </View>
          <View style={styles.apiActions}>
            <TouchableOpacity style={styles.keyActionSmallBtn} onPress={onOpenSyncModal} activeOpacity={0.8}>
              <Text style={styles.keyActionSmallBtnText}>오늘 연동</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.keyActionSmallBtn, styles.dangerActionButton]}
              onPress={handleWithdraw}
              activeOpacity={0.8}
            >
              <Text style={[styles.keyActionSmallBtnText, styles.dangerActionText]}>탈퇴</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardSectionTitle}>랭킹 참여 (선택)</Text>
      <Text style={styles.promptGuideText}>
        원하는 사용자끼리만 가볍게 학습 동기를 나눕니다. 참여하지 않아도 앱 사용에는 영향이 없습니다.
      </Text>
      <TextInput
        style={styles.inputField}
        placeholder="공개 닉네임 (2~12자)"
        placeholderTextColor="#94a3b8"
        value={nickname}
        onChangeText={setNickname}
        maxLength={12}
        autoCorrect={false}
      />
      <TouchableOpacity
        style={[styles.primaryActionButton, (!nickname.trim() || registering) && { opacity: 0.6 }]}
        onPress={handleRegister}
        disabled={registering || !nickname.trim()}
        activeOpacity={0.85}
      >
        {registering ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.primaryActionText}>참여 등록</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

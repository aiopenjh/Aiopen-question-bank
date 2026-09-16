import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { colors, radius, spacing } from '../../styles/designTokens';

const KAKAO_OPEN_CHAT_URL = 'https://open.kakao.com/o/gaRtkENi';

export interface FeedbackCardProps {
  compact?: boolean;
}

export const FeedbackCard: React.FC<FeedbackCardProps> = ({ compact = false }) => {
  const handleOpenKakaoChat = async () => {
    try {
      const supported = await Linking.canOpenURL(KAKAO_OPEN_CHAT_URL);
      if (supported) {
        await Linking.openURL(KAKAO_OPEN_CHAT_URL);
      } else {
        await Linking.openURL(KAKAO_OPEN_CHAT_URL);
      }
    } catch {
      Alert.alert(
        '안내',
        '카카오톡 오픈채팅 링크를 열 수 없습니다. 브라우저에서 아래 주소로 접속해 주세요:\n' +
          KAKAO_OPEN_CHAT_URL
      );
    }
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={handleOpenKakaoChat}
        activeOpacity={0.8}
        accessibilityRole="link"
        accessibilityLabel="카카오톡으로 의견 보내기"
      >
        <Text style={styles.compactIcon}>💬</Text>
        <Text style={styles.compactText}>카카오톡 문의</Text>
        <Text style={styles.compactArrow}>↗</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.cardContainer}
      onPress={handleOpenKakaoChat}
      activeOpacity={0.8}
    >
      <View style={styles.copyArea}>
        <Text style={styles.headerTitle}>의견 보내기</Text>
        <Text style={styles.description}>불편한 점이나 필요한 기능을 알려주세요.</Text>
      </View>
      <Text style={styles.chatButtonText}>카카오톡 ↗</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  copyArea: {
    flex: 1,
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
  },
  description: {
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: 2,
  },
  chatButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  compactContainer: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  compactText: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  compactArrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 5,
  },
});

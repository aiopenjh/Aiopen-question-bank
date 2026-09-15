import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';

const KAKAO_OPEN_CHAT_URL = 'https://open.kakao.com/o/gaRtkENi';

export const FeedbackCard: React.FC = () => {
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

  return (
    <View style={styles.cardContainer}>
      <View style={styles.headerRow}>
        <Text style={styles.headerIcon}>💬</Text>
        <Text style={styles.headerTitle}>건의사항 & 불편한 점 제보</Text>
      </View>
      <Text style={styles.description}>
        앱을 이용하시며 불편하셨던 점이나 추가를 원하는 기능이 있으신가요? 개발자 오픈채팅으로 언제든 편하게 말씀해 주세요!
      </Text>
      <TouchableOpacity
        style={styles.chatButton}
        onPress={handleOpenKakaoChat}
        activeOpacity={0.85}
      >
        <Text style={styles.chatButtonIcon}>🗨️</Text>
        <Text style={styles.chatButtonText}>카카오톡 오픈채팅으로 의견 보내기</Text>
        <Text style={styles.chatButtonArrow}>➔</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1.2,
    borderColor: '#fde047',
    shadowColor: '#ca8a04',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  headerIcon: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#713f12',
  },
  description: {
    fontSize: 12.5,
    color: '#854d0e',
    lineHeight: 18,
    marginBottom: 14,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE500',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#a16207',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 1,
  },
  chatButtonIcon: {
    fontSize: 15,
  },
  chatButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#381E1F',
  },
  chatButtonArrow: {
    fontSize: 12,
    fontWeight: '800',
    color: '#381E1F',
  },
});

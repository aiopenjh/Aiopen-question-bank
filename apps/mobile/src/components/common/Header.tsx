import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { colors, radius, spacing } from '../../styles/designTokens';
import { RankingLeaderboardCard } from '../../features/study/RankingLeaderboardCard';

export interface HeaderProps {
  currentPage: number;
  onSelectPage: (page: number) => void;
  hasApiKey: boolean;
  onOpenSourceUpload?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  onSelectPage,
  hasApiKey,
  onOpenSourceUpload,
}) => {
  return (
    <View style={styles.headerContainer}>
      {/* 1. 브랜드 헤더 (터치 시 첫 페이지인 메인 홈으로 자연스럽게 복귀) */}
      <View style={styles.brandSection}>
        <View style={styles.rankingTickerSlot}>
          <RankingLeaderboardCard />
        </View>

        <TouchableOpacity
          style={styles.brandHome}
          onPress={() => onSelectPage(0)}
          activeOpacity={0.7}
        >
          <View style={styles.brandTitleRow}>
            <Image
              source={require('../../../assets/app-icon.png')}
              style={styles.brandIcon}
              resizeMode="cover"
              accessibilityLabel="Celueste 책 아이콘"
            />
            <Text style={styles.appTitle}>Celueste <Text style={styles.appTitleStar}>✦</Text></Text>
          </View>
        </TouchableOpacity>

        {onOpenSourceUpload && (
          <TouchableOpacity
            onPress={onOpenSourceUpload}
            style={styles.uploadShortcutBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.uploadShortcutBtnText}>+ 자료</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. 책 목차형 3단 탭 네비게이션: 메인(0) -> 과목자료함(1) -> 설정(2) */}
      <View style={styles.navRow}>
        {/* [ 🏠 메인 ] */}
        <TouchableOpacity
          onPress={() => onSelectPage(0)}
          style={[styles.navTab, currentPage === 0 && styles.navTabActive]}
          activeOpacity={0.8}
        >
          <Text
            style={[styles.navTabText, currentPage === 0 && styles.navTabTextActive]}
            numberOfLines={1}
          >
            메인
          </Text>
        </TouchableOpacity>

        {/* [ 📚 과목&자료함 ] */}
        <TouchableOpacity
          onPress={() => onSelectPage(1)}
          style={[styles.navTab, currentPage === 1 && styles.navTabActive]}
          activeOpacity={0.8}
        >
          <Text
            style={[styles.navTabText, currentPage === 1 && styles.navTabTextActive]}
            numberOfLines={1}
          >
            자료함
          </Text>
        </TouchableOpacity>

        {/* [ ⚙️ 설정 ] */}
        <TouchableOpacity
          onPress={() => onSelectPage(2)}
          style={[
            styles.navTab,
            currentPage === 2 && styles.navTabActive,
            !hasApiKey && currentPage !== 2 && styles.navTabAlert,
          ]}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.navTabText,
              currentPage === 2 && styles.navTabTextActive,
              !hasApiKey && currentPage !== 2 && styles.navTabTextAlert,
            ]}
            numberOfLines={1}
          >
            설정{!hasApiKey ? '  !' : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandSection: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 9,
    paddingHorizontal: 68,
    backgroundColor: colors.surface,
  },
  brandHome: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankingTickerSlot: {
    position: 'absolute',
    left: spacing.md,
    top: 7,
    width: '30%',
    maxWidth: 136,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  brandIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
  },
  appTitle: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.4,
  },
  appTitleStar: {
    color: colors.primary,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    gap: spacing.sm,
  },
  navTab: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTabActive: {
    backgroundColor: colors.primaryPressed,
    borderColor: colors.primaryPressed,
  },
  navTabAlert: {
    borderColor: '#D8BD8A',
    backgroundColor: colors.goldSoft,
  },
  navTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  navTabTextActive: {
    color: colors.white,
    fontWeight: '800',
  },
  navTabTextAlert: {
    color: colors.gold,
  },
  uploadShortcutBtn: {
    position: 'absolute',
    right: spacing.md,
    top: 8,
    paddingVertical: 8,
    paddingHorizontal: 9,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#E7C4CF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadShortcutBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.primary,
  },
});

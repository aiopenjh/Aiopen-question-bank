import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';

interface BrandHeaderProps {
  onGoHome: () => void;
  subtitle?: string;
  badgeText?: string;
  compact?: boolean;
}

/**
 * 전역 공통 브랜드 헤더 컴포넌트
 * 어느 화면에서든 어플 이름(Celueste ✨)을 누르면 메인 화면(홈)으로 즉시 돌아가도록 지원합니다.
 */
export const BrandHeader: React.FC<BrandHeaderProps> = ({
  onGoHome,
  subtitle = '어플 이름을 누르면 메인 화면으로 돌아갑니다',
  badgeText = '🏠 홈으로',
  compact = false,
}) => {
  return (
    <TouchableOpacity
      style={[styles.container, compact && styles.containerCompact]}
      onPress={onGoHome}
      activeOpacity={0.7}
    >
      <View style={styles.titleRow}>
        <Text style={[styles.title, compact && styles.titleCompact]}>Celueste ✨</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeText}</Text>
        </View>
      </View>
      {subtitle ? (
        <Text style={[styles.subtitle, compact && styles.subtitleCompact]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#fecdd3',
  },
  containerCompact: {
    paddingTop: 4,
    paddingBottom: 6,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ffe4e6',
    backgroundColor: 'transparent',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#881337',
    letterSpacing: 0.3,
  },
  titleCompact: {
    fontSize: 18,
  },
  badge: {
    backgroundColor: '#ffe4e6',
    borderWidth: 1,
    borderColor: '#fda4af',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    color: '#be123c',
    fontSize: 11,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    color: '#9f1239',
    marginTop: 2,
    fontWeight: '500',
  },
  subtitleCompact: {
    fontSize: 10,
    marginTop: 1,
  },
});

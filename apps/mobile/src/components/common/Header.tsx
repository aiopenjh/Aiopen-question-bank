import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';

export interface HeaderProps {
  currentPage: number;
  onSelectPage: (page: number) => void;
  hasApiKey: boolean;
  questionCount?: number;
  onOpenSourceUpload?: () => void;
  onGoHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  onSelectPage,
  hasApiKey,
  questionCount = 0,
  onOpenSourceUpload,
  onGoHome,
}) => {
  return (
    <View style={styles.headerContainer}>
      {/* 1. 브랜드 헤더 (터치 시 첫 페이지인 메인 홈으로 자연스럽게 복귀) */}
      <TouchableOpacity
        style={styles.brandSection}
        onPress={() => onSelectPage(0)}
        activeOpacity={0.7}
      >
        <Text style={styles.appTitle}>Celueste ✨</Text>
        <Text style={styles.appSubtitle}>나만의 맞춤형 CBT 학습 엔진</Text>
      </TouchableOpacity>

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
            🏠 메인
          </Text>
        </TouchableOpacity>

        {/* [ 📚 과목&자료함 ] */}
        <TouchableOpacity
          onPress={() => onSelectPage(1)}
          style={[styles.navTab, styles.navTabMiddle, currentPage === 1 && styles.navTabActive]}
          activeOpacity={0.8}
        >
          <Text
            style={[styles.navTabText, currentPage === 1 && styles.navTabTextActive]}
            numberOfLines={1}
          >
            📚 과목자료함{questionCount > 0 ? ` (${questionCount})` : ''}
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
            ⚙️ 설정{!hasApiKey ? ' ⚠️' : ''}
          </Text>
        </TouchableOpacity>

        {/* [ 📁 자료추가 ] 숏컷 버튼 */}
        {onOpenSourceUpload && (
          <TouchableOpacity
            onPress={onOpenSourceUpload}
            style={styles.uploadShortcutBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.uploadShortcutBtnText}>+자료</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#fecdd3',
  },
  brandSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 11,
    paddingBottom: 7,
    backgroundColor: '#ffffff',
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#881337',
    letterSpacing: 0.3,
  },
  appSubtitle: {
    fontSize: 11,
    color: '#9f1239',
    marginTop: 2,
    fontWeight: '500',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7f8',
    borderTopWidth: 1,
    borderTopColor: '#ffe4e6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 5,
  },
  navTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#ffffff',
    borderWidth: 1.2,
    borderColor: '#fecdd3',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  navTabMiddle: {
    flex: 1.3,
  },
  navTabActive: {
    backgroundColor: '#f43f5e',
    borderColor: '#e11d48',
    shadowColor: '#be123c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  navTabAlert: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  navTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#881337',
  },
  navTabTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  navTabTextAlert: {
    color: '#b45309',
  },
  uploadShortcutBtn: {
    paddingVertical: 8,
    paddingHorizontal: 9,
    borderRadius: 9,
    backgroundColor: '#fff1f2',
    borderWidth: 1.2,
    borderColor: '#fda4af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadShortcutBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#e11d48',
  },
});

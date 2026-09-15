import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';

interface HeaderProps {
  hasApiKey: boolean;
  questionCount?: number;
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
  onOpenSourceUpload?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  hasApiKey,
  questionCount = 0,
  onOpenLibrary,
  onOpenSettings,
  onOpenSourceUpload,
}) => {
  return (
    <View style={styles.headerContainer}>
      {/* 1. 어플 이름 독립 공간 (최상단) */}
      <View style={styles.brandSection}>
        <Text style={styles.appTitle}>Celueste ✨</Text>
        <Text style={styles.appSubtitle}>나만의 맞춤형 CBT 학습 엔진</Text>
      </View>

      {/* 2. 과목자료함, 설정 및 내자료업로드 통합 네비게이션 영역 */}
      <View style={styles.navContainer}>
        {/* 상단 행: 과목 & 자료함 + 설정 */}
        <View style={styles.navTopRow}>
          <TouchableOpacity
            onPress={onOpenLibrary}
            style={styles.libraryBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.libraryBtnText}>
              📚 과목 & 자료함{questionCount > 0 ? ` (${questionCount})` : ''}
            </Text>
          </TouchableOpacity>

          <View style={styles.navRightGroup}>
            {!hasApiKey && (
              <TouchableOpacity
                onPress={onOpenSettings}
                style={styles.statusPillWarning}
                activeOpacity={0.8}
              >
                <Text style={styles.statusPillText}>⚠️ AI 연결</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onOpenSettings}
              style={styles.settingsBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.settingsBtnText}>⚙️ 설정</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 하단 행: 과목자료함과 설정 바로 아래 같은 배열의 내자료업로드 링크 */}
        {onOpenSourceUpload && (
          <TouchableOpacity
            onPress={onOpenSourceUpload}
            style={styles.sourceUploadLinkBtn}
            activeOpacity={0.8}
          >
            <View style={styles.sourceUploadLeft}>
              <Text style={styles.sourceUploadIcon}>📁</Text>
              <Text style={styles.sourceUploadTitle}>내자료업로드</Text>
              <Text style={styles.sourceUploadSub}>(PDF · TXT · ZIP 교재 첨부)</Text>
            </View>
            <Text style={styles.sourceUploadArrow}>열기 ➔</Text>
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
  // 1. 어플 이름 독립 공간 (상단 브랜드 영역)
  brandSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 13,
    paddingBottom: 9,
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
  // 2. 통합 네비게이션 영역
  navContainer: {
    backgroundColor: '#fff7f8',
    borderTopWidth: 1,
    borderTopColor: '#ffe4e6',
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    gap: 8,
  },
  navTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  libraryBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1.2,
    borderColor: '#fda4af',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  libraryBtnText: {
    color: '#be123c',
    fontSize: 12.5,
    fontWeight: 'bold',
  },
  navRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingsBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1.2,
    borderColor: '#fda4af',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingsBtnText: {
    color: '#be123c',
    fontSize: 12.5,
    fontWeight: 'bold',
  },
  statusPillWarning: {
    backgroundColor: '#fffbeb',
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  statusPillText: {
    color: '#b45309',
    fontSize: 10.5,
    fontWeight: 'bold',
  },
  // 과목자료함 & 설정 아래 같은 배열의 내자료업로드 링크 바
  sourceUploadLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderWidth: 1.2,
    borderColor: '#fecdd3',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sourceUploadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceUploadIcon: {
    fontSize: 14,
  },
  sourceUploadTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#881337',
  },
  sourceUploadSub: {
    fontSize: 11,
    color: '#9f1239',
  },
  sourceUploadArrow: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#e11d48',
  },
});

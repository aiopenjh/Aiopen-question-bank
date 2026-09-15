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

      {/* 2. 과목&자료함, 내자료업로드, 설정 1열 가로 배열 */}
      <View style={styles.navRow}>
        <TouchableOpacity
          onPress={onOpenLibrary}
          style={styles.libraryBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.libraryBtnText} numberOfLines={1}>
            📚 과목&자료함{questionCount > 0 ? ` (${questionCount})` : ''}
          </Text>
        </TouchableOpacity>

        {onOpenSourceUpload && (
          <TouchableOpacity
            onPress={onOpenSourceUpload}
            style={styles.sourceUploadBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.sourceUploadBtnText} numberOfLines={1}>
              📁 내자료업로드
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={onOpenSettings}
          style={[styles.settingsBtn, !hasApiKey && styles.settingsBtnAlert]}
          activeOpacity={0.8}
        >
          <Text style={[styles.settingsBtnText, !hasApiKey && styles.settingsBtnTextAlert]} numberOfLines={1}>
            ⚙️ 설정{!hasApiKey ? ' ⚠️' : ''}
          </Text>
        </TouchableOpacity>
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
  // 2. 통합 네비게이션 1열 가로 배열 영역
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7f8',
    borderTopWidth: 1,
    borderTopColor: '#ffe4e6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  libraryBtn: {
    flex: 1.25,
    backgroundColor: '#ffffff',
    borderWidth: 1.2,
    borderColor: '#fda4af',
    paddingVertical: 7.5,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  libraryBtnText: {
    color: '#be123c',
    fontSize: 12,
    fontWeight: 'bold',
  },
  sourceUploadBtn: {
    flex: 1.1,
    backgroundColor: '#ffffff',
    borderWidth: 1.2,
    borderColor: '#fecdd3',
    paddingVertical: 7.5,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sourceUploadBtnText: {
    color: '#881337',
    fontSize: 12,
    fontWeight: '700',
  },
  settingsBtn: {
    paddingVertical: 7.5,
    paddingHorizontal: 9,
    backgroundColor: '#ffffff',
    borderWidth: 1.2,
    borderColor: '#fda4af',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingsBtnAlert: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  settingsBtnText: {
    color: '#be123c',
    fontSize: 11.5,
    fontWeight: 'bold',
  },
  settingsBtnTextAlert: {
    color: '#b45309',
  },
});

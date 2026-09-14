import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';

interface HeaderProps {
  hasApiKey: boolean;
  questionCount?: number;
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  hasApiKey,
  questionCount = 0,
  onOpenLibrary,
  onOpenSettings,
}) => {
  return (
    <View style={styles.header}>
      <View style={styles.headerTitleGroup}>
        <Text style={styles.appTitle}>Celueste ✨</Text>
        <Text style={styles.appSubtitle}>나만의 맞춤형 CBT 엔진</Text>
      </View>
      <View style={styles.headerRightActions}>
        {!hasApiKey && (
          <TouchableOpacity onPress={onOpenSettings} style={styles.statusPillWarning} activeOpacity={0.8}>
            <Text style={styles.statusPillText}>⚠️ AI 연결</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onOpenLibrary} style={styles.libraryHeaderBtn} activeOpacity={0.8}>
          <Text style={styles.libraryHeaderBtnText}>
            📚 과목 & 자료함{questionCount > 0 ? ` (${questionCount})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onOpenSettings} style={styles.settingsHeaderBtn} activeOpacity={0.8}>
          <Text style={styles.settingsHeaderBtnText}>⚙️ 설정</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#fecdd3',
    backgroundColor: '#ffffff',
  },
  headerTitleGroup: {
    flexShrink: 1,
    marginRight: 6,
  },
  appTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#881337',
    letterSpacing: 0.2,
  },
  appSubtitle: {
    fontSize: 10,
    color: '#9f1239',
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusPillWarning: {
    backgroundColor: '#fffbeb',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  statusPillText: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: 'bold',
  },
  libraryHeaderBtn: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fda4af',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
  },
  libraryHeaderBtnText: {
    color: '#be123c',
    fontSize: 11,
    fontWeight: 'bold',
  },
  settingsHeaderBtn: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fda4af',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 18,
  },
  settingsHeaderBtnText: {
    color: '#be123c',
    fontSize: 11,
    fontWeight: 'bold',
  },
});

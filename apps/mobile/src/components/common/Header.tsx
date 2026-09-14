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
      <View>
        <Text style={styles.appTitle}>CogniQuest</Text>
        <Text style={styles.appSubtitle}>나만의 평생 지적 성장 기록부</Text>
      </View>
      <View style={styles.headerRightActions}>
        {!hasApiKey && (
          <TouchableOpacity onPress={onOpenSettings} style={styles.statusPillWarning} activeOpacity={0.8}>
            <Text style={styles.statusPillText}>⚠️ AI 연결필요</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onOpenLibrary} style={styles.libraryHeaderBtn} activeOpacity={0.8}>
          <Text style={styles.libraryHeaderBtnText}>
            📚 과목 & 자료함{questionCount > 0 ? ` (${questionCount})` : ''}
          </Text>
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#fecdd3',
    backgroundColor: '#ffffff',
  },
  appTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#881337',
  },
  appSubtitle: {
    fontSize: 11,
    color: '#9f1239',
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPillWarning: {
    backgroundColor: '#fffbeb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  statusPillText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: 'bold',
  },
  libraryHeaderBtn: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fda4af',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  libraryHeaderBtnText: {
    color: '#be123c',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

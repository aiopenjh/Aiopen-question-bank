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
            📚 자료함{questionCount > 0 ? ` (${questionCount})` : ''}
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
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  appTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  appSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPillWarning: {
    backgroundColor: '#78350f',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#b45309',
  },
  statusPillText: {
    color: '#fde68a',
    fontSize: 11,
    fontWeight: 'bold',
  },
  libraryHeaderBtn: {
    backgroundColor: '#312e81',
    borderWidth: 1,
    borderColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  libraryHeaderBtnText: {
    color: '#e0e7ff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

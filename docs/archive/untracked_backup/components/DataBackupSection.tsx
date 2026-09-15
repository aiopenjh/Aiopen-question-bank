import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';

interface DataBackupSectionProps {
  onExportBackup: () => Promise<void>;
  onOpenRestoreModal: () => void;
  onResetAllData: () => void;
}

export const DataBackupSection: React.FC<DataBackupSectionProps> = ({
  onExportBackup,
  onOpenRestoreModal,
  onResetAllData,
}) => {
  return (
    <>
      {/* 🛡️ 데이터 백업 및 복원 (간소화된 컴팩트 디자인) */}
      <View style={styles.compactCard}>
        <View style={styles.compactCardHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.compactCardTitle}>🛡️ 데이터 백업 및 복원</Text>
            <Text style={styles.compactCardSubtitle}>
              학습 데이터 백업 파일 공유 및 복원
            </Text>
          </View>
          <View style={styles.compactBtnGroup}>
            <TouchableOpacity
              style={styles.miniBtnPrimary}
              onPress={onExportBackup}
              activeOpacity={0.7}
            >
              <Text style={styles.miniBtnPrimaryText}>💾 백업</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.miniBtnSecondary}
              onPress={onOpenRestoreModal}
              activeOpacity={0.7}
            >
              <Text style={styles.miniBtnSecondaryText}>🔄 복원</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ⚠️ 데이터 클린 초기화 (간소화) */}
      <View style={[styles.compactCard, { backgroundColor: '#fffafb', borderColor: '#ffe4e6' }]}>
        <View style={styles.compactCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.compactCardTitle, { fontSize: 13, color: '#94a3b8' }]}>전체 데이터 초기화</Text>
          </View>
          <TouchableOpacity
            style={styles.miniResetBtn}
            onPress={onResetAllData}
            activeOpacity={0.7}
          >
            <Text style={styles.miniResetBtnText}>🗑️ 초기화</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  compactCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fecdd3',
    marginBottom: 12,
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  compactCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#881337',
    marginBottom: 2,
  },
  compactCardSubtitle: {
    fontSize: 11,
    color: '#64748b',
  },
  compactBtnGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  miniBtnPrimary: {
    backgroundColor: '#f43f5e',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  miniBtnPrimaryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  miniBtnSecondary: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fda4af',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  miniBtnSecondaryText: {
    color: '#be123c',
    fontSize: 12,
    fontWeight: '700',
  },
  miniResetBtn: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  miniResetBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '600',
  },
});

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from './settingsStyles';

export interface DataBackupSectionProps {
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
      {/* 🛡️ 데이터 백업 및 복원 */}
      <View style={styles.compactCard}>
        <View style={styles.compactCardHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.compactCardTitle}>🛡️ 데이터 백업 및 복원</Text>
            <Text style={styles.compactCardSubtitle}>
              초경량 ZIP 압축 백업 파일 내보내기 및 자동 복원
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

      {/* ⚠️ 데이터 클린 초기화 */}
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

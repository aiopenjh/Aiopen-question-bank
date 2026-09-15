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
            <Text style={styles.compactCardTitle}>데이터 백업 & 인쇄용 문제집</Text>
            <Text style={styles.compactCardSubtitle}>
              API 키 제외 전체 백업 · A4 문제지, 해설지, 오답노트 동봉
            </Text>
          </View>
          <View style={styles.compactBtnGroup}>
            <TouchableOpacity
              style={styles.miniBtnPrimary}
              onPress={onExportBackup}
              activeOpacity={0.7}
            >
              <Text style={styles.miniBtnPrimaryText}>백업/출력</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.miniBtnSecondary}
              onPress={onOpenRestoreModal}
              activeOpacity={0.7}
            >
              <Text style={styles.miniBtnSecondaryText}>복원</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ⚠️ 데이터 클린 초기화 */}
      <View style={[styles.compactCard, styles.resetCard]}>
        <View style={styles.compactCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.compactCardTitle, styles.resetTitle]}>전체 데이터 초기화</Text>
          </View>
          <TouchableOpacity
            style={styles.miniResetBtn}
            onPress={onResetAllData}
            activeOpacity={0.7}
          >
            <Text style={styles.miniResetBtnText}>초기화</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
};

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { styles } from './settingsStyles';
import { APP_BUILD_INFO } from '../../constants/buildInfo';

export interface AppVersionSectionProps {
  hasUpdate: boolean;
  isChecking: boolean;
  latestVersion?: string;
  onCheckForUpdate: () => void;
  onApplyUpdate: () => void;
}

export const AppVersionSection: React.FC<AppVersionSectionProps> = ({
  hasUpdate,
  isChecking,
  latestVersion,
  onCheckForUpdate,
  onApplyUpdate,
}) => {
  return (
    <View style={styles.compactCard}>
      <View style={styles.compactCardHeader}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.compactCardTitle}>앱 버전 및 최신 갱신</Text>
          <Text style={styles.compactCardSubtitle}>
            현재 버전: {APP_BUILD_INFO.buildLabel}
            {hasUpdate && ` → ${latestVersion || '새 버전'} 발견!`}
          </Text>
        </View>

        <View style={styles.compactBtnGroup}>
          {hasUpdate ? (
            <TouchableOpacity
              style={[styles.miniBtnPrimary, styles.updateButton]}
              onPress={onApplyUpdate}
              activeOpacity={0.7}
            >
              <Text style={styles.miniBtnPrimaryText}>1초 갱신</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.miniBtnSecondary}
              onPress={onCheckForUpdate}
              disabled={isChecking}
              activeOpacity={0.7}
            >
              {isChecking ? (
                <ActivityIndicator size="small" color="#64748b" />
              ) : (
                <Text style={styles.miniBtnSecondaryText}>갱신 확인</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

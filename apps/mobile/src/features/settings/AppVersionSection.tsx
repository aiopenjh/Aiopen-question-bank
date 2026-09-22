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
    <View style={styles.versionFooter}>
      <View style={styles.versionFooterRow}>
        <Text style={styles.versionFooterInlineText}>
          버전 v{APP_BUILD_INFO.version}
          {hasUpdate && ` · ${latestVersion || '새 버전'} 갱신 가능`}
        </Text>

        <View style={styles.compactBtnGroup}>
          {hasUpdate ? (
            <TouchableOpacity
              style={[styles.versionFooterButton, styles.updateButton]}
              onPress={onApplyUpdate}
              activeOpacity={0.7}
            >
              <Text style={styles.versionFooterButtonTextActive}>갱신</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.versionFooterButton}
              onPress={onCheckForUpdate}
              disabled={isChecking}
              activeOpacity={0.7}
            >
              {isChecking ? (
                <ActivityIndicator size="small" color="#64748b" />
              ) : (
                <Text style={styles.versionFooterButtonText}>갱신</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

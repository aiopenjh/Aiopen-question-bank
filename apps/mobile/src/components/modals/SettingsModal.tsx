/**
 * Settings Modal Wrapper Component
 */

import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlarmConfig } from '../../utils/notifications';
import { SettingsScreen } from '../../features/settings/SettingsScreen';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { appStyles as styles } from '../../styles/appStyles';

export interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  apiKey: string;
  onChangeApiKey: (text: string) => void;
  onSaveApiKey: (keyToSave?: string) => Promise<void>;
  onDeleteApiKey: () => Promise<void>;
  alarmConfig: AlarmConfig;
  onChangeAlarmConfig: (config: AlarmConfig) => void;
  targetQuestionCount?: number;
  onChangeTargetQuestionCount?: (count: number) => void;
  onExportBackup: () => Promise<void>;
  onOpenRestoreModal: () => void;
  onResetAllData: () => void;
  onSaveSettings: () => Promise<void>;
  onOpenUserManual?: () => void;
  hasUpdate?: boolean;
  isCheckingUpdate?: boolean;
  latestVersion?: string;
  onCheckForUpdate?: () => void;
  onApplyUpdate?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  // 왼쪽으로 스와이프하면 메인 화면으로 복귀
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: props.onClose,
  });

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      onRequestClose={props.onClose}
    >
      <SafeAreaView style={styles.fullModalContainer} {...swipeHandlers}>
        <View style={styles.fullModalHeader}>
          {/* 1. 뒤로가기 버튼 */}
          <TouchableOpacity
            style={styles.fullModalBackBtn}
            onPress={props.onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.fullModalBackBtnText}>← 뒤로</Text>
          </TouchableOpacity>

          {/* 2. 화면 타이틀 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 18 }}>⚙️</Text>
            <Text style={styles.fullModalTitle}>환경설정</Text>
          </View>

          {/* 3. 저장 버튼 */}
          <TouchableOpacity
            style={styles.fullModalSaveBtn}
            onPress={props.onSaveSettings}
            activeOpacity={0.8}
          >
            <Text style={styles.fullModalSaveBtnText}>💾 저장</Text>
          </TouchableOpacity>
        </View>
        <SettingsScreen
          apiKey={props.apiKey}
          onChangeApiKey={props.onChangeApiKey}
          onSaveApiKey={props.onSaveApiKey}
          onDeleteApiKey={props.onDeleteApiKey}
          alarmConfig={props.alarmConfig}
          onChangeAlarmConfig={props.onChangeAlarmConfig}
          targetQuestionCount={props.targetQuestionCount}
          onChangeTargetQuestionCount={props.onChangeTargetQuestionCount}
          onExportBackup={props.onExportBackup}
          onOpenRestoreModal={props.onOpenRestoreModal}
          onResetAllData={props.onResetAllData}
          onOpenUserManual={props.onOpenUserManual}
          hasUpdate={props.hasUpdate}
          isCheckingUpdate={props.isCheckingUpdate}
          latestVersion={props.latestVersion}
          onCheckForUpdate={props.onCheckForUpdate}
          onApplyUpdate={props.onApplyUpdate}
        />
      </SafeAreaView>
    </Modal>
  );
};

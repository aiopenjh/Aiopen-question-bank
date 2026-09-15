/**
 * Settings Modal Wrapper Component
 */

import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlarmConfig } from '../../utils/notifications';
import { SettingsScreen } from '../../features/settings/SettingsScreen';
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
}

export const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      onRequestClose={props.onClose}
    >
      <SafeAreaView style={styles.fullModalContainer}>
        <View style={styles.fullModalHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 20 }}>⚙️</Text>
            <Text style={styles.fullModalTitle}>환경설정 & AI 모델 관리</Text>
          </View>
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
        />
      </SafeAreaView>
    </Modal>
  );
};

import React from 'react';
import { ScrollView } from 'react-native';
import { AlarmConfig, DEFAULT_ALARM_CONFIG } from '../../utils/notifications';
import { styles } from './settingsStyles';
import { ApiKeySection } from './ApiKeySection';
import { AlarmConfigSection } from './AlarmConfigSection';
import { DataBackupSection } from './DataBackupSection';

interface SettingsScreenProps {
  apiKey: string;
  onChangeApiKey: (text: string) => void;
  onSaveApiKey: (keyToSave?: string) => Promise<void>;
  onDeleteApiKey?: () => Promise<void>;
  alarmConfig?: AlarmConfig;
  onChangeAlarmConfig?: (config: AlarmConfig) => void;
  onExportBackup: () => Promise<void>;
  onOpenRestoreModal: () => void;
  onResetAllData: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  apiKey,
  onChangeApiKey,
  onSaveApiKey,
  onDeleteApiKey,
  alarmConfig = DEFAULT_ALARM_CONFIG,
  onChangeAlarmConfig,
  onExportBackup,
  onOpenRestoreModal,
  onResetAllData,
}) => {
  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding}>
      {/* 1. API Key 연결 상태 카드 */}
      <ApiKeySection
        apiKey={apiKey}
        onChangeApiKey={onChangeApiKey}
        onSaveApiKey={onSaveApiKey}
        onDeleteApiKey={onDeleteApiKey}
      />

      {/* 2. 평일 정기 학습 알람 카드 */}
      <AlarmConfigSection
        alarmConfig={alarmConfig}
        onChangeAlarmConfig={onChangeAlarmConfig}
      />

      {/* 3. 데이터 백업 및 복원, 클린 초기화 */}
      <DataBackupSection
        onExportBackup={onExportBackup}
        onOpenRestoreModal={onOpenRestoreModal}
        onResetAllData={onResetAllData}
      />
    </ScrollView>
  );
};

import React from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { AlarmConfig, DEFAULT_ALARM_CONFIG } from '../../utils/notifications';
import { styles } from './settingsStyles';
import { ApiKeySection } from './ApiKeySection';
import { AlarmConfigSection } from './AlarmConfigSection';
import { DailyGoalSection } from './DailyGoalSection';
import { DataBackupSection } from './DataBackupSection';

interface SettingsScreenProps {
  apiKey: string;
  onChangeApiKey: (text: string) => void;
  onSaveApiKey: (keyToSave?: string) => Promise<void>;
  onDeleteApiKey?: () => Promise<void>;
  alarmConfig?: AlarmConfig;
  onChangeAlarmConfig?: (config: AlarmConfig) => void;
  targetQuestionCount?: number;
  onChangeTargetQuestionCount?: (count: number) => void;
  onExportBackup: () => Promise<void>;
  onOpenRestoreModal: () => void;
  onResetAllData: () => void;
  onOpenUserManual?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  apiKey,
  onChangeApiKey,
  onSaveApiKey,
  onDeleteApiKey,
  alarmConfig = DEFAULT_ALARM_CONFIG,
  onChangeAlarmConfig,
  targetQuestionCount = 3,
  onChangeTargetQuestionCount,
  onExportBackup,
  onOpenRestoreModal,
  onResetAllData,
  onOpenUserManual,
}) => {
  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding}>
      {/* 0. 앱 공식 이용 가이드 & 사용설명서 배너 */}
      {onOpenUserManual && (
        <TouchableOpacity style={styles.manualBanner} onPress={onOpenUserManual} activeOpacity={0.8}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 24 }}>📖</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.manualBannerTitle}>앱 공식 이용 가이드 & 사용설명서</Text>
              <Text style={styles.manualBannerSub}>교재 업로드, 30단계 커리큘럼, 오답노트 활용법</Text>
            </View>
            <Text style={styles.manualBannerArrow}>열기 ➔</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* 1. 정기 학습 알람 카드 */}
      <AlarmConfigSection
        alarmConfig={alarmConfig}
        onChangeAlarmConfig={onChangeAlarmConfig}
      />

      {/* 2. 일일 학습 목표 문제 수 설정 카드 (알람 바로 아래) */}
      {onChangeTargetQuestionCount && (
        <DailyGoalSection
          targetCount={targetQuestionCount}
          onChangeTargetCount={onChangeTargetQuestionCount}
        />
      )}

      {/* 3. API Key 연결 상태 카드 (슬림하게 아래로 배치하여 가림 효과) */}
      <ApiKeySection
        apiKey={apiKey}
        onChangeApiKey={onChangeApiKey}
        onSaveApiKey={onSaveApiKey}
        onDeleteApiKey={onDeleteApiKey}
      />

      {/* 4. 데이터 백업 및 복원, 클린 초기화 */}
      <DataBackupSection
        onExportBackup={onExportBackup}
        onOpenRestoreModal={onOpenRestoreModal}
        onResetAllData={onResetAllData}
      />
    </ScrollView>
  );
};

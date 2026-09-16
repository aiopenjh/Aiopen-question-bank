import React from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { AlarmConfig, DEFAULT_ALARM_CONFIG } from '../../utils/notifications';
import { styles } from './settingsStyles';
import { ApiKeySection } from './ApiKeySection';
import { AlarmConfigSection } from './AlarmConfigSection';
import { DailyGoalSection } from './DailyGoalSection';
import { DataBackupSection } from './DataBackupSection';
import { AppVersionSection } from './AppVersionSection';

interface SettingsGroupProps {
  index: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

const SettingsGroup: React.FC<SettingsGroupProps> = ({
  index,
  title,
  description,
  children,
}) => (
  <View style={styles.settingsGroup}>
    <View style={styles.groupHeader}>
      <Text style={styles.groupIndex}>{index}</Text>
      <View style={styles.groupHeaderCopy}>
        <Text style={styles.groupTitle}>{title}</Text>
        <Text style={styles.groupDescription}>{description}</Text>
      </View>
    </View>
    {children}
  </View>
);

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
  hasUpdate?: boolean;
  isCheckingUpdate?: boolean;
  latestVersion?: string;
  onCheckForUpdate?: () => void;
  onApplyUpdate?: () => void;
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
  hasUpdate = false,
  isCheckingUpdate = false,
  latestVersion,
  onCheckForUpdate,
  onApplyUpdate,
}) => {
  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding}>
      <View style={styles.pageIntro}>
        <Text style={styles.pageEyebrow}>MY STUDY SETTINGS</Text>
        <Text style={styles.pageTitle}>나에게 맞는 학습 환경</Text>
        <Text style={styles.pageDescription}>
          학습 루틴부터 데이터 보관까지, 필요한 설정을 한곳에서 관리하세요.
        </Text>
      </View>

      <SettingsGroup
        index="01"
        title="학습 루틴"
        description="매일 풀 문제 수와 알림 시간을 정합니다."
      >
        {onChangeTargetQuestionCount && (
          <DailyGoalSection
            targetCount={targetQuestionCount}
            onChangeTargetCount={onChangeTargetQuestionCount}
          />
        )}
        <AlarmConfigSection
          alarmConfig={alarmConfig}
          onChangeAlarmConfig={onChangeAlarmConfig}
        />
      </SettingsGroup>

      <SettingsGroup
        index="02"
        title="AI 연결"
        description="문제 생성에 사용할 AI 연결 상태를 관리합니다."
      >
        <ApiKeySection
          apiKey={apiKey}
          onChangeApiKey={onChangeApiKey}
          onSaveApiKey={onSaveApiKey}
          onDeleteApiKey={onDeleteApiKey}
        />
      </SettingsGroup>

      <SettingsGroup
        index="03"
        title="데이터 관리"
        description="학습 기록을 백업하거나 기존 데이터를 복원합니다."
      >
        <DataBackupSection
          onExportBackup={onExportBackup}
          onOpenRestoreModal={onOpenRestoreModal}
          onResetAllData={onResetAllData}
        />
      </SettingsGroup>

      <SettingsGroup
        index="04"
        title="앱 정보"
        description="사용 가이드와 현재 앱 버전을 확인합니다."
      >
        {onOpenUserManual && (
          <TouchableOpacity style={styles.manualBanner} onPress={onOpenUserManual} activeOpacity={0.8}>
            <View style={styles.manualBannerRow}>
              <View style={styles.manualBadge}>
                <Text style={styles.manualBadgeText}>GUIDE</Text>
              </View>
              <View style={styles.manualBannerCopy}>
                <Text style={styles.manualBannerTitle}>앱 공식 이용 가이드 & 사용설명서</Text>
                <Text style={styles.manualBannerSub}>교재 업로드, 30단원 이상 커리큘럼, 오답노트 활용법</Text>
              </View>
              <Text style={styles.manualBannerArrow}>열기 ›</Text>
            </View>
          </TouchableOpacity>
        )}
        {onCheckForUpdate && onApplyUpdate && (
          <AppVersionSection
            hasUpdate={hasUpdate}
            isChecking={isCheckingUpdate}
            latestVersion={latestVersion}
            onCheckForUpdate={onCheckForUpdate}
            onApplyUpdate={onApplyUpdate}
          />
        )}
      </SettingsGroup>
    </ScrollView>
  );
};

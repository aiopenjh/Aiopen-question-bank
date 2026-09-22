import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { AlarmConfig, DEFAULT_ALARM_CONFIG } from '../../utils/notifications';
import { styles } from './settingsStyles';
import { PullRefreshIndicator } from '../../components/common/PullRefreshIndicator';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { ApiKeySection } from './ApiKeySection';
import { AlarmConfigSection } from './AlarmConfigSection';
import { DailyGoalSection } from './DailyGoalSection';
import { DataBackupSection } from './DataBackupSection';
import { AppVersionSection } from './AppVersionSection';
import { FeedbackCard } from '../study/FeedbackCard';
import { DAILY_GOAL_DEFAULT } from '../../domain/daily_goal';

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
  onOpenFeedback?: () => void;
  refreshing?: boolean;
  onRefresh?: () => Promise<void> | void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  apiKey,
  onChangeApiKey,
  onSaveApiKey,
  onDeleteApiKey,
  alarmConfig = DEFAULT_ALARM_CONFIG,
  onChangeAlarmConfig,
  targetQuestionCount = DAILY_GOAL_DEFAULT,
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
  onOpenFeedback,
  refreshing = false,
  onRefresh,
}) => {
  const { pullDistance, handleScroll, touchHandlers } = usePullToRefresh({
    refreshing,
    onRefresh,
  });

  return (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={[styles.scrollPadding, { flexGrow: 1 }]}
      bounces={true}
      alwaysBounceVertical={true}
      overScrollMode="always"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      {...touchHandlers}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#f43f5e', '#be123c']}
            tintColor="#f43f5e"
            titleColor="#be123c"
            progressBackgroundColor="#ffffff"
            progressViewOffset={Platform.OS === 'android' ? 20 : 0}
          />
        ) : undefined
      }
    >
      <PullRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
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
                <Text style={styles.manualBannerSub}>문제 출제, 목표·알림, 자료함, 백업과 홈 화면 추가 안내</Text>
              </View>
              <View style={styles.manualBannerButton}>
                <Text style={styles.manualBannerButtonText}>열기 ›</Text>
              </View>
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

      <FeedbackCard compact onOpen={onOpenFeedback} />
    </ScrollView>
  );
};

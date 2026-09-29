import React from 'react';
import { Image, ScrollView, View, Text, TextInput, TouchableOpacity, RefreshControl, Keyboard, Platform, Linking, type LayoutChangeEvent } from 'react-native';
import { AlarmConfig, DEFAULT_ALARM_CONFIG } from '../../utils/notifications';
import { styles } from './settingsStyles';
import { PullRefreshIndicator } from '../../components/common/PullRefreshIndicator';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { ApiKeySection } from './ApiKeySection';
import { AlarmConfigSection } from './AlarmConfigSection';
import { DailyGoalSection } from './DailyGoalSection';
import { DataBackupSection } from './DataBackupSection';
import type { BackupKind } from '../../data/db';
import { AppVersionSection } from './AppVersionSection';
import { FeedbackCard } from '../study/FeedbackCard';
import { DAILY_GOAL_DEFAULT } from '../../domain/daily_goal';
import { PRIVACY_POLICY_URL } from '../../constants/buildInfo';
import type { QuestionRevision, Topic, Unit } from '../../contracts/types';

interface SettingsGroupProps {
  index: string;
  title: string;
  description: string;
  children: React.ReactNode;
  collapsible?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
}

const SettingsGroup: React.FC<SettingsGroupProps> = ({
  index,
  title,
  description,
  children,
  collapsible = false,
  onLayout,
}) => {
  const [expanded, setExpanded] = React.useState(!collapsible);
  const headerContents = (
    <>
      <Text style={styles.groupIndex}>{index}</Text>
      <View style={styles.groupHeaderCopy}>
        <Text style={styles.groupTitle}>{title}</Text>
        <Text style={styles.groupDescription}>{description}</Text>
      </View>
      {collapsible && <Text style={styles.groupChevron}>{expanded ? '⌃' : '⌄'}</Text>}
    </>
  );

  return (
    <View style={styles.settingsGroup} onLayout={onLayout}>
      {collapsible ? (
        <TouchableOpacity
          style={[styles.groupHeader, !expanded && styles.groupHeaderCollapsed]}
          onPress={() => setExpanded((current) => !current)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          {headerContents}
        </TouchableOpacity>
      ) : (
        <View style={styles.groupHeader}>{headerContents}</View>
      )}
      {expanded && children}
    </View>
  );
};

interface SettingsScreenProps {
  apiKey: string;
  onChangeApiKey: (text: string) => void;
  onSaveApiKey: (keyToSave?: string) => Promise<void>;
  onDeleteApiKey?: () => Promise<void>;
  alarmConfig?: AlarmConfig;
  onChangeAlarmConfig?: (config: AlarmConfig) => void;
  targetQuestionCount?: number;
  onChangeTargetQuestionCount?: (count: number) => void;
  onExportBackup: (backupKind?: BackupKind) => Promise<void>;
  onOpenRestoreModal: () => void;
  onResetAllData: () => void;
  topics?: Topic[];
  units?: Unit[];
  questions?: QuestionRevision[];
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
  topics = [],
  units = [],
  questions = [],
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
  const scrollRef = React.useRef<ScrollView>(null);
  const focusedApiInputRef = React.useRef<TextInput | null>(null);
  const keyboardTopRef = React.useRef<number | null>(null);
  const scrollYRef = React.useRef(0);
  const revealTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [keyboardPadding, setKeyboardPadding] = React.useState(0);

  function revealApiInput() {
    const input = focusedApiInputRef.current;
    const keyboardTop = keyboardTopRef.current;
    if (!input || keyboardTop === null) return;
    input.measureInWindow((_x, y, _width, height) => {
      const overlap = y + height + 24 - keyboardTop;
      if (overlap <= 0) return;
      const targetY = scrollYRef.current + overlap;
      scrollYRef.current = targetY;
      scrollRef.current?.scrollTo({ y: targetY, animated: true });
    });
  }

  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardTopRef.current = event.endCoordinates.screenY;
      setKeyboardPadding(event.endCoordinates.height + 48);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      revealTimerRef.current = setTimeout(revealApiInput, 80);
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTopRef.current = null;
      setKeyboardPadding(0);
    });
    return () => {
      shown.remove();
      hidden.remove();
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.tabContent}
      contentContainerStyle={[styles.scrollPadding, { flexGrow: 1 }, keyboardPadding > 0 && { paddingBottom: keyboardPadding }]}
      bounces={true}
      alwaysBounceVertical={true}
      overScrollMode="always"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      onScroll={(event) => {
        scrollYRef.current = event.nativeEvent.contentOffset.y;
        handleScroll(event);
      }}
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
      <View style={styles.settingsPanel}>
        <View style={styles.settingsWatermarkStage} pointerEvents="none">
          <Image
            source={require('../../../assets/android-icon-foreground-v2.png')}
            resizeMode="contain"
            style={styles.settingsWatermarkImage}
            accessible={false}
          />
          <View style={styles.settingsWatermarkLetters}>
            {Array.from('Celueste').map((letter, index) => (
              <Text
                key={`${letter}-${index}`}
                style={[
                  styles.settingsWatermarkLetter,
                  { transform: [{ translateY: index * 32 }] },
                ]}
              >
                {letter}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.settingsPanelContent}>
        <View style={styles.pageIntro}>
        <View style={styles.pageIntroRow}>
          <View style={styles.pageIntroCopy}>
            <Text style={styles.pageEyebrow}>MY STUDY SETTINGS</Text>
            <Text style={styles.pageTitle}>나에게 맞는 학습 환경</Text>
            <Text style={styles.pageDescription}>
              학습 루틴부터 데이터 보관까지, 필요한 설정을 한곳에서 관리하세요.
            </Text>
          </View>
          {onOpenUserManual && (
            <TouchableOpacity style={styles.manualHeaderLink} onPress={onOpenUserManual} activeOpacity={0.75}>
              <Text style={styles.manualHeaderLinkText}>사용설명서</Text>
              <Text style={styles.manualHeaderLinkArrow}>›</Text>
            </TouchableOpacity>
          )}
        </View>
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
        collapsible
      >
        <ApiKeySection
          apiKey={apiKey}
          onChangeApiKey={onChangeApiKey}
          onSaveApiKey={onSaveApiKey}
          onDeleteApiKey={onDeleteApiKey}
          onInputFocus={(input) => {
            focusedApiInputRef.current = input;
            if (Platform.OS === 'android') revealApiInput();
          }}
        />
      </SettingsGroup>

      <SettingsGroup
        index="03"
        title="데이터 관리"
        description="문제집 PDF를 만들거나 문제은행 데이터를 백업·복원합니다."
        collapsible
      >
        <DataBackupSection
          onExportBackup={onExportBackup}
          onOpenRestoreModal={onOpenRestoreModal}
          onResetAllData={onResetAllData}
          topics={topics}
          units={units}
          questions={questions}
        />
      </SettingsGroup>

        {!!PRIVACY_POLICY_URL && (
          <View style={styles.manualLinkSection}>
            <TouchableOpacity
              style={styles.manualLinkRow}
              onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
              activeOpacity={0.75}
            >
              <Text style={styles.manualLinkText}>개인정보 처리방침</Text>
              <Text style={styles.manualLinkArrow}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.feedbackSection}>
          <FeedbackCard compact onOpen={onOpenFeedback} />
          {onCheckForUpdate && onApplyUpdate && (
            <AppVersionSection
              hasUpdate={hasUpdate}
              isChecking={isCheckingUpdate}
              latestVersion={latestVersion}
              onCheckForUpdate={onCheckForUpdate}
              onApplyUpdate={onApplyUpdate}
            />
          )}
        </View>
        </View>
      </View>
    </ScrollView>
  );
};

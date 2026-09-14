import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { AlarmConfig } from '../../utils/notifications';
import { styles } from './settingsStyles';

export interface AlarmConfigSectionProps {
  alarmConfig: AlarmConfig;
  onChangeAlarmConfig?: (config: AlarmConfig) => void;
}

export const AlarmConfigSection: React.FC<AlarmConfigSectionProps> = ({
  alarmConfig,
  onChangeAlarmConfig,
}) => {
  function updateAlarm(patch: Partial<AlarmConfig>) {
    if (onChangeAlarmConfig) {
      onChangeAlarmConfig({ ...alarmConfig, ...patch });
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.alarmCardHeader}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.cardSectionTitle}>⏰ 평일 정기 학습 알람</Text>
          <Text style={styles.alarmSubGuide}>
            평일(월~금) 원하는 시간대를 직접 선택하고 켜거나 끌 수 있습니다.
          </Text>
        </View>
        <View style={styles.alarmActiveBadge}>
          <Text style={styles.alarmActiveBadgeText}>🔔 월~금 알람</Text>
        </View>
      </View>

      {/* 1. 오전 알람 (범위: 8시 ~ 11시, 기본 8시) */}
      <View style={[styles.alarmItemBlock, !alarmConfig.morningEnabled && styles.alarmItemBlockDisabled]}>
        <View style={styles.alarmItemTopRow}>
          <View style={styles.alarmItemLeft}>
            <Text style={{ fontSize: 18 }}>🌅</Text>
            <View>
              <Text style={[styles.alarmItemTitle, !alarmConfig.morningEnabled && { color: '#94a3b8' }]}>
                오전 알람
              </Text>
              <Text style={styles.alarmItemSubText}>선택 가능: 08:00 ~ 11:00</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.alarmToggleBtn,
              alarmConfig.morningEnabled ? styles.alarmToggleOn : styles.alarmToggleOff,
            ]}
            onPress={() => updateAlarm({ morningEnabled: !alarmConfig.morningEnabled })}
            activeOpacity={0.8}
          >
            <Text style={alarmConfig.morningEnabled ? styles.alarmToggleTextOn : styles.alarmToggleTextOff}>
              {alarmConfig.morningEnabled ? '🔔 활성화' : '🔕 끔'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.alarmControlRow, !alarmConfig.morningEnabled && styles.alarmControlRowDisabled]}>
          <TouchableOpacity
            style={[
              styles.stepperArrowBtn,
              (!alarmConfig.morningEnabled || alarmConfig.morningHour <= 8) && styles.stepperArrowBtnDisabled,
            ]}
            onPress={() => {
              if (alarmConfig.morningHour > 8) {
                updateAlarm({ morningHour: alarmConfig.morningHour - 1 });
              }
            }}
            disabled={!alarmConfig.morningEnabled || alarmConfig.morningHour <= 8}
          >
            <Text
              style={[
                styles.stepperArrowText,
                (!alarmConfig.morningEnabled || alarmConfig.morningHour <= 8) && styles.stepperArrowTextDisabled,
              ]}
            >
              ◀
            </Text>
          </TouchableOpacity>

          <View style={styles.timeDisplayCenter}>
            <Text style={[styles.timeDisplayText, !alarmConfig.morningEnabled && { color: '#94a3b8' }]}>
              {String(alarmConfig.morningHour).padStart(2, '0')}:00
            </Text>
            <Text style={[styles.timeDisplaySub, !alarmConfig.morningEnabled && { color: '#cbd5e1' }]}>
              오전 {alarmConfig.morningHour}시
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.stepperArrowBtn,
              (!alarmConfig.morningEnabled || alarmConfig.morningHour >= 11) && styles.stepperArrowBtnDisabled,
            ]}
            onPress={() => {
              if (alarmConfig.morningHour < 11) {
                updateAlarm({ morningHour: alarmConfig.morningHour + 1 });
              }
            }}
            disabled={!alarmConfig.morningEnabled || alarmConfig.morningHour >= 11}
          >
            <Text
              style={[
                styles.stepperArrowText,
                (!alarmConfig.morningEnabled || alarmConfig.morningHour >= 11) && styles.stepperArrowTextDisabled,
              ]}
            >
              ▶
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. 저녁 알람 (범위: 19시 ~ 21시, 기본 20시) */}
      <View style={[styles.alarmItemBlock, !alarmConfig.eveningEnabled && styles.alarmItemBlockDisabled]}>
        <View style={styles.alarmItemTopRow}>
          <View style={styles.alarmItemLeft}>
            <Text style={{ fontSize: 18 }}>🌙</Text>
            <View>
              <Text style={[styles.alarmItemTitle, !alarmConfig.eveningEnabled && { color: '#94a3b8' }]}>
                저녁 알람
              </Text>
              <Text style={styles.alarmItemSubText}>선택 가능: 19:00 ~ 21:00</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.alarmToggleBtn,
              alarmConfig.eveningEnabled ? styles.alarmToggleOn : styles.alarmToggleOff,
            ]}
            onPress={() => updateAlarm({ eveningEnabled: !alarmConfig.eveningEnabled })}
            activeOpacity={0.8}
          >
            <Text style={alarmConfig.eveningEnabled ? styles.alarmToggleTextOn : styles.alarmToggleTextOff}>
              {alarmConfig.eveningEnabled ? '🔔 활성화' : '🔕 끔'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.alarmControlRow, !alarmConfig.eveningEnabled && styles.alarmControlRowDisabled]}>
          <TouchableOpacity
            style={[
              styles.stepperArrowBtn,
              (!alarmConfig.eveningEnabled || alarmConfig.eveningHour <= 19) && styles.stepperArrowBtnDisabled,
            ]}
            onPress={() => {
              if (alarmConfig.eveningHour > 19) {
                updateAlarm({ eveningHour: alarmConfig.eveningHour - 1 });
              }
            }}
            disabled={!alarmConfig.eveningEnabled || alarmConfig.eveningHour <= 19}
          >
            <Text
              style={[
                styles.stepperArrowText,
                (!alarmConfig.eveningEnabled || alarmConfig.eveningHour <= 19) && styles.stepperArrowTextDisabled,
              ]}
            >
              ◀
            </Text>
          </TouchableOpacity>

          <View style={styles.timeDisplayCenter}>
            <Text style={[styles.timeDisplayText, !alarmConfig.eveningEnabled && { color: '#94a3b8' }]}>
              {alarmConfig.eveningHour}:00
            </Text>
            <Text style={[styles.timeDisplaySub, !alarmConfig.eveningEnabled && { color: '#cbd5e1' }]}>
              저녁 {alarmConfig.eveningHour > 12 ? alarmConfig.eveningHour - 12 : alarmConfig.eveningHour}시
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.stepperArrowBtn,
              (!alarmConfig.eveningEnabled || alarmConfig.eveningHour >= 21) && styles.stepperArrowBtnDisabled,
            ]}
            onPress={() => {
              if (alarmConfig.eveningHour < 21) {
                updateAlarm({ eveningHour: alarmConfig.eveningHour + 1 });
              }
            }}
            disabled={!alarmConfig.eveningEnabled || alarmConfig.eveningHour >= 21}
          >
            <Text
              style={[
                styles.stepperArrowText,
                (!alarmConfig.eveningEnabled || alarmConfig.eveningHour >= 21) && styles.stepperArrowTextDisabled,
              ]}
            >
              ▶
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

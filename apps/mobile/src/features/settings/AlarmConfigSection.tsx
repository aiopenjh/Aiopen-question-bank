import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { AlarmConfig, DayOfWeek, ALL_DAYS } from '../../utils/notifications';
import { styles } from './settingsStyles';

export interface AlarmConfigSectionProps {
  alarmConfig: AlarmConfig;
  onChangeAlarmConfig?: (config: AlarmConfig) => void;
}

interface AlarmTimeSlotRowProps {
  icon: string;
  title: string;
  subText: string;
  enabled: boolean;
  hour: number;
  minHour: number;
  maxHour: number;
  periodLabel: string;
  onToggle: () => void;
  onChangeHour: (h: number) => void;
}

const AlarmTimeSlotRow: React.FC<AlarmTimeSlotRowProps> = ({
  icon,
  title,
  subText,
  enabled,
  hour,
  minHour,
  maxHour,
  periodLabel,
  onToggle,
  onChangeHour,
}) => {
  const displayHourText = hour > 12 ? `${periodLabel} ${hour - 12}시` : `${periodLabel} ${hour}시`;
  const timeFormatted = `${String(hour).padStart(2, '0')}:00`;

  return (
    <View style={[styles.alarmItemBlock, !enabled && styles.alarmItemBlockDisabled]}>
      <View style={styles.alarmItemTopRow}>
        <View style={styles.alarmItemLeft}>
          <Text style={{ fontSize: 18 }}>{icon}</Text>
          <View>
            <Text style={[styles.alarmItemTitle, !enabled && { color: '#94a3b8' }]}>{title}</Text>
            <Text style={styles.alarmItemSubText}>{subText}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.alarmToggleBtn, enabled ? styles.alarmToggleOn : styles.alarmToggleOff]}
          onPress={onToggle}
          activeOpacity={0.8}
        >
          <Text style={enabled ? styles.alarmToggleTextOn : styles.alarmToggleTextOff}>
            {enabled ? '🔔 활성화' : '🔕 끔'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.alarmControlRow, !enabled && styles.alarmControlRowDisabled]}>
        <TouchableOpacity
          style={[styles.stepperArrowBtn, (!enabled || hour <= minHour) && styles.stepperArrowBtnDisabled]}
          onPress={() => {
            if (hour > minHour) onChangeHour(hour - 1);
          }}
          disabled={!enabled || hour <= minHour}
        >
          <Text style={[styles.stepperArrowText, (!enabled || hour <= minHour) && styles.stepperArrowTextDisabled]}>
            ◀
          </Text>
        </TouchableOpacity>

        <View style={styles.timeDisplayCenter}>
          <Text style={[styles.timeDisplayText, !enabled && { color: '#94a3b8' }]}>{timeFormatted}</Text>
          <Text style={[styles.timeDisplaySub, !enabled && { color: '#cbd5e1' }]}>{displayHourText}</Text>
        </View>

        <TouchableOpacity
          style={[styles.stepperArrowBtn, (!enabled || hour >= maxHour) && styles.stepperArrowBtnDisabled]}
          onPress={() => {
            if (hour < maxHour) onChangeHour(hour + 1);
          }}
          disabled={!enabled || hour >= maxHour}
        >
          <Text style={[styles.stepperArrowText, (!enabled || hour >= maxHour) && styles.stepperArrowTextDisabled]}>
            ▶
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const AlarmConfigSection: React.FC<AlarmConfigSectionProps> = ({
  alarmConfig,
  onChangeAlarmConfig,
}) => {
  function updateAlarm(patch: Partial<AlarmConfig>) {
    if (onChangeAlarmConfig) {
      onChangeAlarmConfig({ ...alarmConfig, ...patch });
    }
  }

  const selectedDays: DayOfWeek[] =
    alarmConfig.selectedDays && alarmConfig.selectedDays.length > 0
      ? alarmConfig.selectedDays
      : alarmConfig.weekendEnabled
      ? ALL_DAYS
      : ['월', '화', '수', '목', '금'];

  function toggleDay(day: DayOfWeek) {
    const isSelected = selectedDays.includes(day);
    const nextDays = isSelected
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day];

    // 요일 순서대로 정렬 (월~일)
    nextDays.sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b));

    updateAlarm({
      selectedDays: nextDays,
      weekendEnabled: nextDays.includes('토') || nextDays.includes('일'),
    });
  }

  const getBadgeText = () => {
    if (selectedDays.length === 0) return '🔕 알람 꺼짐';
    if (selectedDays.length === 7) return '🔔 매일(월~일)';
    const isStandardWeekday =
      selectedDays.length === 5 &&
      ['월', '화', '수', '목', '금'].every((d) => selectedDays.includes(d as DayOfWeek));
    if (isStandardWeekday) return '🔔 평일(월~금)';
    return `🔔 ${selectedDays.join('·')} 선택됨`;
  };

  return (
    <View style={styles.card}>
      {/* 1. 카드 헤더 */}
      <View style={styles.alarmCardHeader}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.cardSectionTitle}>⏰ 정기 학습 알람</Text>
          <Text style={styles.alarmSubGuide}>
            원하는 요일을 탭하여 자유롭게 알람 요일을 설정하세요.
          </Text>
        </View>
        <View style={styles.alarmActiveBadge}>
          <Text style={styles.alarmActiveBadgeText}>{getBadgeText()}</Text>
        </View>
      </View>

      {/* 2. 월~일 7개 요일 직접 선택 버튼 (깔끔한 한 줄 배치) */}
      <View style={styles.dayChipsContainer}>
        {ALL_DAYS.map((day) => {
          const isSelected = selectedDays.includes(day);
          return (
            <TouchableOpacity
              key={day}
              style={[styles.dayChipBtn, isSelected ? styles.dayChipBtnActive : styles.dayChipBtnInactive]}
              onPress={() => toggleDay(day)}
              activeOpacity={0.7}
            >
              <Text style={isSelected ? styles.dayChipBtnTextActive : styles.dayChipBtnTextInactive}>
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. 오전 알람 */}
      <AlarmTimeSlotRow
        icon="🌅"
        title="오전 알람"
        subText="선택 가능: 08:00 ~ 11:00"
        enabled={alarmConfig.morningEnabled}
        hour={alarmConfig.morningHour}
        minHour={8}
        maxHour={11}
        periodLabel="오전"
        onToggle={() => updateAlarm({ morningEnabled: !alarmConfig.morningEnabled })}
        onChangeHour={(h) => updateAlarm({ morningHour: h })}
      />

      {/* 4. 저녁 알람 */}
      <AlarmTimeSlotRow
        icon="🌙"
        title="저녁 알람"
        subText="선택 가능: 19:00 ~ 21:00"
        enabled={alarmConfig.eveningEnabled}
        hour={alarmConfig.eveningHour}
        minHour={19}
        maxHour={21}
        periodLabel="저녁"
        onToggle={() => updateAlarm({ eveningEnabled: !alarmConfig.eveningEnabled })}
        onChangeHour={(h) => updateAlarm({ eveningHour: h })}
      />
    </View>
  );
};

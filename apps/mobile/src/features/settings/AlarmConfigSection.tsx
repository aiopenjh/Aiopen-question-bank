import React, { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  AlarmConfig,
  AlarmTime,
  ALL_DAYS,
  DayOfWeek,
  normalizeAlarmConfig,
} from '../../utils/notifications';
import { styles } from './settingsStyles';

export interface AlarmConfigSectionProps {
  alarmConfig: AlarmConfig;
  onChangeAlarmConfig?: (config: AlarmConfig) => void;
}

interface AlarmTimeInputProps {
  value: AlarmTime;
  disabled: boolean;
  onCommit: (time: AlarmTime) => boolean;
}

const MAX_ALARM_TIMES = 8;

function formatTime(time: AlarmTime): string {
  return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
}

function parseTime(text: string): AlarmTime | null {
  const trimmed = text.trim();
  let hour: number;
  let minute: number;

  if (trimmed.includes(':')) {
    const [hourPart, minutePart] = trimmed.split(':');
    hour = Number.parseInt(hourPart, 10);
    minute = Number.parseInt(minutePart, 10);
  } else {
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.length <= 2) {
      hour = Number.parseInt(digits, 10);
      minute = 0;
    } else if (digits.length === 3) {
      hour = Number.parseInt(digits.slice(0, 1), 10);
      minute = Number.parseInt(digits.slice(1), 10);
    } else {
      hour = Number.parseInt(digits.slice(0, 2), 10);
      minute = Number.parseInt(digits.slice(2, 4), 10);
    }
  }

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  return {
    hour: Math.min(23, Math.max(0, hour)),
    minute: Math.min(59, Math.max(0, minute)),
  };
}

const AlarmTimeInput: React.FC<AlarmTimeInputProps> = ({ value, disabled, onCommit }) => {
  const [draft, setDraft] = useState(formatTime(value));

  useEffect(() => {
    setDraft(formatTime(value));
  }, [value.hour, value.minute]);

  function commit() {
    const parsed = parseTime(draft);
    if (!parsed || !onCommit(parsed)) {
      setDraft(formatTime(value));
      return;
    }
    setDraft(formatTime(parsed));
  }

  return (
    <TextInput
      value={draft}
      onChangeText={(text) => setDraft(text.replace(/[^\d:]/g, '').slice(0, 5))}
      onBlur={commit}
      onSubmitEditing={commit}
      editable={!disabled}
      keyboardType="numbers-and-punctuation"
      maxLength={5}
      selectTextOnFocus
      style={[styles.alarmTimeInput, disabled && styles.timeInputDisabled]}
      accessibilityLabel={`알람 시간 ${formatTime(value)}`}
    />
  );
};

export const AlarmConfigSection: React.FC<AlarmConfigSectionProps> = ({
  alarmConfig,
  onChangeAlarmConfig,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');
  const currentConfig = normalizeAlarmConfig(alarmConfig);

  function updateAlarm(patch: Partial<AlarmConfig>) {
    onChangeAlarmConfig?.(normalizeAlarmConfig({ ...currentConfig, ...patch }));
  }

  const selectedDays: DayOfWeek[] = Array.isArray(currentConfig.selectedDays)
    ? currentConfig.selectedDays
    : currentConfig.weekendEnabled === false
    ? ['월', '화', '수', '목', '금']
    : ALL_DAYS;

  function toggleDay(day: DayOfWeek) {
    const nextDays = selectedDays.includes(day)
      ? selectedDays.filter((selectedDay) => selectedDay !== day)
      : [...selectedDays, day];
    nextDays.sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b));
    updateAlarm({
      enabled: nextDays.length > 0 && currentConfig.times.length > 0 ? currentConfig.enabled : false,
      selectedDays: nextDays,
      weekendEnabled: nextDays.includes('토') || nextDays.includes('일'),
    });
  }

  function changeTime(index: number, nextTime: AlarmTime): boolean {
    const isDuplicate = currentConfig.times.some(
      (time, timeIndex) =>
        timeIndex !== index && time.hour === nextTime.hour && time.minute === nextTime.minute
    );
    if (isDuplicate) {
      setDuplicateError('이미 추가된 시간입니다.');
      return false;
    }
    setDuplicateError('');
    updateAlarm({
      times: currentConfig.times.map((time, timeIndex) => (timeIndex === index ? nextTime : time)),
    });
    return true;
  }

  function addTime() {
    if (currentConfig.times.length >= MAX_ALARM_TIMES) return;
    const now = new Date();
    let minuteOfDay = (Math.ceil((now.getHours() * 60 + now.getMinutes()) / 5) * 5) % (24 * 60);
    const used = new Set(currentConfig.times.map((time) => time.hour * 60 + time.minute));
    while (used.has(minuteOfDay)) minuteOfDay = (minuteOfDay + 5) % (24 * 60);

    setDuplicateError('');
    updateAlarm({
      enabled: selectedDays.length > 0,
      times: [
        ...currentConfig.times,
        { hour: Math.floor(minuteOfDay / 60), minute: minuteOfDay % 60 },
      ],
    });
  }

  function removeTime(index: number) {
    const nextTimes = currentConfig.times.filter((_, timeIndex) => timeIndex !== index);
    setDuplicateError('');
    updateAlarm({ times: nextTimes, enabled: nextTimes.length > 0 ? currentConfig.enabled : false });
  }

  function toggleEnabled() {
    if (!currentConfig.enabled) {
      updateAlarm({
        enabled: true,
        times: currentConfig.times.length > 0 ? currentConfig.times : [{ hour: 8, minute: 0 }],
        selectedDays: selectedDays.length > 0 ? selectedDays : [...ALL_DAYS],
      });
      return;
    }
    updateAlarm({ enabled: false });
  }

  const daySummary =
    selectedDays.length === 7
      ? '매일'
      : selectedDays.length === 5 &&
        ['월', '화', '수', '목', '금'].every((day) => selectedDays.includes(day as DayOfWeek))
      ? '평일'
      : selectedDays.length > 0
      ? selectedDays.join('·')
      : '요일 없음';
  const firstTime = currentConfig.times[0];
  const timeSummary = firstTime
    ? `${formatTime(firstTime)}${currentConfig.times.length > 1 ? ` 외 ${currentConfig.times.length - 1}개` : ''}`
    : '시간 없음';

  return (
    <View style={styles.alarmSection}>
      <TouchableOpacity
        style={styles.alarmSummaryButton}
        onPress={() => setExpanded((current) => !current)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.alarmSummaryCopy}>
          <Text style={styles.alarmSummaryTitle}>알람 설정</Text>
          <Text style={styles.alarmSummaryText}>
            {currentConfig.enabled ? `${daySummary} · ${timeSummary}` : '꺼짐'}
          </Text>
        </View>
        <Text style={styles.alarmSummaryChevron}>{expanded ? '⌃' : '⌄'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.alarmExpandedBody}>
          <View style={styles.alarmEnabledRow}>
            <Text style={styles.alarmEnabledTitle}>사용 요일</Text>
            <TouchableOpacity
              style={[styles.alarmToggleBtn, currentConfig.enabled ? styles.alarmToggleOn : styles.alarmToggleOff]}
              onPress={toggleEnabled}
              activeOpacity={0.8}
            >
              <Text style={currentConfig.enabled ? styles.alarmToggleTextOn : styles.alarmToggleTextOff}>
                {currentConfig.enabled ? '켜짐' : '꺼짐'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.compactDayRow, !currentConfig.enabled && styles.alarmControlsDisabled]}>
            {ALL_DAYS.map((day) => {
              const isSelected = selectedDays.includes(day);
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayChipBtn, isSelected ? styles.dayChipBtnActive : styles.dayChipBtnInactive]}
                  onPress={() => toggleDay(day)}
                  activeOpacity={0.7}
                  disabled={!currentConfig.enabled}
                  hitSlop={{ top: 5, bottom: 5, left: 4, right: 4 }}
                >
                  <Text style={isSelected ? styles.dayChipBtnTextActive : styles.dayChipBtnTextInactive}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.alarmTimesHeader}>
            <Text style={styles.alarmTimesTitle}>알람 시간</Text>
            <Text style={styles.alarmTimesGuide}>24시간 기준 · {currentConfig.times.length}/{MAX_ALARM_TIMES}</Text>
          </View>

          <View style={styles.alarmTimeChipGrid}>
            {currentConfig.times.map((time, index) => (
              <View key={`${time.hour}-${time.minute}-${index}`} style={styles.alarmMiniCard}>
                <View style={styles.alarmMiniCardHeader}>
                  <Text style={styles.alarmMiniCardLabel}>ALARM {index + 1}</Text>
                  <TouchableOpacity
                    style={styles.removeAlarmTimeButton}
                    onPress={() => removeTime(index)}
                    activeOpacity={0.7}
                    accessibilityLabel={`${formatTime(time)} 알람 삭제`}
                  >
                    <Text style={styles.removeAlarmTimeText}>×</Text>
                  </TouchableOpacity>
                </View>
                  <AlarmTimeInput
                    value={time}
                    disabled={!currentConfig.enabled}
                    onCommit={(nextTime) => changeTime(index, nextTime)}
                  />
              </View>
            ))}
            {currentConfig.times.length < MAX_ALARM_TIMES && (
              <TouchableOpacity style={styles.addAlarmMiniCard} onPress={addTime} activeOpacity={0.75}>
                <Text style={styles.addAlarmMiniIcon}>＋</Text>
                <Text style={styles.addAlarmTimeText}>알람 추가</Text>
              </TouchableOpacity>
            )}
          </View>
          {!!duplicateError && <Text style={styles.alarmTimeError}>{duplicateError}</Text>}
        </View>
      )}
    </View>
  );
};

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { styles } from './settingsStyles';

export interface DailyGoalSectionProps {
  targetCount: number;
  onChangeTargetCount: (count: number) => void;
}

export const DailyGoalSection: React.FC<DailyGoalSectionProps> = ({
  targetCount,
  onChangeTargetCount,
}) => {
  const [inputText, setInputText] = useState(String(targetCount));

  useEffect(() => {
    setInputText(String(targetCount));
  }, [targetCount]);

  const handleCommitNumber = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setInputText(cleaned);
    const parsed = parseInt(cleaned, 10);
    if (!isNaN(parsed) && parsed > 0) {
      onChangeTargetCount(Math.min(10, Math.max(1, parsed)));
    }
  };

  const handleStep = (delta: number) => {
    const next = Math.min(10, Math.max(1, targetCount + delta));
    setInputText(String(next));
    onChangeTargetCount(next);
  };

  const PRESETS = [3, 5, 7, 10];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.cardSectionTitle}>일일 학습 목표 설정</Text>
          <Text style={styles.alarmSubGuide}>
            메인 홈 화면의 일일 달성률 기준이 되는 하루 목표 문제 수(1~10문항)를 설정합니다.
          </Text>
        </View>
        <View style={styles.alarmActiveBadge}>
          <Text style={styles.alarmActiveBadgeText}>목표 {targetCount}문항</Text>
        </View>
      </View>

      {/* 목표 문항 수 숫자 직접 입력 및 스텝 버튼 */}
      <View style={styles.goalInputRow}>
        <TouchableOpacity
          style={[styles.stepperArrowBtn, targetCount <= 1 && styles.stepperArrowBtnDisabled]}
          onPress={() => handleStep(-1)}
          disabled={targetCount <= 1}
          activeOpacity={0.7}
        >
          <Text style={[styles.stepperArrowText, targetCount <= 1 && styles.stepperArrowTextDisabled]}>
            ◀
          </Text>
        </TouchableOpacity>

        <View style={styles.goalInputCenter}>
          <TextInput
            style={styles.goalInputField}
            value={inputText}
            onChangeText={handleCommitNumber}
            keyboardType="number-pad"
            maxLength={2}
            selectTextOnFocus
          />
          <Text style={styles.goalInputSuffix}>문항 / 일</Text>
        </View>

        <TouchableOpacity
          style={[styles.stepperArrowBtn, targetCount >= 10 && styles.stepperArrowBtnDisabled]}
          onPress={() => handleStep(1)}
          disabled={targetCount >= 10}
          activeOpacity={0.7}
        >
          <Text style={[styles.stepperArrowText, targetCount >= 10 && styles.stepperArrowTextDisabled]}>
            ▶
          </Text>
        </TouchableOpacity>
      </View>

      {/* 빠른 추천 프리셋 버튼 */}
      <View style={styles.goalPresetRow}>
        {PRESETS.map((count) => {
          const isSelected = targetCount === count;
          return (
            <TouchableOpacity
              key={count}
              style={[styles.goalPresetChip, isSelected && styles.goalPresetChipActive]}
              onPress={() => {
                setInputText(String(count));
                onChangeTargetCount(count);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.goalPresetText, isSelected && styles.goalPresetTextActive]}>
                {count}문제
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

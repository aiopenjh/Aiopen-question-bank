import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { styles } from './settingsStyles';

export interface DailyGoalSectionProps {
  targetCount: number;
  onChangeTargetCount: (count: number) => void | Promise<void>;
}

export const DailyGoalSection: React.FC<DailyGoalSectionProps> = ({
  targetCount,
  onChangeTargetCount,
}) => {
  const [inputText, setInputText] = useState(String(targetCount));

  useEffect(() => {
    setInputText(String(targetCount));
  }, [targetCount]);

  const parsedInput = Number.parseInt(inputText, 10);
  const isValidInput = Number.isInteger(parsedInput) && parsedInput >= 1 && parsedInput <= 10;
  const hasChanges = isValidInput && parsedInput !== targetCount;

  const handleChangeNumber = (text: string) => {
    setInputText(text.replace(/[^0-9]/g, ''));
  };

  const handleStep = (delta: number) => {
    const current = isValidInput ? parsedInput : targetCount;
    const next = Math.min(10, Math.max(1, current + delta));
    setInputText(String(next));
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    await onChangeTargetCount(parsedInput);
  };

  return (
    <View style={[styles.card, styles.goalCard]}>
      <View style={styles.goalHeaderRow}>
        <Text style={[styles.cardSectionTitle, styles.goalCardTitle]}>일일 학습 목표</Text>
        <TouchableOpacity
          style={[styles.goalSaveButton, !hasChanges && styles.goalSaveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges}
          activeOpacity={0.75}
        >
          <Text style={[styles.goalSaveButtonText, !hasChanges && styles.goalSaveButtonTextDisabled]}>
            목표 {isValidInput ? parsedInput : targetCount}문항 저장
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.goalInputRow}>
        <TouchableOpacity
          style={[styles.stepperArrowBtn, parsedInput <= 1 && styles.stepperArrowBtnDisabled]}
          onPress={() => handleStep(-1)}
          disabled={parsedInput <= 1}
          activeOpacity={0.7}
        >
          <Text style={[styles.stepperArrowText, parsedInput <= 1 && styles.stepperArrowTextDisabled]}>
            ◀
          </Text>
        </TouchableOpacity>

        <View style={styles.goalInputCenter}>
          <TextInput
            style={styles.goalInputField}
            value={inputText}
            onChangeText={handleChangeNumber}
            keyboardType="number-pad"
            maxLength={2}
            selectTextOnFocus
          />
          <Text style={styles.goalInputSuffix}>문항</Text>
        </View>

        <TouchableOpacity
          style={[styles.stepperArrowBtn, parsedInput >= 10 && styles.stepperArrowBtnDisabled]}
          onPress={() => handleStep(1)}
          disabled={parsedInput >= 10}
          activeOpacity={0.7}
        >
          <Text style={[styles.stepperArrowText, parsedInput >= 10 && styles.stepperArrowTextDisabled]}>
            ▶
          </Text>
        </TouchableOpacity>
      </View>

      {!isValidInput && <Text style={styles.goalValidationText}>1~10 사이의 문항 수를 입력해 주세요.</Text>}
    </View>
  );
};

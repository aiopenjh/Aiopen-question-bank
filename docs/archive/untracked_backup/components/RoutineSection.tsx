import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { RoutineRevision } from '../../../contracts/types';
import { ROUTINE_PRESETS } from '../../../domain/routine';
import { showAlert } from '../../../utils/alert';

interface RoutineSectionProps {
  routine: RoutineRevision | null;
  onChangeRoutinePreset: (presetKey: string) => Promise<void>;
}

export const RoutineSection: React.FC<RoutineSectionProps> = ({
  routine,
  onChangeRoutinePreset,
}) => {
  const [saving, setSaving] = useState(false);
  async function choose(key: string) {
    if (saving) return;
    setSaving(true);
    try { await onChangeRoutinePreset(key); }
    catch { showAlert('요일 저장 실패', '저장 공간을 확인하고 다시 선택해 주세요.'); }
    finally { setSaving(false); }
  }
  return (
    <View style={styles.card}>
      <Text style={styles.cardSectionTitle}>🌿 라이프스타일 학습 요일 설정</Text>
      <Text style={styles.promptGuideText}>
        나의 생활 패턴에 맞게 학습 요일을 선택하세요. 쉬는 날에는 스트레스 없는 편안한 휴식 모드로 전환됩니다.
      </Text>
      <View style={styles.presetButtonsContainer}>
        {Object.entries(ROUTINE_PRESETS).filter(([key]) => key !== 'custom').map(([key, item]) => {
          const isSelected = routine?.preset === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.presetButton, isSelected && styles.presetButtonSelected]}
              onPress={() => choose(key)}
              disabled={saving}
            >
              <Text style={[styles.presetButtonText, isSelected && styles.presetButtonTextSelected]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecdd3',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#881337',
    marginBottom: 8,
  },
  promptGuideText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 19,
    marginBottom: 12,
  },
  presetButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    backgroundColor: '#fff5f7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecdd3',
    minWidth: '45%',
    alignItems: 'center',
  },
  presetButtonSelected: {
    backgroundColor: '#f43f5e',
    borderColor: '#e11d48',
  },
  presetButtonText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  presetButtonTextSelected: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});

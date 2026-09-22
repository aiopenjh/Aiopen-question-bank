import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getDifficultyProfile, normalizeDifficultyLevel } from '../../domain/difficulty';
import { colors, radius, spacing } from '../../styles/designTokens';

interface DifficultyLevelControlProps {
  value: number;
  onChange: (level: number) => void;
  disabled?: boolean;
  compact?: boolean;
  maxLevel?: number;
}

const QUICK_LEVELS = [1, 5, 10, 15, 20, 25, 30] as const;

export const DifficultyLevelControl: React.FC<DifficultyLevelControlProps> = ({
  value,
  onChange,
  disabled = false,
  compact = false,
  maxLevel = 31,
}) => {
  const level = normalizeDifficultyLevel(value);
  const profile = getDifficultyProfile(level);

  return (
    <View>
      <View style={styles.currentRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="난이도 한 단계 낮추기"
          style={[styles.stepButton, level <= 1 && styles.stepButtonDisabled]}
          onPress={() => onChange(Math.max(1, level - 1))}
          disabled={disabled || level <= 1}
        >
          <Text style={styles.stepButtonText}>−</Text>
        </TouchableOpacity>
        <View style={styles.levelValueBox}>
          <Text style={styles.levelValue}>레벨 {level}</Text>
          <Text style={styles.bandLabel}>{profile.bandLabel}</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="난이도 한 단계 높이기"
          style={[styles.stepButton, level >= maxLevel && styles.stepButtonDisabled]}
          onPress={() => onChange(Math.min(maxLevel, level + 1))}
          disabled={disabled || level >= maxLevel}
        >
          <Text style={styles.stepButtonText}>＋</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.quickRow, compact && styles.quickRowCompact]}>
        {QUICK_LEVELS.map((quickLevel) => {
          const selected = level === quickLevel;
          return (
            <TouchableOpacity
              key={quickLevel}
              style={[styles.quickButton, selected && styles.quickButtonSelected]}
              onPress={() => onChange(quickLevel)}
              disabled={disabled}
            >
              <Text style={[styles.quickText, selected && styles.quickTextSelected]}>
                {quickLevel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.helpText}>1~30은 자유 선택 · 31부터 3문제 중 2문제 이상 정답이면 다음 레벨이 열려요. 현재 Lv.{maxLevel}까지 선택할 수 있어요.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  stepButtonDisabled: {
    opacity: 0.35,
  },
  stepButtonText: {
    color: colors.primaryPressed,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '800',
  },
  levelValueBox: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: '#FFF9FB',
    borderWidth: 1,
    borderColor: colors.border,
  },
  levelValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  bandLabel: {
    color: colors.primaryPressed,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
  },
  quickRowCompact: {
    gap: 4,
  },
  quickButton: {
    flexGrow: 1,
    minWidth: 34,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  quickButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  quickText: {
    color: colors.inkMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  quickTextSelected: {
    color: colors.primaryPressed,
    fontWeight: '900',
  },
  helpText: {
    color: colors.inkMuted,
    fontSize: 9.5,
    lineHeight: 14,
    marginTop: spacing.sm,
  },
});

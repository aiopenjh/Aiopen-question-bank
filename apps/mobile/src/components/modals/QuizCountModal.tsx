import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity } from 'react-native';
import { LearnerKnowledgeLevel } from '../../contracts/types';

export interface QuizCountModalOptions {
  learnerLevel?: LearnerKnowledgeLevel;
  shouldReplaceExisting?: boolean;
}

interface QuizCountModalProps {
  visible: boolean;
  unitTitle?: string;
  topicName?: string;
  existingCount?: number;
  initialLevel?: LearnerKnowledgeLevel;
  onClose: () => void;
  onSelectCount: (count: number, options?: QuizCountModalOptions) => void;
  onOpenBackup?: () => void;
}

const LEVEL_MAP: Record<
  LearnerKnowledgeLevel,
  { name: string; icon: string; desc: string }
> = {
  beginner: { name: '입문', icon: '🌱', desc: '쉬운 비유와 기초 개념 위주 (초심자용)' },
  basic: { name: '기본', icon: '📘', desc: '표준 필수 개념 & 핵심 원리 (정규 시험용)' },
  advanced: { name: '실전', icon: '🔥', desc: '기출 난이도 & 함정 선지 극복 (실전 시험대비)' },
  master: { name: '심화', icon: '👑', desc: '최고난도 복합 추론 & 킬러 문항 (심화 마스터)' },
};

export const QuizCountModal: React.FC<QuizCountModalProps> = ({
  visible,
  unitTitle,
  topicName,
  existingCount = 0,
  initialLevel = 'basic',
  onClose,
  onSelectCount,
  onOpenBackup,
}) => {
  const [selectedLevel, setSelectedLevel] = useState<LearnerKnowledgeLevel>(initialLevel || 'basic');
  const [shouldReplace, setShouldReplace] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      setSelectedLevel(initialLevel || 'basic');
      setShouldReplace(false);
    }
  }, [visible, initialLevel]);

  const currentLevelInfo = LEVEL_MAP[selectedLevel] || LEVEL_MAP.basic;
  const isModifiedFromDefault = initialLevel ? selectedLevel !== initialLevel : false;

  const options = [
    {
      count: 3,
      badge: '⚡ 약 10초 (빠른 출제)',
      title: '3문제 풀기',
      desc: '핵심 개념 위주의 신속한 마이크로러닝 (즉시 생성)',
      color: '#e11d48',
      borderColor: '#fda4af',
      bg: '#fff1f2',
    },
    {
      count: 5,
      badge: '🎯 가장 추천 (가장 쾌적하고 안정적)',
      title: '5문제 풀기',
      desc: '개념 이해 + 실전 함정 선지 + 꼼꼼한 해설지 (가장 안정적인 최적 문항 수)',
      color: '#be123c',
      borderColor: '#fb7185',
      bg: '#fff1f2',
    },
    {
      count: 10,
      badge: '🏆 집중 학습 (생성 시간 다소 소요)',
      title: '10문제 풀기',
      desc: '단원 집중 풀이 (문항 수가 많아 AI 응답에 시간이 다소 걸릴 수 있습니다)',
      color: '#9f1239',
      borderColor: '#f43f5e',
      bg: '#fff1f2',
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <Text style={styles.badge}>📝 실전 출제 설정 및 문항 수 선택</Text>
              {existingCount > 0 && (
                <View style={styles.storedBadge}>
                  <Text style={styles.storedBadgeText}>📚 보관: {existingCount}문항</Text>
                </View>
              )}
            </View>
            <Text style={styles.title}>몇 문제를 출제해 드릴까요?</Text>
            {unitTitle && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {topicName ? `[${topicName}] ` : ''}{unitTitle}
              </Text>
            )}
          </View>

          {/* 1. 현재 적용 난이도 고정 표시 카드 */}
          <View style={styles.currentLevelCard}>
            <View style={styles.currentLevelTop}>
              <View style={styles.currentLevelBadge}>
                <Text style={styles.currentLevelBadgeText}>
                  {currentLevelInfo.icon} {currentLevelInfo.name} 난이도 적용 중
                </Text>
              </View>
              <Text style={styles.currentLevelOriginTag}>
                {isModifiedFromDefault ? '✏️ 이번 단원 변경됨' : '📌 과목 기본값 고정'}
              </Text>
            </View>
            <Text style={styles.currentLevelDesc}>
              {currentLevelInfo.desc}
            </Text>
          </View>

          {/* 2. 난이도 변경 선택 영역 (원할 때 눌러서 변경) */}
          <View style={styles.sectionBlock}>
            <View style={styles.levelChangeHeader}>
              <Text style={styles.sectionLabel}>🎯 난이도 변경 (원하실 때만 클릭)</Text>
              {isModifiedFromDefault && initialLevel && (
                <TouchableOpacity
                  onPress={() => setSelectedLevel(initialLevel)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.resetLevelText}>
                    ↺ 처음 설정({LEVEL_MAP[initialLevel]?.name})으로 복원
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.levelRow}>
              {(
                [
                  { key: 'beginner', label: '🌱 입문' },
                  { key: 'basic', label: '📘 기본' },
                  { key: 'advanced', label: '🔥 실전' },
                  { key: 'master', label: '👑 심화' },
                ] as const
              ).map((lvl) => {
                const isActive = selectedLevel === lvl.key;
                const isInitial = initialLevel === lvl.key;
                return (
                  <TouchableOpacity
                    key={lvl.key}
                    style={[
                      styles.levelChip,
                      isActive && styles.levelChipActive,
                    ]}
                    onPress={() => setSelectedLevel(lvl.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.levelChipText, isActive && styles.levelChipTextActive]}>
                      {lvl.label}
                    </Text>
                    {isInitial && (
                      <View style={styles.initialDot} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 2. 기존 문제 처리 옵션 (이미 문제가 있을 때만 표시) */}
          {existingCount > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>🔄 기존 문제 처리 (보관 중인 {existingCount}문항)</Text>
              <View style={styles.replaceOptionRow}>
                <TouchableOpacity
                  style={[styles.replaceBtn, !shouldReplace && styles.replaceBtnActive]}
                  onPress={() => setShouldReplace(false)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.replaceBtnText, !shouldReplace && styles.replaceBtnTextActive]}>
                    ➕ 유지하고 추가
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.replaceBtn, shouldReplace && styles.replaceBtnDangerActive]}
                  onPress={() => setShouldReplace(true)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.replaceBtnText, shouldReplace && styles.replaceBtnDangerTextActive]}>
                    🧹 지우고 새 난이도로 교체
                  </Text>
                </TouchableOpacity>
              </View>
              {shouldReplace && (
                <Text style={styles.replaceNoticeText}>
                  ⚠️ 기존에 풀었던 {existingCount}문항을 비우고, 선택하신 난이도로 완전히 새롭게 교체합니다.
                </Text>
              )}
            </View>
          )}

          {/* 30문제 이상 누적 시 안전 백업 권장 배너 */}
          {existingCount >= 30 && (
            <View style={styles.backupRecommendBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Text style={{ fontSize: 13 }}>🛡️</Text>
                <Text style={styles.backupRecommendTitle}>데이터 안전 백업 권장 (누적 {existingCount}문항)</Text>
              </View>
              <Text style={styles.backupRecommendText}>
                단원에 소중한 문제가 많이 누적되었습니다! 스마트폰 캐시 정리나 기기 변경에 대비해 지금 백업해두세요.
              </Text>
              {onOpenBackup && (
                <TouchableOpacity
                  style={styles.backupActionBtn}
                  onPress={() => {
                    onClose();
                    onOpenBackup();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.backupActionBtnText}>💾 지금 데이터 백업 파일 내보내기</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.optionsContainer}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.count}
                style={[
                  styles.optionCard,
                  { borderColor: opt.borderColor, backgroundColor: opt.bg },
                ]}
                onPress={() =>
                  onSelectCount(opt.count, {
                    learnerLevel: selectedLevel,
                    shouldReplaceExisting: shouldReplace,
                  })
                }
                activeOpacity={0.8}
              >
                <View style={styles.optionTopRow}>
                  <Text style={[styles.optionTitle, { color: opt.color }]}>
                    {opt.title}
                  </Text>
                  <View style={[styles.optionBadge, { backgroundColor: opt.borderColor }]}>
                    <Text style={[styles.optionBadgeText, { color: opt.color }]}>
                      {opt.badge}
                    </Text>
                  </View>
                </View>
                <Text style={styles.optionDesc}>{opt.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 소요 시간 및 대기 안내 카드 */}
          <View style={styles.timeNoticeCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Text style={{ fontSize: 13 }}>💡</Text>
              <Text style={styles.timeNoticeTitle}>출제 권장 가이드 & 누적 문제은행</Text>
            </View>
            <Text style={styles.timeNoticeText}>
              • 5문제가 가장 안정적이고 쾌적하게 출제되며, 바쁠 땐 3문제, 단원 마스터 시 10문제를 추천합니다.{'\n'}
              • 여러 번 출제하셔도 단원 내 다양한 개념으로 확장 출제되어 50~100문제 이상 안전하게 쌓을 수 있습니다.{'\n'}
              • 생성된 문제는 기기 내 개인 DB에 영구 보존됩니다.
            </Text>
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1.5,
    borderColor: '#fecdd3',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  sectionBlock: {
    marginBottom: 12,
  },
  currentLevelCard: {
    backgroundColor: '#fff1f4',
    borderWidth: 1.5,
    borderColor: '#fda4af',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  currentLevelTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  currentLevelBadge: {
    backgroundColor: '#e11d48',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  currentLevelBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  currentLevelOriginTag: {
    fontSize: 11,
    color: '#be123c',
    fontWeight: '700',
  },
  currentLevelDesc: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 15,
  },
  levelChangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  resetLevelText: {
    fontSize: 11,
    color: '#e11d48',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  levelRow: {
    flexDirection: 'row',
    gap: 6,
  },
  levelChip: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelChipActive: {
    backgroundColor: '#fff1f2',
    borderColor: '#f43f5e',
  },
  initialDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e11d48',
    marginTop: 2,
  },
  levelChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  levelChipTextActive: {
    color: '#e11d48',
    fontWeight: '800',
  },
  replaceOptionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  replaceBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replaceBtnActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  replaceBtnDangerActive: {
    backgroundColor: '#fff1f2',
    borderColor: '#ef4444',
  },
  replaceBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  replaceBtnTextActive: {
    color: '#2563eb',
    fontWeight: '800',
  },
  replaceBtnDangerTextActive: {
    color: '#dc2626',
    fontWeight: '800',
  },
  replaceNoticeText: {
    fontSize: 11,
    color: '#e11d48',
    marginTop: 4,
    fontWeight: '600',
  },
  header: {
    marginBottom: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#e11d48',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  storedBadge: {
    backgroundColor: '#ffe4e6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f43f5e',
  },
  storedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#be123c',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#881337',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  backupRecommendBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  backupRecommendTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#166534',
  },
  backupRecommendText: {
    fontSize: 11,
    color: '#15803d',
    lineHeight: 16,
    marginBottom: 8,
  },
  backupActionBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  backupActionBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  optionsContainer: {
    gap: 9,
    marginBottom: 12,
  },
  optionCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 13,
  },
  optionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  optionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  optionBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  optionDesc: {
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 15,
  },
  timeNoticeCard: {
    backgroundColor: '#fff1f4',
    borderRadius: 10,
    padding: 11,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  timeNoticeTitle: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#881337',
  },
  timeNoticeText: {
    fontSize: 10.5,
    color: '#9f1239',
    lineHeight: 15,
  },
  cancelBtn: {
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
});

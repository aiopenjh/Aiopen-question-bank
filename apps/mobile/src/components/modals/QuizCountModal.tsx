import React from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity } from 'react-native';

interface QuizCountModalProps {
  visible: boolean;
  unitTitle?: string;
  topicName?: string;
  onClose: () => void;
  onSelectCount: (count: number) => void;
}

export const QuizCountModal: React.FC<QuizCountModalProps> = ({
  visible,
  unitTitle,
  topicName,
  onClose,
  onSelectCount,
}) => {
  const options = [
    {
      count: 3,
      badge: '⚡ 약 10초 내외 (빠른 출제)',
      title: '3문제 풀기',
      desc: '핵심 개념 위주의 신속한 마이크로러닝 (즉시 생성)',
      color: '#38bdf8',
      borderColor: 'rgba(56, 189, 248, 0.4)',
      bg: 'rgba(56, 189, 248, 0.08)',
    },
    {
      count: 5,
      badge: '🎯 약 15~20초 소요',
      title: '5문제 풀기',
      desc: '개념 이해 + 기출 함정 선지 + 꼼꼼한 해설지 구성',
      color: '#a78bfa',
      borderColor: 'rgba(167, 139, 250, 0.4)',
      bg: 'rgba(167, 139, 250, 0.08)',
    },
    {
      count: 10,
      badge: '🏆 약 30~45초 소요',
      title: '10문제 풀기',
      desc: '실전 모의고사 수준의 빈틈없는 고난도 집중 트레이닝',
      color: '#f59e0b',
      borderColor: 'rgba(245, 158, 11, 0.4)',
      bg: 'rgba(245, 158, 11, 0.08)',
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <Text style={styles.badge}>📝 실전 출제 문항 수 선택</Text>
            <Text style={styles.title}>몇 문제를 풀어볼까요?</Text>
            {unitTitle && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {topicName ? `[${topicName}] ` : ''}{unitTitle}
              </Text>
            )}
          </View>

          <View style={styles.optionsContainer}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.count}
                style={[
                  styles.optionCard,
                  { borderColor: opt.borderColor, backgroundColor: opt.bg },
                ]}
                onPress={() => onSelectCount(opt.count)}
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
              <Text style={{ fontSize: 13 }}>⏱️</Text>
              <Text style={styles.timeNoticeTitle}>출제 대기시간 안내</Text>
            </View>
            <Text style={styles.timeNoticeText}>
              • 3문제는 가볍고 빠르게 즉시 출제됩니다.{'\n'}
              • 5문제 / 10문제는 정답 및 오답 해설지를 꼼꼼하게 작성하므로 시간이 조금 걸립니다.{'\n'}
              • 오류 없이 안전하게 시험장으로 연결되니 잠시만 기다려 주세요.
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    marginBottom: 16,
  },
  badge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38bdf8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
  },
  optionsContainer: {
    gap: 10,
    marginBottom: 12,
  },
  optionCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
  },
  optionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionTitle: {
    fontSize: 16,
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
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 16,
  },
  timeNoticeCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  timeNoticeTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#e2e8f0',
  },
  timeNoticeText: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
});

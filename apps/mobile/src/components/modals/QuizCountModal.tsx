import React from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity } from 'react-native';

interface QuizCountModalProps {
  visible: boolean;
  unitTitle?: string;
  topicName?: string;
  existingCount?: number;
  onClose: () => void;
  onSelectCount: (count: number) => void;
  onOpenBackup?: () => void;
}

export const QuizCountModal: React.FC<QuizCountModalProps> = ({
  visible,
  unitTitle,
  topicName,
  existingCount = 0,
  onClose,
  onSelectCount,
  onOpenBackup,
}) => {
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
      badge: '🎯 약 15~20초 소요',
      title: '5문제 풀기',
      desc: '개념 이해 + 기출 함정 선지 + 꼼꼼한 해설지 구성',
      color: '#be123c',
      borderColor: '#fb7185',
      bg: '#fff1f2',
    },
    {
      count: 10,
      badge: '🏆 약 25~35초 (안정적 최대 출제)',
      title: '10문제 풀기',
      desc: 'API 지연 없는 최대 문항 출제 (5~10회 누적 시 50~100문제 완성)',
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
              <Text style={styles.badge}>📝 실전 출제 문항 수 선택</Text>
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
              <Text style={{ fontSize: 13 }}>💡</Text>
              <Text style={styles.timeNoticeTitle}>API 안정성 및 50~100문제 누적 안내</Text>
            </View>
            <Text style={styles.timeNoticeText}>
              • AI API 과부하 및 지연 방지를 위해 1회 최대 10문제씩 가장 쾌적하게 출제됩니다.{'\n'}
              • 10문제씩 여러 번 출제하셔도 기존 문제와 겹치지 않는 새로운 변형 문제가 생성되어 단원당 50~100문제 이상 안전하게 쌓을 수 있습니다.{'\n'}
              • 생성된 문제는 스마트폰 개인 DB에 영구 보존됩니다.
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

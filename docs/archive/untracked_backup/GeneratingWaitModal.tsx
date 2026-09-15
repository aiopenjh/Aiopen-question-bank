import React from 'react';
import { StyleSheet, View, Text, Modal, ActivityIndicator } from 'react-native';

export interface GeneratingWaitStatus {
  active: boolean;
  count: number;
  title: string;
  message: string;
}

interface GeneratingWaitModalProps {
  status: GeneratingWaitStatus | null;
}

export const GeneratingWaitModal: React.FC<GeneratingWaitModalProps> = ({ status }) => {
  if (!status?.active) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.loadingWaitOverlay}>
        <View style={styles.loadingWaitCard}>
          <ActivityIndicator size="large" color="#f43f5e" style={{ marginBottom: 14 }} />
          <Text style={styles.loadingWaitTitle}>
            {status.count === 3
              ? '⚡ 3문제 빠른 출제 중...'
              : status.count === 5
              ? '🎯 5문제 정밀 출제 중...'
              : `📝 ${status.count}문제 생성 중...`}
          </Text>
          {status.title ? (
            <Text style={styles.loadingWaitSubtitle} numberOfLines={1}>
              학습 범위: {status.title}
            </Text>
          ) : null}
          <Text style={styles.loadingWaitMessage}>
            {status.message}
          </Text>

          <View style={styles.loadingWaitNoteBox}>
            <Text style={styles.loadingWaitNoteText}>
              AI 응답과 문제 형식을 확인하고 저장합니다. 문항 수에 따라 시간이 달라집니다.
            </Text>
            <Text style={[styles.loadingWaitNoteText, { color: '#be123c', marginTop: 4, fontWeight: 'bold' }]}>
              연결이 끊기거나 시간이 초과되면 실패 이유를 안내합니다. 다른 모델로 자동 재요청하지 않습니다.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  loadingWaitOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingWaitCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fecdd3',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  loadingWaitTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#881337',
    marginBottom: 6,
    textAlign: 'center',
  },
  loadingWaitSubtitle: {
    fontSize: 13,
    color: '#e11d48',
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  loadingWaitMessage: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 16,
  },
  loadingWaitNoteBox: {
    backgroundColor: '#fff1f4',
    borderRadius: 10,
    padding: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#fecdd3',
    alignItems: 'center',
  },
  loadingWaitNoteText: {
    fontSize: 11,
    color: '#9f1239',
    textAlign: 'center',
    lineHeight: 16,
  },
});

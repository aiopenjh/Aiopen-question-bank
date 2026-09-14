import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal } from 'react-native';

interface FactModalProps {
  visible: boolean;
  citationText: string;
  onClose: () => void;
}

export const FactModal: React.FC<FactModalProps> = ({ visible, citationText, onClose }) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>📚 사실 기반 출제 근거</Text>
          <Text style={styles.modalFactText}>
            본 문제는 임의 가설이 아닌, 공인 교재 및 표준 교육과정 출제 기준에 근거합니다.
          </Text>
          <View style={styles.factQuoteBox}>
            <Text style={styles.factQuoteText}>{citationText || '출제 근거 팩트 정보가 등록되어 있습니다.'}</Text>
          </View>
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseButtonText}>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 8,
  },
  modalFactText: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 12,
  },
  factQuoteBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  factQuoteText: {
    color: '#38bdf8',
    fontSize: 13,
    lineHeight: 19,
  },
  modalCloseButton: {
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

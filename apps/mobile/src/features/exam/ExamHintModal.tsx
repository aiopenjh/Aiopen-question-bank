import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { styles } from './examStyles';

export interface ExamHintModalProps {
  visible: boolean;
  onClose: () => void;
  questionIndex: number;
  hintText?: string;
  explanationText?: string;
}

export const ExamHintModal: React.FC<ExamHintModalProps> = ({
  visible,
  onClose,
  questionIndex,
  hintText,
  explanationText,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.hintModalCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Text style={{ fontSize: 20 }}>💡</Text>
            <Text style={styles.hintModalTitle}>Q{questionIndex + 1} 문제 힌트</Text>
          </View>
          <Text style={styles.hintModalContent}>
            {hintText || explanationText?.slice(0, 80) || '지문과 보기를 꼼꼼히 다시 읽어보세요.'}...
          </Text>
          <TouchableOpacity style={styles.closeHintBtn} onPress={onClose}>
            <Text style={styles.closeHintBtnText}>확인 및 문제 풀기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

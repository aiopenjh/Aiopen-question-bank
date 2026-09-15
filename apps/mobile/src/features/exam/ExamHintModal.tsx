import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
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
  const content =
    (hintText && hintText.trim().length > 0)
      ? hintText.trim()
      : (explanationText && explanationText.trim().length > 0)
      ? explanationText.trim()
      : '지문과 보기를 꼼꼼히 다시 읽고 핵심 키워드를 찾아보세요.';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.hintModalCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <Text style={{ fontSize: 20 }}>💡</Text>
            <Text style={styles.hintModalTitle}>Q{questionIndex + 1} 문제 힌트</Text>
          </View>
          <ScrollView
            style={{ maxHeight: 260, marginBottom: 18 }}
            showsVerticalScrollIndicator={true}
          >
            <Text style={styles.hintModalContent}>
              {content}
            </Text>
          </ScrollView>
          <TouchableOpacity style={styles.closeHintBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeHintBtnText}>확인 및 문제 풀기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

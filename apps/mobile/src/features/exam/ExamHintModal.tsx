import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { styles } from './examStyles';

export interface ExamHintModalProps {
  visible: boolean;
  onClose: () => void;
  questionIndex: number;
  hintText?: string;
}

// 해설(explanationText)에는 정답 도출 과정이 그대로 담겨 있어 힌트 대신 보여주면
// 사실상 정답을 알려주는 셈이 된다. 전용 힌트가 없을 때는 정답을 노출하지 않는
// 중립적인 기본 안내만 표시한다(해설로 폴백하지 않음).
export const ExamHintModal: React.FC<ExamHintModalProps> = ({
  visible,
  onClose,
  questionIndex,
  hintText,
}) => {
  const content =
    hintText && hintText.trim().length > 0
      ? hintText.trim()
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

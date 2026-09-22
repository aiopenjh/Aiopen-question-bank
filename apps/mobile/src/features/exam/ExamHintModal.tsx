import React from 'react';
import { ActivityIndicator, Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { styles } from './examStyles';
import { colors } from '../../styles/designTokens';

export interface ExamHintModalProps {
  visible: boolean;
  onClose: () => void;
  questionIndex: number;
  hintText?: string;
  // 기존 저장 문제(구 데이터)에는 전용 힌트가 없을 수 있다. 이때는 의미 없는 공통 문구
  // 대신 AI 힌트를 직접 생성하는 버튼을 보여준다(비용 발생 방지를 위해 자동 호출 금지).
  onGenerateHint?: () => void;
  isGeneratingHint?: boolean;
  generateHintError?: string | null;
}

// 해설(explanationText)에는 정답 도출 과정이 그대로 담겨 있어 힌트 대신 보여주면
// 사실상 정답을 알려주는 셈이 된다. 전용 힌트가 없을 때는 정답을 노출하지 않는
// 중립적인 기본 안내만 표시한다(해설로 폴백하지 않음).
export const ExamHintModal: React.FC<ExamHintModalProps> = ({
  visible,
  onClose,
  questionIndex,
  hintText,
  onGenerateHint,
  isGeneratingHint = false,
  generateHintError,
}) => {
  const trimmedHint = hintText && hintText.trim().length > 0 ? hintText.trim() : '';

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
            {trimmedHint ? (
              <Text style={styles.hintModalContent}>{trimmedHint}</Text>
            ) : (
              <View>
                <Text style={styles.hintEmptyText}>
                  아직 이 문제의 전용 힌트가 없습니다. 버튼을 누르면 이 문제만을 위한 힌트를
                  생성해 저장합니다(생성 후에는 추가 요청 없이 재사용됩니다).
                </Text>
                {isGeneratingHint ? (
                  <View style={styles.hintLoadingRow}>
                    <ActivityIndicator color={colors.primaryPressed} />
                    <Text style={styles.hintEmptyText}>힌트를 생성하는 중...</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.generateHintBtn}
                    onPress={onGenerateHint}
                    activeOpacity={0.8}
                    disabled={!onGenerateHint}
                  >
                    <Text style={styles.generateHintBtnText}>✨ AI 힌트 만들기</Text>
                  </TouchableOpacity>
                )}
                {generateHintError ? (
                  <Text style={styles.hintErrorText}>{generateHintError}</Text>
                ) : null}
              </View>
            )}
          </ScrollView>
          <TouchableOpacity style={styles.closeHintBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeHintBtnText}>확인 및 문제 풀기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

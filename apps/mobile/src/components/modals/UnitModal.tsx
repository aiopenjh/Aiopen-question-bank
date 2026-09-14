import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Modal } from 'react-native';
import { showAlert } from '../../utils/alert';

interface UnitModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateUnit: (title: string, depth: 1 | 2 | 3) => Promise<void>;
}

export const UnitModal: React.FC<UnitModalProps> = ({ visible, onClose, onCreateUnit }) => {
  const [unitTitle, setUnitTitle] = useState('');
  const depth: 1 | 2 | 3 = 1;
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreate() {
    if (!unitTitle.trim()) {
      showAlert('알림', '단원명을 입력해 주세요.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onCreateUnit(unitTitle.trim(), depth);
      setUnitTitle('');
      onClose();
    } catch (err: any) {
      showAlert('오류', `단원 추가 실패: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>📌 새 단원(목차) 추가</Text>
          <Text style={styles.promptGuideText}>
            교재의 대단원 또는 중단원 제목을 입력하세요.
          </Text>

          <TextInput
            style={styles.inputField}
            placeholder="단원 제목 (예: 제1장 수와 연산)"
            placeholderTextColor="#fda4af"
            value={unitTitle}
            onChangeText={setUnitTitle}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
            onKeyPress={(e: any) => {
              if (e?.nativeEvent?.key === 'Enter' && !e?.nativeEvent?.shiftKey) {
                e?.preventDefault?.();
                handleCreate();
              }
            }}
          />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#ffe4e6', borderWidth: 1, borderColor: '#fecdd3' }]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={[styles.actionBtnText, { color: '#be123c' }]}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#f43f5e' }]}
              onPress={handleCreate}
              disabled={isSubmitting}
            >
              <Text style={styles.actionBtnText}>{isSubmitting ? '추가 중...' : '단원 추가'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: '#fecdd3',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#881337',
    marginBottom: 8,
  },
  promptGuideText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 14,
  },
  inputField: {
    backgroundColor: '#fff5f7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#1f2937',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#fecdd3',
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

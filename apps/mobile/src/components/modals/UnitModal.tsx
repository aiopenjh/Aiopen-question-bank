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
            placeholderTextColor="#94a3b8"
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
              style={[styles.actionBtn, { backgroundColor: '#334155' }]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.actionBtnText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#6366f1' }]}
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
  promptGuideText: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 12,
  },
  inputField: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
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

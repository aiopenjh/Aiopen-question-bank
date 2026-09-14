import React from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Modal } from 'react-native';

interface BackupModalProps {
  visible: boolean;
  backupText: string;
  onChangeBackupText: (text: string) => void;
  onClose: () => void;
  onRestore: () => Promise<void>;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  visible,
  backupText,
  onChangeBackupText,
  onClose,
  onRestore,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>📦 JSON 데이터 백업 및 복원</Text>
          <Text style={styles.promptGuideText}>
            (보안 정책 R12: API Key 등 민감한 자격증명은 백업 파일에 포함되지 않고 안전하게 분리 보호됩니다.)
          </Text>
          <TextInput
            style={[styles.inputField, { height: 160, fontSize: 11 }]}
            placeholder="백업 JSON 텍스트를 복사하거나 붙여넣으세요..."
            placeholderTextColor="#94a3b8"
            multiline
            value={backupText}
            onChangeText={onChangeBackupText}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#334155' }]}
              onPress={onClose}
            >
              <Text style={styles.actionBtnText}>닫기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#6366f1' }]}
              onPress={onRestore}
            >
              <Text style={styles.actionBtnText}>복원 실행</Text>
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
    marginBottom: 6,
  },
  promptGuideText: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 10,
    lineHeight: 16,
  },
  inputField: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
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

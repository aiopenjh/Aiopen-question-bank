import React from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Modal } from 'react-native';

interface BackupModalProps {
  visible: boolean;
  backupText: string;
  onChangeBackupText: (text: string) => void;
  onClose: () => void;
  onRestore: () => Promise<void>;
  onRestoreFromFile?: () => Promise<void>;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  visible,
  backupText,
  onChangeBackupText,
  onClose,
  onRestore,
  onRestoreFromFile,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>🔄 학습 데이터 복원하기</Text>
          <Text style={styles.promptGuideText}>
            이전에 카카오톡이나 파일로 저장해둔 백업 파일(.json)을 불러오면 학습 데이터가 1초 만에 복구됩니다.
          </Text>

          {/* 1. 원클릭 파일 선택 버튼 (가장 추천) */}
          {onRestoreFromFile && (
            <TouchableOpacity
              style={styles.filePickBtn}
              onPress={onRestoreFromFile}
              activeOpacity={0.8}
            >
              <Text style={styles.filePickBtnIcon}>📁</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.filePickBtnTitle}>백업 파일(.json) 선택하여 복원</Text>
                <Text style={styles.filePickBtnSub}>카톡/다운로드 폴더의 백업 파일 원클릭 복구</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* 구분선 */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>또는 텍스트 직접 붙여넣기</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* 2. 보조: 텍스트 직접 붙여넣기 입력창 */}
          <TextInput
            style={[styles.inputField, { height: 110, fontSize: 11 }]}
            placeholder="여기에 백업 JSON 텍스트를 붙여넣으셔도 됩니다..."
            placeholderTextColor="#fda4af"
            multiline
            value={backupText}
            onChangeText={onChangeBackupText}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#ffe4e6', borderWidth: 1, borderColor: '#fecdd3' }]}
              onPress={onClose}
            >
              <Text style={[styles.actionBtnText, { color: '#be123c' }]}>닫기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#f43f5e' }]}
              onPress={onRestore}
            >
              <Text style={styles.actionBtnText}>텍스트로 복원</Text>
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
    borderRadius: 20,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#881337',
    marginBottom: 6,
  },
  promptGuideText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 14,
    lineHeight: 18,
  },
  filePickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f4',
    borderWidth: 1.5,
    borderColor: '#fb7185',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    gap: 12,
  },
  filePickBtnIcon: {
    fontSize: 26,
  },
  filePickBtnTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#9f1239',
    marginBottom: 2,
  },
  filePickBtnSub: {
    fontSize: 11,
    color: '#e11d48',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#fecdd3',
  },
  dividerText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  inputField: {
    backgroundColor: '#fffafb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#fecdd3',
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


import React from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { UniversalModal as Modal } from '../common/UniversalModal';
import { colors } from '../../styles/designTokens';

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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        activeOpacity={1}
        style={styles.modalOverlay}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalCard}
          onPress={(e) => e.stopPropagation?.()}
        >
          <Text style={styles.modalTitle}>학습 데이터 복원</Text>
          <Text style={styles.promptGuideText}>
            백업 JSON을 선택하면 파일 종류를 확인한 뒤 복원 범위를 안내합니다. API 키는 변경하지 않습니다.
          </Text>

          {/* 1. 원클릭 파일 선택 버튼 (가장 추천) */}
          {onRestoreFromFile && (
            <TouchableOpacity
              style={styles.filePickBtn}
              onPress={onRestoreFromFile}
              activeOpacity={0.8}
            >
              <Text style={styles.filePickBtnIcon}>📦</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.filePickBtnTitle}>백업 파일 선택</Text>
                <Text style={styles.filePickBtnSub}>문제만 백업 또는 전체 백업을 자동으로 구분합니다.</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* 구분선 */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>또는 텍스트 직접 붙여넣기</Text>
            <View style={styles.dividerLine} />
          </View>

          <TextInput
            style={styles.inputField}
            placeholder="여기에 백업 JSON 텍스트를 붙여넣으세요..."
            placeholderTextColor="#fda4af"
            value={backupText}
            onChangeText={onChangeBackupText}
            multiline
            numberOfLines={6}
          />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.actionBtnText, { color: colors.primaryPressed }]}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primaryPressed }]}
              onPress={onRestore}
            >
              <Text style={styles.actionBtnText}>텍스트로 복원</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(64, 48, 56, 0.44)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.ink,
    marginBottom: 6,
  },
  promptGuideText: {
    fontSize: 12,
    color: colors.inkMuted,
    marginBottom: 14,
    lineHeight: 18,
  },
  filePickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.primary,
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
    color: colors.ink,
    marginBottom: 2,
  },
  filePickBtnSub: {
    fontSize: 11,
    color: colors.primaryPressed,
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
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  inputField: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
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


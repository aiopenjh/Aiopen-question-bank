import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { UniversalModal as Modal } from '../common/UniversalModal';
import { Topic, Source } from '../../contracts/types';
import { colors } from '../../styles/designTokens';

interface SourceUploadModalProps {
  visible: boolean;
  topics: Topic[];
  sources: Source[];
  sourceTitle: string;
  sourceText?: string;
  selectedSourceTopicId: string | null;
  onSelectSourceTopicId: (topicId: string | null) => void;
  onChangeSourceTitle: (title: string) => void;
  onPickSourceFile: () => Promise<void>;
  onSaveSource: () => Promise<void>;
  onDeleteSource?: (sourceId: string) => Promise<void>;
  onClose: () => void;
}

export const SourceUploadModal: React.FC<SourceUploadModalProps> = ({
  visible,
  topics,
  sources,
  sourceTitle,
  sourceText,
  selectedSourceTopicId,
  onSelectSourceTopicId,
  onChangeSourceTitle,
  onPickSourceFile,
  onSaveSource,
  onDeleteSource,
  onClose,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        activeOpacity={1}
        style={styles.overlay}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalCard}
          onPress={(e) => e.stopPropagation?.()}
        >
          {/* 헤더 */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.modalTitle}>📁 내자료업로드</Text>
              <Text style={styles.modalSubtitle}>
                파일 첨부 시 AI가 분석하여 해당 과목의 맞춤 문제로 출제합니다
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.closeBtnText}>← 뒤로</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* 1단계: 학습 과목(대단원) 이름 직접 입력 */}
            <Text style={styles.stepLabel}>1️⃣ 학습 과목(대단원) 이름</Text>
            <TextInput
              style={styles.inputField}
              placeholder="과목 또는 대단원명을 직접 입력하세요 (예: 정보처리기사, 한국사...)"
              placeholderTextColor="#94a3b8"
              value={sourceTitle}
              onChangeText={(text) => {
                onChangeSourceTitle(text);
                const matched = topics.find((t) => t.name.trim().toLowerCase() === text.trim().toLowerCase());
                onSelectSourceTopicId(matched ? matched.id : null);
              }}
            />

            {/* 2단계: 파일 첨부 버튼 (PDF, TXT, ZIP) */}
            <Text style={[styles.stepLabel, { marginTop: 12 }]}>2️⃣ 교재 파일 첨부</Text>
            <TouchableOpacity style={styles.uploadBtn} onPress={onPickSourceFile} activeOpacity={0.8}>
              <Text style={styles.uploadBtnIcon}>📁</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.uploadBtnTitle}>교재 / 문제집 파일 선택하기</Text>
                <Text style={styles.uploadBtnSub}>
                  {sourceText
                    ? '✅ 파일 내용 준비 완료 (터치하여 변경)'
                    : 'PDF, TXT, ZIP 파일 지원 (한글 문서는 변환 후 첨부)'}
                </Text>
              </View>
              <View style={styles.uploadTag}>
                <Text style={styles.uploadTagText}>{sourceText ? '변경' : '파일 탐색'}</Text>
              </View>
            </TouchableOpacity>

            {/* 등록 버튼 */}
            <TouchableOpacity
              style={[
                styles.saveBtn,
                !sourceTitle.trim() && styles.saveBtnDisabled,
              ]}
              onPress={async () => {
                await onSaveSource();
                onClose();
              }}
              disabled={!sourceTitle.trim()}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>💾 교재 자료 등록하기</Text>
            </TouchableOpacity>

            {/* 등록된 교재 자료 목록 */}
            {sources.length > 0 && (
              <View style={styles.sourceSection}>
                <Text style={styles.sourceSectionTitle}>📚 등록된 교재 자료 ({sources.length}건):</Text>
                {sources.map((s) => (
                  <View key={s.id} style={styles.sourceRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.sourceRowTitle} numberOfLines={1}>📄 {s.title}</Text>
                      <Text style={styles.sourceRowDate}>{s.createdAt.slice(0, 10)} 등록</Text>
                    </View>
                    {onDeleteSource && (
                      <TouchableOpacity
                        style={styles.deleteSourceBtn}
                        onPress={() => onDeleteSource(s.id)}
                      >
                        <Text style={styles.deleteSourceBtnText}>삭제</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(64, 48, 56, 0.44)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    padding: 20,
    paddingBottom: 30,
    borderTopWidth: 2,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.inkMuted,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.inkMuted,
  },
  scrollArea: {
    maxHeight: 520,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    padding: 13,
    marginBottom: 6,
    gap: 10,
  },
  uploadBtnIcon: {
    fontSize: 24,
  },
  uploadBtnTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 2,
  },
  uploadBtnSub: {
    fontSize: 10.5,
    color: colors.inkMuted,
  },
  uploadTag: {
    backgroundColor: '#ffe4e6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  uploadTagText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#e11d48',
  },
  inputField: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 14,
  },
  saveBtn: {
    backgroundColor: colors.primaryPressed,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  saveBtnDisabled: {
    backgroundColor: '#cbd5e1',
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: 'bold',
  },
  sourceSection: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  sourceSectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
    marginBottom: 8,
  },
  sourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  sourceRowTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  sourceRowDate: {
    fontSize: 10.5,
    color: '#94a3b8',
  },
  deleteSourceBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#fee2e2',
  },
  deleteSourceBtnText: {
    fontSize: 10.5,
    color: '#ef4444',
    fontWeight: '600',
  },
});

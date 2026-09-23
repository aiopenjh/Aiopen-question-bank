import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, StyleSheet } from 'react-native';
import { styles } from './settingsStyles';
import { UniversalModal as Modal } from '../../components/common/UniversalModal';
import { ViewportPopupLayer } from '../../components/common/ViewportPopupLayer';
import type { QuestionRevision, Topic, Unit } from '../../contracts/types';
import { generateWorkbookHtml } from '../../utils/workbookHtml';
import { showAlert } from '../../utils/alert';
import type { BackupKind } from '../../data/db';
import { colors, radius, shadows, spacing } from '../../styles/designTokens';

export interface DataBackupSectionProps {
  onExportBackup: (backupKind?: BackupKind) => Promise<void>;
  onOpenRestoreModal: () => void;
  onResetAllData: () => void;
  topics: Topic[];
  units: Unit[];
  questions: QuestionRevision[];
}

export const DataBackupSection: React.FC<DataBackupSectionProps> = ({
  onExportBackup,
  onOpenRestoreModal,
  onResetAllData,
  topics,
  units,
  questions,
}) => {
  const [workbookVisible, setWorkbookVisible] = useState(false);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [includeExplanations, setIncludeExplanations] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [backupChoiceVisible, setBackupChoiceVisible] = useState(false);
  const availableTopics = topics.filter((topic) => questions.some((question) => question.topicId === topic.id));

  function openWorkbook() {
    setSelectedTopicIds([]);
    setIncludeExplanations(false);
    setWorkbookVisible(true);
  }

  function exportWorkbook() {
    const selectedTopics = availableTopics.filter((topic) => selectedTopicIds.includes(topic.id));
    if (!selectedTopics.length) {
      showAlert('과목 선택', '문제집에 담을 과목을 하나 이상 선택해 주세요.');
      return;
    }
    if (Platform.OS !== 'web') {
      showAlert('PDF 저장', '현재 PDF 저장은 웹 버전에서 이용할 수 있습니다.');
      return;
    }
    const watermarkAsset = require('../../../assets/android-icon-foreground-v2.png');
    const watermarkImageUrl = watermarkAsset?.uri
      ? new URL(watermarkAsset.uri, window.location.href).href : '';
    const html = generateWorkbookHtml(
      selectedTopics,
      units,
      questions.filter((question) => selectedTopicIds.includes(question.topicId || '')),
      includeExplanations,
      watermarkImageUrl,
      window.location.href
    );
    setWorkbookVisible(false);
    const workbookUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    window.location.assign(workbookUrl);
  }

  function chooseBackup(backupKind: BackupKind) {
    setBackupChoiceVisible(false);
    void onExportBackup(backupKind);
  }

  async function saveWorkbookPdf() {
    const selectedTopics = availableTopics.filter((topic) => selectedTopicIds.includes(topic.id));
    if (!selectedTopics.length) {
      showAlert('과목 선택', '문제집에 담을 과목을 하나 이상 선택해 주세요.');
      return;
    }
    if (Platform.OS !== 'web' || savingPdf) return;
    setSavingPdf(true);
    try {
      const watermarkAsset = require('../../../assets/android-icon-foreground-v2.png');
      const watermarkImageUrl = watermarkAsset?.uri
        ? new URL(watermarkAsset.uri, window.location.href).href : '';
      const { createWorkbookPdf } = await import('../../utils/workbookPdf');
      const bytes = await createWorkbookPdf(
        selectedTopics,
        units,
        questions.filter((question) => selectedTopicIds.includes(question.topicId || '')),
        includeExplanations,
        watermarkImageUrl
      );
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Celueste_Workbook_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setWorkbookVisible(false);
    } catch (error) {
      showAlert('PDF 저장 실패', error instanceof Error ? error.message : 'PDF를 만드는 중 오류가 발생했습니다.');
    } finally {
      setSavingPdf(false);
    }
  }

  return (
    <>
      <View style={styles.compactCard}>
        <View style={styles.compactCardHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.compactCardTitle}>내 문제집 내보내기</Text>
            <Text style={styles.compactCardSubtitle}>과목을 골라 단원별 A4 PDF 문제집으로 저장</Text>
          </View>
          <TouchableOpacity style={styles.miniBtnPrimary} onPress={openWorkbook} activeOpacity={0.7}>
            <Text style={styles.miniBtnPrimaryText}>문제집 만들기</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.compactCard}>
        <View style={styles.compactCardHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.compactCardTitle}>학습 데이터 백업</Text>
            <Text style={styles.compactCardSubtitle}>
              문제 공유용 또는 기기 이전용 전체 백업 · API 키 제외
            </Text>
          </View>
          <View style={styles.compactBtnGroup}>
            <TouchableOpacity
              style={styles.miniBtnPrimary}
              onPress={() => setBackupChoiceVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.miniBtnPrimaryText}>백업하기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.miniBtnSecondary}
              onPress={onOpenRestoreModal}
              activeOpacity={0.7}
            >
              <Text style={styles.miniBtnSecondaryText}>복원하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ViewportPopupLayer visible={backupChoiceVisible} onRequestClose={() => setBackupChoiceVisible(false)}>
        {/* 바깥 영역을 누르면 닫힌다. Android 뒤로가기는 onRequestClose가 처리한다. */}
        <TouchableOpacity activeOpacity={1} style={backupChoiceStyles.overlay} onPress={() => setBackupChoiceVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={backupChoiceStyles.card} onPress={(e) => e.stopPropagation?.()}>
            <TouchableOpacity style={backupChoiceStyles.option} onPress={() => chooseBackup('question-bank')} activeOpacity={0.8}>
              <Text style={backupChoiceStyles.optionTitle}>문제만 백업</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[backupChoiceStyles.option, backupChoiceStyles.optionLast]} onPress={() => chooseBackup('full')} activeOpacity={0.8}>
              <Text style={backupChoiceStyles.optionTitle}>전체 백업</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </ViewportPopupLayer>

      <Modal visible={workbookVisible} transparent animationType="fade" onRequestClose={() => setWorkbookVisible(false)}>
        <View style={workbookStyles.overlay}>
          <View style={workbookStyles.card}>
            <Text style={workbookStyles.title}>내 문제집 내보내기</Text>
            <Text style={workbookStyles.description}>저장할 과목을 선택하세요. 단원마다 새 페이지로 구분됩니다.</Text>
            <ScrollView style={workbookStyles.list}>
              {availableTopics.length ? availableTopics.map((topic) => {
                const checked = selectedTopicIds.includes(topic.id);
                const count = questions.filter((question) => question.topicId === topic.id).length;
                return <TouchableOpacity key={topic.id} style={workbookStyles.row}
                  accessibilityRole="checkbox" accessibilityState={{ checked }}
                  onPress={() => setSelectedTopicIds((current) => checked
                    ? current.filter((id) => id !== topic.id) : [...current, topic.id])}>
                  <Text style={workbookStyles.check}>{checked ? '☑' : '□'}</Text>
                  <Text style={workbookStyles.rowText}>{topic.name} · {count}문항</Text>
                </TouchableOpacity>;
              }) : <Text style={workbookStyles.description}>저장된 문제가 있는 과목이 없습니다.</Text>}
            </ScrollView>
            <TouchableOpacity style={workbookStyles.row} accessibilityRole="checkbox"
              accessibilityState={{ checked: includeExplanations }}
              onPress={() => setIncludeExplanations((value) => !value)}>
              <Text style={workbookStyles.check}>{includeExplanations ? '☑' : '□'}</Text>
              <Text style={workbookStyles.rowText}>정답과 해설 포함</Text>
            </TouchableOpacity>
            <TouchableOpacity style={workbookStyles.directSave} onPress={saveWorkbookPdf} disabled={savingPdf}>
              <Text style={workbookStyles.directSaveText}>{savingPdf ? 'PDF 만드는 중…' : 'PDF 파일 바로 저장'}</Text>
            </TouchableOpacity>
            <View style={workbookStyles.actions}>
              <TouchableOpacity style={workbookStyles.cancel} onPress={() => setWorkbookVisible(false)}>
                <Text style={workbookStyles.cancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={workbookStyles.submit} onPress={exportWorkbook}>
                <Text style={workbookStyles.submitText}>PDF 저장 화면 열기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ⚠️ 데이터 클린 초기화 */}
      <View style={[styles.compactCard, styles.resetCard]}>
        <View style={styles.compactCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.compactCardTitle, styles.resetTitle]}>전체 데이터 초기화</Text>
          </View>
          <TouchableOpacity
            style={styles.miniResetBtn}
            onPress={onResetAllData}
            activeOpacity={0.7}
          >
            <Text style={styles.miniResetBtnText}>초기화</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
};

const workbookStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(31,24,29,0.55)', padding: 20 },
  card: { maxHeight: '80%', backgroundColor: '#fff', borderRadius: 18, padding: 20 },
  title: { fontSize: 19, fontWeight: '800', color: '#302832', marginBottom: 7 },
  description: { fontSize: 13, lineHeight: 19, color: '#716770', marginBottom: 12 },
  list: { maxHeight: 290, marginBottom: 10 },
  row: { minHeight: 45, flexDirection: 'row', alignItems: 'center' },
  check: { fontSize: 23, color: '#9d6278', width: 34 },
  rowText: { fontSize: 15, color: '#302832', flex: 1 },
  directSave: { marginTop: 12, padding: 13, alignItems: 'center', borderRadius: 9, backgroundColor: '#995e75' },
  directSaveText: { color: '#fff', fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 15 },
  cancel: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 9, backgroundColor: '#f4eff1' },
  cancelText: { color: '#6d6168', fontWeight: '700' },
  submit: { flex: 2, padding: 12, alignItems: 'center', borderRadius: 9, backgroundColor: '#995e75' },
  submitText: { color: '#fff', fontWeight: '800' },
});

// 선택지가 두 개뿐인 백업 범위 팝업 전용 compact 스타일 (문제집·복원 모달과 별도)
const backupChoiceStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(64,48,56,0.36)', padding: spacing.xl },
  card: {
    width: '100%', maxWidth: 300, alignSelf: 'center', overflow: 'hidden', backgroundColor: colors.surface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    ...shadows.soft,
  },
  option: {
    minHeight: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: spacing.lg,
  },
  optionLast: { borderBottomWidth: 0 },
  optionTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.ink },
});

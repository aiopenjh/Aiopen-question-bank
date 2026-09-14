import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { RoutineRevision } from '../../contracts/types';
import { ROUTINE_PRESETS } from '../../domain/routine';
import { showAlert } from '../../utils/alert';

interface SettingsScreenProps {
  apiKey: string;
  onChangeApiKey: (text: string) => void;
  onSaveApiKey: (keyToSave?: string) => Promise<void>;
  onDeleteApiKey?: () => Promise<void>;
  preferredModel?: string;
  onChangePreferredModel?: (model: string) => Promise<void>;
  routine: RoutineRevision | null;
  onChangeRoutinePreset: (presetKey: string) => Promise<void>;
  onExportBackup: () => Promise<void>;
  onOpenRestoreModal: () => void;
  onResetAllData: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  apiKey,
  onChangeApiKey,
  onSaveApiKey,
  onDeleteApiKey,
  preferredModel = 'gemini-3.5-flash',
  onChangePreferredModel,
  routine,
  onChangeRoutinePreset,
  onExportBackup,
  onOpenRestoreModal,
  onResetAllData,
}) => {
  const [inputKey, setInputKey] = useState(apiKey);
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setInputKey(apiKey);
  }, [apiKey]);

  const isRegistered = apiKey.trim().length > 8;

  async function handlePressSave() {
    const trimmed = inputKey.trim();
    if (!trimmed) {
      showAlert('알림', '저장할 API Key를 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      onChangeApiKey(trimmed);
      await onSaveApiKey(trimmed);
      setIsEditingKey(false);
    } catch (err: any) {
      showAlert('오류', `저장 중 오류 발생: ${err?.message || '알 수 없는 오류'}`);
    } finally {
      setSaving(false);
    }
  }

  async function handlePressDelete() {
    if (!onDeleteApiKey) return;
    showAlert('키 삭제 확인', '등록된 API Key를 완전히 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제하기',
        style: 'destructive',
        onPress: async () => {
          await onDeleteApiKey();
          setInputKey('');
          setIsEditingKey(true);
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollPadding}>
      {/* 1. API Key 연결 상태 카드 (저장 시 입력창 완전 소멸) */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardSectionTitle}>🔑 AI 출제 공급자 연결</Text>
          <View style={isRegistered ? styles.connectedBadge : styles.disconnectedBadge}>
            <Text style={isRegistered ? styles.connectedBadgeText : styles.disconnectedBadgeText}>
              {isRegistered ? '🟢 연동 완료' : '⚪ 미연동'}
            </Text>
          </View>
        </View>

        {isRegistered && !isEditingKey ? (
          /* 키가 이미 저장되어 있는 경우: 입력창은 완전히 사라지고 미니멀 상태 표시 */
          <View style={styles.savedKeyBanner}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Text style={{ fontSize: 16 }}>🔒</Text>
                <Text style={styles.savedKeyTitle}>API Key 암호화 저장됨</Text>
              </View>
              <Text style={styles.savedKeySubText}>
                {apiKey.trim().startsWith('AIzaSy')
                  ? 'Google Gemini 키가 등록되어 있습니다. (최신 3.5 우선 자동 통신)'
                  : apiKey.trim().startsWith('sk-ant-')
                  ? 'Anthropic Claude 키가 등록되어 있습니다.'
                  : apiKey.trim().startsWith('sk-')
                  ? 'OpenAI GPT 키가 등록되어 있습니다.'
                  : 'API Key가 안전하게 보관되어 있습니다.'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <TouchableOpacity
                style={styles.keyActionSmallBtn}
                onPress={() => {
                  setInputKey(apiKey);
                  setIsEditingKey(true);
                }}
              >
                <Text style={styles.keyActionSmallBtnText}>✏️ 변경</Text>
              </TouchableOpacity>
              {onDeleteApiKey && (
                <TouchableOpacity
                  style={[styles.keyActionSmallBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444' }]}
                  onPress={handlePressDelete}
                >
                  <Text style={[styles.keyActionSmallBtnText, { color: '#fca5a5' }]}>🗑️ 삭제</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          /* 최초 등록이거나 사용자가 '변경'을 눌렀을 때만 입력창 노출 */
          <View style={{ marginTop: 2 }}>
            <Text style={styles.promptGuideText}>
              사용하실 AI API 키를 입력 후 [저장하기]를 눌러주세요. (최신 3.5 모델이 자동 적용됩니다)
            </Text>

            <View style={styles.keyInputRow}>
              <TextInput
                style={styles.keyInputField}
                placeholder="API Key 입력 (예: AIzaSy...)"
                placeholderTextColor="#64748b"
                value={inputKey}
                onChangeText={setInputKey}
                autoCapitalize="none"
                secureTextEntry={!isKeyVisible}
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setIsKeyVisible(!isKeyVisible)}
              >
                <Text style={styles.eyeBtnText}>{isKeyVisible ? '🔒 숨김' : '👁️ 보기'}</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.primaryActionButton, { flex: 1 }]}
                onPress={handlePressSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryActionText}>🔒 안전하게 저장하기</Text>
                )}
              </TouchableOpacity>

              {isRegistered && (
                <TouchableOpacity
                  style={[styles.primaryActionButton, { backgroundColor: '#ffe4e6', borderWidth: 1, borderColor: '#fecdd3', flex: 0.4 }]}
                  onPress={() => {
                    setInputKey(apiKey);
                    setIsEditingKey(false);
                  }}
                  disabled={saving}
                >
                  <Text style={[styles.primaryActionText, { color: '#be123c' }]}>취소</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* 루틴 요일 설정 카드 */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>🌿 라이프스타일 학습 요일 설정</Text>
        <Text style={styles.promptGuideText}>
          나의 생활 패턴에 맞게 학습 요일을 선택하세요. 쉬는 날에는 스트레스 없는 편안한 휴식 모드로 전환됩니다.
        </Text>
        <View style={styles.presetButtonsContainer}>
          {Object.entries(ROUTINE_PRESETS).map(([key, item]) => {
            const isSelected = routine?.preset === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.presetButton, isSelected && styles.presetButtonSelected]}
                onPress={() => onChangeRoutinePreset(key)}
              >
                <Text style={[styles.presetButtonText, isSelected && styles.presetButtonTextSelected]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 백업 및 복원 */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>🛡️ 데이터 백업 및 복원</Text>
        <Text style={styles.promptGuideText}>
          모든 학습 데이터와 오답 기록은 스마트폰 로컬에 안전하게 저장됩니다.
        </Text>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            style={[styles.primaryActionButton, { flex: 1, backgroundColor: '#f43f5e' }]}
            onPress={onExportBackup}
          >
            <Text style={styles.primaryActionText}>💾 백업 내보내기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryActionButton, { flex: 1, backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fda4af' }]}
            onPress={onOpenRestoreModal}
          >
            <Text style={[styles.primaryActionText, { color: '#be123c' }]}>🔄 백업 복원하기</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 완전 초기화 버튼 */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>⚠️ 데이터 클린 초기화</Text>
        <Text style={styles.promptGuideText}>
          모든 데이터를 비우고 깨끗한 백지 상태에서 처음부터 다시 시작합니다.
        </Text>
        <TouchableOpacity
          style={[styles.primaryActionButton, { backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fca5a5' }]}
          onPress={onResetAllData}
        >
          <Text style={[styles.primaryActionText, { color: '#b91c1c' }]}>🗑️ 전체 데이터 초기화</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  tabContent: {
    flex: 1,
    backgroundColor: '#fff1f4',
  },
  scrollPadding: {
    padding: 16,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecdd3',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#881337',
    marginBottom: 8,
  },
  promptGuideText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 19,
    marginBottom: 12,
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
    marginBottom: 10,
  },
  primaryActionButton: {
    backgroundColor: '#f43f5e',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  presetButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    backgroundColor: '#fff5f7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecdd3',
    minWidth: '45%',
    alignItems: 'center',
  },
  presetButtonSelected: {
    backgroundColor: '#f43f5e',
    borderColor: '#e11d48',
  },
  presetButtonText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  presetButtonTextSelected: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  connectedBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  connectedBadgeText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '800',
  },
  disconnectedBadge: {
    backgroundColor: '#ffe4e6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  disconnectedBadgeText: {
    color: '#be123c',
    fontSize: 11,
    fontWeight: '700',
  },
  keyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  keyInputField: {
    flex: 1,
    backgroundColor: '#fff5f7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1f2937',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  eyeBtn: {
    backgroundColor: '#ffe4e6',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  eyeBtnText: {
    color: '#be123c',
    fontSize: 12,
    fontWeight: '700',
  },
  saveSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  saveSuccessTitle: {
    color: '#059669',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modelChip: {
    backgroundColor: '#fff5f7',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modelChipSelected: {
    backgroundColor: '#ffe4e6',
    borderColor: '#f43f5e',
  },
  modelChipText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  modelChipTextSelected: {
    color: '#be123c',
    fontWeight: '700',
  },
  savedKeyBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff5f7',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  savedKeyTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#881337',
  },
  savedKeySubText: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
    marginTop: 2,
  },
  keyActionSmallBtn: {
    backgroundColor: '#ffe4e6',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  keyActionSmallBtnText: {
    color: '#be123c',
    fontSize: 11,
    fontWeight: 'bold',
  },
});

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
                  ? 'Google Gemini 키가 등록되어 있습니다.'
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
              사용하실 AI API 키를 입력 후 [저장하기]를 눌러주세요.
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
                  style={[styles.primaryActionButton, { backgroundColor: '#334155', flex: 0.4 }]}
                  onPress={() => {
                    setInputKey(apiKey);
                    setIsEditingKey(false);
                  }}
                  disabled={saving}
                >
                  <Text style={styles.primaryActionText}>취소</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* 2. 출제 AI 모델 선택 (독립 카드) */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>🎯 출제 AI 모델 선택 (3.5+ 최우선)</Text>
        <Text style={styles.promptGuideText}>
          문제를 생성할 때 우선 적용할 최신 AI 모델을 지정합니다. 일시 혼잡(503) 시 다음 가용 모델로 자동 우회됩니다.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[
            { id: 'gemini-3.5-flash', label: '⚡ Gemini 3.5 Flash' },
            { id: 'gemini-3.5-flash-lite', label: '🪶 Gemini 3.5 Lite' },
            { id: 'gemini-3.6-flash', label: '🚀 Gemini 3.6 Flash' },
            { id: 'gemini-3.7-flash', label: '🧠 Gemini 3.7 Flash' },
            { id: 'gemini-3.8-flash', label: '👑 Gemini 3.8 Flash' },
            { id: 'claude-3-5-sonnet-20241022', label: '🟣 Claude 3.5' },
            { id: 'gpt-4o', label: '🟢 GPT-4o' },
          ].map((m) => {
            const isSelected = preferredModel === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.modelChip, isSelected && styles.modelChipSelected]}
                onPress={() => onChangePreferredModel && onChangePreferredModel(m.id)}
              >
                <Text style={[styles.modelChipText, isSelected && styles.modelChipTextSelected]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
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
            style={[styles.primaryActionButton, { flex: 1, backgroundColor: '#0f766e' }]}
            onPress={onExportBackup}
          >
            <Text style={styles.primaryActionText}>💾 백업 내보내기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryActionButton, { flex: 1, backgroundColor: '#334155' }]}
            onPress={onOpenRestoreModal}
          >
            <Text style={styles.primaryActionText}>🔄 백업 복원하기</Text>
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
          style={[styles.primaryActionButton, { backgroundColor: '#7f1d1d' }]}
          onPress={onResetAllData}
        >
          <Text style={styles.primaryActionText}>🗑️ 전체 데이터 초기화</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  tabContent: {
    flex: 1,
  },
  scrollPadding: {
    padding: 16,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 8,
  },
  promptGuideText: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 19,
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
  primaryActionButton: {
    backgroundColor: '#6366f1',
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
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    minWidth: '45%',
    alignItems: 'center',
  },
  presetButtonSelected: {
    backgroundColor: '#4338ca',
    borderColor: '#6366f1',
  },
  presetButtonText: {
    color: '#94a3b8',
    fontSize: 13,
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
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  connectedBadgeText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '800',
  },
  disconnectedBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  disconnectedBadgeText: {
    color: '#94a3b8',
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
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
  },
  eyeBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 8,
  },
  eyeBtnText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  saveSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  saveSuccessTitle: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modelChip: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modelChipSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderColor: '#38bdf8',
  },
  modelChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  modelChipTextSelected: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  savedKeyBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  savedKeyTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  savedKeySubText: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
    marginTop: 2,
  },
  keyActionSmallBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#475569',
  },
  keyActionSmallBtnText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: 'bold',
  },
});

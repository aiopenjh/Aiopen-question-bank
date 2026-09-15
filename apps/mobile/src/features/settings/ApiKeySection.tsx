import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { showAlert } from '../../utils/alert';
import { styles } from './settingsStyles';

export interface ApiKeySectionProps {
  apiKey: string;
  onChangeApiKey: (text: string) => void;
  onSaveApiKey: (keyToSave?: string) => Promise<void>;
  onDeleteApiKey?: () => Promise<void>;
}

export const ApiKeySection: React.FC<ApiKeySectionProps> = ({
  apiKey,
  onChangeApiKey,
  onSaveApiKey,
  onDeleteApiKey,
}) => {
  const [newKeyInput, setNewKeyInput] = useState('');
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const isRegistered = apiKey.trim().length > 8;

  const getProviderName = () => {
    const k = apiKey.trim();
    if (k.startsWith('AIzaSy')) return 'Google Gemini (최신 3.5 자동 연동)';
    if (k.startsWith('sk-ant-')) return 'Anthropic Claude';
    if (k.startsWith('sk-')) return 'OpenAI GPT';
    return '범용 AI 출제 엔진';
  };

  async function handlePressSave() {
    const trimmed = newKeyInput.trim();
    if (!trimmed) {
      showAlert('알림', '등록할 새로운 API Key를 붙여넣어 주세요.');
      return;
    }
    setSaving(true);
    try {
      onChangeApiKey(trimmed);
      await onSaveApiKey(trimmed);
      setNewKeyInput('');
      setIsEditingKey(false);
      showAlert('보안 등록 완료', '새로운 API Key가 안전하게 암호화 보관되었습니다.\n\n(보안을 위해 원문은 화면에 일절 노출되지 않습니다)');
    } catch (err: any) {
      showAlert('오류', `저장 중 오류 발생: ${err?.message || '알 수 없는 오류'}`);
    } finally {
      setSaving(false);
    }
  }

  async function handlePressDelete() {
    if (!onDeleteApiKey) return;
    showAlert('키 삭제 확인', '등록된 API Key를 완전히 파기하시겠습니까?\n\n삭제 시 새로운 문제를 생성하려면 다시 키를 등록하셔야 합니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제하기',
        style: 'destructive',
        onPress: async () => {
          await onDeleteApiKey();
          setNewKeyInput('');
          setIsEditingKey(false);
          showAlert('삭제 완료', '등록된 API Key가 안전하게 파기되었습니다.');
        },
      },
    ]);
  }

  return (
    <View style={[styles.card, { paddingVertical: 12, paddingHorizontal: 14 }]}>
      {isRegistered && !isEditingKey ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 14 }}>🔒</Text>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#881337' }}>
                AI 키 안전 보관 중
              </Text>
              <View style={[styles.connectedBadge, { paddingVertical: 2, paddingHorizontal: 6 }]}>
                <Text style={[styles.connectedBadgeText, { fontSize: 10 }]}>연동됨</Text>
              </View>
            </View>
            <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {getProviderName()} · 원문 영구 은닉
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <TouchableOpacity
              style={styles.keyActionSmallBtn}
              onPress={() => {
                setNewKeyInput('');
                setIsEditingKey(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.keyActionSmallBtnText}>🔄 교체</Text>
            </TouchableOpacity>
            {onDeleteApiKey && (
              <TouchableOpacity
                style={[
                  styles.keyActionSmallBtn,
                  { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: '#fca5a5' },
                ]}
                onPress={handlePressDelete}
                activeOpacity={0.8}
              >
                <Text style={[styles.keyActionSmallBtnText, { color: '#ef4444' }]}>🗑️</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#881337' }}>
              🔑 {isRegistered ? '새 API Key로 교체' : 'AI API Key 등록'}
            </Text>
            {isRegistered && (
              <TouchableOpacity
                onPress={() => setIsEditingKey(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ fontSize: 11, color: '#64748b' }}>취소 ✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <TextInput
              style={[styles.keyInputField, { flex: 1, paddingVertical: 7, fontSize: 12, marginBottom: 0 }]}
              placeholder="새로운 API Key 붙여넣기"
              placeholderTextColor="#94a3b8"
              value={newKeyInput}
              onChangeText={setNewKeyInput}
              autoCapitalize="none"
              secureTextEntry={true}
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[
                styles.primaryActionButton,
                { paddingVertical: 9, paddingHorizontal: 14, marginTop: 0, borderRadius: 10 },
                !newKeyInput.trim() && { opacity: 0.6 },
              ]}
              onPress={handlePressSave}
              disabled={saving || !newKeyInput.trim()}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={[styles.primaryActionText, { fontSize: 12 }]}>저장</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

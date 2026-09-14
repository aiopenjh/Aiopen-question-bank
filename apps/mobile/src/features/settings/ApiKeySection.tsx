import React, { useState, useEffect } from 'react';
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
              onChangeText={(text) => {
                setInputKey(text);
                onChangeApiKey(text);
              }}
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
                style={[
                  styles.primaryActionButton,
                  { backgroundColor: '#ffe4e6', borderWidth: 1, borderColor: '#fecdd3', flex: 0.4 },
                ]}
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
  );
};

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { showAlert } from '../../utils/alert';
import { styles } from './settingsStyles';

export interface ApiKeySectionProps {
  apiKey: string;
  onChangeApiKey: (text: string) => void;
  onSaveApiKey: (keyToSave?: string) => Promise<void>;
  onDeleteApiKey?: () => Promise<void>;
  onInputFocus?: () => void;
}

export const ApiKeySection: React.FC<ApiKeySectionProps> = ({
  apiKey,
  onChangeApiKey,
  onSaveApiKey,
  onDeleteApiKey,
  onInputFocus,
}) => {
  const [newKeyInput, setNewKeyInput] = useState('');
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const isRegistered = apiKey.trim().length > 8;

  async function handlePressSave() {
    const trimmed = newKeyInput.trim();
    if (!trimmed) {
      showAlert('알림', '등록할 새로운 API Key를 붙여넣어 주세요.');
      return;
    }
    setSaving(true);
    try {
      await onSaveApiKey(trimmed);
      onChangeApiKey(trimmed);
      setNewKeyInput('');
      setIsEditingKey(false);
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
        },
      },
    ]);
  }

  return (
    <View style={styles.card}>
      {isRegistered && !isEditingKey ? (
        <View style={styles.apiSummaryRow}>
          <View style={styles.apiSummaryCopy}>
            <View style={styles.apiTitleRow}>
              <Text style={styles.apiTitle}>AI 키 연결됨</Text>
              <View style={styles.connectedBadge}>
                <Text style={styles.connectedBadgeText}>연동됨</Text>
              </View>
            </View>
            <Text style={styles.apiProviderText}>
              등록된 키는 화면에 표시하지 않습니다.
            </Text>
          </View>

          <View style={styles.apiActions}>
            <TouchableOpacity
              style={styles.keyActionSmallBtn}
              onPress={() => {
                setNewKeyInput('');
                setIsEditingKey(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.keyActionSmallBtnText}>교체</Text>
            </TouchableOpacity>
            {onDeleteApiKey && (
              <TouchableOpacity
                style={[
                  styles.keyActionSmallBtn,
                  styles.dangerActionButton,
                ]}
                onPress={handlePressDelete}
                activeOpacity={0.8}
              >
                <Text style={[styles.keyActionSmallBtnText, styles.dangerActionText]}>삭제</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <View>
          <View style={styles.apiEditHeader}>
            <Text style={styles.apiTitle}>
              {isRegistered ? '새 API Key로 교체' : 'AI API Key 등록'}
            </Text>
            {isRegistered && (
              <TouchableOpacity
                onPress={() => setIsEditingKey(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.apiCancelText}>취소</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.apiInputRow}>
            <TextInput
              style={styles.keyInputField}
              placeholder="새로운 API Key 붙여넣기"
              placeholderTextColor="#94a3b8"
              value={newKeyInput}
              onChangeText={setNewKeyInput}
              onFocus={onInputFocus}
              autoCapitalize="none"
              secureTextEntry={true}
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[
                styles.primaryActionButton,
                styles.apiSaveButton,
                !newKeyInput.trim() && { opacity: 0.6 },
              ]}
              onPress={handlePressSave}
              disabled={saving || !newKeyInput.trim()}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.primaryActionText}>저장</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

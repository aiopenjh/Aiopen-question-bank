import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { showAlert } from '../../../utils/alert';

interface ApiKeySectionProps {
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
        <Text style={styles.cardSectionTitle}>🔑 AI 문제 출제 연결</Text>
        <View style={isRegistered ? styles.connectedBadge : styles.disconnectedBadge}>
          <Text style={isRegistered ? styles.connectedBadgeText : styles.disconnectedBadgeText}>
            {isRegistered ? '🔑 키 등록됨' : '⚪ 키 필요'}
          </Text>
        </View>
      </View>

      {isRegistered && !isEditingKey ? (
        <View style={styles.savedKeyBanner}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Text style={{ fontSize: 16 }}>🔒</Text>
              <Text style={styles.savedKeyTitle}>{Platform.OS === 'web' ? '현재 페이지에서 키 사용 중' : '기기 보안 저장소에 키 보관됨'}</Text>
            </View>
            <Text style={styles.savedKeySubText}>문제를 출제할 때 실제 연결 상태를 확인합니다.</Text>
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
            본인 API 키를 등록해 주세요. 등록은 실제 연결 성공을 뜻하지 않으며, 문제 출제 시 연결 결과를 확인합니다.
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
      <Text style={[styles.promptGuideText, { marginTop: 12 }]}>새 문제 출제에는 본인 API의 사용량이 적용됩니다. 저장된 문제 풀기와 복습은 추가 호출 없이 가능합니다. 웹에서는 새로고침 후 키를 다시 입력합니다.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
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
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#881337',
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
  promptGuideText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 19,
    marginBottom: 12,
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
});

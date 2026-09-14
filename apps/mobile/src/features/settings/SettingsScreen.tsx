import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { RoutineRevision } from '../../contracts/types';
import { ROUTINE_PRESETS } from '../../domain/routine';
import { showAlert } from '../../utils/alert';
import { AlarmConfig, DEFAULT_ALARM_CONFIG } from '../../utils/notifications';

interface SettingsScreenProps {
  apiKey: string;
  onChangeApiKey: (text: string) => void;
  onSaveApiKey: (keyToSave?: string) => Promise<void>;
  onDeleteApiKey?: () => Promise<void>;
  routine: RoutineRevision | null;
  onChangeRoutinePreset: (presetKey: string) => Promise<void>;
  alarmConfig?: AlarmConfig;
  onChangeAlarmConfig?: (config: AlarmConfig) => void;
  onExportBackup: () => Promise<void>;
  onOpenRestoreModal: () => void;
  onResetAllData: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  apiKey,
  onChangeApiKey,
  onSaveApiKey,
  onDeleteApiKey,
  routine,
  onChangeRoutinePreset,
  alarmConfig = DEFAULT_ALARM_CONFIG,
  onChangeAlarmConfig,
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

  function updateAlarm(patch: Partial<AlarmConfig>) {
    if (onChangeAlarmConfig) {
      onChangeAlarmConfig({ ...alarmConfig, ...patch });
    }
  }

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

      {/* ⏰ 평일 정기 학습 알람 카드 (2개 기본 폼, 시간 업앤다운 & 개별 활성화/비활성화) */}
      <View style={styles.card}>
        <View style={styles.alarmCardHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.cardSectionTitle}>⏰ 평일 정기 학습 알람</Text>
            <Text style={styles.alarmSubGuide}>
              평일(월~금) 원하는 시간대를 직접 선택하고 켜거나 끌 수 있습니다.
            </Text>
          </View>
          <View style={styles.alarmActiveBadge}>
            <Text style={styles.alarmActiveBadgeText}>🔔 월~금 알람</Text>
          </View>
        </View>

        {/* 1. 오전 알람 (범위: 8시 ~ 11시, 기본 8시) */}
        <View style={[styles.alarmItemBlock, !alarmConfig.morningEnabled && styles.alarmItemBlockDisabled]}>
          <View style={styles.alarmItemTopRow}>
            <View style={styles.alarmItemLeft}>
              <Text style={{ fontSize: 18 }}>🌅</Text>
              <View>
                <Text style={[styles.alarmItemTitle, !alarmConfig.morningEnabled && { color: '#94a3b8' }]}>
                  오전 알람
                </Text>
                <Text style={styles.alarmItemSubText}>선택 가능: 08:00 ~ 11:00</Text>
              </View>
            </View>

            {/* 개별 토글 버튼 */}
            <TouchableOpacity
              style={[
                styles.alarmToggleBtn,
                alarmConfig.morningEnabled ? styles.alarmToggleOn : styles.alarmToggleOff,
              ]}
              onPress={() => updateAlarm({ morningEnabled: !alarmConfig.morningEnabled })}
              activeOpacity={0.8}
            >
              <Text style={alarmConfig.morningEnabled ? styles.alarmToggleTextOn : styles.alarmToggleTextOff}>
                {alarmConfig.morningEnabled ? '🔔 활성화' : '🔕 끔'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 시간 업앤다운 스텝퍼 컨트롤러 */}
          <View style={[styles.alarmControlRow, !alarmConfig.morningEnabled && styles.alarmControlRowDisabled]}>
            <TouchableOpacity
              style={[
                styles.stepperArrowBtn,
                (!alarmConfig.morningEnabled || alarmConfig.morningHour <= 8) && styles.stepperArrowBtnDisabled,
              ]}
              onPress={() => {
                if (alarmConfig.morningHour > 8) {
                  updateAlarm({ morningHour: alarmConfig.morningHour - 1 });
                }
              }}
              disabled={!alarmConfig.morningEnabled || alarmConfig.morningHour <= 8}
            >
              <Text style={[
                styles.stepperArrowText,
                (!alarmConfig.morningEnabled || alarmConfig.morningHour <= 8) && styles.stepperArrowTextDisabled,
              ]}>
                ◀
              </Text>
            </TouchableOpacity>

            <View style={styles.timeDisplayCenter}>
              <Text style={[styles.timeDisplayText, !alarmConfig.morningEnabled && { color: '#94a3b8' }]}>
                {String(alarmConfig.morningHour).padStart(2, '0')}:00
              </Text>
              <Text style={[styles.timeDisplaySub, !alarmConfig.morningEnabled && { color: '#cbd5e1' }]}>
                오전 {alarmConfig.morningHour}시
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.stepperArrowBtn,
                (!alarmConfig.morningEnabled || alarmConfig.morningHour >= 11) && styles.stepperArrowBtnDisabled,
              ]}
              onPress={() => {
                if (alarmConfig.morningHour < 11) {
                  updateAlarm({ morningHour: alarmConfig.morningHour + 1 });
                }
              }}
              disabled={!alarmConfig.morningEnabled || alarmConfig.morningHour >= 11}
            >
              <Text style={[
                styles.stepperArrowText,
                (!alarmConfig.morningEnabled || alarmConfig.morningHour >= 11) && styles.stepperArrowTextDisabled,
              ]}>
                ▶
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. 저녁 알람 (범위: 19시 ~ 21시, 기본 20시) */}
        <View style={[styles.alarmItemBlock, !alarmConfig.eveningEnabled && styles.alarmItemBlockDisabled]}>
          <View style={styles.alarmItemTopRow}>
            <View style={styles.alarmItemLeft}>
              <Text style={{ fontSize: 18 }}>🌙</Text>
              <View>
                <Text style={[styles.alarmItemTitle, !alarmConfig.eveningEnabled && { color: '#94a3b8' }]}>
                  저녁 알람
                </Text>
                <Text style={styles.alarmItemSubText}>선택 가능: 19:00 ~ 21:00</Text>
              </View>
            </View>

            {/* 개별 토글 버튼 */}
            <TouchableOpacity
              style={[
                styles.alarmToggleBtn,
                alarmConfig.eveningEnabled ? styles.alarmToggleOn : styles.alarmToggleOff,
              ]}
              onPress={() => updateAlarm({ eveningEnabled: !alarmConfig.eveningEnabled })}
              activeOpacity={0.8}
            >
              <Text style={alarmConfig.eveningEnabled ? styles.alarmToggleTextOn : styles.alarmToggleTextOff}>
                {alarmConfig.eveningEnabled ? '🔔 활성화' : '🔕 끔'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 시간 업앤다운 스텝퍼 컨트롤러 */}
          <View style={[styles.alarmControlRow, !alarmConfig.eveningEnabled && styles.alarmControlRowDisabled]}>
            <TouchableOpacity
              style={[
                styles.stepperArrowBtn,
                (!alarmConfig.eveningEnabled || alarmConfig.eveningHour <= 19) && styles.stepperArrowBtnDisabled,
              ]}
              onPress={() => {
                if (alarmConfig.eveningHour > 19) {
                  updateAlarm({ eveningHour: alarmConfig.eveningHour - 1 });
                }
              }}
              disabled={!alarmConfig.eveningEnabled || alarmConfig.eveningHour <= 19}
            >
              <Text style={[
                styles.stepperArrowText,
                (!alarmConfig.eveningEnabled || alarmConfig.eveningHour <= 19) && styles.stepperArrowTextDisabled,
              ]}>
                ◀
              </Text>
            </TouchableOpacity>

            <View style={styles.timeDisplayCenter}>
              <Text style={[styles.timeDisplayText, !alarmConfig.eveningEnabled && { color: '#94a3b8' }]}>
                {alarmConfig.eveningHour}:00
              </Text>
              <Text style={[styles.timeDisplaySub, !alarmConfig.eveningEnabled && { color: '#cbd5e1' }]}>
                저녁 {alarmConfig.eveningHour > 12 ? alarmConfig.eveningHour - 12 : alarmConfig.eveningHour}시
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.stepperArrowBtn,
                (!alarmConfig.eveningEnabled || alarmConfig.eveningHour >= 21) && styles.stepperArrowBtnDisabled,
              ]}
              onPress={() => {
                if (alarmConfig.eveningHour < 21) {
                  updateAlarm({ eveningHour: alarmConfig.eveningHour + 1 });
                }
              }}
              disabled={!alarmConfig.eveningEnabled || alarmConfig.eveningHour >= 21}
            >
              <Text style={[
                styles.stepperArrowText,
                (!alarmConfig.eveningEnabled || alarmConfig.eveningHour >= 21) && styles.stepperArrowTextDisabled,
              ]}>
                ▶
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 🛡️ 데이터 백업 및 복원 (간소화된 컴팩트 디자인) */}
      <View style={styles.compactCard}>
        <View style={styles.compactCardHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.compactCardTitle}>🛡️ 데이터 백업 및 복원</Text>
            <Text style={styles.compactCardSubtitle}>
              학습 데이터 백업 파일 공유 및 복원
            </Text>
          </View>
          <View style={styles.compactBtnGroup}>
            <TouchableOpacity
              style={styles.miniBtnPrimary}
              onPress={onExportBackup}
              activeOpacity={0.7}
            >
              <Text style={styles.miniBtnPrimaryText}>💾 백업</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.miniBtnSecondary}
              onPress={onOpenRestoreModal}
              activeOpacity={0.7}
            >
              <Text style={styles.miniBtnSecondaryText}>🔄 복원</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ⚠️ 데이터 클린 초기화 (간소화) */}
      <View style={[styles.compactCard, { backgroundColor: '#fffafb', borderColor: '#ffe4e6' }]}>
        <View style={styles.compactCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.compactCardTitle, { fontSize: 13, color: '#94a3b8' }]}>전체 데이터 초기화</Text>
          </View>
          <TouchableOpacity
            style={styles.miniResetBtn}
            onPress={onResetAllData}
            activeOpacity={0.7}
          >
            <Text style={styles.miniResetBtnText}>🗑️ 초기화</Text>
          </TouchableOpacity>
        </View>
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
  alarmActiveBadge: {
    backgroundColor: '#ffe4e6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  alarmActiveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#be123c',
  },
  alarmCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  alarmSubGuide: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 8,
  },
  alarmItemBlock: {
    backgroundColor: '#fffafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecdd3',
    padding: 12,
    marginBottom: 10,
  },
  alarmItemBlockDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  alarmItemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alarmItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alarmItemTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#881337',
  },
  alarmItemSubText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  alarmToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  alarmToggleOn: {
    backgroundColor: '#ffe4e6',
    borderWidth: 1,
    borderColor: '#fda4af',
  },
  alarmToggleOff: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  alarmToggleTextOn: {
    color: '#e11d48',
    fontSize: 11,
    fontWeight: 'bold',
  },
  alarmToggleTextOff: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'bold',
  },
  alarmControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  alarmControlRowDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  stepperArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fda4af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperArrowBtnDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  stepperArrowText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#be123c',
  },
  stepperArrowTextDisabled: {
    color: '#cbd5e1',
  },
  timeDisplayCenter: {
    alignItems: 'center',
  },
  timeDisplayText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#881337',
  },
  timeDisplaySub: {
    fontSize: 10,
    color: '#e11d48',
    marginTop: 1,
    fontWeight: '600',
  },
  compactCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fecdd3',
    marginBottom: 12,
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  compactCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#881337',
    marginBottom: 2,
  },
  compactCardSubtitle: {
    fontSize: 11,
    color: '#64748b',
  },
  compactBtnGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  miniBtnPrimary: {
    backgroundColor: '#f43f5e',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  miniBtnPrimaryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  miniBtnSecondary: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fda4af',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  miniBtnSecondaryText: {
    color: '#be123c',
    fontSize: 12,
    fontWeight: '700',
  },
  miniResetBtn: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  miniResetBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '600',
  },
});

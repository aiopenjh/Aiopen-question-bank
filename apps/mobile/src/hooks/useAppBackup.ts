/**
 * Application JSON Backup & Legacy ZIP Restore Hook
 * Reference: CogniQuest_개발명세_v1
 */

import { useState } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import {
  exportBackupJSON,
  inspectBackupJSON,
  restoreBackupJSON,
  clearAllData,
} from '../data/db';
import type { BackupInspection, BackupKind } from '../data/db';
import {
  decompressBackupPayload,
  base64ToU8,
} from '../utils/backupArchive';
import { showAlert } from '../utils/alert';
import {
  ALL_DAYS,
  AlarmConfig,
  scheduleWeekdayStudyAlarms,
} from '../utils/notifications';

function isAlarmConfig(value: unknown): value is AlarmConfig {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AlarmConfig>;
  const validDays = new Set(ALL_DAYS);
  const hasMultipleTimes =
    typeof candidate.enabled === 'boolean' &&
    Array.isArray(candidate.times) &&
    candidate.times.every(
      (time) =>
        Number.isInteger(time?.hour) &&
        Number.isInteger(time?.minute) &&
        time.hour >= 0 &&
        time.hour <= 23 &&
        time.minute >= 0 &&
        time.minute <= 59
    );
  const hasUnifiedTime =
    typeof candidate.enabled === 'boolean' &&
    Number.isInteger(candidate.hour) &&
    Number.isInteger(candidate.minute) &&
    (candidate.hour as number) >= 0 &&
    (candidate.hour as number) <= 23 &&
    (candidate.minute as number) >= 0 &&
    (candidate.minute as number) <= 59;
  const hasLegacyTime =
    typeof candidate.morningEnabled === 'boolean' &&
    typeof candidate.eveningEnabled === 'boolean' &&
    Number.isInteger(candidate.morningHour) &&
    Number.isInteger(candidate.eveningHour) &&
    (candidate.morningHour as number) >= 0 &&
    (candidate.morningHour as number) <= 23 &&
    (candidate.eveningHour as number) >= 0 &&
    (candidate.eveningHour as number) <= 23;

  return (
    (hasMultipleTimes || hasUnifiedTime || hasLegacyTime) &&
    Array.isArray(candidate.selectedDays) &&
    candidate.selectedDays.every((day) => validDays.has(day))
  );
}

async function createPortableBackupJSON(backupKind: BackupKind): Promise<string> {
  return exportBackupJSON(backupKind);
}

function readRestoredAlarmConfig(jsonString: string): AlarmConfig | null {
  try {
    const parsed = JSON.parse(jsonString);
    return isAlarmConfig(parsed?.alarmConfig) ? parsed.alarmConfig : null;
  } catch {
    return null;
  }
}

/** 백업에 랭킹 복구 토큰이 실려 있는지 확인한다 (계획서 §3.1: 유출 시 랭킹 계정 복구에 쓰일 수 있는 민감 파일). */
function includesRankingRecoveryToken(jsonString: string): boolean {
  try {
    return !!JSON.parse(jsonString)?.rankingRecoveryToken;
  } catch {
    return false;
  }
}

export function useAppBackup(params: { onRefreshData: () => Promise<void> }) {
  const { onRefreshData } = params;

  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [backupText, setBackupText] = useState('');

  async function handleExportBackup(backupKind: BackupKind = 'question-bank') {
    let json = '';
    try {
      json = await createPortableBackupJSON(backupKind);
      const dateStr = new Date().toISOString().slice(0, 10);
      const isFullBackup = backupKind === 'full';
      const backupFileName = isFullBackup
        ? `Celueste_Full_Backup_${dateStr}.json`
        : `Celueste_Question_Bank_${dateStr}.json`;
      const rankingWarning = includesRankingRecoveryToken(json)
        ? '\n\n⚠️ 이 백업에는 랭킹 계정 복구 정보가 포함되어 있습니다. 유출되면 타인이 내 랭킹 계정에 접근할 수 있으니 안전하게 보관해 주세요.'
        : '';

      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = backupFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showAlert(
          isFullBackup ? '전체 백업 완료' : '문제은행 백업 완료',
          isFullBackup
            ? `백업 파일(${backupFileName})이 저장되었습니다. 학습 기록·교재·설정과 랭킹 복구 정보를 담으며 API 키는 포함하지 않습니다.${rankingWarning}`
            : `백업 파일(${backupFileName})이 저장되었습니다. 과목·단원·문제만 담으며 풀이 기록, 랭킹 계정과 API 키는 포함하지 않습니다.`
        );
      } else {
        const fileUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${backupFileName}`;
        await FileSystem.writeAsStringAsync(fileUri, json, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        if (await Sharing.isAvailableAsync()) {
          if (rankingWarning) {
            showAlert('백업 파일 안내', `공유/저장할 파일에 랭킹 계정 복구 정보가 포함됩니다.${rankingWarning}`);
          }
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: isFullBackup
              ? '전체 백업 파일 공유/저장'
              : '문제은행 백업 파일 공유/저장',
            UTI: 'public.json',
          });
        } else {
          // 공유 기능 미지원 기기 폴백
          setBackupText(json);
          setBackupModalVisible(true);
        }
      }
    } catch (err: any) {
      console.warn('백업 파일 생성 및 공유 실패:', err);
      if (json) {
        setBackupText(json);
        setBackupModalVisible(true);
      } else {
        showAlert('오류', `백업 생성 중 오류 발생: ${err?.message || '알 수 없는 오류'}`);
      }
    }
  }

  async function applyRestore(content: string, inspection: BackupInspection) {
    const restoredAlarmConfig = inspection.backupKind === 'full'
      ? readRestoredAlarmConfig(content)
      : null;
    const res = await restoreBackupJSON(content);
    if (res.success && restoredAlarmConfig) {
      // 운영체제의 예약 ID 자체는 기기 간 이동할 수 없으므로 설정을 저장한 뒤
      // 현재 기기에서 동일한 요일/시간으로 다시 예약한다.
      await scheduleWeekdayStudyAlarms(restoredAlarmConfig);
    }
    showAlert(res.success ? '복원 완료' : '복원 실패', res.message);
    if (res.success) {
      await onRefreshData();
      setBackupModalVisible(false);
      setBackupText('');
    }
  }

  async function requestRestore(content: string) {
    let inspection: BackupInspection;
    try {
      inspection = inspectBackupJSON(content);
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : '알 수 없는 형식 오류';
      showAlert('복원 실패', `백업 파일 형식이 올바르지 않거나 손상되었습니다: ${detail}`);
      return;
    }

    if (inspection.backupKind === 'full') {
      showAlert(
        '전체 백업 복원',
        '현재 기기의 과목·문제·풀이 기록·교재·설정이 백업 내용으로 교체됩니다. API 키는 유지됩니다. 계속하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '전체 복원',
            style: 'destructive',
            onPress: () => {
              void applyRestore(content, inspection);
            },
          },
        ]
      );
      return;
    }

    await applyRestore(content, inspection);
  }

  async function handleRestoreFromFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      let content = '';

      if (Platform.OS === 'web' && (file as any).file) {
        const arrayBuffer = await (file as any).file.arrayBuffer();
        const u8 = new Uint8Array(arrayBuffer);
        content = decompressBackupPayload(u8);
      } else {
        // 모바일: ZIP 압축 파일 여부 자동 감지 및 압축 해제
        try {
          const base64 = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const u8 = base64ToU8(base64);
          content = decompressBackupPayload(u8);
        } catch {
          content = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
        }
      }

      if (!content || !content.trim()) {
        showAlert('오류', '선택한 파일의 내용이 비어 있거나 올바르지 않습니다.');
        return;
      }

      await requestRestore(content);
    } catch (err: any) {
      console.warn('파일 복원 실패:', err);
      showAlert(
        '복원 실패',
        `백업 파일을 읽거나 압축을 푸는 중 오류가 발생했습니다: ${err?.message || '파일 오류'}`
      );
    }
  }

  async function handleRestoreBackup() {
    if (!backupText.trim()) {
      showAlert('알림', '복원할 백업 JSON 데이터를 입력(붙여넣기)해 주세요.');
      return;
    }
    await requestRestore(backupText);
  }

  function handleResetAllData() {
    showAlert(
      '전체 초기화',
      '모든 과목, 단원, 문제, 학습 기록과 등록한 API 키가 삭제됩니다. 풀이 기록과 교재까지 되살리려면 초기화 전에 전체 백업을 저장해 주세요.\n\n초기화 전에 필요한 데이터를 확인해 주세요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '완전 초기화',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            await onRefreshData();
            showAlert('초기화 완료', '모든 데이터가 깨끗하게 정리되었습니다.');
          },
        },
      ]
    );
  }

  return {
    backupModalVisible,
    setBackupModalVisible,
    backupText,
    setBackupText,
    handleExportBackup,
    handleRestoreFromFile,
    handleRestoreBackup,
    handleResetAllData,
  };
}

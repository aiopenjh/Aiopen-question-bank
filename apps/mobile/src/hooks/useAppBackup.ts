/**
 * Application Backup, Compressed ZIP Export & Restore Hook
 * Reference: CogniQuest_개발명세_v1
 */

import { useState } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { exportBackupJSON, restoreBackupJSON, clearAllData } from '../data/db';
import {
  compressBackupToZip,
  decompressBackupPayload,
  u8ToBase64,
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

  return (
    typeof candidate.morningEnabled === 'boolean' &&
    typeof candidate.eveningEnabled === 'boolean' &&
    Number.isInteger(candidate.morningHour) &&
    Number.isInteger(candidate.eveningHour) &&
    (candidate.morningHour as number) >= 0 &&
    (candidate.morningHour as number) <= 23 &&
    (candidate.eveningHour as number) >= 0 &&
    (candidate.eveningHour as number) <= 23 &&
    Array.isArray(candidate.selectedDays) &&
    candidate.selectedDays.every((day) => validDays.has(day))
  );
}

async function createPortableBackupJSON(): Promise<string> {
  return exportBackupJSON();
}

function readRestoredAlarmConfig(jsonString: string): AlarmConfig | null {
  try {
    const parsed = JSON.parse(jsonString);
    return isAlarmConfig(parsed?.alarmConfig) ? parsed.alarmConfig : null;
  } catch {
    return null;
  }
}

export function useAppBackup(params: { onRefreshData: () => Promise<void> }) {
  const { onRefreshData } = params;

  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [backupText, setBackupText] = useState('');

  async function handleExportBackup() {
    let json = '';
    try {
      json = await createPortableBackupJSON();
      const dateStr = new Date().toISOString().slice(0, 10);
      const zipFileName = `Celueste_Study_Backup_${dateStr}.zip`;
      const zipBytes = compressBackupToZip(json);

      if (Platform.OS === 'web') {
        // 웹 브라우저: .zip 압축 파일 직접 다운로드
        const blob = new Blob([zipBytes.buffer as ArrayBuffer], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = zipFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showAlert(
          '압축 백업 및 실전 문제집 생성 완료',
          `백업 파일(${zipFileName})이 저장되었습니다.\n\n` +
          `[ZIP 압축 파일 포함 구성]\n` +
          `1. 📝 전체 문제지.html\n   (브라우저에서 열어 인쇄/PDF 저장 가능)\n` +
          `2. 🎯 정답과 해설.html\n   (빠른 정답표 및 상세 해설 수록)\n` +
          `3. 📓 나만의 오답노트.html\n   (직접 저장한 문제와 손필기 공간)\n` +
          `4. 💾 backup_data.json\n   (API 키를 제외한 전체 학습 데이터 복원용 원본)`
        );
      } else {
        // 모바일 (Android/iOS): 압축 파일 생성 후 공유 시트로 전송 (카톡/메일/클라우드 저장 등)
        const fileUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${zipFileName}`;
        const base64 = u8ToBase64(zipBytes);
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/zip',
            dialogTitle: '전체 학습 데이터 백업 & 인쇄용 문제집 ZIP 공유/저장',
            UTI: 'public.zip-archive',
          });
        } else {
          // 공유 기능 미지원 기기 폴백
          setBackupText(json);
          setBackupModalVisible(true);
        }
      }
    } catch (err: any) {
      console.warn('압축 백업 파일 생성 및 공유 실패:', err);
      if (json) {
        setBackupText(json);
        setBackupModalVisible(true);
      } else {
        showAlert('오류', `백업 생성 중 오류 발생: ${err?.message || '알 수 없는 오류'}`);
      }
    }
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

      const restoredAlarmConfig = readRestoredAlarmConfig(content);
      const res = await restoreBackupJSON(content);
      if (res.success && restoredAlarmConfig) {
        // 운영체제의 예약 ID 자체는 기기 간 이동할 수 없으므로 설정을 저장한 뒤
        // 현재 기기에서 동일한 요일/시간으로 다시 예약한다.
        await scheduleWeekdayStudyAlarms(restoredAlarmConfig);
      }
      showAlert(res.success ? '압축 해제 및 복원 완료' : '복원 실패', res.message);
      if (res.success) {
        await onRefreshData();
        setBackupModalVisible(false);
        setBackupText('');
      }
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
    const restoredAlarmConfig = readRestoredAlarmConfig(backupText);
    const res = await restoreBackupJSON(backupText);
    if (res.success && restoredAlarmConfig) {
      await scheduleWeekdayStudyAlarms(restoredAlarmConfig);
    }
    showAlert(res.success ? '복원 완료' : '복원 실패', res.message);
    if (res.success) {
      await onRefreshData();
      setBackupModalVisible(false);
      setBackupText('');
    }
  }

  function handleResetAllData() {
    showAlert('전체 초기화', '모든 주제, 단원, 문제 및 학습 기록이 삭제됩니다. 계속하시겠습니까?', [
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
    ]);
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

import React, { useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, StyleSheet, View, Text } from 'react-native';
import { StudyAlarmStatus, setStudyAlarmsEnabled, subscribeStudyAlarmStatus, syncStudyAlarms } from '../../../utils/notifications';

export const AlarmSection: React.FC<{ activeDays: number[] }> = ({ activeDays }) => {
  const [status, setStatus] = useState<StudyAlarmStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const daysKey = activeDays.join(',');
  useEffect(() => {
    let mounted = true;
    const update = (next: StudyAlarmStatus) => { if (mounted) setStatus(next); };
    const unsubscribe = subscribeStudyAlarmStatus(update);
    void syncStudyAlarms(activeDays).then(update);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void syncStudyAlarms(activeDays).then(update);
    });
    return () => { mounted = false; unsubscribe(); subscription.remove(); };
  }, [daysKey]);
  async function change(enabled: boolean) {
    setBusy(true);
    try { setStatus(await setStudyAlarmsEnabled(enabled, activeDays)); }
    finally { setBusy(false); }
  }
  const registered = status?.enabled && !status.error && status.scheduledCount === status.expectedCount;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>⏰ 매일 아침 · 저녁 문제 출제 알림</Text>
      <Text style={styles.badge}>{!status ? '설정 확인 중' : registered ? '알림 등록됨 (매일 발송)' : status.error ? '설정 확인 필요' : '알림 꺼짐'}</Text>
      <Text style={styles.description}>
        요일과 상관없이 매일(월~일) 오전 8시와 저녁 8시에 문제 출제 알림을 받습니다. 알림을 누르면 준비된 문제 풀이를 시작합니다.
      </Text>
      {status?.enabled && <Text style={styles.description}>기기에 등록된 학습 알림: {status.scheduledCount}/{status.expectedCount}개 (매일 오전 8시 · 저녁 8시)</Text>}
      {!!status?.error && <Text accessibilityRole="alert" style={styles.error}>{status.error}</Text>}
      {!!settingsError && <Text accessibilityRole="alert" style={styles.error}>{settingsError}</Text>}
      <View style={styles.row}>
        <Pressable accessibilityRole="button" disabled={busy || !status || Platform.OS === 'web'}
          style={[styles.button, (busy || !status || Platform.OS === 'web') && styles.disabled]}
          onPress={() => void change(!status?.enabled)}>
          <Text style={styles.buttonText}>{busy ? '처리 중…' : status?.enabled ? '알림 끄기' : '알림 켜기'}</Text>
        </Pressable>
        {!!status?.error && Platform.OS !== 'web' && <Pressable accessibilityRole="button" style={styles.button} disabled={busy}
          onPress={() => void change(status.enabled)}><Text style={styles.buttonText}>다시 확인</Text></Pressable>}
        {Platform.OS !== 'web' && <Pressable accessibilityRole="button" style={styles.button}
          onPress={() => { void Linking.openSettings().catch(() => setSettingsError('휴대폰 설정에서 Celueste 앱의 알림을 확인해 주세요.')); }}>
          <Text style={styles.buttonText}>휴대폰 설정</Text>
        </Pressable>}
      </View>
      <Text style={styles.note}>알림을 처음 켤 때 권한을 요청합니다. 절전·방해 금지·기기 설정에 따라 소리나 도착 시간이 달라질 수 있습니다.</Text>
    </View>
  );
};
const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#fecdd3' },
  title: { fontSize: 16, fontWeight: 'bold', color: '#881337' },
  badge: { color: '#be123c', fontWeight: '700', marginVertical: 8 },
  description: { fontSize: 13, color: '#475569', lineHeight: 20, marginBottom: 8 },
  error: { color: '#b91c1c', lineHeight: 20, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { backgroundColor: '#ffe4e6', borderRadius: 8, padding: 12 },
  buttonText: { color: '#881337', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  note: { color: '#64748b', fontSize: 12, lineHeight: 18, marginTop: 12 },
});

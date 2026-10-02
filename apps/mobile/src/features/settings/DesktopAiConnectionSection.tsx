import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  AiConnectionChoice, DesktopModel, DesktopProviderId, DesktopProviderStatus,
  disconnectDesktopProvider, getDesktopModels, getDesktopProviders, isDesktopConnectorEnvironment,
  readAiConnectionChoice, saveAiConnectionChoice, startDesktopLogin,
} from '../../integrations/desktop_ai_connector';
import { colors, radius, spacing } from '../../styles/designTokens';

const entries: Array<{ id: DesktopProviderId; name: string; signup: string }> = [
  { id: 'openai', name: 'GPT', signup: 'https://chatgpt.com/' },
  { id: 'google', name: 'Gemini', signup: 'https://accounts.google.com/signup' },
];

export const DesktopAiConnectionSection: React.FC = () => {
  const available = isDesktopConnectorEnvironment();
  const [providers, setProviders] = useState<DesktopProviderStatus[]>([]);
  const [choice, setChoice] = useState<AiConnectionChoice>({ mode: 'api-key' });
  const [selected, setSelected] = useState<DesktopProviderId | null>(null);
  const [models, setModels] = useState<DesktopModel[]>([]);
  const [model, setModel] = useState('');
  const [modelsOpen, setModelsOpen] = useState(false);
  const [apiAccepted, setApiAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('사용할 AI를 연결하세요.');
  const mounted = useRef(true), sequence = useRef(0);
  const savedChoice = useRef<AiConnectionChoice>(choice);
  const reload = useCallback(async () => {
    try {
      const [statuses, saved] = await Promise.all([getDesktopProviders(), readAiConnectionChoice()]);
      if (!mounted.current) return;
      savedChoice.current = saved; setChoice(saved); setProviders(statuses);
      const failed = statuses.find(item => item.lastResult && !item.lastResult.ok);
      if (failed) setMessage(failed.lastResult!.message);
    } catch (error: any) { if (mounted.current) setMessage(error?.message || '로그인 프로그램을 먼저 실행하세요.'); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    if (available) { void reload(); window.addEventListener('focus', reload); }
    return () => { mounted.current = false; if (available) window.removeEventListener('focus', reload); };
  }, [available, reload]);
  useEffect(() => {
    if (!providers.some(item => item.status === 'connecting')) return;
    const timer = setInterval(() => void reload(), 2000); return () => clearInterval(timer);
  }, [providers, reload]);
  const connected = selected ? providers.find(item => item.canInfer && item.id === selected)
    : providers.find(item => item.canInfer && choice.mode === 'desktop' && item.id === choice.providerId)
      ?? providers.find(item => item.canInfer);
  useEffect(() => {
    const current = ++sequence.current;
    setModels([]); setModel(''); setModelsOpen(false); setApiAccepted(false);
    if (!connected) return;
    setBusy(true);
    getDesktopModels(connected.id).then(async items => {
      if (!mounted.current || current !== sequence.current) return;
      const saved = savedChoice.current;
      const prior = saved.mode === 'desktop' && saved.providerId === connected.id ? saved.model : '';
      const nextModel = items.some(item => item.id === prior) ? prior : items[0]?.id ?? '';
      setModels(items); setModel(nextModel);
      if (nextModel && connected.authMode !== 'google-api-oauth' && (saved.mode === 'api-key' || saved.providerId !== connected.id || !prior || prior !== nextModel)) {
        const next: AiConnectionChoice = { mode: 'desktop', providerId: connected.id, model: nextModel, acceptApiUsage: false };
        await saveAiConnectionChoice(next);
        if (!mounted.current || current !== sequence.current) return;
        savedChoice.current = next; setChoice(next); setMessage('연결됐습니다. 바로 문제를 출제할 수 있습니다.');
      }
      if (saved.mode === 'desktop' && saved.providerId === connected.id) setApiAccepted(saved.acceptApiUsage);
      if (!items.length) setMessage('사용 가능한 모델이 없습니다.');
    }).catch(error => { if (mounted.current && current === sequence.current) setMessage(error.message); })
      .finally(() => { if (mounted.current && current === sequence.current) setBusy(false); });
  }, [connected?.id, connected?.activeAccountId]);
  if (!available) return null;
  async function action(operation: () => Promise<void>) {
    setBusy(true);
    try { await operation(); }
    catch (error: any) { if (mounted.current) setMessage(error?.message || '연결을 확인해 주세요.'); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <View style={s.section}>
    <Text style={s.description}>내 계정으로 로그인하고 사용할 AI를 선택하세요.</Text>
    <View style={s.providerGrid}>{entries.map(entry => {
      const provider = providers.find(item => item.id === entry.id);
      const hint = !provider ? '' : provider.status === 'connecting' ? '로그인 중…'
        : provider.canInfer ? choice.mode === 'desktop' && choice.providerId === entry.id && model ? '출제 준비됨' : '모델 확인 중…'
        : provider.status === 'identity-only' ? '로그인됨 · AI 사용 권한은 별도'
        : entry.id === 'anthropic' ? '구독 로그인 연결 미지원'
        : entry.id === 'google' && !provider.canConnect ? 'Google 로그인 앱 등록 필요' : '';
      return <View key={entry.id} style={s.providerCard}>
        <Text style={s.providerName}>{entry.name}</Text>
        <Text style={s.providerHint}>{hint || '계정을 연결하세요.'}</Text>
          <TouchableOpacity style={[s.button, (busy || !provider) && s.disabled]}
            disabled={busy || !provider}
            accessibilityRole="button" onPress={() => {
              setSelected(entry.id);
              if (provider && !provider.canConnect && !provider.canInfer) {
                setMessage(entry.id === 'google' ? 'Google 로그인 앱 등록이 완료되면 계정 로그인으로 연결할 수 있습니다.' : provider.description);
                return;
              }
              if (provider?.canInfer) { setSelected(entry.id); setModelsOpen(true); return; }
              void action(async () => {
                await startDesktopLogin(entry.id, provider?.activeAccountId ?? null);
                setMessage('공식 로그인 페이지로 이동합니다.'); await reload();
              });
            }}><Text style={s.buttonText}>{entry.name + (provider?.canInfer ? ' · 연결됨' : provider && !provider.canConnect ? ' · 연결 준비' : '로 연결')}</Text></TouchableOpacity>
        <View style={s.cardActions}>
          <TouchableOpacity accessibilityRole="link" onPress={() => void Linking.openURL(provider?.signupUrl ?? entry.signup)}><Text style={s.link}>가입</Text></TouchableOpacity>
          {(provider?.canInfer || provider?.status === 'identity-only') && <TouchableOpacity disabled={busy} accessibilityRole="button" onPress={() => void action(async () => {
            setMessage(await disconnectDesktopProvider(entry.id)); setSelected(null); await reload();
          })}><Text style={s.link}>해제</Text></TouchableOpacity>}
        </View>
      </View>;
    })}</View>
    {connected && models.length > 0 && <View style={s.picker}>
      <TouchableOpacity style={s.modelTrigger} disabled={busy} accessibilityRole="button" accessibilityState={{ expanded: modelsOpen }}
        accessibilityLabel="사용할 AI 모델 선택" onPress={() => setModelsOpen(value => !value)}>
        <Text style={s.modelName}>{models.find(item => item.id === model)?.name ?? '모델 선택'}</Text><Text style={s.link}>{modelsOpen ? '⌃' : '⌄'}</Text>
      </TouchableOpacity>
      {modelsOpen && <View style={s.modelMenu}>
        {connected.authMode === 'google-api-oauth' && <TouchableOpacity disabled={busy} style={s.consent} accessibilityRole="checkbox" accessibilityState={{ checked: apiAccepted }}
          onPress={() => setApiAccepted(value => !value)}><Text style={s.hint}>{apiAccepted ? '☑' : '☐'} Gemini 구독과 별도로 Google API 사용량·과금이 적용될 수 있습니다.</Text></TouchableOpacity>}
        <ScrollView style={s.models} nestedScrollEnabled>
          {models.map(item => <TouchableOpacity key={item.id}
            disabled={busy || (connected.authMode === 'google-api-oauth' && !apiAccepted)}
            style={[s.model, model === item.id && s.selectedModel]} accessibilityRole="radio" accessibilityState={{ checked: model === item.id }}
            onPress={() => void action(async () => {
              const next: AiConnectionChoice = { mode: 'desktop', providerId: connected.id, model: item.id, acceptApiUsage: apiAccepted };
              await saveAiConnectionChoice(next); savedChoice.current = next; setChoice(next); setModel(item.id); setModelsOpen(false);
              setMessage('이 AI로 출제·힌트·채점을 진행합니다.');
            })}><Text style={s.modelName}>{item.name}</Text><Text style={s.check}>{model === item.id ? '✓' : ''}</Text></TouchableOpacity>)}
        </ScrollView>
      </View>}
    </View>}
    {choice.mode === 'desktop' && <Text style={s.hint}>사용 중: {entries.find(item => item.id === choice.providerId)?.name} · {choice.model}</Text>}
    {busy && <ActivityIndicator color={colors.primaryPressed} />}
    <Text style={s.hint} accessibilityLiveRegion="polite">{message}</Text>
  </View>;
};
const s = StyleSheet.create({
  section: { paddingVertical: spacing.md, gap: spacing.md },
  providerGrid: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  providerCard: { flex: 1, minWidth: 0, gap: spacing.sm, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  providerName: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  providerHint: { color: colors.inkMuted, fontSize: 12, lineHeight: 18, minHeight: 36 },
  cardActions: { flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end', alignItems: 'center' },
  button: { backgroundColor: colors.primaryPressed, borderRadius: radius.sm, padding: spacing.md },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: '600' },
  description: { color: colors.inkMuted, fontSize: 13, lineHeight: 20 },
  hint: { color: colors.inkMuted, fontSize: 12, lineHeight: 18, marginTop: spacing.xs },
  link: { color: colors.primaryPressed, fontSize: 12 },
  disabled: { opacity: 0.45 },
  picker: { position: 'relative', alignSelf: 'flex-start', zIndex: 20 },
  modelTrigger: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface },
  modelMenu: { position: 'absolute', bottom: 44, left: 0, width: 260, padding: spacing.xs, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.surface, elevation: 8,
    shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12 },
  models: { maxHeight: 200 }, consent: { padding: spacing.sm },
  model: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  selectedModel: { backgroundColor: colors.primarySoft },
  modelName: { color: colors.ink, fontSize: 13, flexShrink: 1 }, check: { color: colors.primaryPressed, fontSize: 15 },
});

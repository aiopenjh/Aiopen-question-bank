import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadows, spacing } from '../../styles/designTokens';

interface StorageSafeModeScreenProps {
  error: string;
  onRetry: () => void;
}

export function StorageSafeModeScreen({ error, onRetry }: StorageSafeModeScreenProps) {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>🛡️</Text>
          </View>
          <Text style={styles.title}>학습 저장소를 열 수 없습니다</Text>
          <Text style={styles.description}>
            최신 학습 기록을 보호하기 위해 이전 저장소로 자동 전환하지 않았습니다.
          </Text>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
          <Text style={styles.notice}>
            앱 저장공간이나 데이터를 삭제하지 마세요. 잠시 후 다시 시도해 주세요.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.retryButton}
            onPress={onRetry}
          >
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    ...shadows.soft,
  },
  iconCircle: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.lg,
  },
  icon: {
    fontSize: 26,
  },
  title: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: {
    color: colors.inkMuted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  errorBox: {
    width: '100%',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  notice: {
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  retryButton: {
    width: '100%',
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryPressed,
    borderRadius: radius.md,
    marginTop: spacing.xl,
    ...shadows.action,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
});

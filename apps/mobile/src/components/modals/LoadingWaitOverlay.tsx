import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  AccessibilityInfo,
  Animated,
  Easing,
} from 'react-native';
import { appStyles as styles } from '../../styles/appStyles';
import { colors } from '../../styles/designTokens';
import { AiGeneratingDanceSprite } from './AiGeneratingDanceSprite';

export interface LoadingWaitOverlayProps {
  status: {
    active: boolean;
    count: number;
    title?: string;
    message?: string;
  } | null;
  isAbsolute?: boolean;
  onCancel?: () => void;
}

/**
 * AI 문제 출제 및 커리큘럼 생성 대기 오버레이
 * - 시간(초) 카운트다운을 완전히 제거하고 "잠시만 기다려 주세요 ✨"로 통일하여 대기 피로도를 없앱니다.
 * - 생성 취소 버튼을 제공하여 오래 걸릴 경우 언제든 즉시 취소할 수 있습니다.
 */
export const LoadingWaitOverlay: React.FC<LoadingWaitOverlayProps> = ({
  status,
  isAbsolute = false,
  onCancel,
}) => {
  const floatProgress = React.useRef(new Animated.Value(0)).current;
  const spinProgress = React.useRef(new Animated.Value(0)).current;
  const [reduceMotionEnabled, setReduceMotionEnabled] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotionEnabled(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  React.useEffect(() => {
    if (!status?.active || reduceMotionEnabled) {
      floatProgress.stopAnimation();
      spinProgress.stopAnimation();
      floatProgress.setValue(0);
      spinProgress.setValue(0);
      return;
    }

    const floatLoop = Animated.loop(
      Animated.timing(floatProgress, {
        toValue: 1,
        duration: 3200,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    );
    const spinLoop = Animated.sequence([
      Animated.delay(5500),
      Animated.loop(
        Animated.sequence([
          Animated.timing(spinProgress, {
            toValue: 1,
            duration: 1100,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.delay(11900),
        ]),
      ),
    ]);
    floatLoop.start();
    spinLoop.start();

    return () => {
      floatLoop.stop();
      spinLoop.stop();
      floatProgress.setValue(0);
      spinProgress.setValue(0);
    };
  }, [floatProgress, reduceMotionEnabled, spinProgress, status?.active]);

  if (!status?.active) return null;

  const isCurriculum = status.title?.includes('목차') || status.count === 0;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="AI 맞춤 학습 콘텐츠를 생성하는 중입니다"
      accessibilityLiveRegion="polite"
      style={[
        styles.loadingWaitOverlay,
        isAbsolute && {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          elevation: 20,
        },
      ]}
    >
      <View style={styles.loadingWaitCard}>
        <Animated.View
          style={{
            transform: [
              { perspective: 850 },
              {
                translateX: floatProgress.interpolate({
                  inputRange: [0, 0.25, 0.5, 0.75, 1],
                  outputRange: [0, 1.5, 0, -1.5, 0],
                }),
              },
              {
                translateY: floatProgress.interpolate({
                  inputRange: [0, 0.25, 0.5, 0.75, 1],
                  outputRange: [0, -3, -5, -3, 0],
                }),
              },
              {
                rotateY: spinProgress.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: ['0deg', '180deg', '360deg'],
                }),
              },
              {
                scale: floatProgress.interpolate({
                  inputRange: [0, 0.25, 0.5, 0.75, 1],
                  outputRange: [1, 1.004, 1.008, 1.004, 1],
                }),
              },
            ],
          }}
        >
          <View style={styles.loadingWaitIllustration}>
            <AiGeneratingDanceSprite reduceMotion={reduceMotionEnabled} />
          </View>
        </Animated.View>

        {/* 1. 통일된 제목 */}
        <Text style={styles.loadingWaitTitle}>
          {isCurriculum ? '🌳 AI 단원 목차 구성 중' : '📝 AI 맞춤 문제 출제 중'}
        </Text>

        {status.title ? (
          <Text style={styles.loadingWaitSubtitle} numberOfLines={1}>
            학습 영역: {status.title}
          </Text>
        ) : null}

        {/* 2. 시간 초 카운트다운 없는 편안한 안내 문구 통일 */}
        <View style={styles.loadingWaitProgressRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingWaitMessage}>잠시만 기다려 주세요</Text>
        </View>

        <View style={styles.loadingWaitNoteBox}>
          <Text style={styles.loadingWaitNoteText}>
            {isCurriculum
              ? 'AI가 입력한 주제와 시작 난이도에 맞춰 5개의 학습 단원을 직접 설계하고 있습니다.'
              : '학습 영역과 난이도에 맞춰 문항을 구성하고 있어요.'}
          </Text>
        </View>

        {/* 3. 🛑 생성 취소 버튼 */}
        {onCancel && (
          <TouchableOpacity
            style={styles.loadingWaitCancelBtn}
            onPress={onCancel}
            activeOpacity={0.8}
          >
            <Text style={styles.loadingWaitCancelBtnText}>✕ 출제 취소하기</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

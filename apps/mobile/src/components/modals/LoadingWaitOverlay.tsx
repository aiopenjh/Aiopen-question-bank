import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { appStyles as styles } from '../../styles/appStyles';

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
  if (!status?.active) return null;

  const isCurriculum = status.title?.includes('목차') || status.count === 0;

  return (
    <View
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
        <ActivityIndicator size="large" color="#f43f5e" style={{ marginBottom: 14 }} />

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
        <Text style={styles.loadingWaitMessage}>
          잠시만 기다려 주세요 ✨
        </Text>

        <View style={styles.loadingWaitNoteBox}>
          <Text style={styles.loadingWaitNoteText}>
            {isCurriculum
              ? 'AI가 공인 표준 교육과정에 맞추어 단계별 학습 단원을 체계적으로 설계하고 있습니다.'
              : 'AI가 핵심 개념을 분석하여 정확하고 유익한 맞춤 문제를 구성하고 있습니다.'}
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

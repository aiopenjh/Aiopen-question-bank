import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { GeneratingWaitStatus } from '../../hooks/useQuizGeneration';
import { appStyles as styles } from '../../styles/appStyles';

export interface LoadingWaitOverlayProps {
  status: {
    active: boolean;
    count: number;
    title?: string;
    message?: string;
  } | null;
  isAbsolute?: boolean;
}

export const LoadingWaitOverlay: React.FC<LoadingWaitOverlayProps> = ({
  status,
  isAbsolute = false,
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
        <Text style={styles.loadingWaitTitle}>
          {isCurriculum
            ? '✨ AI 5단계 목차 설계 중...'
            : status.count === 3
            ? '⚡ 3문제 빠른 출제 중...'
            : status.count === 5
            ? '🎯 5문제 정밀 출제 중...'
            : status.count === 10
            ? '🏆 10문제 마스터 시험지 생성 중...'
            : '⏳ 잠시만 기다려주세요...'}
        </Text>
        {status.title ? (
          <Text style={styles.loadingWaitSubtitle} numberOfLines={1}>
            학습 범위: {status.title}
          </Text>
        ) : null}
        <Text style={styles.loadingWaitMessage}>{status.message}</Text>

        <View style={styles.loadingWaitNoteBox}>
          <Text style={styles.loadingWaitNoteText}>
            {isCurriculum
              ? '✨ 표준 교육과정 분석 및 5단계 단원 구성을 위해 약 5~10초 소요됩니다.'
              : status.count === 3
              ? '⚡ 약 10초 내외 생성 후 바로 시험장으로 연결됩니다.'
              : status.count === 5
              ? '🎯 5문제는 정밀 해설 구성을 위해 약 15~20초 소요됩니다.'
              : '🏆 10문제는 심층 오답 분석 작성을 위해 약 25~35초 소요됩니다.'}
          </Text>
          <Text
            style={[
              styles.loadingWaitNoteText,
              { color: '#be123c', marginTop: 4, fontWeight: 'bold' },
            ]}
          >
            {isCurriculum
              ? '※ 잠시만 기다려주시면 5단계 단원이 자료함에 안전하게 등록됩니다.'
              : '※ 생성된 문제는 스마트폰 로컬 DB에 안전하게 보존되어 누적됩니다.'}
          </Text>
        </View>
      </View>
    </View>
  );
};

import React, { useRef } from 'react';
import { Animated, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { ScratchpadCanvas } from './ScratchpadCanvas';
import { useScratchpadDrawing } from './scratchpadDrawing';
import { colors, radius, spacing } from '../../styles/designTokens';

// 풀이공간(Scratchpad): 수학/과학 등 계산·풀이 보조용 터치 드로잉 패널.
// 채점에는 전혀 반영되지 않는 순수 보조 도구이며, 실제 답안 제출은 항상 별도 입력(객관식 선택 또는
// 서술형 텍스트 입력)으로만 이루어진다. AI/데이터모델과 완전히 분리된 로컬 전용 UI.
// 웹은 연속 SVG 경로, 네이티브는 둥근 연결 선분을 사용한다.

interface ScratchpadPanelProps {
  visible: boolean;
  onClose: () => void;
}

export const ScratchpadPanel: React.FC<ScratchpadPanelProps> = ({ visible, onClose }) => {
  const { height } = useWindowDimensions();
  const sheetHeight = Math.round(height * 0.46);
  const drawing = useScratchpadDrawing();
  const translateY = useRef(new Animated.Value(sheetHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: visible ? 0 : sheetHeight,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: visible ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, translateY, backdropOpacity, sheetHeight]);

  return (
    <>
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      </Animated.View>
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[styles.sheet, { height: sheetHeight, transform: [{ translateY }] }]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>📐 풀이공간</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity style={[styles.headerBtn, { opacity: drawing.strokes.length ? 1 : 0.4 }]}
              disabled={!drawing.strokes.length} accessibilityLabel="마지막 획 되돌리기" onPress={drawing.undo}>
              <Text style={styles.headerBtnText}>↶ 되돌리기</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={drawing.clear}>
              <Text style={styles.headerBtnText}>전체 지우기</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={onClose}>
              <Text style={styles.headerBtnText}>닫기 ✕</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.canvas}>
          <ScratchpadCanvas {...drawing} />
          {drawing.strokes.length === 0 && (
            <Text pointerEvents="none" style={styles.hint}>
              여기에 손가락(또는 마우스)으로 자유롭게 풀이 과정을 적어보세요.{'\n'}채점에는 반영되지 않습니다.
            </Text>
          )}
        </View>
      </Animated.View>
    </>
  );
};

const styles = {
  backdrop: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 49,
  },
  sheet: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 50,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 14,
    fontWeight: '900' as const,
    color: colors.ink,
  },
  headerBtn: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  headerBtnText: {
    color: colors.primaryPressed,
    fontSize: 12,
    fontWeight: 'bold' as const,
  },
  canvas: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  hint: {
    padding: spacing.xl,
    fontSize: 13,
    lineHeight: 20,
    color: colors.inkMuted,
    textAlign: 'center' as const,
  },
};

import React, { useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '../../styles/designTokens';

// 풀이공간(Scratchpad): 수학/과학 등 계산·풀이 보조용 터치 드로잉 패널.
// 채점에는 전혀 반영되지 않는 순수 보조 도구이며, 실제 답안 제출은 항상 별도 입력(객관식 선택 또는
// 서술형 텍스트 입력)으로만 이루어진다. AI/데이터모델과 완전히 분리된 로컬 전용 UI.

interface Point {
  x: number;
  y: number;
}

const PANEL_WIDTH = Math.min(340, Dimensions.get('window').width * 0.86);
const DOT_SIZE = 3;

interface ScratchpadPanelProps {
  visible: boolean;
  onClose: () => void;
}

export const ScratchpadPanel: React.FC<ScratchpadPanelProps> = ({ visible, onClose }) => {
  const translateX = useRef(new Animated.Value(PANEL_WIDTH)).current;
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const currentStrokeRef = useRef<Point[]>([]);

  React.useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : PANEL_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          currentStrokeRef.current = [{ x: locationX, y: locationY }];
          setStrokes((prev) => [...prev, currentStrokeRef.current]);
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          currentStrokeRef.current.push({ x: locationX, y: locationY });
          // 배열 참조를 새로 만들어 리렌더 트리거 (마지막 stroke만 교체)
          setStrokes((prev) => {
            const next = prev.slice(0, -1);
            next.push([...currentStrokeRef.current]);
            return next;
          });
        },
        onPanResponderRelease: () => {
          currentStrokeRef.current = [];
        },
      }),
    []
  );

  function handleClear() {
    setStrokes([]);
    currentStrokeRef.current = [];
  }

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.panel, { transform: [{ translateX }] }]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>📐 풀이공간</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.headerBtn} onPress={handleClear}>
            <Text style={styles.headerBtnText}>지우기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={onClose}>
            <Text style={styles.headerBtnText}>닫기 ✕</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.canvas} {...panResponder.panHandlers}>
        {strokes.map((stroke, sIdx) =>
          stroke.map((p, pIdx) => (
            <View
              key={`${sIdx}-${pIdx}`}
              style={[styles.dot, { left: p.x - DOT_SIZE / 2, top: p.y - DOT_SIZE / 2 }]}
            />
          ))
        )}
        {strokes.length === 0 && <Text style={styles.hint}>여기에 손가락(또는 마우스)으로 자유롭게 풀이 과정을 적어보세요.{'\n'}채점에는 반영되지 않습니다.</Text>}
      </View>
    </Animated.View>
  );
};

const styles = {
  panel: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    shadowColor: colors.ink,
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 50,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing.lg,
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
    paddingHorizontal: 10,
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
  dot: {
    position: 'absolute' as const,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.ink,
  },
  hint: {
    padding: spacing.xl,
    fontSize: 13,
    lineHeight: 20,
    color: colors.inkMuted,
    textAlign: 'center' as const,
  },
};

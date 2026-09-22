import React, { useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '../../styles/designTokens';

// 풀이공간(Scratchpad): 수학/과학 등 계산·풀이 보조용 터치 드로잉 패널.
// 채점에는 전혀 반영되지 않는 순수 보조 도구이며, 실제 답안 제출은 항상 별도 입력(객관식 선택 또는
// 서술형 텍스트 입력)으로만 이루어진다. AI/데이터모델과 완전히 분리된 로컬 전용 UI.
// 하단 바텀시트 형태로 문제 지문 위를 가리지 않게 하고, 점이 아니라 연결된 선분으로 그려 매끄럽게 보이게 한다.

interface Point {
  x: number;
  y: number;
}

const SHEET_HEIGHT = Math.round(Dimensions.get('window').height * 0.46);
const LINE_THICKNESS = 3;

interface ScratchpadPanelProps {
  visible: boolean;
  onClose: () => void;
}

export const ScratchpadPanel: React.FC<ScratchpadPanelProps> = ({ visible, onClose }) => {
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const currentStrokeRef = useRef<Point[]>([]);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: visible ? 0 : SHEET_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: visible ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, translateY, backdropOpacity]);

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

  // 점과 점 사이를 실제 선분(회전된 얇은 View)으로 이어서 그린다.
  // RN의 rotate 변형은 기본적으로 뷰 자기 중심을 기준으로 회전하므로,
  // 두 점의 중점을 뷰 중심에 맞추고 폭을 두 점 사이 거리로 잡으면 정확히 그 구간을 잇는 선이 된다.
  function renderStroke(stroke: Point[], strokeIdx: number) {
    if (stroke.length === 1) {
      const p = stroke[0];
      return (
        <View
          key={`${strokeIdx}-dot`}
          style={[styles.dot, { left: p.x - LINE_THICKNESS / 2, top: p.y - LINE_THICKNESS / 2 }]}
        />
      );
    }
    const segments = [];
    for (let i = 1; i < stroke.length; i++) {
      const a = stroke[i - 1];
      const b = stroke[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length === 0) continue;
      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      segments.push(
        <View
          key={`${strokeIdx}-${i}`}
          style={[
            styles.segment,
            {
              left: midX - length / 2,
              top: midY - LINE_THICKNESS / 2,
              width: length,
              transform: [{ rotate: `${angleDeg}deg` }],
            },
          ]}
        />
      );
    }
    return segments;
  }

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
        style={[styles.sheet, { transform: [{ translateY }] }]}
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
          {strokes.map((stroke, sIdx) => renderStroke(stroke, sIdx))}
          {strokes.length === 0 && (
            <Text style={styles.hint}>
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
    height: SHEET_HEIGHT,
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
  segment: {
    position: 'absolute' as const,
    height: LINE_THICKNESS,
    borderRadius: LINE_THICKNESS / 2,
    backgroundColor: colors.ink,
  },
  dot: {
    position: 'absolute' as const,
    width: LINE_THICKNESS,
    height: LINE_THICKNESS,
    borderRadius: LINE_THICKNESS / 2,
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

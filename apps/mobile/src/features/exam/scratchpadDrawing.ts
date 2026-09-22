import { useRef, useState } from 'react';

export interface Point { x: number; y: number }
export type Stroke = Point[];
export interface DrawingProps {
  strokes: Stroke[];
  onStart: (point: Point) => void;
  onMove: (point: Point) => void;
  onEnd: () => void;
}

export function useScratchpadDrawing() {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  const active = useRef(false);
  function publish(next: Stroke[]) {
    strokesRef.current = next;
    setStrokes(next);
  }
  return {
    strokes,
    onStart(point: Point) {
      active.current = true;
      publish([...strokesRef.current, [point]]);
    },
    onMove(point: Point) {
      if (!active.current) return;
      const previous = strokesRef.current;
      const stroke = previous[previous.length - 1];
      const last = stroke[stroke.length - 1];
      if (Math.hypot(point.x - last.x, point.y - last.y) < 0.5) return;
      // 화면 갱신이 지연되어도 손을 뗀 뒤 이 획의 데이터는 바뀌지 않는다.
      publish([...previous.slice(0, -1), [...stroke, point]]);
    },
    onEnd() { active.current = false; },
    undo() { active.current = false; publish(strokesRef.current.slice(0, -1)); },
    clear() { active.current = false; publish([]); },
  };
}

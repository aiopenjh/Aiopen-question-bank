import React, { useRef } from 'react';
import { colors } from '../../styles/designTokens';
import { DrawingProps } from './scratchpadDrawing';

// 하나의 SVG 경로로 한 획을 표현한다. 캡처한 포인터와 캔버스 좌표계는 획 끝까지 유지한다.
export function ScratchpadCanvas({ strokes, onStart, onMove, onEnd }: DrawingProps) {
  const pointer = useRef<number | null>(null);
  function point(event: React.PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }
  function finish(event: React.PointerEvent<SVGSVGElement>, includeEndpoint = false) {
    if (pointer.current !== event.pointerId) return;
    if (includeEndpoint) onMove(point(event));
    pointer.current = null;
    onEnd();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }
  return (
    <svg
      aria-label="풀이 그림 영역"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', userSelect: 'none' }}
      onPointerDown={(event) => {
        if (pointer.current !== null || event.button !== 0) return;
        event.preventDefault();
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        onStart(point(event));
      }}
      onPointerMove={(event) => {
        if (pointer.current === event.pointerId) onMove(point(event));
      }}
      onPointerUp={(event) => finish(event, true)}
      onPointerCancel={(event) => finish(event)}
      onLostPointerCapture={(event) => finish(event)}
    >
      {strokes.map((stroke, index) => (
        <path key={index} pointerEvents="none" fill="none" stroke={colors.ink} strokeWidth={3}
          strokeLinecap="round" strokeLinejoin="round"
          d={stroke.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ') +
            (stroke.length === 1 ? ' l 0.01 0' : '')} />
      ))}
    </svg>
  );
}

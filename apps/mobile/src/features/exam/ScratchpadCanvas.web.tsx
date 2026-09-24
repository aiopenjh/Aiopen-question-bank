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
    try {
      // 일부 모바일 인앱 브라우저(예: 카카오톡 인앱 웹뷰)는 SVG 요소의 Pointer Capture
      // 해제를 지원하지 않아 예외를 던진다. 이미 획은 완료되었으므로 실패해도 무시한다.
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // 무시: 캡처 해제 실패가 이후 터치 입력을 막지 않도록 한다.
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
        try {
          // Pointer Capture가 실패하는 브라우저/웹뷰에서도(아래 catch) 손그림 시작(onStart)은
          // 반드시 실행되어야 한다. 이전에는 이 호출이 던지는 예외가 onStart 실행을 막아
          // "손가락으로 그려도 아무것도 안 그려짐" 현상의 원인이 될 수 있었다.
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // 무시: 캡처 없이도 onPointerMove/Up은 계속 이 요소에서 수신 가능하다.
        }
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

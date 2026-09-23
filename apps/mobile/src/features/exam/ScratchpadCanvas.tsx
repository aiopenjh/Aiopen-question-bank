import { useMemo, useRef } from 'react';
import { PanResponder, View } from 'react-native';
import { colors } from '../../styles/designTokens';
import { DrawingProps } from './scratchpadDrawing';

export function ScratchpadCanvas(props: DrawingProps) {
  const handlers = useRef(props);
  handlers.current = props;
  const origin = useRef({ x: 0, y: 0 });
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: ({ nativeEvent: e }) => {
      origin.current = { x: e.pageX - e.locationX, y: e.pageY - e.locationY };
      handlers.current.onStart({ x: e.locationX, y: e.locationY });
    },
    onPanResponderMove: (_, gesture) => handlers.current.onMove({
      x: gesture.moveX - origin.current.x, y: gesture.moveY - origin.current.y,
    }),
    onPanResponderRelease: () => handlers.current.onEnd(),
    onPanResponderTerminate: () => handlers.current.onEnd(),
  }), []);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, overflow: 'hidden' }} {...responder.panHandlers}>
      <View pointerEvents="none" style={{ flex: 1 }}>
        {props.strokes.map((stroke, s) => stroke.map((p, i) => {
          const a = stroke[Math.max(0, i - 1)];
          const length = Math.hypot(p.x - a.x, p.y - a.y);
          return <View key={`${s}-${i}`} style={{
            position: 'absolute', left: (a.x + p.x) / 2 - (length + 3) / 2,
            top: (a.y + p.y) / 2 - 1.5, width: length + 3, height: 3,
            borderRadius: 1.5, backgroundColor: colors.ink,
            transform: [{ rotate: `${Math.atan2(p.y - a.y, p.x - a.x)}rad` }],
          }} />;
        }))}
      </View>
    </View>
  );
}

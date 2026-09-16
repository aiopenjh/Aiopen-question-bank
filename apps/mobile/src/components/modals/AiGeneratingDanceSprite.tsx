import React from 'react';
import { Image, View } from 'react-native';

const danceSprite = require('../../../assets/illustrations/ai-generating-dance-strip.png');
const FRAME_WIDTH = 108;
const FRAME_HEIGHT = 144;
const FRAME_SEQUENCE = [0, 1, 2, 3, 2, 1];

export interface AiGeneratingDanceSpriteProps {
  reduceMotion?: boolean;
}

export const AiGeneratingDanceSprite: React.FC<AiGeneratingDanceSpriteProps> = ({
  reduceMotion = false,
}) => {
  const [sequenceIndex, setSequenceIndex] = React.useState(0);

  React.useEffect(() => {
    if (reduceMotion) {
      setSequenceIndex(0);
      return;
    }

    const timer = setInterval(() => {
      setSequenceIndex((current) => (current + 1) % FRAME_SEQUENCE.length);
    }, 650);

    return () => clearInterval(timer);
  }, [reduceMotion]);

  const frame = FRAME_SEQUENCE[sequenceIndex];

  return (
    <View
      style={{
        width: FRAME_WIDTH,
        height: FRAME_HEIGHT,
        overflow: 'hidden',
      }}
    >
      <Image
        source={danceSprite}
        resizeMode="stretch"
        accessible={false}
        accessibilityIgnoresInvertColors
        style={{
          width: FRAME_WIDTH * 4,
          height: FRAME_HEIGHT,
          transform: [{ translateX: -frame * FRAME_WIDTH }],
        }}
      />
    </View>
  );
};

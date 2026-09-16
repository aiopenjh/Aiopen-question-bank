import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

export type StateIllustrationKind =
  | 'home'
  | 'emptyLibrary'
  | 'reviewComplete';

const illustrationSources = {
  home: require('../../../assets/illustrations/home-study-guide.png'),
  emptyLibrary: require('../../../assets/illustrations/empty-library.png'),
  reviewComplete: require('../../../assets/illustrations/review-complete.png'),
} as const;

const aspectRatios: Record<StateIllustrationKind, number> = {
  home: 1.5,
  emptyLibrary: 2 / 3,
  reviewComplete: 1,
};

export interface StateIllustrationProps {
  kind: StateIllustrationKind;
  width: number;
  style?: StyleProp<ImageStyle>;
}

export const StateIllustration: React.FC<StateIllustrationProps> = ({
  kind,
  width,
  style,
}) => (
  <Image
    source={illustrationSources[kind]}
    resizeMode="contain"
    accessible={false}
    accessibilityIgnoresInvertColors
    style={[{ width, height: width / aspectRatios[kind] }, style]}
  />
);

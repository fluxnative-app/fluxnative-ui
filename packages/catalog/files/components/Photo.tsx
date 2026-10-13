// A picture that loads: a Skeleton (or a `muted` well) until the image
// arrives, the image, and a fallback when it fails. Sized by width and
// `aspectRatio` (or a fixed height); corners are `shape.card`. `alt` is
// the screen-reader description; leave it empty for a decorative picture.
// Children draw over the image (a gradient, a badge) and keep their own position.

import React, { useState } from 'react';
import { Image, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { shape } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import Icon from './Icon';
import Skeleton from './Skeleton';

export type PhotoPlaceholder = 'skeleton' | 'muted' | 'none';
export type PhotoFit = 'cover' | 'contain';

export interface PhotoProps {
  uri: string;
  /** What the picture shows, for screen readers; '' (default) marks it decorative. */
  alt?: string;
  /** Width / height. Default 1; ignored with `height`. */
  aspectRatio?: number;
  /** Default '100%'. */
  width?: DimensionValue;
  /** A fixed height instead of `aspectRatio`: px, or a share of the parent (`'100%'` fills it, like `width`). */
  height?: DimensionValue;
  /** Corner radius. Default `shape.card`. */
  radius?: number;
  /** Default 'cover'. */
  fit?: PhotoFit;
  /** What shows while loading. Default 'skeleton'. */
  placeholder?: PhotoPlaceholder;
  /** What shows when the image fails. Default: an image glyph on `muted`. */
  fallback?: React.ReactNode;
  /** Drawn over the image. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

type Phase = 'loading' | 'ready' | 'failed';
const FALLBACK_GLYPH = 28;

export default function Photo({
  uri,
  alt = '',
  aspectRatio = 1,
  width = '100%',
  height,
  radius = shape.card,
  fit = 'cover',
  placeholder = 'skeleton',
  fallback,
  children,
  style,
}: PhotoProps) {
  const palette = usePalette();
  const [phase, setPhase] = useState<Phase>('loading');
  const decorative = alt === '';
  return (
    <View
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : alt}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      style={[
        styles.frame,
        { width, borderRadius: radius, backgroundColor: palette.muted },
        height !== undefined ? { height } : { aspectRatio },
        style,
      ]}
    >
      {phase !== 'failed' ? (
        <Image source={{ uri }} resizeMode={fit} onLoad={() => setPhase('ready')} onError={() => setPhase('failed')} style={StyleSheet.absoluteFill} />
      ) : null}
      {phase === 'loading' && placeholder === 'skeleton' ? <Skeleton width="100%" radius={radius} style={styles.fill} /> : null}
      {phase === 'failed'
        ? (fallback ?? (
            <View style={styles.centre}>
              <Icon name="image" size={FALLBACK_GLYPH} color={palette['muted-foreground']} />
            </View>
          ))
        : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, height: '100%' },
  centre: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});

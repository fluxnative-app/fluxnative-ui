// A picture that loads: a Skeleton (or a `placeholderColor` well) until the
// image arrives, the image, and a fallback when it fails. Sized by width and
// `aspectRatio` (or a fixed height); corners are `shape.card`. The frame
// keeps its size in every phase, so nothing shifts when an image loads or
// fails. A failure shows `fallback` when given, else the well with a centred
// `fallbackIcon`, on the first error event (no retry, no timer: a capture of
// a dead URL is the same every time). `alt` is the screen-reader
// description, kept on the frame in every phase; leave it empty for a
// decorative picture. Children draw over the image or the fallback (a
// gradient, a caption) and keep their own position.

import React, { useState } from 'react';
import { Image, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { shape } from '../theme/tokens';
import { usePalette, type ColorName } from '../theme/usePalette';
import Icon, { type IconName } from './Icon';
import Skeleton from './Skeleton';

export type PhotoPlaceholder = 'skeleton' | 'muted' | 'none';
export type PhotoFit = 'cover' | 'contain';
/** The well's fill: a surface role that has a readable ink for the fallback glyph. */
export type PhotoPlaceholderColor = 'muted' | 'card' | 'background' | 'secondary' | 'tertiary' | 'accent' | 'primary' | 'inverse';
/** The glyph centred on a failed image: an `Icon` name, or 'none' for a plain well. */
export type PhotoFallbackIcon = IconName | 'none';
/** Where a photo is: loading, drawn, or failed (the fallback stays until `uri` changes). */
export type PhotoPhase = 'loading' | 'ready' | 'failed';

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
  /** The well behind the image while it loads and when it fails. Default 'muted'. */
  placeholderColor?: PhotoPlaceholderColor;
  /** What shows when the image fails. Default: `fallbackIcon` centred on the well. */
  fallback?: React.ReactNode;
  /** The glyph on a failed image without `fallback`. Default 'image'. */
  fallbackIcon?: PhotoFallbackIcon;
  /** The image arrived. */
  onLoad?: () => void;
  /** The image failed; the fallback is already showing. Called once per `uri`. */
  onError?: () => void;
  /** Drawn over the image, and over the fallback when it fails. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const FALLBACK_GLYPH = 28;
const INK: { readonly [C in PhotoPlaceholderColor]: ColorName } = {
  muted: 'muted-foreground',
  card: 'muted-foreground',
  background: 'muted-foreground',
  secondary: 'secondary-foreground',
  tertiary: 'tertiary-foreground',
  accent: 'accent-foreground',
  primary: 'primary-foreground',
  inverse: 'inverse-foreground',
};

/** The next phase after an image event; a failure is final for its `uri`. */
export function nextPhotoPhase(phase: PhotoPhase, event: 'load' | 'error'): PhotoPhase {
  if (phase === 'failed') return 'failed';
  return event === 'load' ? 'ready' : 'failed';
}

export default function Photo({
  uri,
  alt = '',
  aspectRatio = 1,
  width = '100%',
  height,
  radius = shape.card,
  fit = 'cover',
  placeholder = 'skeleton',
  placeholderColor = 'muted',
  fallback,
  fallbackIcon = 'image',
  onLoad,
  onError,
  children,
  style,
}: PhotoProps) {
  const palette = usePalette();
  // Keyed by uri: a new picture in a recycled cell starts loading again.
  const [state, setState] = useState<{ uri: string; phase: PhotoPhase }>({ uri, phase: 'loading' });
  const phase: PhotoPhase = state.uri === uri ? state.phase : 'loading';
  const decorative = alt === '';
  const settle = (event: 'load' | 'error') => {
    const next = nextPhotoPhase(phase, event);
    if (next === phase) return;
    setState({ uri, phase: next });
    if (next === 'ready') onLoad?.();
    else onError?.();
  };
  return (
    <View
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : alt}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      style={[
        styles.frame,
        { width, borderRadius: radius, backgroundColor: palette[placeholderColor] },
        height !== undefined ? { height } : { aspectRatio },
        style,
      ]}
    >
      {phase !== 'failed' ? (
        <Image source={{ uri }} resizeMode={fit} onLoad={() => settle('load')} onError={() => settle('error')} style={StyleSheet.absoluteFill} />
      ) : null}
      {phase === 'loading' && placeholder === 'skeleton' ? <Skeleton width="100%" radius={radius} style={styles.fill} /> : null}
      {phase === 'failed'
        ? (fallback ?? (
            <View style={styles.centre}>
              {fallbackIcon !== 'none' ? <Icon name={fallbackIcon} size={FALLBACK_GLYPH} color={palette[INK[placeholderColor]]} /> : null}
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

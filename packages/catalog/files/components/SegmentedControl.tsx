// A row of exclusive options. 'track': a `muted` track whose selected
// segment rides on a raised `card` thumb that springs across. 'line': text
// tabs with a `primary` underline under the selected one. Segments are
// tabs for screen readers. The track follows `shape.control`; labels are
// `type.label`. Reduce Motion snaps the thumb.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { elevation, shape, type } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import Press from './Press';
import useReducedMotion from './useReducedMotion';

export type SegmentedVariant = 'track' | 'line';
export type SegmentedSize = 'sm' | 'md';

export interface SegmentedControlProps {
  /** The labels, in order: two to five. */
  segments: readonly string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  /** 'track' (default) or 'line'. */
  variant?: SegmentedVariant;
  /** 32 or 40 px tall. Default 'md'. */
  size?: SegmentedSize;
  disabled?: boolean;
  /** Screen-reader name of the whole control: what it switches ("Period"). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Comp tokens: height per size, the track's inner padding and the underline's thickness, in px. */
export const segmentedHeight: { readonly [S in SegmentedSize]: number } = { sm: 36, md: 44 };
/** Each segment's touch target, at least: the thumb inside a track is shorter than the track. */
const MIN_TARGET = 44;
const PAD = 3;
const LINE = 2;
/** The thumb's slide: a little overshoot, settled in about 300 ms. */
const SLIDE = { speed: 20, bounciness: 4 };

export default function SegmentedControl({
  segments,
  selectedIndex,
  onChange,
  variant = 'track',
  size = 'md',
  disabled = false,
  accessibilityLabel,
  style,
}: SegmentedControlProps) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const position = useRef(new Animated.Value(selectedIndex)).current;
  const track = variant === 'track';
  const count = segments.length;

  useEffect(() => {
    if (reduced) {
      position.setValue(selectedIndex);
      return;
    }
    const slide = Animated.spring(position, { toValue: selectedIndex, useNativeDriver: true, ...SLIDE });
    slide.start();
    return () => slide.stop();
  }, [position, selectedIndex, reduced]);

  const segmentWidth = Math.max(0, width - (track ? PAD * 2 : 0)) / Math.max(count, 1);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={onLayout}
      style={[
        styles.row,
        track
          ? { height: segmentedHeight[size], padding: PAD, borderRadius: shape.control, backgroundColor: palette.muted }
          : { height: segmentedHeight[size] + LINE, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette['border-soft'] },
        disabled ? styles.dimmed : null,
        style,
      ]}
    >
      {width > 0 && count > 1 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            track
              ? [styles.thumb, elevation[1], { borderRadius: Math.max(0, shape.control - PAD), backgroundColor: palette.card }]
              : [styles.line, { backgroundColor: palette.primary }],
            {
              width: segmentWidth,
              transform: [{ translateX: position.interpolate({ inputRange: [0, count - 1], outputRange: [0, segmentWidth * (count - 1)] }) }],
            },
          ]}
        />
      ) : null}
      {segments.map((label, i) => {
        const selected = i === selectedIndex;
        return (
          <Press
            key={label}
            onPress={() => onChange(i)}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            haptic="selection"
            activeScale={1}
            hitSlop={Math.max(0, (MIN_TARGET - (segmentedHeight[size] - (track ? PAD * 2 : 0))) / 2)}
            style={styles.segment}
          >
            <Text numberOfLines={1} style={[type.label, { color: selected ? (track ? palette.foreground : palette.primary) : palette['muted-foreground'] }]}>
              {label}
            </Text>
          </Press>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  segment: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
  thumb: { position: 'absolute', top: PAD, bottom: PAD, left: PAD },
  line: { position: 'absolute', bottom: 0, left: 0, height: LINE, borderRadius: LINE / 2 },
  dimmed: { opacity: 0.45 },
});

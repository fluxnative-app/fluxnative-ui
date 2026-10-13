// Where a pager is: one dot per page, the current one stretched into a
// short pill, or (`variant="dots"`) every dot the same round size with the
// current one at full strength. On content the dots are `foreground` (the
// others faded);
// over a photo (`onPhoto`) they are the scheme's lightest neutral. The
// pill springs between pages (Reduce Motion: it jumps). Screen readers
// hear "Page 2 of 5".

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { space } from '../theme/tokens';
import { usePalette, useScheme } from '../theme/usePalette';
import useReducedMotion from './useReducedMotion';

export type PageDotsSize = 'sm' | 'md';
export type PageDotsVariant = 'pill' | 'dots';

export interface PageDotsProps {
  count: number;
  /** The current page, from 0. */
  index: number;
  /** 6 or 8 px dots. Default 'md'. */
  size?: PageDotsSize;
  /** 'pill' (default): the current page is a pill. 'dots': equal dots, the current one marked by strength alone. */
  variant?: PageDotsVariant;
  /** Light dots for a photo or a dark hero. */
  onPhoto?: boolean;
  /** Default "Page <index + 1> of <count>". */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Comp tokens: dot diameter per size, the active pill's length as a multiple, and the faded dots' opacity per variant. */
export const pageDotSize: { readonly [S in PageDotsSize]: number } = { sm: 6, md: 8 };
const PILL = 3;
// A faded dot is still a page the reader can count, so it reaches 3:1 against the ground: `foreground` at
// 55% does on every one of the template catalog's 72 light palettes (median 4.0); 30% reached none
// (median 2.0). In 'dots' the current page is marked by strength alone, and 55% also keeps 3:1 against it.
export const pageDotFaded: { readonly [V in PageDotsVariant]: number } = { pill: 0.55, dots: 0.55 };
const SLIDE = { speed: 20, bounciness: 4 };

export default function PageDots({ count, index, size = 'md', variant = 'pill', onPhoto = false, accessibilityLabel, style }: PageDotsProps) {
  const palette = usePalette();
  const scheme = useScheme();
  const reduced = useReducedMotion();
  const values = useRef<Animated.Value[]>([]).current;
  const diameter = pageDotSize[size];
  const stretch = variant === 'pill' ? PILL : 1;
  const faded = pageDotFaded[variant];
  for (let i = values.length; i < count; i += 1) values.push(new Animated.Value(i === index ? 1 : 0));
  // The lightest neutral the scheme has: `background` in light, `foreground` in dark.
  const color = onPhoto ? (scheme === 'dark' ? palette.foreground : palette.background) : palette.foreground;

  useEffect(() => {
    const moves = values.slice(0, count).map((value, i) => {
      const to = i === index ? 1 : 0;
      if (reduced) {
        value.setValue(to);
        return null;
      }
      const spring = Animated.spring(value, { toValue: to, useNativeDriver: false, ...SLIDE });
      spring.start();
      return spring;
    });
    return () => moves.forEach((move) => move?.stop());
  }, [values, count, index, reduced]);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? `Page ${index + 1} of ${count}`}
      accessibilityValue={{ min: 1, max: count, now: index + 1 }}
      style={[styles.row, style]}
    >
      {values.slice(0, count).map((value, i) => (
        <Animated.View
          key={i}
          style={{
            height: diameter,
            borderRadius: diameter / 2,
            marginHorizontal: space[1] / 2,
            backgroundColor: color,
            width: value.interpolate({ inputRange: [0, 1], outputRange: [diameter, diameter * stretch] }),
            opacity: value.interpolate({ inputRange: [0, 1], outputRange: [faded, 1] }),
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});

// How far along something is: a `muted` track with a run in the tone
// colour, pill-shaped (`shape.control`), or square-ended (`square`) for a
// hard-edged brand. Optional label and value text
// above it. The run eases to each new value (Reduce Motion: it jumps);
// `indeterminate` sweeps a short run while the length is unknown. Screen
// readers get the label and the percentage.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { duration, easing, shape, space, type } from '../theme/tokens';
import { usePalette, type ColorName } from '../theme/usePalette';
import useReducedMotion from './useReducedMotion';

export type ProgressTone = 'primary' | 'success' | 'warning' | 'destructive' | 'tertiary';

export interface ProgressBarProps {
  /** 0 to 1. Default 0; ignored while `indeterminate`. */
  progress?: number;
  /** Default 'primary'. */
  tone?: ProgressTone;
  /** Track height in px. Default 6. */
  height?: number;
  /** Text above the bar, at the start. */
  label?: string;
  /** Text above the bar, at the end ("3 of 5", "60%"). */
  valueLabel?: string;
  /** Square ends (radius 0) on the track and the run, for a brand drawn without rounding. Default false: `shape.control`. */
  square?: boolean;
  /** Unknown length: a sweeping run instead of a fill. */
  indeterminate?: boolean;
  /** Default: the label, else 'Progress'. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Comp tokens: the default track height, the sweeping run's width and one sweep's length. */
export const progressBarHeight = 6;
const SWEEP_WIDTH: `${number}%` = '30%';
const SWEEP_MS = 1200;
const TONE: { readonly [T in ProgressTone]: ColorName } = {
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  destructive: 'destructive',
  tertiary: 'tertiary',
};

export default function ProgressBar({
  progress = 0,
  tone = 'primary',
  height = progressBarHeight,
  label,
  valueLabel,
  indeterminate = false,
  square = false,
  accessibilityLabel,
  style,
}: ProgressBarProps) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const clamped = Math.min(1, Math.max(0, progress));
  const fill = useRef(new Animated.Value(clamped)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (indeterminate) return;
    if (reduced) {
      fill.setValue(clamped);
      return;
    }
    const [x1, y1, x2, y2] = easing.standard;
    const move = Animated.timing(fill, { toValue: clamped, duration: duration.normal, easing: Easing.bezier(x1, y1, x2, y2), useNativeDriver: false });
    move.start();
    return () => move.stop();
  }, [fill, clamped, reduced, indeterminate]);

  useEffect(() => {
    if (!indeterminate || reduced) {
      sweep.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: SWEEP_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [sweep, indeterminate, reduced]);

  const percent = Math.round(clamped * 100);
  const corner = square ? 0 : Math.min(shape.control, height / 2);
  const run = indeterminate
    ? { width: SWEEP_WIDTH, left: sweep.interpolate({ inputRange: [0, 1], outputRange: ['-30%', '100%'] }) }
    : { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) };
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? label ?? 'Progress'}
      accessibilityValue={indeterminate ? undefined : { min: 0, max: 100, now: percent, text: valueLabel ?? `${percent}%` }}
      style={style}
    >
      {label !== undefined || valueLabel !== undefined ? (
        <View style={styles.caption}>
          <Text numberOfLines={1} style={[type.label, styles.label, { color: palette.foreground }]}>
            {label}
          </Text>
          {valueLabel !== undefined ? <Text style={[type.numeric, { color: palette['muted-foreground'] }]}>{valueLabel}</Text> : null}
        </View>
      ) : null}
      <View style={{ height, borderRadius: corner, backgroundColor: palette.muted, overflow: 'hidden' }}>
        <Animated.View style={[styles.run, run, { borderRadius: corner, backgroundColor: palette[TONE[tone]] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space[2] },
  label: { flex: 1, marginRight: space[3] },
  run: { position: 'absolute', top: 0, bottom: 0, left: 0 },
});

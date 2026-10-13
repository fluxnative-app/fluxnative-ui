// One number that matters, said once: a label, the value in tabular figures
// with an optional unit, an optional change chip and a caption (Substack's
// creator stats, Fitbit's vitals, Tonal's totals, MacroFactor's insights).
// `card` sets it on a card surface; tiles side by side share a row, `flex: 1`
// each. The change chip is a filled pill in the trend's colour and its ink, so
// it passes 4.5:1 in either scheme. A screen reader hears one element:
// "label, value unit, change, caption"; with `onPress` it is a button.

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { shape, space, type, type TypeRole } from '../theme/tokens';
import { usePalette, type ColorName } from '../theme/usePalette';
import Press from './Press';

export type StatTrend = 'up' | 'down' | 'neutral';
export type StatTileVariant = 'card' | 'plain';

export interface StatTileProps {
  label: string;
  value: string | number;
  /** After the value, smaller: "kg", "bpm", "kcal". */
  unit?: string;
  /** The change, as written: "+6", "−2.1 kg", "12%". */
  delta?: string;
  /** The change's colour. Default: from the sign of `delta` (+ up, − down). */
  trend?: StatTrend;
  /** Under the value: "Last 7 days", "Today". */
  caption?: string;
  /** Default 'card'. */
  variant?: StatTileVariant;
  /** 'lg' sets the value in the display role. Default 'md' (headline). */
  size?: 'md' | 'lg';
  /** The value's text role instead: 'numeric' carries a brand's number face (a mono family). Tabular figures stay on. */
  valueRole?: TypeRole;
  /** The value's colour role. Default the surface's ink. */
  valueColor?: ColorName;
  /** Default 'start'. */
  align?: 'start' | 'center';
  onPress?: () => void;
  /** Default: label, value and unit, change, caption. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const TREND: { readonly [T in StatTrend]: [ColorName, ColorName] } = {
  up: ['success', 'success-foreground'],
  down: ['destructive', 'destructive-foreground'],
  neutral: ['muted', 'muted-foreground'],
};

/** "+6" → up, "−2.1" or "-2.1" → down, anything else → neutral. */
export function trendOf(delta: string | undefined): StatTrend {
  const sign = delta?.trim().charAt(0);
  return sign === '+' ? 'up' : sign === '-' || sign === '−' ? 'down' : 'neutral';
}

export default function StatTile({
  label,
  value,
  unit,
  delta,
  trend,
  caption,
  variant = 'card',
  size = 'md',
  valueRole,
  valueColor,
  align = 'start',
  onPress,
  accessibilityLabel,
  style,
}: StatTileProps) {
  const palette = usePalette();
  const [fill, ink] = TREND[trend ?? trendOf(delta)];
  const center = align === 'center';
  const name = accessibilityLabel ?? [label, `${value}${unit ? ` ${unit}` : ''}`, delta, caption].filter(Boolean).join(', ');
  const surface = variant === 'card' ? { backgroundColor: palette.card, borderRadius: shape.card, padding: space[4] } : null;
  const body = (
    <View style={[styles.body, center ? styles.center : null]}>
      <Text style={[type.bodySm, { color: palette['muted-foreground'] }]} numberOfLines={1}>
        {label}
      </Text>
      {delta ? (
        <View style={[styles.chip, { backgroundColor: palette[fill] }]}>
          <Text style={[type.label, { color: palette[ink] }]}>{delta}</Text>
        </View>
      ) : null}
      <View style={[styles.valueRow, center ? styles.center : null]}>
        <Text style={[type[valueRole ?? (size === 'lg' ? 'display' : 'headline')], styles.tabular, { color: valueColor !== undefined ? palette[valueColor] : variant === 'card' ? palette['card-foreground'] : palette.foreground }]}>{value}</Text>
        {unit ? <Text style={[type.label, { color: palette['muted-foreground'] }]}>{unit}</Text> : null}
      </View>
      {caption ? <Text style={[type.bodySm, { color: palette['muted-foreground'] }]}>{caption}</Text> : null}
    </View>
  );
  if (onPress) {
    return (
      <Press onPress={onPress} accessibilityLabel={name} accessibilityRole="button" style={[surface, style]}>
        {body}
      </Press>
    );
  }
  return (
    <View accessible accessibilityLabel={name} style={[surface, style]}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[1], alignItems: 'flex-start' },
  center: { alignItems: 'center', justifyContent: 'center' },
  chip: { borderRadius: shape.control, paddingHorizontal: space[2], paddingVertical: 2, marginVertical: space[1] },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: space[1] },
  tabular: { fontVariant: ['tabular-nums'] },
});

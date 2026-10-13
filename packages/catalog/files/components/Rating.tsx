// Stars for a rating: filled in `warning` (the amber of every store), the
// rest outlined in `border`, halves clipped. Beside them an optional value
// ("4.6", `type.numeric`) and count ("3.8K ratings"). With `onChange` it
// is an input: tap a star, or adjust with the screen reader's actions.
// `formatCount(3800)` gives "3.8K".

import React from 'react';
import { StyleSheet, Text, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native';
import { interaction, space, type } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import Icon from './Icon';
import Press from './Press';

export type RatingSize = 'sm' | 'md' | 'lg';

export interface RatingProps {
  /** 0 to `max`, halves allowed (4.5). */
  value: number;
  /** Default 5. */
  max?: number;
  /** 12 / 16 / 24 px stars. Default 'md'. */
  size?: RatingSize;
  /** Shows the value beside the stars, to one decimal. */
  showValue?: boolean;
  /** The number of ratings, shown as "3.8K ratings" (or "1,186 ratings" with `countFormat="full"`). */
  count?: number;
  /** 'short' (default): 3.8K. 'full': every digit, grouped (1,186), where the exact figure is the point. */
  countFormat?: 'short' | 'full';
  /** Word after the count. Default 'ratings'. */
  countLabel?: string;
  /** Makes the stars an input: tap a star, or use the increment and decrement actions. */
  onChange?: (value: number) => void;
  disabled?: boolean;
  /** Default "Rated <value> out of <max>", with the count. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Comp tokens `rating.star.*`: star size per size, and the gap between stars, in px. */
export const ratingStar: { readonly [S in RatingSize]: number } = { sm: 12, md: 16, lg: 24 };
const GAP = 2;
const MIN_TARGET = 44;

/** 950 → "950", 3800 → "3.8K", 1200000 → "1.2M". */
export function formatCount(count: number): string {
  if (count < 1000) return String(Math.round(count));
  const [value, unit] = count < 1_000_000 ? [count / 1000, 'K'] : [count / 1_000_000, 'M'];
  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${rounded}${unit}`;
}

export default function Rating({
  value,
  max = 5,
  size = 'md',
  showValue = false,
  count,
  countFormat = 'short',
  countLabel = 'ratings',
  onChange,
  disabled = false,
  accessibilityLabel,
  style,
}: RatingProps) {
  const palette = usePalette();
  const star = ratingStar[size];
  const clamped = Math.min(max, Math.max(0, value));
  const interactive = onChange !== undefined;
  const set = (next: number) => {
    if (!disabled) onChange?.(Math.min(max, Math.max(0, next)));
  };
  const onAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') set(Math.floor(clamped) + 1);
    else if (event.nativeEvent.actionName === 'decrement') set(Math.ceil(clamped) - 1);
  };
  const summary = `${clamped % 1 === 0 ? clamped : clamped.toFixed(1)} out of ${max}`;
  const shownCount = count === undefined ? '' : countFormat === 'full' ? Math.round(count).toLocaleString('en-US') : formatCount(count);
  const label = accessibilityLabel ?? `Rated ${summary}${count !== undefined ? `, ${shownCount} ${countLabel}` : ''}`;
  const stars = Array.from({ length: max }, (_, i) => {
    const filled = Math.min(1, Math.max(0, clamped - i));
    const glyph = (
      <View style={{ width: star, height: star }}>
        <Icon name="star" size={star} color={palette.border} />
        {filled > 0 ? (
          <View style={[styles.clip, { width: star * filled }]}>
            <Icon name="star" size={star} color={palette.warning} filled />
          </View>
        ) : null}
      </View>
    );
    if (!interactive) return <View key={i} style={{ marginRight: i < max - 1 ? GAP : 0 }}>{glyph}</View>;
    return (
      <Press
        key={i}
        onPress={() => set(i + 1)}
        disabled={disabled}
        accessibilityLabel={`${i + 1} ${i === 0 ? 'star' : 'stars'}`}
        accessibilityRole="radio"
        accessibilityState={{ checked: i < clamped }}
        haptic="selection"
        hitSlop={Math.max(interaction.press.hitSlop, Math.ceil((MIN_TARGET - star) / 2))}
        style={{ marginRight: i < max - 1 ? GAP : 0 }}
      >
        {glyph}
      </Press>
    );
  });
  return (
    <View
      accessible={!interactive}
      accessibilityRole={interactive ? 'adjustable' : 'text'}
      accessibilityLabel={label}
      accessibilityValue={interactive ? { min: 0, max, now: clamped, text: summary } : undefined}
      accessibilityActions={interactive ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
      onAccessibilityAction={interactive ? onAction : undefined}
      style={[styles.row, style]}
    >
      {stars}
      {showValue ? <Text style={[type.numeric, styles.value, { color: palette.foreground }]}>{clamped.toFixed(1)}</Text> : null}
      {count !== undefined ? (
        <Text style={[type.bodySm, styles.count, { color: palette['muted-foreground'] }]}>
          {shownCount} {countLabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  clip: { position: 'absolute', top: 0, left: 0, bottom: 0, overflow: 'hidden' },
  value: { marginLeft: space[2] },
  count: { marginLeft: space[1.5] },
});

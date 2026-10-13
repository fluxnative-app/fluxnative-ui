// Loading placeholder for a list: rows of a leading shape and text bars, the
// second bar shorter, laid out the way the content will sit (Instagram,
// Quizlet, ChatGPT; a trailing value pair like Wise; hairlines like talabat).
// Each bar is a `Skeleton`, so the breath follows `interaction.skeleton` and
// Reduce Motion holds it still. A screen reader meets one element, "Loading",
// marked busy; the bars themselves are hidden.

import React from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { layout, shape, space } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import Skeleton from './Skeleton';

export type SkeletonLeading = 'circle' | 'square' | 'none';

export interface SkeletonRowsProps {
  /** Rows to draw. Default 4. */
  count?: number;
  /** The shape before the text: an avatar, a thumbnail or nothing. Default 'circle'. */
  leading?: SkeletonLeading;
  /** Text bars per row, 1 to 3. Default 2. */
  lines?: number;
  /** A short value pair at the end of each row (an amount, a time). */
  trailing?: boolean;
  /** Hairlines between rows. */
  dividers?: boolean;
  /** Leading shape size in px. Default 44. */
  size?: number;
  /** Default 'Loading'. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Comp tokens: the bar widths, first to third, and their heights. */
const LINE_WIDTHS: readonly DimensionValue[] = ['72%', '46%', '58%'];
const FIRST_LINE = 14;
const OTHER_LINE = 12;

export default function SkeletonRows({
  count = 4,
  leading = 'circle',
  lines = 2,
  trailing = false,
  dividers = false,
  size = 44,
  accessibilityLabel = 'Loading',
  style,
}: SkeletonRowsProps) {
  const palette = usePalette();
  const bars = Math.max(1, Math.min(3, Math.round(lines)));
  const rows = Array.from({ length: Math.max(1, Math.round(count)) }, (_, index) => index);
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel} accessibilityState={{ busy: true }} style={style}>
      {rows.map((row) => (
        <View
          key={row}
          style={[
            styles.row,
            { minHeight: size + space[3] * 2 },
            dividers && row < rows.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette['border-soft'] } : null,
          ]}
        >
          {leading === 'none' ? null : <Skeleton width={size} height={size} circle={leading === 'circle'} radius={shape.well} />}
          <View style={styles.lines}>
            {Array.from({ length: bars }, (_, line) => (
              <Skeleton key={line} width={LINE_WIDTHS[line]} height={line === 0 ? FIRST_LINE : OTHER_LINE} />
            ))}
          </View>
          {trailing ? (
            <View style={styles.trailing}>
              <Skeleton width={56} height={FIRST_LINE} />
              <Skeleton width={36} height={OTHER_LINE} />
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: layout.gutter, paddingVertical: space[3] },
  lines: { flex: 1, gap: space[2] },
  trailing: { alignItems: 'flex-end', gap: space[2] },
});

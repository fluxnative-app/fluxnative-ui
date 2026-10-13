// The bar pinned under a screen's content: a primary button, an optional
// second one beside or above it, and either a leading slot (a Stepper, a
// price) or a summary line ("Total", "$45.96") over the buttons. It lives
// in the screen's column, after the scroll view, on `background` under a
// hairline; `floating` lifts it onto a `card` with `elevation[3]` and side
// margins. The bottom padding clears the home indicator (`layout.gutter`).

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { elevation, layout, shape, space, type } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import Button, { type ButtonVariant } from './Button';

export type BottomBarArrange = 'row' | 'stacked';

export interface BottomBarProps {
  /** The main button. */
  primaryLabel: string;
  onPrimary: () => void;
  /** Default 'primary'. */
  primaryVariant?: ButtonVariant;
  primaryDisabled?: boolean;
  /** Shows a spinner in the main button. */
  primaryLoading?: boolean;
  /** A second button, rendered only with `onSecondary`. */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Default 'outline'. */
  secondaryVariant?: ButtonVariant;
  /** Two buttons side by side ('row', default) or the second under the first ('stacked'). */
  arrange?: BottomBarArrange;
  /** Left of the main button: a Stepper, a price. */
  leading?: React.ReactNode;
  /** A line over the buttons: label at the start, value at the end. */
  summaryLabel?: string;
  summaryValue?: string;
  /** Anything else over the buttons (a legal line, a promo). */
  children?: React.ReactNode;
  /** A card with a shadow and side margins instead of a full-width bar. */
  floating?: boolean;
  /** Bottom padding in px, for the home indicator or a tab bar. Default `layout.gutter`. */
  bottom?: number;
  style?: StyleProp<ViewStyle>;
}

export default function BottomBar({
  primaryLabel,
  onPrimary,
  primaryVariant = 'primary',
  primaryDisabled = false,
  primaryLoading = false,
  secondaryLabel,
  onSecondary,
  secondaryVariant = 'outline',
  arrange = 'row',
  leading,
  summaryLabel,
  summaryValue,
  children,
  floating = false,
  bottom = layout.gutter,
  style,
}: BottomBarProps) {
  const palette = usePalette();
  const secondary =
    secondaryLabel !== undefined && onSecondary !== undefined ? (
      <Button label={secondaryLabel} onPress={onSecondary} variant={secondaryVariant} style={arrange === 'row' ? styles.grow : null} />
    ) : null;
  const primary = (
    <Button
      label={primaryLabel}
      onPress={onPrimary}
      variant={primaryVariant}
      disabled={primaryDisabled}
      loading={primaryLoading}
      style={arrange === 'row' ? styles.grow : null}
    />
  );
  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: bottom },
        floating
          ? [styles.floating, elevation[3], { backgroundColor: palette.card, borderRadius: shape.card, marginBottom: bottom, paddingBottom: space[4] }]
          : { backgroundColor: palette.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette['border-soft'] },
        style,
      ]}
    >
      {children}
      {summaryLabel !== undefined || summaryValue !== undefined ? (
        <View style={styles.summary}>
          <Text style={[type.body, { color: palette['foreground-soft'] }]}>{summaryLabel}</Text>
          <Text style={[type.numeric, styles.summaryValue, { color: palette.foreground }]}>{summaryValue}</Text>
        </View>
      ) : null}
      {arrange === 'stacked' ? (
        <View style={styles.stack}>
          {primary}
          {secondary}
        </View>
      ) : (
        <View style={styles.row}>
          {leading !== undefined ? <View style={styles.leading}>{leading}</View> : null}
          {secondary}
          {primary}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: layout.gutter, paddingTop: space[3] },
  floating: { marginHorizontal: layout.gutter, paddingTop: space[4] },
  summary: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space[3] },
  summaryValue: { fontSize: type.title.fontSize, lineHeight: type.title.lineHeight },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  stack: { gap: space[2] },
  grow: { flex: 1 },
  leading: { marginRight: space[1] },
});

// A hairline rule between rows or sections. `inset` keeps it off the
// leading edge (a row's icon column, or the gutter with `true`); `vertical`
// draws a column rule. Colour is `border-soft`, or `border` when `strong`.
// Screen readers skip it.

import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { layout } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';

export interface DividerProps {
  /** Leading offset in px (top, when vertical); `true` is `layout.gutter`. Default 0. */
  inset?: number | boolean;
  /** `border` instead of `border-soft`. */
  strong?: boolean;
  /** A column rule: hairline wide, stretched to the row's height. */
  vertical?: boolean;
  /** Space on both sides of the rule in px. Default 0. */
  margin?: number;
  style?: StyleProp<ViewStyle>;
}

export default function Divider({ inset = 0, strong = false, vertical = false, margin = 0, style }: DividerProps) {
  const palette = usePalette();
  const offset = inset === true ? layout.gutter : inset === false ? 0 : inset;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        vertical
          ? { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginTop: offset, marginHorizontal: margin }
          : { height: StyleSheet.hairlineWidth, marginLeft: offset, marginVertical: margin },
        { backgroundColor: strong ? palette.border : palette['border-soft'] },
        style,
      ]}
    />
  );
}

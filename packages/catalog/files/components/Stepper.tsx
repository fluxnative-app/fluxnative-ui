// A quantity control: minus, the value, plus. Each button is a 32 or
// 40 px circle, outlined on `border` or filled `muted`; the value is
// `type.numeric`. For screen readers the whole control is one adjustable
// element with increment and decrement actions. The buttons stop at
// `min` and `max`, and each tap gives a selection haptic.

import React from 'react';
import { StyleSheet, Text, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native';
import { interaction, shape, space, type } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import Icon from './Icon';
import Press from './Press';

export type StepperSize = 'sm' | 'md';
export type StepperVariant = 'outline' | 'tonal';

export interface StepperProps {
  value: number;
  onChange: (next: number) => void;
  /** Screen-reader name of what is counted ("Quantity"). Required. */
  accessibilityLabel: string;
  /** Default 0. */
  min?: number;
  /** Default 99. */
  max?: number;
  /** Default 1. */
  step?: number;
  /** 32 or 40 px buttons. Default 'md'. */
  size?: StepperSize;
  /** 'outline' (default) or 'tonal'. */
  variant?: StepperVariant;
  disabled?: boolean;
  /** Formats the shown value ("2 kg"). Default: the number. */
  format?: (value: number) => string;
  /** Screen-reader names of the two buttons. Default 'Decrease' / 'Increase'. */
  decreaseLabel?: string;
  increaseLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Comp tokens `stepper.button.*`: button diameter and glyph size per size, in px. */
export const stepperButton: { readonly [S in StepperSize]: number } = { sm: 32, md: 40 };
const GLYPH: { readonly [S in StepperSize]: number } = { sm: 16, md: 18 };
/** The value column never shrinks below this, so 9 → 10 doesn't move the buttons. */
const VALUE_MIN = 28;
/** The smallest comfortable touch target: a smaller button grows its hit area to it. */
const MIN_TARGET = 44;

export default function Stepper({
  value,
  onChange,
  accessibilityLabel,
  min = 0,
  max = 99,
  step = 1,
  size = 'md',
  variant = 'outline',
  disabled = false,
  format,
  decreaseLabel = 'Decrease',
  increaseLabel = 'Increase',
  style,
}: StepperProps) {
  const palette = usePalette();
  const shown = format ? format(value) : String(value);
  const canDecrease = !disabled && value - step >= min;
  const canIncrease = !disabled && value + step <= max;
  const decrease = () => {
    if (canDecrease) onChange(value - step);
  };
  const increase = () => {
    if (canIncrease) onChange(value + step);
  };
  const diameter = stepperButton[size];
  const face = variant === 'outline' ? { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: palette.border } : { backgroundColor: palette.muted };
  const button = (label: string, onPress: () => void, enabled: boolean, glyph: 'minus' | 'plus') => (
    <Press
      onPress={onPress}
      disabled={!enabled}
      accessibilityLabel={label}
      haptic="selection"
      hitSlop={Math.max(interaction.press.hitSlop, Math.ceil((MIN_TARGET - diameter) / 2))}
      style={[styles.button, { width: diameter, height: diameter, borderRadius: Math.min(shape.control, diameter / 2) }, face]}
    >
      <Icon name={glyph} size={GLYPH[size]} color={palette.foreground} />
    </Press>
  );
  const onAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') increase();
    else if (event.nativeEvent.actionName === 'decrement') decrease();
  };
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value, text: shown }}
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAction}
      style={[styles.row, style]}
    >
      {button(decreaseLabel, decrease, canDecrease, 'minus')}
      <Text style={[type.numeric, styles.value, { minWidth: VALUE_MIN, color: palette.foreground }]}>{shown}</Text>
      {button(increaseLabel, increase, canIncrease, 'plus')}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  button: { alignItems: 'center', justifyContent: 'center' },
  value: { textAlign: 'center', marginHorizontal: space[2] },
});

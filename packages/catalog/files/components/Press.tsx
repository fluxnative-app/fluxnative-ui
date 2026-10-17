// The one pressable. Scales down while pressed, fires an optional haptic
// through the host bridge, and always carries a screen-reader name. Its
// defaults (haptic, scale, hit slop, spring) are the template's interaction
// profile, `interaction.press` in theme/tokens; props still override them.
// Layout styles (flex, position, margins) go on the Pressable so the
// control sits in its parent's layout; the rest paints the animated box.
// It reaches the 44 pt touch target by itself: it measures its box and
// grows the hit slop on each axis that is short of MIN_TARGET, without
// moving a pixel. An explicit `hitSlop` still wins; `minTarget={false}`
// turns the growth off for dense controls whose neighbours sit closer.

import React, { useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  type AccessibilityRole,
  type AccessibilityState,
  type GestureResponderEvent,
  type Insets,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { interaction } from '../theme/tokens';
import { bridge } from './bridge';
import useReducedMotion from './useReducedMotion';

export type PressHaptic = 'none' | 'light' | 'selection' | 'medium';
export type PressRole = Extract<AccessibilityRole, 'button' | 'link' | 'tab' | 'radio' | 'checkbox' | 'switch' | 'menuitem'>;

export interface PressProps {
  onPress?: (event: GestureResponderEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Screen-reader name. Required: a control with no name is a bug. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityRole?: PressRole;
  accessibilityState?: AccessibilityState;
  disabled?: boolean;
  /** Haptic on press, through the host bridge when it has one. Default `interaction.press.haptic` ('none' in the kit). */
  haptic?: PressHaptic;
  /** Scale while pressed; 1 turns it off. Default `interaction.press.activeScale` (0.96 in the kit). */
  activeScale?: number;
  /** Extra hit area in px on every side. When set it wins over `minTarget`. Default: the brand's `interaction.press.hitSlop` (0 in the kit), grown to reach `minTarget`. */
  hitSlop?: number;
  /** The touch target the control reaches by itself, in pt: the hit slop grows on each short axis. Default `MIN_TARGET` (44); `false` keeps the brand's slop only, for dense controls whose neighbours are closer than the slop would reach. */
  minTarget?: number | false;
  testID?: string;
}

/** How far a disabled control fades. Not a token: every template dims the same way. */
const DISABLED_OPACITY = 0.45;

const OUTER_KEYS = new Set<keyof ViewStyle>([
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'zIndex',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'marginHorizontal',
  'marginVertical',
  'width',
  'minWidth',
  'maxWidth',
]);

function splitStyle(style: StyleProp<ViewStyle>): { outer: ViewStyle; inner: ViewStyle } {
  const flat = StyleSheet.flatten(style) ?? {};
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    (OUTER_KEYS.has(key as keyof ViewStyle) ? outer : inner)[key] = value;
  }
  // The inner box fills the outer one so width on the outside still paints.
  if ('width' in outer || 'flex' in outer || 'alignSelf' in outer) inner.width = inner.width ?? '100%';
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

/** The touch target every control reaches, in pt (the craft checker's 44 pt rule). */
export const MIN_TARGET = 44;

/** Hit slop for a short text action ("See all", "Undo", "Cancel"): enough around a `height`-tall line for a 44 pt target, never under the brand's press slop. */
export function textActionSlop(height: number): number {
  return Math.max(interaction.press.hitSlop, Math.ceil((MIN_TARGET - height) / 2));
}

/** The hit slop that grows a `width` × `height` box to a `min` × `min` target, per axis, never under `base`; `min` false gives `base` on every side. */
export function minTargetSlop(width: number, height: number, base: number, min: number | false = MIN_TARGET): Required<Insets> {
  const across = min === false ? base : Math.max(base, Math.ceil((min - width) / 2));
  const along = min === false ? base : Math.max(base, Math.ceil((min - height) / 2));
  return { top: along, bottom: along, left: across, right: across };
}

export default function Press({
  onPress,
  onLongPress,
  children,
  style,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  accessibilityState,
  disabled = false,
  haptic = interaction.press.haptic,
  activeScale = interaction.press.activeScale,
  hitSlop,
  minTarget = MIN_TARGET,
  testID,
}: PressProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const { outer, inner } = splitStyle(style);
  const base = interaction.press.hitSlop;
  // The box as last laid out; before the first layout event the slop is the brand's, as before.
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const measures = hitSlop === undefined && minTarget !== false;
  const measure = measures
    ? {
        onLayout: (event: LayoutChangeEvent) => {
          const { width, height } = event.nativeEvent.layout;
          setBox((current) => (current !== null && current.width === width && current.height === height ? current : { width, height }));
        },
      }
    : null;
  const slop = hitSlop ?? (measures && box !== null ? minTargetSlop(box.width, box.height, base, minTarget) : base);

  const to = (value: number) => {
    if (reduced || activeScale === 1) return;
    const { speed, bounciness } = interaction.press.spring;
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed, bounciness }).start();
  };

  return (
    <Pressable
      onPress={(event) => {
        if (haptic !== 'none') bridge()?.ui?.haptic?.(haptic);
        onPress?.(event);
      }}
      onLongPress={onLongPress}
      onPressIn={() => to(activeScale)}
      onPressOut={() => to(1)}
      disabled={disabled}
      hitSlop={slop}
      {...measure}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, ...accessibilityState }}
      style={outer}
      testID={testID}
    >
      {/* The press scale joins the caller's transform (a tilted card keeps its rotate) instead of replacing it. */}
      <Animated.View style={[inner, { transform: [...(Array.isArray(inner.transform) ? inner.transform : []), { scale }] }, disabled ? styles.disabled : null]}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: DISABLED_OPACITY },
});

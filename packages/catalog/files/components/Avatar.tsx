// A person or a brand: the photo when there is one, else initials on a
// tinted disc. Sizes 24 to 80 px; corners follow `shape.avatar` (round in
// the kit) or `shape.cardInner` when `rounded`. A `status` dot sits at the
// bottom-right corner inside a `background` ring. The screen-reader name
// is the person's name, with the status.

import React, { useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { fontWeight, shape } from '../theme/tokens';
import { usePalette, type ColorName } from '../theme/usePalette';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'away' | 'offline';
export type AvatarTone = 'auto' | 'primary' | 'secondary' | 'tertiary' | 'accent' | 'muted';

export interface AvatarProps {
  /** The person's name: the initials and the screen-reader name. */
  name: string;
  /** Photo URL; initials show until it loads, and when it fails. */
  uri?: string;
  /** 24 / 32 / 40 / 56 / 80 px. Default 'md'. */
  size?: AvatarSize;
  /** `shape.cardInner` corners instead of `shape.avatar`. */
  rounded?: boolean;
  /** A presence dot: `success`, `warning`, `muted-foreground`. */
  status?: AvatarStatus;
  /** The initials disc. 'auto' (default) picks a role from the name, so a list varies and stays on the palette. */
  tone?: AvatarTone;
  /** Drawn over the bottom-right corner in place of the status (a small icon, a flag). */
  badge?: React.ReactNode;
  /** Default: the name, then the status ("Alex Smith, online"). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Comp tokens `avatar.size.*`, in px. */
export const avatarSize: { readonly [S in AvatarSize]: number } = { xs: 24, sm: 32, md: 40, lg: 56, xl: 80 };
/** Initials and the status dot scale with the disc; the dot's ring is 2 px. */
const INITIALS_RATIO = 0.4;
const DOT_RATIO = 0.28;
const DOT_MIN = 8;
const RING = 2;
const AUTO: readonly Exclude<AvatarTone, 'auto'>[] = ['primary', 'tertiary', 'secondary', 'accent'];
const FILL: { readonly [T in Exclude<AvatarTone, 'auto'>]: readonly [ColorName, ColorName] } = {
  primary: ['primary', 'primary-foreground'],
  secondary: ['secondary', 'secondary-foreground'],
  tertiary: ['tertiary', 'tertiary-foreground'],
  accent: ['accent', 'accent-foreground'],
  muted: ['muted', 'muted-foreground'],
};
const STATUS: { readonly [S in AvatarStatus]: ColorName } = { online: 'success', away: 'warning', offline: 'muted-foreground' };

/** "Alex Smith" → "AS"; one word gives one letter. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** The same name always lands on the same disc colour. */
export function toneOf(name: string): Exclude<AvatarTone, 'auto'> {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AUTO[hash % AUTO.length] ?? 'primary';
}

export default function Avatar({ name, uri, size = 'md', rounded = false, status, tone = 'auto', badge, accessibilityLabel, style }: AvatarProps) {
  const palette = usePalette();
  const [failed, setFailed] = useState(false);
  const diameter = avatarSize[size];
  const radius = rounded ? Math.min(shape.cardInner, diameter / 2) : Math.min(shape.avatar, diameter / 2);
  const [fill, ink] = FILL[tone === 'auto' ? toneOf(name) : tone];
  const dot = Math.max(DOT_MIN, Math.round(diameter * DOT_RATIO));
  const label = accessibilityLabel ?? (status !== undefined ? `${name}, ${status}` : name);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={[{ width: diameter, height: diameter }, style]}>
      <View style={[styles.disc, { borderRadius: radius, backgroundColor: palette[fill] }]}>
        <Text style={{ fontSize: Math.round(diameter * INITIALS_RATIO), lineHeight: diameter, fontWeight: fontWeight.semibold, color: palette[ink] }}>
          {initialsOf(name)}
        </Text>
        {uri !== undefined && !failed ? (
          <Image source={{ uri }} onError={() => setFailed(true)} resizeMode="cover" style={[StyleSheet.absoluteFill, { borderRadius: radius }]} />
        ) : null}
      </View>
      {badge !== undefined ? (
        <View style={styles.corner}>{badge}</View>
      ) : status !== undefined ? (
        <View
          style={[
            styles.corner,
            { width: dot, height: dot, borderRadius: dot / 2, borderWidth: RING, borderColor: palette.background, backgroundColor: palette[STATUS[status]] },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  corner: { position: 'absolute', right: 0, bottom: 0 },
});

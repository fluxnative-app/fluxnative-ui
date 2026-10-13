// One row of a settings or menu list: a leading icon (bare, or on a
// `muted` tile), the title with an optional subtitle, and at the trailing
// edge a value, a chevron, or any control. With `onPress` the row is a
// Press; without one it is a plain View, so a Toggle placed in `trailing`
// never sits inside another pressable. Text roles: `type.body` (title),
// `type.bodySm` (subtitle, value). Rows have no horizontal padding of
// their own: ListGroup (or the screen) supplies the gutter.

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { shape, space, type } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import Icon from './Icon';
import Press, { type PressRole } from './Press';

export type ListRowTrailing = 'chevron' | 'none';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** An Icon (or any small view) before the title. */
  leading?: React.ReactNode;
  /** Draws `leading` centred on a 32 px `muted` tile (`shape.well`). */
  leadingTile?: boolean;
  /** Short text at the trailing edge ("Automatic", "Off"). */
  value?: string;
  /** 'chevron' (default with `onPress`), 'none', or a control such as a Toggle. */
  trailing?: ListRowTrailing | React.ReactNode;
  onPress?: () => void;
  /** Colours the title `destructive` ("Delete account"). */
  destructive?: boolean;
  disabled?: boolean;
  /** Default 'button'; 'link' when the row leaves the app. */
  accessibilityRole?: Extract<PressRole, 'button' | 'link' | 'menuitem'>;
  /** Default: the title, then the value ("Dark mode, Automatic"). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Comp tokens: the row's minimum height, the leading tile, the chevron glyph, in px. */
export const listRowMinHeight = 48;
const TILE = 32;
const CHEVRON = 18;
/** A row scales less than a button: it is wide, and the chevron already says it opens. */
const ROW_SCALE = 0.985;

export default function ListRow({
  title,
  subtitle,
  leading,
  leadingTile = false,
  value,
  trailing,
  onPress,
  destructive = false,
  disabled = false,
  accessibilityRole = 'button',
  accessibilityLabel,
  style,
}: ListRowProps) {
  const palette = usePalette();
  const end = trailing ?? (onPress !== undefined ? 'chevron' : 'none');
  const content = (
    <View style={styles.row}>
      {leading !== undefined ? (
        <View style={[styles.leading, leadingTile ? { width: TILE, height: TILE, borderRadius: shape.well, backgroundColor: palette.muted } : null]}>
          {leading}
        </View>
      ) : null}
      <View style={styles.text}>
        <Text numberOfLines={1} style={[type.body, { color: destructive ? palette.destructive : palette.foreground }]}>
          {title}
        </Text>
        {subtitle !== undefined ? (
          <Text numberOfLines={2} style={[type.bodySm, { color: palette['muted-foreground'] }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value !== undefined ? (
        <Text numberOfLines={1} style={[type.bodySm, styles.value, { color: palette['muted-foreground'] }]}>
          {value}
        </Text>
      ) : null}
      {end === 'chevron' ? (
        <Icon name="chevron-right" size={CHEVRON} color={palette['muted-foreground']} style={styles.chevron} />
      ) : end === 'none' ? null : (
        <View style={styles.control}>{end}</View>
      )}
    </View>
  );
  if (onPress === undefined) return <View style={style}>{content}</View>;
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? (value !== undefined ? `${title}, ${value}` : title)}
      accessibilityHint={subtitle}
      activeScale={ROW_SCALE}
      style={style}
    >
      {content}
    </Press>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: listRowMinHeight, paddingVertical: space[2] },
  leading: { alignItems: 'center', justifyContent: 'center', marginRight: space[3] },
  text: { flex: 1 },
  value: { marginLeft: space[3], maxWidth: '45%' },
  chevron: { marginLeft: space[1] },
  control: { marginLeft: space[3] },
});

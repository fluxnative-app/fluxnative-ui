// The row at the top of a screen the template owns: a round back button,
// the title (centred over the row, or at the start), and trailing actions.
// `large` adds a display-size title under the row and leaves the row's
// middle empty, like a large-title screen. The row is `chrome.appBarHeight`
// tall; the title is `type.title` (`type.display` when large); the side
// buttons are IconButtons. The host's safe area sits above it.

import React from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { chrome, layout, space, type } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import Icon from './Icon';
import IconButton, { iconButtonInk, type IconButtonVariant } from './IconButton';

export type ScreenHeaderAlign = 'center' | 'start';

export interface ScreenHeaderProps {
  title?: string;
  /** Shows the back button. */
  onBack?: () => void;
  /** Screen-reader name of the back button. Default 'Back'. */
  backLabel?: string;
  /** The back glyph: 'platform' (default; a chevron on iOS, an arrow elsewhere), or one for every platform when the design draws one. */
  backIcon?: 'platform' | 'chevron' | 'arrow';
  /** Replaces the back button (a close button, an avatar). */
  leading?: React.ReactNode;
  /** Right of the title: IconButtons, in a row. */
  trailing?: React.ReactNode;
  /** Where the row title sits. Default 'center' with a back button or `leading`, else 'start'. */
  align?: ScreenHeaderAlign;
  /** A display-size title under the row; the row itself then shows no title. */
  large?: boolean;
  /** Caps line above the large title. */
  eyebrow?: string;
  /** The side buttons' face. Default 'tonal'; 'translucent' over a photo. */
  buttonVariant?: IconButtonVariant;
  style?: StyleProp<ViewStyle>;
}

/** The back glyph per platform: a chevron on iOS, an arrow elsewhere. */
export function backIcon(): 'chevron-left' | 'arrow-left' {
  return Platform.OS === 'ios' ? 'chevron-left' : 'arrow-left';
}

export default function ScreenHeader({
  title,
  onBack,
  backIcon: backGlyph = 'platform',
  backLabel = 'Back',
  leading,
  trailing,
  align,
  large = false,
  eyebrow,
  buttonVariant = 'tonal',
  style,
}: ScreenHeaderProps) {
  const palette = usePalette();
  const hasLeading = onBack !== undefined || leading !== undefined;
  const centred = (align ?? (hasLeading ? 'center' : 'start')) === 'center';
  const rowTitle = large ? undefined : title;
  const back =
    onBack !== undefined ? (
      <IconButton onPress={onBack} accessibilityLabel={backLabel} variant={buttonVariant}>
        <Icon name={backGlyph === 'chevron' ? 'chevron-left' : backGlyph === 'arrow' ? 'arrow-left' : backIcon()} color={iconButtonInk(buttonVariant, palette)} />
      </IconButton>
    ) : null;
  return (
    <View style={[styles.header, style]}>
      <View style={styles.row}>
        <View style={styles.side}>{leading ?? back}</View>
        {rowTitle !== undefined && centred ? (
          <View pointerEvents="none" style={styles.centre}>
            <Text accessibilityRole="header" numberOfLines={1} style={[type.title, { color: palette.foreground }]}>
              {rowTitle}
            </Text>
          </View>
        ) : null}
        {rowTitle !== undefined && !centred ? (
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={[type.title, styles.start, hasLeading ? styles.afterLeading : null, { color: palette.foreground }]}
          >
            {rowTitle}
          </Text>
        ) : (
          <View style={styles.spacer} />
        )}
        <View style={[styles.side, styles.trailing]}>{trailing}</View>
      </View>
      {large && title !== undefined ? (
        <View style={styles.large}>
          {eyebrow !== undefined ? (
            <Text style={[type.caps, styles.eyebrow, { color: palette['muted-foreground'] }]}>{eyebrow.toUpperCase()}</Text>
          ) : null}
          <Text accessibilityRole="header" style={[type.display, { color: palette.foreground }]}>
            {title}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: layout.gutter },
  row: { height: chrome.appBarHeight, flexDirection: 'row', alignItems: 'center' },
  side: { flexDirection: 'row', alignItems: 'center' },
  trailing: { justifyContent: 'flex-end', gap: space[2] },
  spacer: { flex: 1 },
  // A centred title spans the row, clear of two buttons on either side.
  centre: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[24] },
  start: { flex: 1 },
  afterLeading: { marginLeft: space[3] },
  large: { paddingTop: space[2], paddingBottom: space[3] },
  eyebrow: { marginBottom: space[1] },
});

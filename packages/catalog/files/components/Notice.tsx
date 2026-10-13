// An inline message inside content: a tinted band with an icon, a line or
// two of text, and one action or a dismiss. Tones info, success, warning
// and error. The tint is the tone colour laid under `card` at low opacity,
// with a solid rule on the leading edge, so the text stays `foreground`
// in both schemes. Screen readers treat it as an alert. Corners are
// `shape.cardInner`; text roles `type.label` (title) and `type.bodySm`.

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { shape, space, type } from '../theme/tokens';
import { usePalette, type Palette } from '../theme/usePalette';
import Icon, { type IconName } from './Icon';
import IconButton from './IconButton';
import Press, { textActionSlop } from './Press';

export type NoticeTone = 'info' | 'success' | 'warning' | 'error';

export interface NoticeProps {
  message: string;
  /** Bold line above the message. */
  title?: string;
  /** Default 'info'. */
  tone?: NoticeTone;
  /** Replaces the tone's icon. */
  icon?: React.ReactNode;
  /** Text action under the message ("Learn more"); rendered only with `onAction`. */
  actionLabel?: string;
  onAction?: () => void;
  /** Shows a close button at the trailing edge. */
  onDismiss?: () => void;
  /** Screen-reader name of the close button. Default 'Dismiss'. */
  dismissLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const ICON: { readonly [T in NoticeTone]: IconName } = { info: 'info', success: 'check-circle', warning: 'alert', error: 'x-circle' };
/** Comp tokens: the tint's opacity, the leading rule's width and the glyph sizes, in px. */
const TINT = 0.12;
const RULE = 3;
const GLYPH = 20;
const CLOSE = 16;

/** The tone's colour on the palette. */
export function noticeColor(tone: NoticeTone, palette: Palette): string {
  switch (tone) {
    case 'info':
      return palette.primary;
    case 'success':
      return palette.success;
    case 'warning':
      return palette.warning;
    case 'error':
      return palette.destructive;
  }
}

export default function Notice({ message, title, tone = 'info', icon, actionLabel, onAction, onDismiss, dismissLabel = 'Dismiss', style }: NoticeProps) {
  const palette = usePalette();
  const color = noticeColor(tone, palette);
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.notice, { borderRadius: shape.cardInner, backgroundColor: palette.card }, style]}
    >
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: TINT }]} />
      <View pointerEvents="none" style={[styles.rule, { backgroundColor: color }]} />
      <View style={styles.icon}>{icon ?? <Icon name={ICON[tone]} size={GLYPH} color={color} />}</View>
      <View style={styles.text}>
        {title !== undefined ? <Text style={[type.label, { color: palette.foreground }]}>{title}</Text> : null}
        <Text style={[type.bodySm, { color: palette['foreground-soft'] }]}>{message}</Text>
        {actionLabel !== undefined && onAction !== undefined ? (
          <Press
            onPress={onAction}
            accessibilityLabel={actionLabel}
            activeScale={1}
            hitSlop={textActionSlop(type.label.lineHeight)}
            style={styles.action}
          >
            <Text style={[type.label, { color }]}>{actionLabel}</Text>
          </Press>
        ) : null}
      </View>
      {onDismiss !== undefined ? (
        <IconButton onPress={onDismiss} accessibilityLabel={dismissLabel} size="sm" style={styles.close}>
          <Icon name="close" size={CLOSE} color={palette['muted-foreground']} />
        </IconButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'flex-start', overflow: 'hidden', paddingVertical: space[3], paddingLeft: space[4], paddingRight: space[2] },
  rule: { position: 'absolute', top: 0, bottom: 0, left: 0, width: RULE },
  icon: { marginRight: space[3], marginTop: space[0.5] },
  text: { flex: 1, paddingRight: space[2], gap: space[1] },
  action: { alignSelf: 'flex-start', marginTop: space[1] },
  close: { marginTop: -space[1] },
});

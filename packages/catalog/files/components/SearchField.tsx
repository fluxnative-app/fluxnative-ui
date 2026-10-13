// The search box at the top of a list: a search glyph, the field, a clear
// button once there is text, and an optional Cancel beside it. Drawn on
// `muted` as a pill (`shape.chip`) or a field (`shape.field`); the focus
// ring is `ring`. The placeholder is the field's screen-reader name, and
// the keyboard's search key submits the trimmed text.

import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { shape, space, type } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import Icon from './Icon';
import IconButton from './IconButton';
import Press, { textActionSlop } from './Press';

export type SearchFieldVariant = 'pill' | 'field';
export type SearchFieldSize = 'md' | 'lg';

export interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Also the field's screen-reader name. Default 'Search'. */
  placeholder?: string;
  /** The keyboard's search key, with the trimmed text. */
  onSubmit?: (text: string) => void;
  /** Shows a Cancel text button beside the field (a search screen of its own). */
  onCancel?: () => void;
  /** Default 'Cancel'. */
  cancelLabel?: string;
  /** Right of the text while it is empty: a scan or filter button. */
  trailing?: React.ReactNode;
  /** 'pill' (default, `shape.chip`) or 'field' (`shape.field`). */
  variant?: SearchFieldVariant;
  /** 40 or 48 px tall. Default 'md'. */
  size?: SearchFieldSize;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Not editable, drawn at full strength: the placeholder says why ("3 questions left tomorrow"). `disabled` fades the field instead. Default false. */
  readOnly?: boolean;
  /** Screen-reader name of the clear button. Default 'Clear search'. */
  clearLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Comp tokens `searchField.height.*`, in px. */
export const searchFieldHeight: { readonly [S in SearchFieldSize]: number } = { md: 40, lg: 48 };
const GLYPH = 18;

export default function SearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  onSubmit,
  onCancel,
  cancelLabel = 'Cancel',
  trailing,
  variant = 'pill',
  size = 'md',
  autoFocus = false,
  disabled = false,
  readOnly = false,
  clearLabel = 'Clear search',
  style,
}: SearchFieldProps) {
  const palette = usePalette();
  const [focused, setFocused] = useState(autoFocus);
  return (
    <View style={[styles.row, style]}>
      <View
        style={[
          styles.box,
          {
            height: searchFieldHeight[size],
            borderRadius: variant === 'pill' ? shape.chip : shape.field,
            backgroundColor: palette.muted,
            borderColor: focused ? palette.ring : 'transparent',
          },
          disabled ? styles.dimmed : null,
        ]}
      >
        <Icon name="search" size={GLYPH} color={palette['muted-foreground']} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette['muted-foreground']}
          accessibilityLabel={placeholder}
          editable={!disabled && !readOnly}
          accessibilityState={{ disabled: disabled || readOnly }}
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={() => onSubmit?.(value.trim())}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[type.body, styles.input, { color: palette.foreground }]}
        />
        {value !== '' ? (
          <IconButton onPress={() => onChangeText('')} accessibilityLabel={clearLabel} size="sm" disabled={disabled || readOnly}>
            <Icon name="close" size={GLYPH} color={palette['muted-foreground']} />
          </IconButton>
        ) : trailing !== undefined ? (
          <View style={styles.trailing}>{trailing}</View>
        ) : null}
      </View>
      {onCancel !== undefined ? (
        <Press
          onPress={onCancel}
          accessibilityLabel={cancelLabel}
          activeScale={1}
          hitSlop={textActionSlop(type.label.lineHeight)}
          style={styles.cancel}
        >
          <Text style={[type.label, { color: palette.primary }]}>{cancelLabel}</Text>
        </Press>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  box: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space[3],
    paddingRight: space[1],
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  input: { flex: 1, paddingVertical: 0, paddingHorizontal: space[2] },
  trailing: { marginLeft: space[1] },
  cancel: { marginLeft: space[3] },
  dimmed: { opacity: 0.45 },
});

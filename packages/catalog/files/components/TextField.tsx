// A labelled field for forms: the label above, the field on `muted` (or
// outlined on `input`), helper text or an error below. `kind` sets the
// keyboard and capitalisation; 'password' hides the text behind a
// Show / Hide toggle. Corners are `shape.field`; focus draws `ring`, an
// error draws `destructive` and is read with the field. Text is `type.body`.

import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions, type StyleProp, type ViewStyle } from 'react-native';
import { shape, space, type } from '../theme/tokens';
import { usePalette } from '../theme/usePalette';
import Press, { textActionSlop } from './Press';

export type TextFieldKind = 'text' | 'name' | 'email' | 'phone' | 'number' | 'url' | 'password';
export type TextFieldVariant = 'filled' | 'outline';

export interface TextFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Above the field; also its screen-reader name. */
  label?: string;
  placeholder?: string;
  /** Under the field, in `muted-foreground`. */
  helper?: string;
  /** Replaces the helper, in `destructive`, and marks the field invalid. */
  error?: string;
  /** Keyboard, capitalisation and secure entry. Default 'text'. */
  kind?: TextFieldKind;
  /** 'filled' (default) on `muted`; 'outline' with an `input` border. */
  variant?: TextFieldVariant;
  /** Inside the field, before the text (a currency sign, an icon). */
  leading?: React.ReactNode;
  /** Inside the field, after the text. 'password' keeps its toggle here. */
  trailing?: React.ReactNode;
  /** Grows with its lines, from three. */
  multiline?: boolean;
  disabled?: boolean;
  maxLength?: number;
  /** The keyboard's return key, with the trimmed text. */
  onSubmit?: (text: string) => void;
  /** Default: the label, else the placeholder. */
  accessibilityLabel?: string;
  /** The password toggle's text. Default 'Show' / 'Hide'. */
  showLabel?: string;
  hideLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const KEYBOARD: Record<TextFieldKind, KeyboardTypeOptions> = {
  text: 'default',
  name: 'default',
  email: 'email-address',
  phone: 'phone-pad',
  number: 'decimal-pad',
  url: 'url',
  password: 'default',
};
const CAPITALIZE: Record<TextFieldKind, 'none' | 'sentences' | 'words'> = {
  text: 'sentences',
  name: 'words',
  email: 'none',
  phone: 'none',
  number: 'none',
  url: 'none',
  password: 'none',
};
/** Comp token `textField.height`: a single-line field, in px. */
export const textFieldHeight = 48;
/** A multiline field starts at this many lines. */
const MIN_LINES = 3;

export default function TextField({
  value,
  onChangeText,
  label,
  placeholder,
  helper,
  error,
  kind = 'text',
  variant = 'filled',
  leading,
  trailing,
  multiline = false,
  disabled = false,
  maxLength,
  onSubmit,
  accessibilityLabel,
  showLabel = 'Show',
  hideLabel = 'Hide',
  style,
}: TextFieldProps) {
  const palette = usePalette();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const invalid = error !== undefined;
  const note = error ?? helper;
  const border = invalid ? palette.destructive : focused ? palette.ring : variant === 'outline' ? palette.input : 'transparent';
  return (
    <View style={style}>
      {label !== undefined ? <Text style={[type.label, styles.label, { color: palette['foreground-soft'] }]}>{label}</Text> : null}
      <View
        style={[
          styles.box,
          { backgroundColor: variant === 'filled' ? palette.muted : 'transparent', borderColor: border, borderRadius: shape.field },
          multiline ? styles.boxMultiline : { height: textFieldHeight },
          disabled ? styles.dimmed : null,
        ]}
      >
        {leading !== undefined ? <View style={styles.leading}>{leading}</View> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette['muted-foreground']}
          accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
          accessibilityHint={note}
          editable={!disabled}
          keyboardType={KEYBOARD[kind]}
          autoCapitalize={CAPITALIZE[kind]}
          autoCorrect={kind === 'text'}
          secureTextEntry={kind === 'password' && hidden}
          multiline={multiline}
          maxLength={maxLength}
          onSubmitEditing={() => onSubmit?.(value.trim())}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[type.body, styles.input, multiline ? { minHeight: type.body.lineHeight * MIN_LINES } : null, { color: palette.foreground }]}
        />
        {kind === 'password' ? (
          <Press
            onPress={() => setHidden(!hidden)}
            accessibilityLabel={`${hidden ? showLabel : hideLabel} password`}
            activeScale={1}
            hitSlop={textActionSlop(type.label.lineHeight)}
            disabled={disabled}
          >
            <Text style={[type.label, { color: palette.primary }]}>{hidden ? showLabel : hideLabel}</Text>
          </Press>
        ) : trailing !== undefined ? (
          <View style={styles.trailing}>{trailing}</View>
        ) : null}
      </View>
      {note !== undefined ? (
        <Text
          accessibilityLiveRegion={invalid ? 'polite' : 'none'}
          style={[type.bodySm, styles.note, { color: invalid ? palette.destructive : palette['muted-foreground'] }]}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: space[1.5] },
  box: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[4], borderWidth: StyleSheet.hairlineWidth * 2 },
  boxMultiline: { alignItems: 'flex-start', paddingVertical: space[3] },
  input: { flex: 1, paddingVertical: 0, paddingHorizontal: 0, textAlignVertical: 'top' },
  leading: { marginRight: space[2] },
  trailing: { marginLeft: space[2] },
  note: { marginTop: space[1.5] },
  dimmed: { opacity: 0.45 },
});

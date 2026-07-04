import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { SText } from './ui/SText';
import { spacing } from '../design/tokens';
import { commerceRadius, type CommerceColorPalette } from '../design/commerce';
import { useCommerceTheme } from '../design/useCommerceTheme';

type FormInputProps = TextInputProps & {
  label: string;
  /** Field-level error message — shown below the input when set, also applies error border */
  error?: string;
};

export function FormInput({
  label,
  multiline = false,
  style,
  error,
  onBlur,
  onFocus,
  ...props
}: FormInputProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={s.inputGroup}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={() => inputRef.current?.focus()}
      >
        <SText variant="label" style={[s.label, isFocused && s.labelFocused]}>{label}</SText>
      </Pressable>
      <TextInput
        ref={inputRef}
        multiline={multiline}
        placeholderTextColor={colors.weak}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        style={[
          s.input,
          multiline && s.textArea,
          isFocused && s.inputFocused,
          error && s.inputError,
          style,
        ]}
        {...props}
      />
      {error ? (
        <SText variant="caption" style={s.errorText}>{error}</SText>
      ) : null}
    </View>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    inputGroup: {
      marginBottom: spacing.md,
    },
    label: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0,
      marginBottom: 7,
    },
    labelFocused: {
      color: colors.accent,
    },
    input: {
      backgroundColor: colors.softBg,
      borderColor: 'transparent',
      borderRadius: commerceRadius.lg,
      borderWidth: 1.5,
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
      minHeight: 52,
      paddingHorizontal: spacing.md,
      paddingVertical: 0,
    },
    inputFocused: {
      backgroundColor: colors.surface,
      borderColor: colors.accent,
    },
    inputError: {
      backgroundColor: colors.errorSoft,
      borderColor: colors.error,
    },
    errorText: {
      color: colors.error,
      fontSize: 12,
      fontWeight: '700',
      marginTop: spacing.xs,
    },
    textArea: {
      minHeight: 104,
      paddingBottom: 14,
      paddingTop: 14,
      textAlignVertical: 'top',
    },
  });
}

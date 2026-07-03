import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { SText } from './ui/SText';
import { borderRadius, spacing } from '../design/tokens';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';

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
  const { colors } = useTheme();
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
        placeholderTextColor={colors.textTertiary}
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

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    inputGroup: {
      marginBottom: spacing.md,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    labelFocused: {
      color: colors.primary,
    },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      borderWidth: 1.5,
      color: colors.textPrimary,
      fontSize: 15,
      minHeight: 52,
      paddingHorizontal: spacing.md,
      paddingVertical: 0,
    },
    inputFocused: {
      borderColor: colors.primary,
    },
    inputError: {
      borderColor: colors.error,
    },
    errorText: {
      color: colors.error,
      fontSize: 12,
      marginTop: spacing.xs,
    },
    textArea: {
      minHeight: 96,
      paddingTop: 14,
      paddingBottom: 14,
      textAlignVertical: 'top',
    },
  });
}

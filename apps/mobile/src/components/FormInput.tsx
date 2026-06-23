import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { SText } from './ui/SText';
import { borderRadius, colors, spacing } from '../design/tokens';

type FormInputProps = TextInputProps & {
  label: string;
  /** Field-level error message — shown below the input when set, also applies error border */
  error?: string;
};

export function FormInput({ label, multiline = false, style, error, ...props }: FormInputProps) {
  return (
    <View style={styles.inputGroup}>
      <SText variant="label" style={styles.label}>{label}</SText>
      <TextInput
        multiline={multiline}
        placeholderTextColor={colors.textTertiary}
        style={[
          styles.input,
          multiline && styles.textArea,
          error && styles.inputError,
          style,
        ]}
        {...props}
      />
      {error ? (
        <SText variant="caption" style={styles.errorText}>{error}</SText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
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
    minHeight: 88,
    textAlignVertical: 'top',
  },
});

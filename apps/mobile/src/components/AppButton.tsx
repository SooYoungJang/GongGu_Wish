import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { SText } from './ui/SText';
import { borderRadius, colors, spacing } from '../design/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'accent';

type AppButtonProps = {
  children: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
};

export function AppButton({
  children,
  onPress,
  disabled = false,
  variant = 'primary',
  style,
}: AppButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <SText variant="button" style={[styles.text, variant === 'secondary' && styles.secondaryText]}>
        {children}
      </SText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  accent: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.borderLight,
  },
  text: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.82,
  },
});

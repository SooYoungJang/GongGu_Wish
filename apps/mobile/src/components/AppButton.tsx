import { useMemo } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { SText } from './ui/SText';
import { spacing } from '../design/tokens';
import { commerceRadius, type CommerceColorPalette } from '../design/commerce';
import { useCommerceTheme } from '../design/useCommerceTheme';

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
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.base,
        s[variant],
        disabled && s.disabled,
        pressed && !disabled && s.pressed,
        style,
      ]}
    >
      <SText variant="button" style={[s.text, variant === 'secondary' && s.secondaryText]}>
        {children}
      </SText>
    </Pressable>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    base: {
      alignItems: 'center',
      borderRadius: commerceRadius.lg,
      justifyContent: 'center',
      minHeight: 50,
      paddingHorizontal: spacing.lg,
      paddingVertical: 13,
    },
    primary: {
      backgroundColor: colors.accent,
    },
    accent: {
      backgroundColor: colors.text,
    },
    secondary: {
      backgroundColor: colors.softBg,
      borderColor: colors.border,
      borderWidth: 1,
    },
    text: {
      color: colors.inverse,
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: 21,
    },
    secondaryText: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: '800',
    },
    disabled: {
      opacity: 0.55,
    },
    pressed: {
      opacity: 0.82,
    },
  });
}

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { SearchGlyph } from '../ui/LineGlyphs';
import { SText, type STextVariant } from '../ui/SText';
import { commerceRadius } from '../../design/commerce';
import { useCommerceTheme } from '../../design/useCommerceTheme';

export function CommerceSurface({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useCommerceTheme();
  return <View style={[{ backgroundColor: colors.bg, flex: 1 }, style]}>{children}</View>;
}

export function CommerceCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, shadow } = useCommerceTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }, shadow, style]}>{children}</View>;
}

export function CommerceChip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useCommerceTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected }}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.softBg : colors.surface,
          borderColor: selected ? colors.softBg : colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <SText variant="label" style={[styles.chipText, { color: selected ? colors.text : colors.muted }]}>{label}</SText>
    </Pressable>
  );
}

export function CommerceSectionTitle({
  children,
  variant = 'cardTitle',
  right,
}: {
  children: ReactNode;
  variant?: STextVariant;
  right?: ReactNode;
}) {
  const { colors } = useCommerceTheme();
  return (
    <View style={styles.sectionTitleRow}>
      <SText variant={variant} style={[styles.sectionTitleText, { color: colors.text }]}>{children}</SText>
      {right}
    </View>
  );
}

export function CommerceSearchField({
  value,
  onChangeText,
  placeholder = '상품을 검색해보세요',
  editable = true,
  style,
  ...props
}: TextInputProps & { style?: StyleProp<ViewStyle> }) {
  const { colors } = useCommerceTheme();
  return (
    <View style={[styles.searchField, { backgroundColor: colors.softBg }, style]}>
      <SearchGlyph color={colors.weak} size={20} />
      <TextInput
        {...props}
        editable={editable}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.weak}
        style={[styles.searchInput, { color: colors.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: commerceRadius.xl,
    borderWidth: 1,
  },
  chip: {
    alignItems: 'center',
    borderRadius: commerceRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 14,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '900',
    includeFontPadding: false,
  },
  pressed: {
    opacity: 0.72,
  },
  searchField: {
    alignItems: 'center',
    borderRadius: commerceRadius.lg,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    height: 48,
    lineHeight: 23,
    padding: 0,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitleText: {
    flexShrink: 1,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 27,
    marginBottom: 0,
  },
});

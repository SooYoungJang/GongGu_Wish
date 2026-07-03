import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SText } from '../../components/ui/SText';

import { borderRadius, spacing } from '../../design/tokens';
import type { CategoryColorName } from '../../design/tokens';
import { useTheme } from '../../context/ThemeContext';
import type { ColorPalette } from '../../context/ThemeContext';

export type CategoryItem = {
  key: CategoryColorName;
  label: string;
  icon: string;
};

export const CATEGORIES: CategoryItem[] = [
  { key: 'beauty', label: '뷰티', icon: '✦' },
  { key: 'fashion', label: '패션', icon: '◒' },
  { key: 'food', label: '푸드', icon: '●' },
  { key: 'lifestyle', label: '라이프', icon: '◇' },
  { key: 'baby', label: '육아', icon: '♡' },
  { key: 'digital', label: '디지털', icon: '⌁' },
];

type CategoryIconProps = {
  item: CategoryItem;
  index: number;
  selected: boolean;
  onPress: (category: CategoryColorName) => void;
  s: ReturnType<typeof makeStyles>;
  colors: ColorPalette;
};

function CategoryIcon({ item, index, selected, onPress, s, colors }: CategoryIconProps) {
  const palette = [
    { bg: colors.surfaceHover, text: colors.textPrimary, border: colors.surfaceHover },
    { bg: colors.borderLight, text: colors.textSecondary, border: colors.borderLight },
    { bg: colors.primaryBg, text: colors.primary, border: colors.primaryBg },
  ][index % 3];

  return (
    <Pressable
      accessibilityLabel={`${item.label} 카테고리 보기`}
      accessibilityRole="button"
      onPress={() => onPress(item.key)}
      style={[
        s.categoryItem,
        { backgroundColor: palette.bg, borderColor: palette.border },
        selected && { backgroundColor: colors.primary, borderColor: colors.primary },
      ]}
    >
      <SText variant="caption" style={[s.categoryLabel, { color: selected ? colors.textInverse : palette.text }]}>{item.label}</SText>
    </Pressable>
  );
}

type CategoryRowProps = {
  onPressCategory: (category: CategoryColorName) => void;
  selectedCategory?: CategoryColorName | null;
};

export function CategoryRow({ onPressCategory, selectedCategory }: CategoryRowProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(), []);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryRow}>
      {CATEGORIES.map((item, index) => (
        <CategoryIcon
          key={item.key}
          item={item}
          index={index}
          selected={selectedCategory === item.key}
          onPress={onPressCategory}
          s={s}
          colors={colors}
        />
      ))}
    </ScrollView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    categoryRow: { gap: spacing.sm, marginBottom: spacing.xl, paddingRight: spacing.lg },
    categoryItem: {
      alignItems: 'center',
      borderRadius: borderRadius.full,
      borderWidth: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      minHeight: 46,
      minWidth: 96,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    categoryLabel: { fontSize: 15, fontWeight: '800' },
  });
}

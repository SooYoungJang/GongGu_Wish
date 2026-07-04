import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SText } from '../ui/SText';
import { categoryColors, spacing } from '../../design/tokens';
import { commerceRadius, type CommerceColorPalette } from '../../design/commerce';
import { useCommerceTheme } from '../../design/useCommerceTheme';
import {
  RANKING_CATEGORY_LABELS,
  RANKING_SORT_CHIPS,
  type RankingCategory,
  type RankingSort,
} from '../../features/ranking/types';

export interface RankingCategoryChipsProps {
  value: RankingCategory;
  categories: readonly RankingCategory[];
  sort: RankingSort;
  onChange: (next: RankingCategory) => void;
  onChangeSort: (next: RankingSort) => void;
}

function getCategoryPalette(category: RankingCategory, colors: CommerceColorPalette) {
  if (category === 'all') {
    return { bg: colors.accentSoft, text: colors.accent, border: colors.accent };
  }

  return categoryColors[category];
}

export function RankingCategoryChips({ value, categories, sort, onChange, onChangeSort }: RankingCategoryChipsProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={s.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
        {categories.map((category) => {
          const selected = category === value;
          const palette = getCategoryPalette(category, colors);

          return (
            <Pressable
              key={category}
              accessibilityLabel={`${RANKING_CATEGORY_LABELS[category]} 카테고리`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(category)}
              style={[
                s.categoryChip,
                {
                  backgroundColor: selected ? palette.bg : colors.surface,
                  borderColor: selected ? palette.border : colors.border,
                },
              ]}
            >
              <SText variant="body" style={[s.categoryChipText, { color: selected ? palette.text : colors.muted }]}>
                {RANKING_CATEGORY_LABELS[category]}
              </SText>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.subChipRow}>
        {RANKING_SORT_CHIPS.map((chip) => {
          const selected = chip.key === sort;

          return (
            <Pressable
              key={chip.key}
              accessibilityLabel={`${chip.label} 정렬`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChangeSort(chip.key)}
              style={[s.sortChip, selected && s.selectedSortChip]}
            >
              <SText variant="caption" style={[s.sortChipText, selected && s.selectedSortChipText]}>{chip.label}</SText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    categoryChip: {
      alignItems: 'center',
      borderRadius: commerceRadius.full,
      borderWidth: 1,
      height: 36,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: 0,
    },
    categoryChipText: {
      fontWeight: '800',
      includeFontPadding: false,
    },
    chipRow: {
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    selectedSortChip: {
      backgroundColor: colors.text,
      borderColor: colors.text,
    },
    selectedSortChipText: {
      color: colors.bg,
    },
    sortChip: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: commerceRadius.full,
      borderWidth: 1,
      height: 32,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: 0,
    },
    sortChipText: {
      color: colors.muted,
      fontWeight: '900',
      includeFontPadding: false,
    },
    subChipRow: {
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
  });
}

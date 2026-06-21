import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { borderRadius, categoryColors, colors, spacing } from '../../design/tokens';
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

function getCategoryPalette(category: RankingCategory) {
  if (category === 'all') {
    return { bg: colors.primaryBg, text: colors.primary, border: colors.primaryLight };
  }

  return categoryColors[category];
}

export function RankingCategoryChips({ value, categories, sort, onChange, onChangeSort }: RankingCategoryChipsProps) {
  return (
    <View style={{ gap: spacing.sm }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {categories.map((category) => {
          const selected = category === value;
          const palette = getCategoryPalette(category);

          return (
            <Pressable
              key={category}
              accessibilityLabel={`${RANKING_CATEGORY_LABELS[category]} 카테고리`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(category)}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: selected ? palette.bg : colors.surface,
                  borderColor: selected ? palette.border : colors.border,
                },
              ]}
            >
              <Text style={[styles.categoryText, { color: selected ? palette.text : colors.textSecondary }]}>
                {RANKING_CATEGORY_LABELS[category]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subChipRow}>
        {RANKING_SORT_CHIPS.map((chip) => {
          const selected = chip.key === sort;

          return (
            <Pressable
              key={chip.key}
              accessibilityLabel={`${chip.label} 정렬`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChangeSort(chip.key)}
              style={[styles.sortChip, selected && styles.selectedSortChip]}
            >
              <Text style={[styles.sortText, selected && styles.selectedSortText]}>{chip.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  categoryChip: {
    alignItems: 'center',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    justifyContent: 'center',
    height: 36,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '800',
    includeFontPadding: false,
  },
  chipRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  selectedSortChip: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  selectedSortText: {
    color: colors.textInverse,
  },
  sortChip: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    justifyContent: 'center',
    height: 32,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
  },
  sortText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    includeFontPadding: false,
    lineHeight: 12,
  },
  subChipRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});

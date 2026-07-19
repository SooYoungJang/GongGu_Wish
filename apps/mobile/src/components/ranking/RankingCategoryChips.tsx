import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { SText } from "../ui/SText";
import { categoryColors, spacing } from "../../design/tokens";
import {
  commerceRadius,
  type CommerceColorPalette,
} from "../../design/commerce";
import { useCommerceTheme } from "../../design/useCommerceTheme";
import {
  RANKING_CATEGORY_LABELS,
  RANKING_SORT_CHIPS,
  type RankingCategory,
  type RankingSort,
} from "../../features/ranking/types";

export interface RankingCategoryChipsProps {
  value: RankingCategory;
  categories: readonly RankingCategory[];
  sort: RankingSort;
  mode?: "all" | "sort" | "category";
  onChange: (next: RankingCategory) => void;
  onChangeSort: (next: RankingSort) => void;
}

function getCategoryPalette(
  category: RankingCategory,
  colors: CommerceColorPalette,
) {
  if (category === "all") {
    return {
      background: colors.accentSoft,
      border: colors.accent,
      text: colors.accent,
    };
  }

  const palette = categoryColors[category];
  return {
    background: palette.bg,
    border: palette.border,
    text: palette.text,
  };
}

export function RankingCategoryChips({
  value,
  categories,
  sort,
  mode = "all",
  onChange,
  onChangeSort,
}: RankingCategoryChipsProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const showSort = mode !== "category";
  const showCategory = mode !== "sort";

  return (
    <View style={s.container}>
      {showSort ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.sortRow}
        >
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
                <SText
                  variant="caption"
                  style={[s.sortChipText, selected && s.selectedSortChipText]}
                >
                  {chip.label}
                </SText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {showCategory ? (
        <ScrollView
          accessibilityRole="tablist"
          contentContainerStyle={s.categoryRow}
          horizontal
          showsHorizontalScrollIndicator={false}
          testID="ranking-category-scroll"
        >
          {categories.map((category) => {
            const selected = category === value;
            const palette = getCategoryPalette(category, colors);

            return (
              <Pressable
                accessibilityLabel={`${RANKING_CATEGORY_LABELS[category]} 카테고리`}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                key={category}
                onPress={() => onChange(category)}
                style={[
                  s.categoryChip,
                  {
                    backgroundColor: selected
                      ? palette.background
                      : colors.surface,
                    borderColor: selected ? palette.border : colors.border,
                  },
                ]}
              >
                <SText
                  variant="caption"
                  style={[
                    s.categoryChipText,
                    { color: selected ? palette.text : colors.muted },
                  ]}
                >
                  {RANKING_CATEGORY_LABELS[category]}
                </SText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    categoryChip: {
      alignItems: "center",
      borderRadius: commerceRadius.full,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    categoryChipText: {
      fontWeight: "800",
      includeFontPadding: false,
    },
    categoryRow: {
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: 1,
    },
    selectedSortChip: {
      borderBottomColor: colors.accent,
    },
    selectedSortChipText: {
      color: colors.accent,
    },
    sortChip: {
      alignItems: "center",
      borderBottomColor: "transparent",
      borderBottomWidth: 2,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
    },
    sortChipText: {
      color: colors.muted,
      fontWeight: "900",
      includeFontPadding: false,
    },
    sortRow: {
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
    },
  });
}

import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SText } from '../ui/SText';
import { spacing } from '../../design/tokens';
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
  mode?: 'all' | 'sort' | 'category';
  onChange: (next: RankingCategory) => void;
  onChangeSort: (next: RankingSort) => void;
}

export function RankingCategoryChips({
  value,
  categories,
  sort,
  mode = 'all',
  onChange,
  onChangeSort,
}: RankingCategoryChipsProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const showSort = mode !== 'category';
  const showCategory = mode !== 'sort';
  const categoryLabel = RANKING_CATEGORY_LABELS[value];
  const triggerLabel = value === 'all' ? `카테고리 ${categoryLabel}` : categoryLabel;

  const selectCategory = (category: RankingCategory) => {
    onChange(category);
    setPickerOpen(false);
  };

  return (
    <View style={s.container}>
      {showSort ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sortRow}>
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
                <SText variant="caption" style={[s.sortChipText, selected && s.selectedSortChipText]}>
                  {chip.label}
                </SText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {showCategory ? (
        <>
          <View style={s.categoryRow}>
            <Pressable
              accessibilityLabel={`${triggerLabel} 선택`}
              accessibilityRole="button"
              accessibilityState={{ expanded: pickerOpen }}
              onPress={() => setPickerOpen(true)}
              style={({ pressed }) => [s.categoryTrigger, pressed && s.pressed]}
            >
              <SText variant="caption" style={s.categoryTriggerText}>
                {triggerLabel}
              </SText>
              <Ionicons color={colors.bg} name="chevron-down" size={14} />
            </Pressable>
          </View>

          <Modal animationType="fade" onRequestClose={() => setPickerOpen(false)} transparent visible={pickerOpen}>
            <View style={s.backdrop}>
              <Pressable
                accessibilityLabel="카테고리 선택창 닫기"
                accessibilityRole="button"
                onPress={() => setPickerOpen(false)}
                style={s.backdropDismiss}
              />
              <View accessibilityViewIsModal style={s.sheet}>
                <View style={s.sheetHeader}>
                  <View>
                    <SText variant="cardTitle" style={s.sheetTitle}>
                      카테고리 선택
                    </SText>
                    <SText variant="caption" style={s.sheetSubtitle}>
                      보고 싶은 공구 분야를 골라주세요
                    </SText>
                  </View>
                  <Pressable
                    accessibilityLabel="카테고리 선택창 닫기"
                    accessibilityRole="button"
                    onPress={() => setPickerOpen(false)}
                    style={({ pressed }) => [s.closeButton, pressed && s.pressed]}
                  >
                    <Ionicons color={colors.text} name="close" size={22} />
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.categoryGrid}>
                  {categories.map((category) => {
                    const selected = category === value;
                    return (
                      <Pressable
                        key={category}
                        accessibilityLabel={`${RANKING_CATEGORY_LABELS[category]} 카테고리`}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => selectCategory(category)}
                        style={({ pressed }) => [
                          s.categoryOption,
                          selected && s.selectedCategoryOption,
                          pressed && s.pressed,
                        ]}
                      >
                        <SText variant="body" style={[s.categoryOptionText, selected && s.selectedCategoryOptionText]}>
                          {RANKING_CATEGORY_LABELS[category]}
                        </SText>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </>
      ) : null}
    </View>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    backdrop: {
      backgroundColor: colors.overlay,
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdropDismiss: {
      ...StyleSheet.absoluteFillObject,
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      paddingBottom: spacing.xl,
    },
    categoryOption: {
      alignItems: 'center',
      backgroundColor: colors.softBg,
      borderColor: colors.borderLight,
      borderRadius: commerceRadius.sm,
      borderWidth: 1,
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      width: '48%',
    },
    categoryOptionText: {
      color: colors.muted,
      fontWeight: '800',
      includeFontPadding: false,
    },
    categoryRow: {
      paddingHorizontal: spacing.lg,
    },
    categoryTrigger: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.text,
      borderRadius: commerceRadius.sm,
      flexDirection: 'row',
      gap: spacing.xs,
      minHeight: 44,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    categoryTriggerText: {
      color: colors.bg,
      fontWeight: '900',
    },
    closeButton: {
      alignItems: 'center',
      backgroundColor: colors.softBg,
      borderRadius: commerceRadius.full,
      justifyContent: 'center',
      minHeight: 44,
      minWidth: 44,
    },
    pressed: {
      opacity: 0.72,
    },
    selectedCategoryOption: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    selectedCategoryOptionText: {
      color: colors.accent,
    },
    selectedSortChip: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    selectedSortChipText: {
      color: colors.accent,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: commerceRadius.xxl,
      borderTopRightRadius: commerceRadius.xxl,
      maxHeight: '74%',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    sheetHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    sheetSubtitle: {
      color: colors.muted,
      marginTop: spacing.xs,
    },
    sheetTitle: {
      color: colors.text,
      fontWeight: '900',
    },
    sortChip: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: commerceRadius.full,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    sortChipText: {
      color: colors.muted,
      fontWeight: '900',
      includeFontPadding: false,
    },
    sortRow: {
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
  });
}

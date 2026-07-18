import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { useCommerceTheme } from "../../design/useCommerceTheme";
import {
  formatRankingUpdatedAt,
  RANKING_CATEGORY_LABELS,
  RANKING_PERIOD_LABELS,
  RANKING_SORT_CHIPS,
  type RankingCategory,
  type RankingPeriod,
  type RankingSort,
} from "../../features/ranking/types";
import { SText } from "../ui/SText";

export interface RankingBasisBarProps {
  category: RankingCategory;
  period: RankingPeriod;
  sort: RankingSort;
  updatedAt?: number;
}

const ROLLING_WINDOW_LABELS: Record<RankingPeriod, string> = {
  today: "최근 24시간 롤링 집계",
  weekly: "최근 7일 롤링 집계",
  monthly: "최근 30일 롤링 집계",
};

const WINDOW_SHORT_LABELS: Record<RankingPeriod, string> = {
  today: "최근 24시간 기준",
  weekly: "최근 7일 기준",
  monthly: "최근 30일 기준",
};

export function RankingBasisBar({
  category,
  period,
  sort,
  updatedAt,
}: RankingBasisBarProps) {
  const theme = useCommerceTheme();
  const s = useMemo(() => makeStyles(theme), [theme]);
  const sortLabel =
    RANKING_SORT_CHIPS.find((chip) => chip.key === sort)?.label ?? "인기 공구";
  const categoryLabel = RANKING_CATEGORY_LABELS[category];
  const updatedLabel = formatRankingUpdatedAt(updatedAt);
  const accessibilityLabel = `${ROLLING_WINDOW_LABELS[period]}, 현재 목록 최고점 100, 조회, 저장, 알림, 상세 관심 반영, ${RANKING_PERIOD_LABELS[period]}, ${sortLabel}, ${categoryLabel} 카테고리, ${updatedLabel}`;

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={s.container}
      testID="ranking-basis-bar"
    >
      <View style={s.copy}>
        <SText style={s.eyebrow} variant="caption">
          인기지수 안내
        </SText>
        <SText style={s.metrics} variant="caption">
          현재 목록 최고점=100 · 조회·저장·알림·상세 관심 반영
        </SText>
      </View>
      <SText style={s.updatedAt} variant="caption">
        {WINDOW_SHORT_LABELS[period]} · {updatedLabel}
      </SText>
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useCommerceTheme>) {
  const { colors, radius, spacing, typography } = theme;
  return StyleSheet.create({
    container: {
      alignItems: "center",
      backgroundColor: colors.accentSoft,
      borderCurve: "continuous",
      borderRadius: radius.md,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      justifyContent: "space-between",
      marginHorizontal: spacing.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    copy: {
      flex: 1,
      gap: spacing.xxs,
      minWidth: 210,
    },
    eyebrow: {
      color: colors.accent,
      ...typography.badge,
    },
    metrics: {
      color: colors.muted,
      lineHeight: 16,
    },
    updatedAt: {
      color: colors.weak,
      lineHeight: 16,
    },
  });
}

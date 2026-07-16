import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import {
  commerceRadius,
  type CommerceColorPalette,
} from "../../design/commerce";
import { spacing } from "../../design/tokens";
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

export function RankingBasisBar({
  category,
  period,
  sort,
  updatedAt,
}: RankingBasisBarProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const sortLabel =
    RANKING_SORT_CHIPS.find((chip) => chip.key === sort)?.label ?? "인기 공구";
  const categoryLabel = RANKING_CATEGORY_LABELS[category];
  const accessibilityLabel = `${ROLLING_WINDOW_LABELS[period]}, ${RANKING_PERIOD_LABELS[period]}, ${sortLabel}, ${categoryLabel} 카테고리`;

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={s.container}
      testID="ranking-basis-bar"
    >
      <View style={s.headingRow}>
        <SText style={s.eyebrow} variant="caption">
          랭킹 기준
        </SText>
        <SText style={s.updatedAt} variant="caption">
          {formatRankingUpdatedAt(updatedAt)}
        </SText>
      </View>
      <SText style={s.window} variant="body">
        {ROLLING_WINDOW_LABELS[period]}
      </SText>
      <SText style={s.selection} variant="caption">
        {RANKING_PERIOD_LABELS[period]} · {sortLabel} · {categoryLabel}
      </SText>
      <SText style={s.metrics} variant="caption">
        조회·저장·알림·검색 클릭을 반영한 인기지수
      </SText>
    </View>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.softBg,
      borderRadius: commerceRadius.md,
      gap: spacing.xs,
      marginHorizontal: spacing.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    eyebrow: {
      color: colors.accent,
      fontWeight: "900",
    },
    headingRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    metrics: {
      color: colors.muted,
      lineHeight: 16,
    },
    selection: {
      color: colors.text,
      fontWeight: "800",
    },
    updatedAt: {
      color: colors.weak,
    },
    window: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      lineHeight: 20,
    },
  });
}

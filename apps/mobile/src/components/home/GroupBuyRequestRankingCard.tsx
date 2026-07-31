import { useMemo, type Dispatch } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { GroupBuyRequestRanking } from "../../features/groupBuyRequests";
import {
  commerceRadius,
  commerceSpacing,
  type CommerceColorPalette,
} from "../../design/commerce";
import { useCommerceTheme } from "../../design/useCommerceTheme";
import { SText } from "../ui/SText";

type GroupBuyRequestRankingCardProps = {
  rankings: GroupBuyRequestRanking[];
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
  onOpenSearch: () => void;
  onPressRanking: Dispatch<string>;
  onRetry: () => void;
};

const MAX_VISIBLE_RANKINGS = 3;

export function GroupBuyRequestRankingCard({
  rankings,
  isError,
  isFetching,
  isLoading,
  onOpenSearch,
  onPressRanking,
  onRetry,
}: GroupBuyRequestRankingCardProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const visibleRankings = rankings.slice(0, MAX_VISIBLE_RANKINGS);
  const hasRankings = visibleRankings.length > 0;
  const isInitialLoading = isLoading && !hasRankings;

  return (
    <View
      accessibilityState={isInitialLoading ? { busy: true } : undefined}
      style={s.card}
      testID="home-group-buy-request-rankings"
    >
      <View style={s.header}>
        <View style={s.headerCopy}>
          <SText accessibilityRole="header" style={s.title} variant="body">
            최근 한 달 공구 요청 TOP 3
          </SText>
          <SText style={s.subtitle} variant="caption">
            최근 30일 동안 가장 많이 요청한 상품이에요
          </SText>
        </View>
        {isFetching && hasRankings && !isError ? (
          <SText
            accessibilityLiveRegion="polite"
            style={s.refreshingText}
            variant="caption"
          >
            업데이트 중
          </SText>
        ) : null}
      </View>

      {isInitialLoading ? (
        <View
          accessibilityLabel="공구 요청 순위를 불러오는 중"
          accessibilityRole="progressbar"
          style={s.rows}
        >
          {Array.from({ length: MAX_VISIBLE_RANKINGS }, (_, index) => (
            <View
              key={index}
              style={s.skeletonRow}
              testID={`group-buy-request-ranking-skeleton-${index + 1}`}
            >
              <View style={s.skeletonRank} />
              <View style={s.skeletonName} />
              <View style={s.skeletonCount} />
            </View>
          ))}
        </View>
      ) : isError && !hasRankings ? (
        <View
          accessibilityLiveRegion="assertive"
          style={s.state}
          testID="group-buy-request-ranking-error"
        >
          <SText style={s.stateTitle} variant="body">
            요청 순위를 불러오지 못했어요
          </SText>
          <Pressable
            accessibilityLabel="공구 요청 순위 다시 불러오기"
            accessibilityRole="button"
            onPress={onRetry}
            style={s.stateButton}
          >
            <SText style={s.stateButtonText} variant="label">
              다시 불러오기
            </SText>
          </Pressable>
        </View>
      ) : !hasRankings ? (
        <View style={s.state} testID="group-buy-request-ranking-empty">
          <SText style={s.stateTitle} variant="body">
            아직 순위에 오른 요청이 없어요
          </SText>
          <SText style={s.stateDescription} variant="caption">
            찾는 공구가 없다면 직접 요청해보세요
          </SText>
          <Pressable
            accessibilityLabel="공구 요청하러 가기"
            accessibilityRole="button"
            onPress={onOpenSearch}
            style={s.stateButton}
          >
            <SText style={s.stateButtonText} variant="label">
              공구 요청하기
            </SText>
          </Pressable>
        </View>
      ) : (
        <View style={s.rows}>
          {visibleRankings.map((ranking, index) => {
            const isFirst = index === 0;
            const isLast = index === visibleRankings.length - 1;
            return (
              <Pressable
                accessibilityLabel={`${ranking.rank}위, ${ranking.productName}, 요청 ${ranking.requestCount}건`}
                accessibilityRole="button"
                key={ranking.requestId}
                onPress={() => onPressRanking(ranking.productName)}
                style={[
                  s.row,
                  isFirst ? s.firstRow : null,
                  isLast ? null : s.rowDivider,
                ]}
              >
                <View
                  style={[s.rankBadge, isFirst ? s.firstRankBadge : null]}
                  testID={`group-buy-request-rank-badge-${ranking.rank}`}
                >
                  <SText
                    style={[s.rankText, isFirst ? s.firstRankText : null]}
                    variant="badge"
                  >
                    {ranking.rank}
                  </SText>
                </View>
                <SText
                  numberOfLines={2}
                  style={s.productName}
                  variant="body"
                >
                  {ranking.productName}
                </SText>
                <SText style={s.requestCount} variant="caption">
                  요청 {ranking.requestCount}건
                </SText>
                <SText
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                  style={s.chevron}
                  variant="body"
                >
                  ›
                </SText>
              </Pressable>
            );
          })}
          {isError ? (
            <Pressable
              accessibilityLabel="저장된 공구 요청 순위 표시 중, 다시 불러오기"
              accessibilityLiveRegion="polite"
              accessibilityRole="button"
              onPress={onRetry}
              style={s.staleNotice}
              testID="group-buy-request-ranking-stale"
            >
              <SText style={s.staleText} variant="caption">
                최신 순위를 확인하지 못했어요 · 다시 시도
              </SText>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.panelBg,
      borderColor: colors.borderLight,
      borderCurve: "continuous",
      borderRadius: commerceRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      marginHorizontal: commerceSpacing.screen,
      marginTop: commerceSpacing.md,
      overflow: "hidden",
      padding: commerceSpacing.md,
    },
    header: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: commerceSpacing.sm,
      justifyContent: "space-between",
      paddingBottom: commerceSpacing.sm,
      paddingHorizontal: commerceSpacing.xs,
    },
    headerCopy: {
      flex: 1,
      gap: commerceSpacing.xxs,
      minWidth: 0,
    },
    title: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
      letterSpacing: -0.1,
      lineHeight: 22,
    },
    subtitle: {
      color: colors.muted,
      flexShrink: 1,
      fontSize: 12,
      lineHeight: 17,
    },
    refreshingText: {
      color: colors.accent,
      flexShrink: 0,
      fontSize: 11,
      fontWeight: "800",
      lineHeight: 16,
      paddingTop: 2,
    },
    rows: {
      gap: 0,
    },
    row: {
      alignItems: "center",
      borderCurve: "continuous",
      borderRadius: commerceRadius.md,
      flexDirection: "row",
      gap: commerceSpacing.sm,
      minHeight: 48,
      paddingHorizontal: commerceSpacing.sm,
      paddingVertical: commerceSpacing.xs,
    },
    firstRow: {
      backgroundColor: colors.accentSoft,
    },
    rowDivider: {
      borderBottomColor: colors.divider,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rankBadge: {
      alignItems: "center",
      backgroundColor: colors.softBg,
      borderCurve: "continuous",
      borderRadius: commerceRadius.sm,
      flexShrink: 0,
      justifyContent: "center",
      minHeight: 28,
      minWidth: 28,
      paddingHorizontal: commerceSpacing.xs,
      paddingVertical: commerceSpacing.xxs,
    },
    firstRankBadge: {
      backgroundColor: colors.accent,
    },
    rankText: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "900",
      lineHeight: 16,
    },
    firstRankText: {
      color: colors.inverse,
    },
    productName: {
      color: colors.text,
      flex: 1,
      flexShrink: 1,
      fontSize: 14,
      fontWeight: "800",
      lineHeight: 20,
      minWidth: 0,
    },
    requestCount: {
      color: colors.muted,
      flexShrink: 0,
      fontSize: 12,
      fontWeight: "800",
      lineHeight: 17,
    },
    chevron: {
      color: colors.weak,
      flexShrink: 0,
      fontSize: 18,
      lineHeight: 20,
    },
    state: {
      alignItems: "center",
      gap: commerceSpacing.xs,
      justifyContent: "center",
      minHeight: 86,
      paddingHorizontal: commerceSpacing.sm,
      paddingVertical: commerceSpacing.sm,
    },
    stateTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      lineHeight: 20,
      textAlign: "center",
    },
    stateDescription: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17,
      textAlign: "center",
    },
    stateButton: {
      alignItems: "center",
      borderColor: colors.border,
      borderCurve: "continuous",
      borderRadius: commerceRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      justifyContent: "center",
      marginTop: 3,
      minHeight: 44,
      paddingHorizontal: 14,
    },
    stateButtonText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: "900",
      lineHeight: 18,
    },
    staleNotice: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: commerceSpacing.sm,
    },
    staleText: {
      color: colors.warning,
      fontSize: 11,
      fontWeight: "800",
      lineHeight: 16,
      textAlign: "center",
    },
    skeletonRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: commerceSpacing.sm,
      minHeight: 48,
      paddingHorizontal: commerceSpacing.sm,
    },
    skeletonRank: {
      backgroundColor: colors.skeleton,
      borderCurve: "continuous",
      borderRadius: commerceRadius.sm,
      height: 28,
      width: 28,
    },
    skeletonName: {
      backgroundColor: colors.skeleton,
      borderCurve: "continuous",
      borderRadius: 6,
      flex: 1,
      height: 14,
      maxWidth: 160,
    },
    skeletonCount: {
      backgroundColor: colors.skeleton,
      borderCurve: "continuous",
      borderRadius: 6,
      height: 12,
      width: 48,
    },
  });
}

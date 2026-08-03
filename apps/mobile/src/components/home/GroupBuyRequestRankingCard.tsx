import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
} from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import type { GroupBuyRequestRanking } from "../../features/groupBuyRequests";
import {
  commerceRadius,
  commerceSpacing,
  type CommerceColorPalette,
} from "../../design/commerce";
import { useCommerceTheme } from "../../design/useCommerceTheme";
import { useAccessibilityAutoPlayPause } from "../../hooks/useAccessibilityAutoPlayPause";
import { SText } from "../ui/SText";

type GroupBuyRequestRankingCardProps = {
  rankings: GroupBuyRequestRanking[];
  isError: boolean;
  isFetching: boolean;
  onPressRanking: Dispatch<string>;
  onRetry: () => void;
};

const MAX_RANKINGS = 10;
const RANKINGS_PER_PAGE = 2;
const RANKING_AUTO_PLAY_MS = 8000;
const RANKING_SWIPE_START_THRESHOLD = 8;
const RANKING_SWIPE_TRIGGER_THRESHOLD = 48;
const RANKING_TRANSITION_MS = 240;
const RANKING_TRANSITION_OFFSET = 24;
const TOP_TITLE_LIMIT = 3;

export function GroupBuyRequestRankingCard({
  rankings,
  isError,
  isFetching,
  onPressRanking,
  onRetry,
}: GroupBuyRequestRankingCardProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const topRankings = rankings.slice(0, MAX_RANKINGS);
  const pageCount = Math.ceil(topRankings.length / RANKINGS_PER_PAGE);
  const [pageIndex, setPageIndex] = useState(0);
  const autoPlayPaused = useAccessibilityAutoPlayPause();
  const rankingTransition = useRef(new Animated.Value(0)).current;
  const rankingKey = topRankings
    .map((ranking) => `${ranking.requestId}:${ranking.rank}`)
    .join("|");

  useEffect(() => {
    rankingTransition.stopAnimation();
    rankingTransition.setValue(0);
    setPageIndex(0);
  }, [rankingKey, rankingTransition]);

  useEffect(
    () => () => {
      rankingTransition.stopAnimation();
    },
    [rankingTransition],
  );

  const normalizedPageIndex = pageCount > 0 ? pageIndex % pageCount : 0;
  const handlePageChange = useCallback(
    (direction: 1 | -1) => {
      if (pageCount <= 1) return;

      const nextPageIndex =
        (normalizedPageIndex + direction + pageCount) % pageCount;
      rankingTransition.stopAnimation();

      if (autoPlayPaused) {
        rankingTransition.setValue(0);
      } else {
        rankingTransition.setValue(direction * RANKING_TRANSITION_OFFSET);
        Animated.timing(rankingTransition, {
          toValue: 0,
          duration: RANKING_TRANSITION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }

      setPageIndex(nextPageIndex);
    },
    [autoPlayPaused, normalizedPageIndex, pageCount, rankingTransition],
  );

  useEffect(() => {
    if (pageCount <= 1 || autoPlayPaused) return;

    const timer = setTimeout(() => {
      handlePageChange(1);
    }, RANKING_AUTO_PLAY_MS);

    return () => clearTimeout(timer);
  }, [autoPlayPaused, handlePageChange, pageCount, normalizedPageIndex]);

  const visibleRankings = topRankings.slice(
    normalizedPageIndex * RANKINGS_PER_PAGE,
    normalizedPageIndex * RANKINGS_PER_PAGE + RANKINGS_PER_PAGE,
  );
  const topTitleRank = Math.min(topRankings.length, TOP_TITLE_LIMIT);
  const rankingTransitionStyle = useMemo(
    () => ({
      opacity: rankingTransition.interpolate({
        inputRange: [
          -RANKING_TRANSITION_OFFSET,
          0,
          RANKING_TRANSITION_OFFSET,
        ],
        outputRange: [0.9, 1, 0.9],
      }),
      transform: [{ translateX: rankingTransition }],
    }),
    [rankingTransition],
  );
  const shouldStartSwipe = useCallback(
    (_: unknown, gestureState: { dx: number; dy: number }) =>
      pageCount > 1 &&
      Math.abs(gestureState.dx) > RANKING_SWIPE_START_THRESHOLD &&
      Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
    [pageCount],
  );
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: shouldStartSwipe,
        onMoveShouldSetPanResponderCapture: shouldStartSwipe,
        onPanResponderRelease: (_, gestureState) => {
          if (
            Math.abs(gestureState.dx) < RANKING_SWIPE_TRIGGER_THRESHOLD ||
            Math.abs(gestureState.dx) <= Math.abs(gestureState.dy)
          ) {
            return;
          }

          handlePageChange(gestureState.dx < 0 ? 1 : -1);
        },
      }),
    [handlePageChange, shouldStartSwipe],
  );

  if (visibleRankings.length === 0) return null;

  return (
    <View style={s.card} testID="home-group-buy-request-rankings">
      <View style={s.header}>
        <View style={s.headerCopy}>
          <SText accessibilityRole="header" style={s.title} variant="body">
            {`최근 한 달 공구 요청 TOP ${topTitleRank}`}
          </SText>
          <SText style={s.subtitle} variant="caption">
            최근 30일 동안 가장 많이 요청한 상품이에요
          </SText>
        </View>
        {isFetching && !isError ? (
          <SText
            accessibilityLiveRegion="polite"
            style={s.refreshingText}
            variant="caption"
          >
            업데이트 중
          </SText>
        ) : null}
      </View>

      <Animated.View
        accessibilityHint="좌우로 밀어 다음 또는 이전 요청 순위를 볼 수 있어요"
        style={[s.rows, rankingTransitionStyle]}
        testID="group-buy-request-ranking-swipe-surface"
        {...panResponder.panHandlers}
      >
        {visibleRankings.map((ranking, index) => {
          const isFirstRank = ranking.rank === 1;
          const isLast = index === visibleRankings.length - 1;
          return (
            <Pressable
              accessibilityLabel={`${ranking.rank}위, ${ranking.productName}, 요청 ${ranking.requestCount}건`}
              accessibilityRole="button"
              key={ranking.requestId}
              onPress={() => onPressRanking(ranking.productName)}
              style={[
                s.row,
                isFirstRank ? s.firstRow : null,
                isLast ? null : s.rowDivider,
              ]}
            >
              <View
                style={[s.rankBadge, isFirstRank ? s.firstRankBadge : null]}
                testID={`group-buy-request-rank-badge-${ranking.rank}`}
              >
                <SText
                  style={[s.rankText, isFirstRank ? s.firstRankText : null]}
                  variant="badge"
                >
                  {ranking.rank}
                </SText>
              </View>
              <SText numberOfLines={2} style={s.productName} variant="body">
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
      </Animated.View>
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
  });
}

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
  type StyleProp,
  type ViewStyle,
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

type HomeRequestTickerProps = {
  rankings: GroupBuyRequestRanking[];
  onPressRanking: Dispatch<string>;
  style?: StyleProp<ViewStyle>;
};

const MAX_RANKINGS = 10;
const AUTO_PLAY_MS = 3000;
const TICKER_HEIGHT = 40;
const SWIPE_START_THRESHOLD = 8;
const SWIPE_TRIGGER_THRESHOLD = 48;
const TRANSITION_MS = 420;
const TRANSITION_OFFSET = 24;

export function HomeRequestTicker({
  rankings,
  onPressRanking,
  style,
}: HomeRequestTickerProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const topRankings = rankings.slice(0, MAX_RANKINGS);
  const itemCount = topRankings.length;
  const [itemIndex, setItemIndex] = useState(0);
  const autoPlayPaused = useAccessibilityAutoPlayPause();
  const transition = useRef(new Animated.Value(0)).current;
  const rankingKey = topRankings
    .map((ranking) => `${ranking.requestId}:${ranking.rank}`)
    .join("|");

  useEffect(() => {
    transition.stopAnimation();
    transition.setValue(0);
    setItemIndex(0);
  }, [rankingKey, transition]);

  useEffect(
    () => () => {
      transition.stopAnimation();
    },
    [transition],
  );

  const normalizedItemIndex = itemCount > 0 ? itemIndex % itemCount : 0;
  const handleItemChange = useCallback(
    (direction: 1 | -1) => {
      if (itemCount <= 1) return;

      const nextItemIndex =
        (normalizedItemIndex + direction + itemCount) % itemCount;
      transition.stopAnimation();

      if (autoPlayPaused) {
        transition.setValue(0);
      } else {
        transition.setValue(direction * TRANSITION_OFFSET);
        Animated.timing(transition, {
          toValue: 0,
          duration: TRANSITION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }

      setItemIndex(nextItemIndex);
    },
    [autoPlayPaused, itemCount, normalizedItemIndex, transition],
  );

  useEffect(() => {
    if (itemCount <= 1 || autoPlayPaused) return;

    const timer = setTimeout(() => {
      handleItemChange(1);
    }, AUTO_PLAY_MS);

    return () => clearTimeout(timer);
  }, [autoPlayPaused, handleItemChange, itemCount, normalizedItemIndex]);

  const shouldStartSwipe = useCallback(
    (_: unknown, gestureState: { dx: number; dy: number }) =>
      itemCount > 1 &&
      Math.abs(gestureState.dx) > SWIPE_START_THRESHOLD &&
      Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
    [itemCount],
  );
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: shouldStartSwipe,
        onMoveShouldSetPanResponderCapture: shouldStartSwipe,
        onPanResponderRelease: (_, gestureState) => {
          if (
            Math.abs(gestureState.dx) < SWIPE_TRIGGER_THRESHOLD ||
            Math.abs(gestureState.dx) <= Math.abs(gestureState.dy)
          ) {
            return;
          }

          handleItemChange(gestureState.dx < 0 ? 1 : -1);
        },
      }),
    [handleItemChange, shouldStartSwipe],
  );

  const visibleRanking = topRankings[normalizedItemIndex];
  const transitionStyle = useMemo(
    () => ({
      opacity: transition.interpolate({
        inputRange: [-TRANSITION_OFFSET, 0, TRANSITION_OFFSET],
        outputRange: [0.76, 1, 0.76],
      }),
      transform: [
        { translateY: transition },
        {
          scale: transition.interpolate({
            inputRange: [-TRANSITION_OFFSET, 0, TRANSITION_OFFSET],
            outputRange: [0.985, 1, 0.985],
          }),
        },
      ],
    }),
    [transition],
  );

  if (!visibleRanking) return null;

  const accessibilityLabel = `공구 요청 ${visibleRanking.rank}위, ${visibleRanking.productName}`;
  const externalStyles = Array.isArray(style) ? style : [style];

  return (
    <View style={[s.shell, ...externalStyles]} testID="home-request-ticker">
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        hitSlop={{ bottom: 2, top: 2 }}
        onPress={() => onPressRanking(visibleRanking.productName)}
        style={s.message}
        testID="home-request-ticker-message"
      >
        <View style={s.leadingIcon}>
          <RequestTickerGlyph color={colors.accent} />
        </View>
        <Animated.View
          accessibilityHint="좌우로 밀어 다음 또는 이전 공구 요청을 볼 수 있어요"
          style={[s.swipeSurface, transitionStyle]}
          testID="home-request-ticker-swipe-surface"
          {...panResponder.panHandlers}
        >
          <View style={s.tickerContent}>
            <View style={s.rankBadge} testID="home-request-ticker-rank">
              <SText style={s.rankBadgeText} variant="caption">
                {`공구 요청 ${visibleRanking.rank}위`}
              </SText>
            </View>
            <SText numberOfLines={1} style={s.messageText} variant="body">
              {`· ${visibleRanking.productName}`}
            </SText>
            <SText
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={s.chevron}
              variant="body"
            >
              ›
            </SText>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

function RequestTickerGlyph({ color }: { color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={styles.glyph}
      testID="home-request-ticker-glyph"
    >
      <View style={[styles.glyphLine, { backgroundColor: color }]} />
      <View style={[styles.glyphLine, { backgroundColor: color }]} />
      <View style={[styles.glyphLine, { backgroundColor: color }]} />
    </View>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    shell: {
      backgroundColor: colors.surface,
      borderBottomColor: colors.borderLight,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      minHeight: TICKER_HEIGHT,
      borderTopColor: colors.borderLight,
      borderTopWidth: StyleSheet.hairlineWidth,
      overflow: "hidden",
    },
    leadingIcon: {
      alignItems: "center",
      flexShrink: 0,
      justifyContent: "center",
      marginRight: commerceSpacing.sm,
      width: 18,
    },
    swipeSurface: {
      flex: 1,
      minHeight: TICKER_HEIGHT,
      overflow: "hidden",
    },
    message: {
      alignItems: "center",
      flexDirection: "row",
      flex: 1,
      minHeight: TICKER_HEIGHT,
      paddingHorizontal: commerceSpacing.lg,
      paddingVertical: commerceSpacing.xs,
    },
    tickerContent: {
      alignItems: "center",
      flexDirection: "row",
      gap: commerceSpacing.sm,
      minHeight: TICKER_HEIGHT,
      paddingRight: commerceSpacing.xs,
    },
    rankBadge: {
      alignItems: "center",
      backgroundColor: colors.accent,
      borderRadius: commerceRadius.full,
      justifyContent: "center",
      minHeight: 26,
      minWidth: 38,
      paddingHorizontal: commerceSpacing.sm,
    },
    rankBadgeText: {
      color: colors.inverse,
      fontSize: 12,
      fontWeight: "900",
      includeFontPadding: false,
      lineHeight: 16,
    },
    messageText: {
      color: colors.text,
      flex: 1,
      flexShrink: 1,
      fontSize: 14,
      fontWeight: "800",
      lineHeight: 20,
      minWidth: 0,
    },
    chevron: {
      color: colors.accent,
      flexShrink: 0,
      fontSize: 18,
      fontWeight: "900",
      lineHeight: 20,
    },
  });
}

const styles = StyleSheet.create({
  glyph: {
    alignItems: "flex-start",
    flexShrink: 0,
    gap: 3,
    justifyContent: "center",
    width: 18,
  },
  glyphLine: {
    borderRadius: commerceRadius.full,
    height: 2,
    width: 15,
  },
});

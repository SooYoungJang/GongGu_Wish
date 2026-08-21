import { useCallback, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Reanimated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { SText } from "../../components/ui/SText";
import { useTheme } from "../../context/ThemeContext";
import { borderRadius, spacing } from "../../design/tokens";
import { BOTTOM_SHEET_ANIMATION_MS } from "../../design/bottomSheetMotion";
import {
  fetchPreviousProductGroupBuys,
  getPreviousProductHistoryQueryKey,
  type PreviousProductGroupBuy,
} from "../../api";
import type { GroupBuy } from "../../types";
import { formatDateRange } from "../../utils";

type PreviousProductHistorySheetProps = {
  current: Pick<GroupBuy, "id" | "brandName" | "productName">;
  visible: boolean;
  maxHeight: number;
  onClose: () => void;
  // eslint-disable-next-line no-unused-vars -- callback parameter documents the target record
  onOpenComments: (groupBuyId: string) => void;
};

export function PreviousProductHistorySheet({
  current,
  visible,
  maxHeight,
  onClose,
  onOpenComments,
}: PreviousProductHistorySheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const resolvedMaxHeight = Math.max(1, maxHeight);
  const sheetTranslate = useSharedValue(resolvedMaxHeight);
  const sheetDragStartY = useSharedValue(0);

  const historyQuery = useQuery({
    queryKey: getPreviousProductHistoryQueryKey(current),
    queryFn: () => fetchPreviousProductGroupBuys(current),
    enabled: visible,
    staleTime: 60_000,
  });
  const history = historyQuery.data ?? [];

  useEffect(() => {
    cancelAnimation(sheetTranslate);
    if (!visible) {
      sheetTranslate.value = resolvedMaxHeight;
      return;
    }
    sheetTranslate.value = resolvedMaxHeight;
    sheetTranslate.value = withTiming(0, {
      duration: BOTTOM_SHEET_ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [resolvedMaxHeight, sheetTranslate, visible]);

  const sheetStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateY: sheetTranslate.value }],
    }),
    [sheetTranslate],
  );

  const closeSheet = useCallback(() => {
    cancelAnimation(sheetTranslate);
    sheetTranslate.value = withTiming(
      resolvedMaxHeight,
      {
        duration: BOTTOM_SHEET_ANIMATION_MS,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) runOnJS(onClose)();
      },
    );
  }, [onClose, resolvedMaxHeight, sheetTranslate]);

  const dismissGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(6)
        .failOffsetX([-24, 24])
        .onBegin(() => {
          sheetDragStartY.value = sheetTranslate.value;
        })
        .onUpdate((event) => {
          sheetTranslate.value = Math.min(
            Math.max(sheetDragStartY.value + event.translationY, 0),
            resolvedMaxHeight,
          );
        })
        .onEnd((event) => {
          const draggedDown = event.translationY > 12;
          const pastThreshold =
            event.translationY > Math.max(72, resolvedMaxHeight * 0.28);
          const flickedDown = event.velocityY > 650;
          if (draggedDown && (pastThreshold || flickedDown)) {
            runOnJS(closeSheet)();
            return;
          }
          sheetTranslate.value = withTiming(0, {
            duration: BOTTOM_SHEET_ANIMATION_MS,
            easing: Easing.out(Easing.cubic),
          });
        }),
    [closeSheet, resolvedMaxHeight, sheetDragStartY, sheetTranslate],
  );

  const renderHistoryItem = useCallback(
    ({ item }: { item: PreviousProductGroupBuy }) => {
      return (
        <Pressable
          accessibilityLabel={`${formatDateRange(item.startDate, item.endDate)} 이전 공구 후기 보기`}
          accessibilityRole="button"
          onPress={() => onOpenComments(item.id)}
          style={({ pressed }) => [
            styles.historyCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
          testID={`previous-product-history-item-${item.id}`}
        >
          {item.thumbnailUrl ? (
            <Image
              accessibilityIgnoresInvertColors
              source={{ uri: item.thumbnailUrl }}
              style={styles.thumbnail}
            />
          ) : (
            <View
              style={[
                styles.thumbnail,
                styles.thumbnailFallback,
                { backgroundColor: colors.surfaceHover },
              ]}
            >
              <Ionicons
                color={colors.textTertiary}
                name="image-outline"
                size={20}
              />
            </View>
          )}
          <View style={styles.cardBody}>
            <View style={styles.cardMetaRow}>
              <SText variant="caption" style={{ color: colors.textTertiary }}>
                공구 종료
              </SText>
              <SText variant="caption" style={{ color: colors.textTertiary }}>
                {formatDateRange(item.startDate, item.endDate)}
              </SText>
            </View>
            {item.summary ? (
              <SText
                numberOfLines={1}
                style={[styles.summary, { color: colors.textPrimary }]}
                variant="body"
              >
                {item.summary}
              </SText>
            ) : null}
            <View style={styles.previewRow}>
              <Ionicons
                color={colors.textTertiary}
                name="chatbubble-ellipses-outline"
                size={14}
              />
              <SText
                numberOfLines={1}
                style={[styles.previewText, { color: colors.textSecondary }]}
                variant="caption"
              >
                후기 보러가기
              </SText>
            </View>
          </View>
          <Ionicons
            color={colors.textTertiary}
            name="chevron-forward"
            size={20}
          />
        </Pressable>
      );
    },
    [colors, onOpenComments],
  );

  if (!visible) return null;

  return (
    <View style={styles.modalLayer} testID="previous-product-history-sheet">
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="이 상품의 이전 공구 창 닫기"
          accessibilityRole="button"
          onPress={closeSheet}
          style={styles.backdrop}
        />
        <Reanimated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.bg, maxHeight },
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={dismissGesture}>
            <View>
              <View style={styles.handle} />
              <View style={styles.header}>
                <View style={styles.headerCopy}>
                  <SText
                    variant="cardTitle"
                    style={{ color: colors.textPrimary }}
                  >
                    이 상품의 이전 공구
                  </SText>
                  <SText
                    variant="caption"
                    style={{ color: colors.textTertiary }}
                  >
                    동일 상품으로 진행된 이전 공구의 후기를 확인해 보세요.
                  </SText>
                </View>
                <Pressable
                  accessibilityLabel="이 상품의 이전 공구 창 닫기"
                  accessibilityRole="button"
                  onPress={closeSheet}
                  style={styles.closeButton}
                >
                  <Ionicons color={colors.textPrimary} name="close" size={24} />
                </Pressable>
              </View>
            </View>
          </GestureDetector>

          {historyQuery.isLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : historyQuery.isError ? (
            <View style={styles.emptyState}>
              <SText variant="body" style={{ color: colors.textSecondary }}>
                이전 공구 기록을 불러오지 못했어요.
              </SText>
              <Pressable
                accessibilityRole="button"
                onPress={() => void historyQuery.refetch()}
                style={styles.retryButton}
              >
                <SText variant="label" style={{ color: colors.primary }}>
                  다시 시도
                </SText>
              </Pressable>
            </View>
          ) : (
            <FlatList
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: spacing.lg + insets.bottom },
              ]}
              data={history}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons
                    color={colors.textTertiary}
                    name="time-outline"
                    size={28}
                  />
                  <SText variant="body" style={{ color: colors.textSecondary }}>
                    아직 이전 공구 기록이 없어요.
                  </SText>
                </View>
              }
              renderItem={renderHistoryItem}
              showsVerticalScrollIndicator={false}
            />
          )}
        </Reanimated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalLayer: { ...StyleSheet.absoluteFillObject, zIndex: 110 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    minHeight: 320,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: "center",
    backgroundColor: "rgba(127,127,127,0.5)",
    borderRadius: borderRadius.full,
    height: 5,
    marginBottom: spacing.sm,
    width: 52,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerCopy: { flex: 1, gap: 3 },
  closeButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  loader: { marginVertical: spacing.xl },
  listContent: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  historyCard: {
    alignItems: "center",
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 94,
    padding: spacing.sm,
  },
  pressed: { opacity: 0.78 },
  thumbnail: { borderRadius: borderRadius.md, height: 70, width: 70 },
  thumbnailFallback: { alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, gap: 5, minWidth: 0 },
  cardMetaRow: { flexDirection: "row", gap: spacing.xs },
  summary: { fontWeight: "700" },
  previewRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    minWidth: 0,
  },
  previewText: { flex: 1 },
  emptyState: {
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 180,
    padding: spacing.xl,
  },
  retryButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
});

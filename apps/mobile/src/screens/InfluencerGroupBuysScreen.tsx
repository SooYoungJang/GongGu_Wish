import { memo, useCallback, useMemo, useState } from "react";
import { Image } from "expo-image";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { getGroupBuyCategoryLabel } from "@gonggu/shared/utils/groupBuyCategory";

import { fetchGroupBuysByInfluencer } from "../api";
import { CenteredBackHeader } from "../components/CenteredBackHeader";
import { buildDealCardAccessibilityLabel } from "../components/DealCard";
import { GroupBuyReminderButton } from "../components/GroupBuyReminderButton";
import { categoryForGroupBuy } from "../components/home/DealCardGrid";
import { InstagramIdentity } from "../components/ui/InstagramIdentity";
import { PriceText } from "../components/ui/PriceText";
import { SText } from "../components/ui/SText";
import { categoryColors, type CategoryColorName } from "../design/tokens";
import { useCommerceTheme } from "../design/useCommerceTheme";
import type { GroupBuy, InfluencerGroupBuysScreenProps } from "../types";
import { formatDateRange } from "../utils";
import { resolveGroupBuyImageUrl } from "../utils/groupBuyMedia";

type InfluencerDealListItemProps = {
  category: CategoryColorName;
  item: GroupBuy;
  onPressItem: (item: GroupBuy) => void;
};

const InfluencerDealListItem = memo(function InfluencerDealListItem({
  category,
  item,
  onPressItem,
}: InfluencerDealListItemProps) {
  const theme = useCommerceTheme();
  const s = useMemo(() => makeListItemStyles(theme), [theme]);
  const token = categoryColors[category];
  const imageUrl = resolveGroupBuyImageUrl(item);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const visibleImageUrl = imageUrl === failedImageUrl ? null : imageUrl;
  const imageSource = useMemo(
    () => (visibleImageUrl ? { uri: visibleImageUrl } : null),
    [visibleImageUrl],
  );
  const handlePress = useCallback(() => {
    onPressItem(item);
  }, [item, onPressItem]);
  const handleImageError = useCallback(() => {
    if (imageUrl) setFailedImageUrl(imageUrl);
  }, [imageUrl]);

  return (
    <View style={s.row} testID={`influencer-deal-row-${item.id}`}>
      <Pressable
        accessibilityHint="공구 상세 보기"
        accessibilityLabel={buildDealCardAccessibilityLabel(item)}
        accessibilityRole="button"
        onPress={handlePress}
        style={({ pressed }) => [
          s.detailAction,
          pressed ? s.pressed : null,
        ]}
        testID={`influencer-deal-detail-${item.id}`}
      />

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={s.content}
        testID={`influencer-deal-content-${item.id}`}
      >
        <View style={s.imageWrap}>
          {imageSource ? (
            <Image
              accessible={false}
              cachePolicy="memory-disk"
              contentFit="cover"
              onError={handleImageError}
              recyclingKey={item.id}
              source={imageSource}
              style={s.image}
              transition={120}
            />
          ) : (
            <View
              style={[
                s.imageFallback,
                { backgroundColor: token.bg, borderColor: token.border },
              ]}
              testID={`influencer-deal-image-fallback-${item.id}`}
            >
              <SText
                style={[s.imageFallbackText, { color: token.text }]}
                variant="caption"
              >
                {(getGroupBuyCategoryLabel(category) ?? "공구").slice(0, 2)}
              </SText>
            </View>
          )}
        </View>

        <View style={s.info}>
          <SText numberOfLines={2} style={s.productName} variant="body">
            {item.productName ?? "공동구매 상품"}
          </SText>
          {item.discountInfo ? (
            <SText numberOfLines={1} style={s.discount} variant="caption">
              {item.discountInfo}
            </SText>
          ) : null}
          <View style={s.bottomRow}>
            <View style={s.commerceInfo}>
              <PriceText
                numberOfLines={1}
                priceKrw={item.priceKrw}
                style={s.price}
              />
              <SText numberOfLines={1} style={s.period} variant="caption">
                {formatDateRange(item.startDate, item.endDate)}
              </SText>
            </View>
          </View>
        </View>
      </View>

      <GroupBuyReminderButton
        item={item}
        size={32}
        style={s.reminderButton}
      />
    </View>
  );
});

const keyExtractor = (item: GroupBuy) => item.id;

export function InfluencerGroupBuysScreen({
  navigation,
  route,
}: InfluencerGroupBuysScreenProps) {
  const { influencerUsername, influencerProfileImageUrl } = route.params;
  const normalizedUsername = influencerUsername.replace(/^@/, "");
  const theme = useCommerceTheme();
  const { colors } = theme;
  const s = useMemo(() => makeStyles(theme), [theme]);

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["group-buys", "influencer", normalizedUsername],
    queryFn: () => fetchGroupBuysByInfluencer(normalizedUsername),
  });

  const groupBuys = data ?? [];
  const profileImageUrl =
    influencerProfileImageUrl ??
    groupBuys[0]?.rawPost.influencer.profileImageUrl ??
    null;
  const handlePressItem = useCallback(
    (item: GroupBuy) => navigation.navigate("Detail", { groupBuy: item }),
    [navigation],
  );
  const renderItem = useCallback(
    ({ item, index }: { item: GroupBuy; index: number }) => (
      <InfluencerDealListItem
        category={categoryForGroupBuy(item, index)}
        item={item}
        onPressItem={handlePressItem}
      />
    ),
    [handlePressItem],
  );
  const renderSeparator = useCallback(
    () => <View style={s.separator} testID="influencer-deal-separator" />,
    [s.separator],
  );

  return (
    <SafeAreaView edges={["top", "bottom"]} style={s.safeArea}>
      <View style={s.container}>
        <CenteredBackHeader
          backButtonTestID="influencer-group-buys-back-button"
          onBack={() => navigation.goBack()}
          testID="influencer-group-buys-header"
          title="인플루언서 공구"
        />

        <InstagramIdentity
          avatarTestID="influencer-group-buys-profile-avatar"
          navigationEnabled={false}
          profileImageUrl={profileImageUrl}
          size="title"
          style={s.profileRow}
          textStyle={s.titleIdentityText}
          username={normalizedUsername}
        />

        {isError ? (
          <View style={s.notice}>
            <SText variant="caption" style={s.noticeText}>
              네트워크 연결 상태를 확인해주세요. 공구 정보를 불러오지 못했어요.
            </SText>
          </View>
        ) : null}

        <FlatList
          contentContainerStyle={s.listContent}
          data={groupBuys}
          ItemSeparatorComponent={renderSeparator}
          keyExtractor={keyExtractor}
          ListEmptyComponent={
            isFetching ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <View style={s.emptyState}>
                <SText variant="cardTitle" style={s.emptyTitle}>
                  아직 표시할 공구가 없어요
                </SText>
                <SText variant="body" style={s.emptyDescription}>
                  이 인플루언서의 승인된 공동구매가 등록되면 여기에서 확인할 수
                  있습니다.
                </SText>
              </View>
            )
          }
          refreshControl={
            <RefreshControl
              onRefresh={refetch}
              refreshing={isFetching}
              tintColor={colors.accent}
            />
          }
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useCommerceTheme>) {
  const { colors, radius, spacing, typography } = theme;

  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },
    container: { flex: 1, backgroundColor: colors.bg },
    profileRow: {
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.screen,
      paddingTop: spacing.sm,
    },
    titleIdentityText: typography.pageTitle,
    notice: {
      backgroundColor: colors.warningSoft,
      borderCurve: "continuous",
      borderRadius: radius.lg,
      marginBottom: spacing.lg,
      marginHorizontal: spacing.screen,
      padding: spacing.md,
    },
    noticeText: { color: colors.warning, textAlign: "center" },
    listContent: {
      flexGrow: 1,
      paddingBottom: spacing.xxl,
      paddingHorizontal: spacing.screen,
    },
    separator: {
      backgroundColor: colors.border,
      height: StyleSheet.hairlineWidth,
    },
    emptyState: {
      alignItems: "center",
      backgroundColor: colors.panelBg,
      borderColor: colors.border,
      borderCurve: "continuous",
      borderRadius: radius.xl,
      borderWidth: 1,
      padding: spacing.xxl,
    },
    emptyTitle: { marginBottom: spacing.xs, textAlign: "center" },
    emptyDescription: { textAlign: "center" },
  });
}

function makeListItemStyles(theme: ReturnType<typeof useCommerceTheme>) {
  const { colors, radius, spacing } = theme;

  return StyleSheet.create({
    row: {
      minHeight: 132,
      paddingVertical: spacing.md,
      position: "relative",
    },
    content: {
      alignItems: "stretch",
      flex: 1,
      flexDirection: "row",
      gap: spacing.md,
    },
    detailAction: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 1,
    },
    pressed: {
      backgroundColor: colors.accentSoft,
      opacity: 0.28,
    },
    imageWrap: {
      alignSelf: "center",
      borderCurve: "continuous",
      borderRadius: radius.lg,
      height: 108,
      overflow: "hidden",
      width: 108,
    },
    image: { height: "100%", width: "100%" },
    imageFallback: {
      alignItems: "center",
      borderWidth: 1,
      flex: 1,
      justifyContent: "center",
    },
    imageFallbackText: { fontWeight: "900" },
    info: {
      flex: 1,
      gap: spacing.xs,
      justifyContent: "center",
      minWidth: 0,
    },
    productName: {
      color: colors.text,
      fontWeight: "800",
      lineHeight: 20,
    },
    discount: {
      color: colors.accent,
      fontWeight: "800",
    },
    bottomRow: {
      alignItems: "flex-end",
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: "auto",
      paddingRight: 40,
    },
    commerceInfo: { flex: 1, minWidth: 0 },
    reminderButton: {
      bottom: spacing.md,
      position: "absolute",
      right: 0,
      zIndex: 3,
    },
    price: { fontSize: 14, lineHeight: 20 },
    period: { color: colors.weak, marginTop: 2 },
  });
}

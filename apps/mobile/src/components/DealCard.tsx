import { useMemo, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import type {
  GestureResponderEvent,
  StyleProp,
  ViewStyle,
} from "react-native";
import { PriceText } from "./ui/PriceText";
import { SText } from "./ui/SText";
import { GroupBuyReminderButton } from "./GroupBuyReminderButton";

import { categoryColors, spacing } from "../design/tokens";
import { commerceRadius, type CommerceColorPalette } from "../design/commerce";
import { useCommerceTheme } from "../design/useCommerceTheme";
import { formatPriceKrw } from "../utils/price";
import { isGroupBuyExpired } from "../utils/groupBuyDates";
import type { CategoryColorName } from "../design/tokens";
import type { GroupBuy } from "../types";
import { formatInstagramHandle } from "@gonggu/shared/utils/instagram";

type DealCardProps = {
  item: GroupBuy;
  category: CategoryColorName;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  trailingAction?: {
    accessibilityHint?: string;
    accessibilityLabel: string;
    icon: ReactNode;
    onPress: () => void;
    selected?: boolean;
    testID?: string;
  };
};

const CATEGORY_LABELS: Record<CategoryColorName, string> = {
  beauty: "뷰티",
  fashion: "패션",
  food: "식품",
  baby: "육아",
  living: "생활용품",
  lifestyle: "생활용품",
  home: "홈인테리어",
  kitchen: "주방용품",
  electronics: "전자제품",
  digital: "전자제품",
  pet: "반려동물",
  auto: "자동차용품",
  hobby: "취미",
  sports: "스포츠",
  stationery: "문구",
  books: "도서",
  media: "음반-DVD",
  travel: "여행",
};

function formatDeadline(endDate: string | null, now = Date.now()) {
  if (!endDate) return "마감일 미정";
  const date = new Date(endDate);
  if (Number.isNaN(date.getTime())) return "마감일 확인 필요";
  if (isGroupBuyExpired({ endDate }, new Date(now))) return "마감됨";

  const days = Math.ceil((date.getTime() - now) / 86_400_000);
  if (days <= 0) return "오늘 마감";
  if (days === 1) return "내일 마감";
  if (days <= 7) return `${days}일 남음`;
  return `${date.getMonth() + 1}월 ${date.getDate()}일 마감`;
}

export function buildDealCardAccessibilityLabel(
  item: GroupBuy,
  now = Date.now(),
) {
  const productName = item.productName?.trim() || "공동구매 상품";
  const price = formatPriceKrw(item.priceKrw) ?? "미정";
  const instagramHandle = formatInstagramHandle(
    item.rawPost.influencer.instagramUsername,
  );
  const seller = instagramHandle || "정보 미정";

  return [
    productName,
    `가격 ${price}`,
    `판매자 ${seller}`,
    formatDeadline(item.endDate, now),
    "상세 보기",
  ].join(", ");
}

export function DealCard({
  item,
  category,
  onPress,
  style,
  trailingAction,
}: DealCardProps) {
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const token = categoryColors[category];
  const imageUrl =
    item.thumbnailUrl ??
    item.mediaItems?.find((media) => media.thumbnailUrl)?.thumbnailUrl ??
    item.mediaUrls?.[0] ??
    null;
  const fallbackLabel = CATEGORY_LABELS[category];
  const instagramHandle = formatInstagramHandle(
    item.rawPost.influencer.instagramUsername,
  );
  const handleTrailingActionPress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    trailingAction?.onPress();
  };

  return (
    <Pressable
      accessibilityLabel={buildDealCardAccessibilityLabel(item)}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.card, style, pressed && s.pressed]}
    >
      <View style={s.imageWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={s.image} />
        ) : (
          <View
            style={[
              s.imageFallback,
              { backgroundColor: token.bg, borderColor: token.border },
            ]}
          >
            <SText
              variant="cardTitle"
              style={[s.imageText, { color: token.text }]}
            >
              {fallbackLabel.slice(0, 2)}
            </SText>
          </View>
        )}
        <GroupBuyReminderButton item={item} style={s.reminderButton} />
        {item.discountInfo ? (
          <View style={s.saleBadge}>
            <SText variant="caption" style={s.saleBadgeText}>
              {item.discountInfo}
            </SText>
          </View>
        ) : null}
        <View style={s.deadlineBadge}>
          <SText variant="caption" style={s.deadlineBadgeText}>
            {formatDeadline(item.endDate)}
          </SText>
        </View>
      </View>
      <SText variant="body" numberOfLines={1} style={s.instagramHandle}>
        {instagramHandle ?? ""}
      </SText>
      <SText variant="caption" numberOfLines={2} style={s.title}>
        {item.productName ?? "공동구매 상품"}
      </SText>
      <View style={s.priceRow}>
        <View style={s.priceSlot}>
          <PriceText numberOfLines={1} priceKrw={item.priceKrw} style={s.price} />
        </View>
        {trailingAction ? (
          <Pressable
            accessibilityHint={trailingAction.accessibilityHint}
            accessibilityLabel={trailingAction.accessibilityLabel}
            accessibilityRole="button"
            accessibilityState={{ selected: !!trailingAction.selected }}
            hitSlop={6}
            onPress={handleTrailingActionPress}
            style={({ pressed }) => [
              s.trailingAction,
              pressed && s.trailingActionPressed,
            ]}
            testID={trailingAction.testID}
          >
            {trailingAction.icon}
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    card: {
      flexBasis: "47%",
      flexGrow: 1,
      minHeight: 206,
    },
    pressed: { opacity: 0.74 },
    imageWrap: {
      aspectRatio: 1,
      backgroundColor: colors.softBg,
      borderRadius: commerceRadius.lg,
      overflow: "hidden",
      position: "relative",
      width: "100%",
    },
    image: {
      height: "100%",
      resizeMode: "cover",
      width: "100%",
    },
    reminderButton: {
      position: "absolute",
      right: 8,
      top: 8,
      zIndex: 2,
    },
    imageFallback: {
      alignItems: "center",
      borderWidth: 1,
      flex: 1,
      justifyContent: "center",
    },
    imageText: { fontSize: 18, fontWeight: "900" },
    saleBadge: {
      backgroundColor: colors.accent,
      borderRadius: commerceRadius.sm,
      left: 8,
      maxWidth: "62%",
      paddingHorizontal: 7,
      paddingVertical: 4,
      position: "absolute",
      top: 8,
    },
    saleBadgeText: {
      color: colors.inverse,
      fontSize: 11,
      fontWeight: "900",
      lineHeight: 14,
    },
    title: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 19,
    },
    price: {
      fontSize: 13,
      lineHeight: 18,
    },
    priceRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
      marginTop: 2,
      minWidth: 0,
    },
    priceSlot: {
      flex: 1,
      minWidth: 0,
    },
    trailingAction: {
      alignItems: "center",
      backgroundColor: colors.accentSoft,
      borderRadius: 16,
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    trailingActionPressed: {
      opacity: 0.64,
    },
    instagramHandle: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 18,
      marginBottom: 2,
      marginTop: spacing.sm,
      minHeight: 18,
    },
    deadlineBadge: {
      backgroundColor: colors.overlay,
      bottom: 0,
      left: 0,
      paddingHorizontal: 8,
      paddingVertical: 4,
      position: "absolute",
      right: 0,
    },
    deadlineBadgeText: {
      color: colors.inverse,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 15,
    },
  });
}

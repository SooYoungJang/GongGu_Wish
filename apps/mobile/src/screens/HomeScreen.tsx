import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  type LayoutChangeEvent,
  type ViewProps,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import {
  FlashList,
  type FlashListRef,
  type ListRenderItemInfo,
} from "@shopify/flash-list";

import { SText } from "../components/ui/SText";
import { InstagramIdentity } from "../components/ui/InstagramIdentity";
import { AsyncStateNotice } from "../components/ui/AsyncStateNotice";
import { ListPageFooter, type ListPagination } from "../components/ui/ListPageFooter";
import { PriceText } from "../components/ui/PriceText";
import { SearchGlyph } from "../components/ui/LineGlyphs";
import { DealCard } from "../components/DealCard";
import { NativeAdCard } from "../components/ads/NativeAdCard";
import { CATEGORIES } from "../components/home/CategoryRow";
import { categoryForGroupBuy } from "../components/home/DealCardGrid";
import { WeeklyCalendarStrip } from "../components/home/WeeklyCalendarStrip";
import { HomeRequestTicker } from "../components/home/HomeRequestTicker";
import {
  getHomeBannerQueryOptions,
  HOME_DATA_STALE_TIME_MS,
} from "../bootstrap/appBootstrap";
import { getHomeBannerStatusCopy } from "@gonggu/shared/utils/homeBannerPresentation";
import { getHomeBannerDateKey } from "@gonggu/shared/utils/homeBanner";
import { formatInstagramHandle } from "@gonggu/shared/utils/instagram";
import { borderRadius, spacing } from "../design/tokens";
import type { CategoryColorName } from "../design/tokens";
import { formatDateKey, isGroupBuyActiveOnDate } from "../utils/groupBuyDates";
import { useGroupBuyFeed } from "../features/feed/queries";
import { selectHomeBannerItems } from "../utils/homeBanner";
import { useCommerceTheme } from "../design/useCommerceTheme";
import type { CommerceColorPalette } from "../design/commerce";
import type { GroupBuy, HomeScreenProps } from "../types";
import { useAccessibilityAutoPlayPause } from "../hooks/useAccessibilityAutoPlayPause";
import { useTabReselect } from "../hooks/useTabReselect";
import { getHomeRequestTickerBottomOffset } from "../navigation/tabBarMetrics";
import {
  useGroupBuyRequestRankings,
  type GroupBuyRequestRanking,
} from "../features/groupBuyRequests";
import promoScrimSource from "../assets/promo-scrim.png";

type HomeAction = () => void;
type DealAction = Dispatch<GroupBuy>;
type HomeCategory = "all" | CategoryColorName;

const HOME_CATEGORY_OPTIONS: Array<{ key: HomeCategory; label: string }> = [
  { key: "all", label: "전체" },
  ...CATEGORIES.map(({ key, label }) => ({ key, label })),
];

type HomeScreenContentProps = {
  groupBuys: GroupBuy[];
  homeBannerGroupBuys?: GroupBuy[];
  groupBuyRequestRankings?: GroupBuyRequestRanking[];
  isError: boolean;
  isFetching: boolean;
  isLoading?: boolean;
  onRefresh: HomeAction;
  onOpenSearch: HomeAction;
  onOpenCalendar: HomeAction;
  onPressDeal: DealAction;
  onPressGroupBuyRequestRanking?: Dispatch<string>;
  scrollToTopRequest?: number | null;
  onCategoryChange?: Dispatch<HomeCategory>;
  weeklyGroupBuys?: GroupBuy[];
  onWeeklyDateChange?: Dispatch<Date>;
  pagination?: ListPagination;
  weeklyPagination?: ListPagination;
};

const HOME_SIDE_PADDING = 16;
const PROMO_CARD_GAP = 12;
const PROMO_AUTO_PLAY_MS = 3000;
const PROMO_WRAP_SETTLE_MS = 450;
const HOME_LIST_POSITION_CONFIG = { disabled: true } as const;
function getPromoVisual(item: GroupBuy) {
  const firstMedia = item.mediaItems?.[0];
  const firstMediaVisual =
    firstMedia?.mediaType === "IMAGE"
      ? firstMedia.url.trim() || firstMedia.thumbnailUrl?.trim()
      : firstMedia?.thumbnailUrl?.trim();
  if (firstMediaVisual) return firstMediaVisual;

  const coverThumbnail = item.thumbnailUrl?.trim();
  if (coverThumbnail) return coverThumbnail;

  const firstImage = item.mediaItems?.find(
    (media) => media.mediaType === "IMAGE" && media.url.trim(),
  );
  if (firstImage) return firstImage.url.trim();

  const firstImageUrl = item.mediaUrls.find((url) =>
    /\.(?:avif|gif|heic|heif|jpe?g|png|webp)(?:$|[?#])/i.test(url),
  );
  if (firstImageUrl) return firstImageUrl;

  const firstPoster = item.mediaItems?.find((media) =>
    media.thumbnailUrl?.trim(),
  )?.thumbnailUrl;

  return (
    firstPoster?.trim() ??
    (item.mediaType === "IMAGE" ? item.mediaUrls[0] : null) ??
    item.thumbnailUrl?.trim() ??
    null
  );
}

function normalizeHomeCategory(
  category: GroupBuy["category"],
): CategoryColorName | null {
  switch (category as string | null | undefined) {
    case "lifestyle":
      return "living";
    case "digital":
      return "electronics";
    default:
      return category ?? null;
  }
}

function getPromoFallbackMark(item: GroupBuy) {
  const source =
    item.brandName?.trim() || item.productName?.trim() || "공동구매";
  return source.replace(/\s/g, "").slice(0, 2).toUpperCase();
}

function HomeTopBar({
  onOpenSearch,
  s,
  colors,
}: {
  onOpenSearch: HomeAction;
  s: ReturnType<typeof makeStyles>;
  colors: CommerceColorPalette;
}) {
  return (
    <View style={s.topBar}>
      <Pressable
        accessibilityLabel="상품 검색"
        accessibilityRole="button"
        onPress={onOpenSearch}
        style={s.searchBox}
      >
        <SearchGlyph color={colors.weak} size={20} />
        <SText variant="body" numberOfLines={1} style={s.searchPlaceholder}>
          상품을 검색해보세요
        </SText>
      </Pressable>
    </View>
  );
}

function PromoArtworkFallback({
  mark,
  s,
  testID,
}: {
  mark: string;
  s: ReturnType<typeof makeStyles>;
  testID?: string;
}) {
  return (
    <View
      accessibilityElementsHidden
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={s.promoArtworkFallback}
      testID={testID}
    >
      <View style={s.promoArtworkMark}>
        <SText variant="label" style={s.promoArtworkMarkText}>
          {mark}
        </SText>
      </View>
      <SText variant="caption" style={s.promoArtworkFallbackText}>
        이미지 준비 중
      </SText>
    </View>
  );
}

function PromoArtwork({
  clone,
  fallbackMark,
  itemId,
  s,
  uri,
}: {
  clone: boolean;
  fallbackMark: string;
  itemId: string;
  s: ReturnType<typeof makeStyles>;
  uri: string | null;
}) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <>
      {!isLoaded ? (
        <PromoArtworkFallback
          mark={fallbackMark}
          s={s}
          testID={clone ? undefined : `promo-artwork-placeholder-${itemId}`}
        />
      ) : null}
      {uri ? (
        <Image
          accessible={false}
          onError={() => setIsLoaded(false)}
          onLoad={() => setIsLoaded(true)}
          resizeMethod="resize"
          resizeMode="cover"
          source={{ uri }}
          style={[s.promoImage, !isLoaded && s.promoImagePending]}
          testID={clone ? undefined : `promo-image-${itemId}`}
        />
      ) : null}
    </>
  );
}

function ShoppingHomeHeading({ s }: { s: ReturnType<typeof makeStyles> }) {
  return (
    <View style={s.shopHeadingRow}>
      <View
        accessible
        accessibilityLabel="쇼핑 홈"
        accessibilityRole="header"
        style={s.shopHeading}
        testID="home-shop-heading"
      >
        <SText variant="label" style={s.shopHeadingText}>
          쇼핑 홈
        </SText>
      </View>
    </View>
  );
}

function HomeCategoryFilter({
  accessibilityElementsHidden = false,
  importantForAccessibility = "auto",
  value,
  onChange,
  onLayout,
  s,
  testID = "home-category-filter",
}: {
  accessibilityElementsHidden?: boolean;
  importantForAccessibility?: ViewProps["importantForAccessibility"];
  value: HomeCategory;
  onChange: Dispatch<HomeCategory>;
  onLayout?: ViewProps["onLayout"];
  s: ReturnType<typeof makeStyles>;
  testID?: string;
}) {
  return (
    <View
      accessibilityElementsHidden={accessibilityElementsHidden}
      accessibilityRole="tablist"
      importantForAccessibility={importantForAccessibility}
      onLayout={onLayout}
      style={s.categoryFilter}
      testID={testID}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.categoryFilterContent}
        testID="home-category-filter-scroll"
      >
        {HOME_CATEGORY_OPTIONS.map(({ key, label }) => {
          const selected = key === value;
          return (
            <Pressable
              accessibilityLabel={`${label} 카테고리`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={key}
              onPress={() => onChange(key)}
              hitSlop={{ bottom: spacing.xs, top: spacing.xs }}
              style={[s.categoryChip, selected && s.selectedCategoryChip]}
            >
              <SText
                variant="label"
                style={[
                  s.categoryChipText,
                  selected && s.selectedCategoryChipText,
                ]}
              >
                {label}
              </SText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function PromoBanner({
  groupBuys,
  onPressDeal,
  s,
  cardWidth,
  sidePadding,
}: {
  groupBuys: GroupBuy[];
  onPressDeal: DealAction;
  s: ReturnType<typeof makeStyles>;
  cardWidth: number;
  sidePadding: number;
}) {
  const [homeBannerDateTick, setHomeBannerDateTick] = useState(0);

  useEffect(() => {
    let midnightTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextMidnight = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      const delay = Math.max(1, nextMidnight.getTime() - now.getTime());

      midnightTimer = setTimeout(() => {
        setHomeBannerDateTick((tick) => tick + 1);
        scheduleNextMidnight();
      }, delay);
    };

    scheduleNextMidnight();

    return () => {
      if (midnightTimer) clearTimeout(midnightTimer);
    };
  }, []);

  const promoItems = useMemo(() => {
    // A deal becomes a home banner only through an explicit admin opt-in and
    // an active date range.
    return selectHomeBannerItems(groupBuys).slice(0, 6);
  }, [groupBuys, homeBannerDateTick]);
  const autoPlayPaused = useAccessibilityAutoPlayPause();
  const canLoop = promoItems.length > 1;
  const shouldAutoPlay = canLoop && !autoPlayPaused;
  const scrollRef = useRef<ScrollView | null>(null);
  const currentPositionRef = useRef(canLoop ? 1 : 0);
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAutoPlayRef = useRef<() => void>(() => {});
  const snapInterval = cardWidth + PROMO_CARD_GAP;
  const cardHeight = Math.min(260, Math.max(224, Math.round(cardWidth / 1.16)));
  const loopingPromoItems = useMemo(() => {
    if (promoItems.length <= 1)
      return promoItems.map((item, index) => ({ item, index, clone: false }));

    return [
      {
        item: promoItems[promoItems.length - 1],
        index: promoItems.length - 1,
        clone: true,
      },
      ...promoItems.map((item, index) => ({ item, index, clone: false })),
      { item: promoItems[0], index: 0, clone: true },
    ];
  }, [promoItems]);

  const clearAutoPlayTimer = useCallback(() => {
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  }, []);

  const clearWrapSettleTimer = useCallback(() => {
    if (wrapSettleTimerRef.current) {
      clearTimeout(wrapSettleTimerRef.current);
      wrapSettleTimerRef.current = null;
    }
  }, []);

  const scrollToPosition = useCallback(
    (position: number, animated: boolean) => {
      scrollRef.current?.scrollTo({ x: position * snapInterval, animated });
    },
    [snapInterval],
  );

  const normalizePosition = useCallback(
    (position: number) => {
      if (!canLoop) return 0;
      if (position <= 0) return promoItems.length;
      if (position >= promoItems.length + 1) return 1;
      return position;
    },
    [canLoop, promoItems.length],
  );

  const scheduleAutoPlay = useCallback(() => {
    clearAutoPlayTimer();
    if (!shouldAutoPlay) return;

    autoPlayTimerRef.current = setTimeout(() => {
      const nextPosition = currentPositionRef.current + 1;
      currentPositionRef.current = nextPosition;
      scrollToPosition(nextPosition, true);

      clearWrapSettleTimer();
      wrapSettleTimerRef.current = setTimeout(() => {
        const normalizedPosition = normalizePosition(nextPosition);
        currentPositionRef.current = normalizedPosition;
        if (normalizedPosition !== nextPosition) {
          scrollToPosition(normalizedPosition, false);
        }
        scheduleAutoPlayRef.current();
      }, PROMO_WRAP_SETTLE_MS);
    }, PROMO_AUTO_PLAY_MS);
  }, [
    shouldAutoPlay,
    clearAutoPlayTimer,
    clearWrapSettleTimer,
    normalizePosition,
    scrollToPosition,
  ]);

  scheduleAutoPlayRef.current = scheduleAutoPlay;

  const handleScrollBeginDrag = useCallback(() => {
    clearAutoPlayTimer();
    clearWrapSettleTimer();
  }, [clearAutoPlayTimer, clearWrapSettleTimer]);

  const handleScrollEndDrag = useCallback(() => {
    scheduleAutoPlay();
  }, [scheduleAutoPlay]);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      clearWrapSettleTimer();

      const settledPosition = Math.round(
        event.nativeEvent.contentOffset.x / snapInterval,
      );
      const normalizedPosition = normalizePosition(settledPosition);
      currentPositionRef.current = normalizedPosition;

      if (canLoop && normalizedPosition !== settledPosition) {
        scrollToPosition(normalizedPosition, false);
      }

      scheduleAutoPlay();
    },
    [
      canLoop,
      clearWrapSettleTimer,
      normalizePosition,
      scheduleAutoPlay,
      scrollToPosition,
      snapInterval,
    ],
  );

  useEffect(() => {
    clearAutoPlayTimer();
    clearWrapSettleTimer();
    currentPositionRef.current = canLoop ? 1 : 0;

    if (canLoop) {
      scrollToPosition(1, false);
    }
    if (shouldAutoPlay) {
      scheduleAutoPlay();
    }

    return () => {
      clearAutoPlayTimer();
      clearWrapSettleTimer();
    };
  }, [
    canLoop,
    clearAutoPlayTimer,
    clearWrapSettleTimer,
    promoItems.length,
    scheduleAutoPlay,
    scrollToPosition,
    shouldAutoPlay,
  ]);

  if (promoItems.length === 0) {
    return (
      <View style={s.promoEmpty}>
        <SText variant="body" style={s.promoEmptyText}>
          오늘의 특가를 준비 중입니다
        </SText>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[s.promoRail, { paddingHorizontal: sidePadding }]}
      contentOffset={canLoop ? { x: snapInterval, y: 0 } : undefined}
      decelerationRate="fast"
      disableIntervalMomentum
      onMomentumScrollEnd={handleMomentumScrollEnd}
      onScrollBeginDrag={handleScrollBeginDrag}
      onScrollEndDrag={handleScrollEndDrag}
      scrollEventThrottle={16}
      snapToAlignment="start"
      snapToInterval={snapInterval}
    >
      {loopingPromoItems.map(({ item, index, clone }, renderIndex) => {
        const visual = getPromoVisual(item);
        const productName = item.productName?.trim() || "공동구매 상품";
        const instagramHandle = formatInstagramHandle(
          item.rawPost.influencer.instagramUsername,
        );
        const statusCopy = getHomeBannerStatusCopy(item);
        const accessibilityLabel = [
          productName,
          instagramHandle,
          statusCopy.accessibilityLabel,
          "상세 열기",
        ]
          .filter((label): label is string => Boolean(label))
          .join(", ");
        return (
          <View
            accessibilityElementsHidden={clone}
            accessibilityLabel={clone ? undefined : accessibilityLabel}
            importantForAccessibility={clone ? "no-hide-descendants" : "auto"}
            key={`${item.id}-${renderIndex}-${clone ? "clone" : "real"}`}
            style={[s.promoCard, { height: cardHeight, width: cardWidth }]}
            testID={clone ? undefined : `promo-card-${item.id}`}
          >
            <Pressable
              accessible={!clone}
              accessibilityElementsHidden={clone}
              accessibilityLabel={clone ? undefined : accessibilityLabel}
              accessibilityRole="button"
              importantForAccessibility={
                clone ? "no-hide-descendants" : "auto"
              }
              onPress={() => onPressDeal(item)}
              style={({ pressed }) => [
                s.promoDetailAction,
                pressed ? s.promoDetailPressed : null,
              ]}
            />
            <View
              pointerEvents="none"
              style={s.promoBackground}
              testID={clone ? undefined : `promo-background-${item.id}`}
            >
              <PromoArtwork
                clone={clone}
                fallbackMark={getPromoFallbackMark(item)}
                itemId={item.id}
                key={`${item.id}:${visual ?? "placeholder"}`}
                s={s}
                uri={visual}
              />
            </View>
            <View
              pointerEvents="none"
              style={s.promoShade}
              testID={clone ? undefined : `promo-shade-${item.id}`}
            />
            <Image
              accessible={false}
              resizeMode="stretch"
              source={promoScrimSource}
              style={s.promoScrim}
              testID={clone ? undefined : `promo-scrim-${item.id}`}
            />
            <View
              pointerEvents="none"
              style={s.promoCounter}
              testID={clone ? undefined : `promo-counter-${item.id}`}
            >
              <SText variant="caption" style={s.promoCounterText}>
                {index + 1} / {promoItems.length}
              </SText>
            </View>
            <View
              pointerEvents="box-none"
              style={s.promoOverlay}
              testID={clone ? undefined : `promo-overlay-${item.id}`}
            >
              {instagramHandle ? (
                <InstagramIdentity
                  avatarTestID={
                    clone ? undefined : `promo-account-avatar-${item.id}`
                  }
                  navigationEnabled={!clone}
                  profileImageUrl={item.rawPost.influencer.profileImageUrl}
                  size="compact"
                  style={s.promoAccountRow}
                  testID={clone ? undefined : `promo-account-${item.id}`}
                  textStyle={s.promoAccount}
                  tone="inverse"
                  username={item.rawPost.influencer.instagramUsername}
                />
              ) : null}
              <View pointerEvents="none">
                <SText variant="cardTitle" numberOfLines={2} style={s.promoTitle}>
                  {productName}
                </SText>
                <View
                  style={s.promoStatusRow}
                  testID={clone ? undefined : `promo-status-${item.id}`}
                >
                  <SText
                    variant="label"
                    numberOfLines={1}
                    style={s.promoStatusAccent}
                  >
                    {statusCopy.accentLabel}
                  </SText>
                  {statusCopy.detailLabel ? (
                    statusCopy.pricePlacement === "detail" &&
                    statusCopy.priceKrw != null ? (
                      <PriceText
                        color="#FFFFFF"
                        priceKrw={statusCopy.priceKrw}
                        style={s.promoStatusDetail}
                        variant="label"
                      />
                    ) : (
                      <SText
                        variant="label"
                        numberOfLines={1}
                        style={s.promoStatusDetail}
                      >
                        {statusCopy.detailLabel}
                      </SText>
                    )
                  ) : null}
                </View>
                {statusCopy.secondaryLabel ? (
                  statusCopy.pricePlacement === "secondary" &&
                  statusCopy.priceKrw != null ? (
                    <PriceText
                      color="#FFFFFF"
                      priceKrw={statusCopy.priceKrw}
                      style={s.promoSecondary}
                      variant="body"
                    />
                  ) : (
                    <SText
                      variant="body"
                      numberOfLines={1}
                      style={s.promoSecondary}
                    >
                      {statusCopy.secondaryLabel}
                    </SText>
                  )
                ) : null}
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function WeeklyGroupBuysSection({
  groupBuys,
  onSelectDate,
  pagination,
  onPressDeal,
  onOpenCalendar,
  s,
}: {
  groupBuys: GroupBuy[];
  onSelectDate?: Dispatch<Date>;
  pagination?: ListPagination;
  onPressDeal: DealAction;
  onOpenCalendar: HomeAction;
  s: ReturnType<typeof makeStyles>;
}) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });

  // This range is independent of the recommendation category/page cursor.
  const weeklyItems = useMemo(() => groupBuys, [groupBuys]);

  // Show items whose deadline falls on the selected day, or all weekly items
  // when no specific day is picked yet.
  const dayItems = useMemo(() => {
    if (!selectedDate) return weeklyItems;
    // Match the CalendarScreen logic: a deal shows on a day when its
    // start-end range overlaps that day, not only on its deadline.
    return weeklyItems.filter((item) =>
      isGroupBuyActiveOnDate(item, selectedDate),
    );
  }, [weeklyItems, selectedDate]);

  return (
    <View style={s.weeklySection} testID="home-weekly-section">
      <WeeklyCalendarStrip
        onPressCalendar={onOpenCalendar}
        selectedDate={selectedDate}
        onSelectDate={(date) => { setSelectedDate(date); onSelectDate?.(date); }}
      />
      {dayItems.length > 0 ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.weeklyList}
          data={dayItems}
          keyExtractor={(item) => item.id}
          onEndReached={pagination?.isError ? undefined : pagination?.onLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={<ListPageFooter pagination={pagination} />}
          renderItem={({ item, index }) => (
            <View style={s.weeklyCard}>
              <DealCard
                item={item}
                category={categoryForGroupBuy(item, index)}
                onPress={() => onPressDeal(item)}
              />
            </View>
          )}
        />
      ) : (
        <View style={s.weeklyEmpty}>
          {pagination?.isLoading ? <ActivityIndicator /> : pagination?.isError ? (
            <ListPageFooter pagination={pagination} />
          ) : (
          <SText variant="body" style={s.weeklyEmptyText}>
            선택한 날짜에 공구가 없습니다
          </SText>
          )}
        </View>
      )}
    </View>
  );
}

// Show the first ad within four products, then draw subsequent gaps from
// [HOME_AD_GAP_MIN, HOME_AD_GAP_MAX] = [2, 10] products. The
// gap sequence is seeded from the recommended product ids so the same batch
// always shows ads at the same indices (no layout jump on re-render), while a
// refreshed batch surfaces fresh ad positions.
const HOME_AD_GAP_MIN = 2;
const HOME_AD_GAP_MAX = 10;
const HOME_FIRST_AD_GAP_MAX = 4;

function seedRandomFromIds(ids: string[]): () => number {
  let h = 1779033703 ^ ids.length;
  for (const id of ids) {
    for (let i = 0; i < id.length; i++) {
      h = Math.imul(h ^ id.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/**
 * Returns the 0-based product indices after which a full-width native ad
 * should be inserted, using seeded random gaps in [HOME_AD_GAP_MIN,
 * HOME_AD_GAP_MAX]. Short finite lists may place the ad after the final
 * product so the two-product minimum can still produce a break.
 */
function buildHomeAdInsertionPoints(ids: string[]): Set<number> {
  const points = new Set<number>();
  const largestFirstGap = Math.min(HOME_FIRST_AD_GAP_MAX, ids.length);
  if (largestFirstGap < HOME_AD_GAP_MIN) return points;
  const random = seedRandomFromIds(ids.slice(0, 1));
  const randomGap = (max = HOME_AD_GAP_MAX) =>
    Math.floor(random() * (max - HOME_AD_GAP_MIN + 1)) + HOME_AD_GAP_MIN;
  let gap = randomGap(largestFirstGap);
  let index = gap - 1;
  while (index < ids.length) {
    points.add(index);
    gap = randomGap();
    index += gap;
  }
  return points;
}

type HomeFeedRow =
  | {
      type: "products";
      key: string;
      products: Array<{ item: GroupBuy; index: number }>;
    }
  | { type: "ad"; key: string };

function buildHomeFeedRows(groupBuys: GroupBuy[]): HomeFeedRow[] {
  const adInsertionPoints = buildHomeAdInsertionPoints(
    groupBuys.map((item) => item.id),
  );
  const rows: HomeFeedRow[] = [];
  let products: Array<{ item: GroupBuy; index: number }> = [];

  groupBuys.forEach((item, index) => {
    products.push({ item, index });
    // Flush partial rows before a full-width ad without changing product order.
    if (
      products.length === 2 ||
      adInsertionPoints.has(index) ||
      index === groupBuys.length - 1
    ) {
      rows.push({
        type: "products",
        key: `products-${products[0].item.id}`,
        products,
      });
      products = [];
    }
    if (adInsertionPoints.has(index)) {
      rows.push({ type: "ad", key: `ad-after-${item.id}` });
    }
  });
  return rows;
}

function homeFeedKey(row: HomeFeedRow) {
  return row.key;
}

function homeFeedItemType(row: HomeFeedRow) {
  return row.type;
}

export function HomeScreenContent({
  groupBuys,
  homeBannerGroupBuys,
  groupBuyRequestRankings = [],
  isError,
  isFetching,
  isLoading = false,
  onRefresh,
  onOpenSearch,
  onOpenCalendar,
  onPressDeal,
  onPressGroupBuyRequestRanking,
  scrollToTopRequest = null,
  onCategoryChange,
  weeklyGroupBuys,
  onWeeklyDateChange,
  pagination,
  weeklyPagination,
}: HomeScreenContentProps) {
  const { colors, isDark } = useCommerceTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [selectedCategory, setSelectedCategory] = useState<HomeCategory>("all");
  const [adRefreshKey, setAdRefreshKey] = useState(0);
  const handleRefresh = useCallback(() => {
    setAdRefreshKey((key) => key + 1);
    onRefresh();
  }, [onRefresh]);
  const categoryFilterTopRef = useRef<number | null>(null);
  const scrollOffsetRef = useRef(0);
  const scrollRef = useRef<FlashListRef<HomeFeedRow>>(null);
  const [isCategoryFilterSticky, setIsCategoryFilterSticky] = useState(false);
  const displayGroupBuys = groupBuys;
  const promoGroupBuys = homeBannerGroupBuys ?? groupBuys;
  const filteredGroupBuys = useMemo(() => {
    if (selectedCategory === "all") return displayGroupBuys;
    return displayGroupBuys.filter(
      (item) => normalizeHomeCategory(item.category) === selectedCategory,
    );
  }, [displayGroupBuys, selectedCategory]);
  const feedRows = useMemo(
    () => buildHomeFeedRows(filteredGroupBuys),
    [filteredGroupBuys],
  );
  const promoCardWidth = Math.max(
    0,
    Math.min(width - HOME_SIDE_PADDING * 2, Math.max(260, width - 88)),
  );
  const promoSidePadding = Math.max(
    HOME_SIDE_PADDING,
    Math.round((width - promoCardWidth) / 2),
  );
  const s = useMemo(() => makeStyles(colors), [colors]);
  const requestTickerBottom = getHomeRequestTickerBottomOffset(insets.bottom);

  useEffect(() => {
    if (scrollToTopRequest == null) return;
    scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [scrollToTopRequest]);

  const handleCategoryChange = useCallback((category: HomeCategory) => {
    setSelectedCategory(category);
    onCategoryChange?.(category);
    const filterTop = categoryFilterTopRef.current;
    if (filterTop != null && scrollOffsetRef.current > filterTop) {
      scrollRef.current?.scrollToOffset({ offset: filterTop, animated: false });
    }
  }, [onCategoryChange]);

  const renderFeedRow = useCallback(
    ({ item: row }: ListRenderItemInfo<HomeFeedRow>) => {
      if (row.type === "ad") {
        return (
          <NativeAdCard
            key={`${row.key}-${adRefreshKey}`}
            style={s.productAd}
            testID="home-native-ad"
            variant="row"
          />
        );
      }
      return (
        <View
          style={[s.recommendSection, s.productRow]}
          testID="home-product-row"
        >
          <View style={s.productGrid}>
            {row.products.map(({ item, index }) => (
              <DealCard
                category={categoryForGroupBuy(item, index)}
                item={item}
                key={item.id}
                onPress={() => onPressDeal(item)}
              />
            ))}
          </View>
        </View>
      );
    },
    [adRefreshKey, onPressDeal, s],
  );

  const handleCategoryFilterLayout = useCallback((event: LayoutChangeEvent) => {
    const nextTop = event.nativeEvent.layout.y;
    categoryFilterTopRef.current = nextTop;
    setIsCategoryFilterSticky(scrollOffsetRef.current >= nextTop);
  }, []);

  const handleHomeScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextOffset = event.nativeEvent.contentOffset.y;
      scrollOffsetRef.current = nextOffset;
      const filterTop = categoryFilterTopRef.current;
      if (filterTop == null) return;
      setIsCategoryFilterSticky((current) => {
        const nextSticky = nextOffset >= filterTop;
        return current === nextSticky ? current : nextSticky;
      });
    },
    [],
  );

  return (
    <SafeAreaView edges={["top", "bottom"]} style={s.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={s.container}>
        <FlashList
          ref={scrollRef}
          data={feedRows}
          renderItem={renderFeedRow}
          keyExtractor={homeFeedKey}
          getItemType={homeFeedItemType}
          maintainVisibleContentPosition={HOME_LIST_POSITION_CONFIG}
          testID="home-product-list"
          keyboardShouldPersistTaps="always"
          onScroll={handleHomeScroll}
          scrollEventThrottle={16}
          onEndReached={pagination?.isError ? undefined : pagination?.onLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={<ListPageFooter pagination={pagination} />}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
            />
          }
          contentContainerStyle={s.listContent}
          ListHeaderComponent={
            <>
              <View style={s.content} testID="home-top-content">
                <HomeTopBar colors={colors} onOpenSearch={onOpenSearch} s={s} />
                <ShoppingHomeHeading s={s} />
                <PromoBanner
                  cardWidth={promoCardWidth}
                  groupBuys={promoGroupBuys}
                  onPressDeal={onPressDeal}
                  s={s}
                  sidePadding={promoSidePadding}
                />
              </View>
              <View style={s.content} testID="home-weekly-content">
                <WeeklyGroupBuysSection
                  groupBuys={weeklyGroupBuys ?? displayGroupBuys}
                  onSelectDate={onWeeklyDateChange}
                  pagination={weeklyPagination}
                  onPressDeal={onPressDeal}
                  onOpenCalendar={onOpenCalendar}
                  s={s}
                />
                {isLoading && groupBuys.length === 0 ? (
                  <ActivityIndicator color={colors.accent} />
                ) : isError ? (
                  <AsyncStateNotice
                    compact
                    isRetrying={isFetching}
                    message={
                      groupBuys.length > 0
                        ? "네트워크 연결 상태를 확인해주세요. 저장된 공구 정보를 계속 표시하고 있어요."
                        : "네트워크 연결 상태를 확인해주세요. 잠시 후 다시 시도해주세요."
                    }
                    onRetry={onRefresh}
                    style={s.queryState}
                    testID="home-query-state"
                    title={
                      groupBuys.length > 0
                        ? "최신 공구 정보를 확인하지 못했어요"
                        : "공구 정보를 불러오지 못했어요"
                    }
                    variant={groupBuys.length > 0 ? "stale" : "error"}
                  />
                ) : groupBuys.length === 0 ? (
                  <AsyncStateNotice
                    compact
                    style={s.queryState}
                    testID="home-query-state"
                    title="현재 표시할 공구가 없어요"
                    message="새 공구가 등록되면 여기에 표시돼요. 잠시 후 다시 확인해 주세요."
                    onRetry={onRefresh}
                    isRetrying={isFetching}
                    variant="empty"
                  />
                ) : null}
              </View>
              <HomeCategoryFilter
                accessibilityElementsHidden={isCategoryFilterSticky}
                importantForAccessibility={
                  isCategoryFilterSticky ? "no-hide-descendants" : "auto"
                }
                onChange={handleCategoryChange}
                onLayout={handleCategoryFilterLayout}
                s={s}
                value={selectedCategory}
              />
            </>
          }
          ListEmptyComponent={
            !isLoading && displayGroupBuys.length > 0 && selectedCategory !== "all" ? (
              <View style={s.recommendSection}>
                <AsyncStateNotice
                  compact
                  variant="empty"
                  title="선택한 카테고리에 공구가 없어요"
                  message="전체 공구에서 다른 상품을 찾아보세요."
                  actionLabel="전체 공구 보기"
                  onRetry={() => handleCategoryChange("all")}
                  testID="home-category-empty"
                />
              </View>
            ) : null
          }
        />
        {isCategoryFilterSticky ? (
          <View
            pointerEvents="box-none"
            style={s.categoryFilterOverlay}
            testID="home-category-filter-sticky-layer"
          >
            <HomeCategoryFilter
              onChange={handleCategoryChange}
              s={s}
              testID="home-category-filter-sticky"
              value={selectedCategory}
            />
          </View>
        ) : null}
        <HomeRequestTicker
          onPressRanking={
            onPressGroupBuyRequestRanking ?? (() => onOpenSearch())
          }
          rankings={groupBuyRequestRankings}
          style={[s.requestTickerDock, { bottom: requestTickerBottom }]}
        />
      </View>
    </SafeAreaView>
  );
}

export function HomeScreen({ navigation }: HomeScreenProps) {
  const [category, setCategory] = useState<HomeCategory>("all");
  const [weeklyDate, setWeeklyDate] = useState(() => formatDateKey(new Date()));
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [homeBannerDateKey, setHomeBannerDateKey] = useState(() =>
    getHomeBannerDateKey(),
  );
  const [scrollToTopRequest, setScrollToTopRequest] = useState<number | null>(
    null,
  );
  const {
    items: groupBuys,
    dataUpdatedAt: groupBuysUpdatedAt,
    isError,
    isLoading,
    isFetching,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    loadMore,
  } = useGroupBuyFeed({ category });
  const weekly = useGroupBuyFeed({ from: weeklyDate, to: weeklyDate });
  const {
    data: homeBannerData,
    dataUpdatedAt: homeBannerUpdatedAt,
    refetch: refetchHomeBanners,
  } = useQuery(getHomeBannerQueryOptions(homeBannerDateKey));
  const {
    data: groupBuyRequestRankings = [],
    refetch: refetchGroupBuyRequestRankings,
  } = useGroupBuyRequestRankings();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextDateCheck = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      timer = setTimeout(
        () => {
          setHomeBannerDateKey(getHomeBannerDateKey());
          scheduleNextDateCheck();
        },
        Math.max(1, nextMidnight.getTime() - now.getTime()),
      );
    };

    scheduleNextDateCheck();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleManualRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        refetchHomeBanners(),
        refetchGroupBuyRequestRankings(),
        weekly.refetch(),
      ]);
    } finally {
      setIsManualRefreshing(false);
    }
  }, [refetch, refetchGroupBuyRequestRankings, refetchHomeBanners, weekly.refetch]);

  const handleHomeTabReselect = useCallback(() => {
    setScrollToTopRequest((request) => (request ?? 0) + 1);
    void handleManualRefresh();
  }, [handleManualRefresh]);

  useTabReselect(navigation, handleHomeTabReselect);

  const homeDataUpdatedAtRef = useRef(0);
  homeDataUpdatedAtRef.current = Math.min(
    groupBuysUpdatedAt,
    homeBannerUpdatedAt,
    weekly.dataUpdatedAt,
  );

  useFocusEffect(
    useCallback(() => {
      const homeDataUpdatedAt = homeDataUpdatedAtRef.current;
      const homeDataIsStale =
        homeDataUpdatedAt === 0 ||
        Date.now() - homeDataUpdatedAt >= HOME_DATA_STALE_TIME_MS;
      const requests: Promise<unknown>[] = [refetchGroupBuyRequestRankings()];

      if (homeDataIsStale) {
        requests.push(refetch(), refetchHomeBanners(), weekly.refetch());
      }

      void Promise.all(requests);
    }, [
      refetch,
      refetchGroupBuyRequestRankings,
      refetchHomeBanners,
      weekly.refetch,
    ]),
  );

  return (
    <HomeScreenContent
      groupBuys={groupBuys}
      groupBuyRequestRankings={groupBuyRequestRankings}
      homeBannerGroupBuys={homeBannerData ?? []}
      isError={isError && !isFetchNextPageError}
      isFetching={isManualRefreshing || (isFetching && !isFetchingNextPage)}
      isLoading={isLoading}
      onCategoryChange={setCategory}
      weeklyGroupBuys={weekly.items}
      onWeeklyDateChange={(date) => setWeeklyDate(formatDateKey(date))}
      pagination={{ hasMore: hasNextPage, isLoading: isFetchingNextPage, isError: isFetchNextPageError, onLoadMore: loadMore }}
      weeklyPagination={{
        hasMore: weekly.hasNextPage,
        isLoading: weekly.isPending || weekly.isFetchingNextPage,
        isError: weekly.isError,
        onLoadMore: weekly.isError && !weekly.isFetchNextPageError ? () => { void weekly.refetch(); } : weekly.loadMore,
      }}
      onRefresh={handleManualRefresh}
      scrollToTopRequest={scrollToTopRequest}
      onOpenSearch={() => navigation.navigate("SearchScreen")}
      onPressGroupBuyRequestRanking={() =>
        navigation.navigate("GroupBuyRequestRankings")
      }
      onOpenCalendar={() =>
        navigation.navigate("CalendarScreen", {
          initialDate: new Date().toISOString(),
        })
      }
      onPressDeal={(groupBuy) => navigation.navigate("Detail", { groupBuy })}
    />
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },
    container: { flex: 1, backgroundColor: colors.bg },
    content: {
      backgroundColor: colors.bg,
      paddingBottom: 24,
      paddingHorizontal: 0,
      paddingTop: 2,
    },
    listContent: {
      paddingBottom: 170,
      paddingHorizontal: 0,
      paddingTop: 0,
    },
    requestTickerDock: {
      elevation: 4,
      left: 0,
      position: "absolute",
      right: 0,
      zIndex: 10,
    },
    queryState: {
      marginHorizontal: spacing.lg,
    },
    topBar: {
      alignItems: "center",
      flexDirection: "row",
      paddingHorizontal: HOME_SIDE_PADDING,
      paddingTop: 8,
    },
    searchBox: {
      alignItems: "center",
      backgroundColor: colors.softBg,
      borderRadius: 16,
      flex: 1,
      flexDirection: "row",
      gap: 10,
      minHeight: 42,
      paddingHorizontal: 14,
    },
    searchPlaceholder: {
      color: colors.weak,
      flex: 1,
      fontSize: 16,
      fontWeight: "700",
      letterSpacing: 0,
      lineHeight: 21,
    },
    shopHeadingRow: {
      paddingHorizontal: HOME_SIDE_PADDING,
      paddingTop: 8,
      paddingBottom: 11,
    },
    shopHeading: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.softBg,
      borderRadius: 12,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 8,
    },
    shopHeadingText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 21,
    },
    promoRail: {
      gap: 12,
      paddingTop: 4,
      paddingBottom: 24,
    },
    promoCard: {
      backgroundColor: colors.promoBg,
      borderRadius: 24,
      borderCurve: "continuous",
      overflow: "hidden",
      position: "relative",
    },
    promoDetailAction: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 1,
    },
    promoDetailPressed: {
      backgroundColor: colors.overlay,
      opacity: 0.22,
    },
    promoBackground: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.promoBg,
      overflow: "hidden",
    },
    promoTitle: {
      color: colors.inverse,
      fontSize: 20,
      fontWeight: "900",
      letterSpacing: -0.3,
      lineHeight: 26,
      textShadowColor: "rgba(0, 0, 0, 0.38)",
      textShadowOffset: { height: 1, width: 0 },
      textShadowRadius: 4,
    },
    promoAccount: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0,
      lineHeight: 17,
      textShadowColor: "rgba(0, 0, 0, 0.38)",
      textShadowOffset: { height: 1, width: 0 },
      textShadowRadius: 3,
    },
    promoAccountRow: {
      marginBottom: 3,
      zIndex: 3,
    },
    promoImage: { ...StyleSheet.absoluteFillObject },
    promoImagePending: { opacity: 0 },
    promoArtworkFallback: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      backgroundColor: colors.promoBg,
      gap: 6,
      justifyContent: "center",
    },
    promoArtworkMark: {
      alignItems: "center",
      backgroundColor: colors.softBg,
      borderCurve: "continuous",
      borderRadius: borderRadius.full,
      height: 64,
      justifyContent: "center",
      width: 64,
    },
    promoArtworkMarkText: {
      color: colors.promoText,
      fontSize: 18,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 24,
    },
    promoArtworkFallbackText: {
      color: colors.promoMuted,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0,
      lineHeight: 14,
    },
    promoScrim: {
      ...StyleSheet.absoluteFillObject,
    },
    promoShade: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.18)",
    },
    promoOverlay: {
      bottom: 0,
      left: 0,
      paddingBottom: 18,
      paddingHorizontal: 18,
      paddingTop: 38,
      position: "absolute",
      right: 0,
      zIndex: 2,
    },
    promoStatusRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 7,
      marginTop: 7,
      minWidth: 0,
    },
    promoStatusAccent: {
      color: colors.accent,
      flexShrink: 0,
      fontSize: 14,
      fontWeight: "900",
      includeFontPadding: false,
      letterSpacing: 0,
      lineHeight: 19,
    },
    promoStatusDetail: {
      color: colors.inverse,
      flexShrink: 1,
      fontSize: 14,
      fontWeight: "800",
      includeFontPadding: false,
      letterSpacing: 0,
      lineHeight: 19,
    },
    promoSecondary: {
      color: "rgba(255, 255, 255, 0.94)",
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0,
      lineHeight: 18,
      marginTop: 2,
    },
    promoCounter: {
      alignItems: "center",
      backgroundColor: colors.overlay,
      borderRadius: borderRadius.full,
      borderCurve: "continuous",
      justifyContent: "center",
      minHeight: 22,
      minWidth: 36,
      paddingHorizontal: 7,
      position: "absolute",
      right: 12,
      top: 12,
    },
    promoCounterText: {
      color: colors.inverse,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 15,
    },
    promoEmpty: {
      alignItems: "center",
      backgroundColor: colors.panelBg,
      borderRadius: borderRadius.xl,
      justifyContent: "center",
      marginHorizontal: spacing.lg,
      minHeight: 160,
    },
    promoEmptyText: { color: colors.muted, fontSize: 15, fontWeight: "700" },
    sectionTitleRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    sectionTitle: {
      color: colors.text,
      flexShrink: 1,
      fontSize: 20,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 27,
    },
    weeklySection: {
      marginBottom: spacing.lg,
      paddingHorizontal: HOME_SIDE_PADDING,
    },
    seeAllButton: {
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    seeAllText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 18,
    },
    weeklyList: {
      gap: 12,
      paddingHorizontal: 0,
    },
    weeklyCard: {
      width: 148,
    },
    weeklyEmpty: {
      alignItems: "center",
      minHeight: 120,
      justifyContent: "center",
    },
    weeklyEmptyText: { color: colors.muted, fontSize: 15, fontWeight: "700" },
    attendanceArt: {
      alignItems: "center",
      backgroundColor: "#EDF2F7",
      borderRadius: 9,
      height: 34,
      justifyContent: "center",
      width: 34,
    },
    attendanceArtText: {
      color: "#4A9AF5",
      fontSize: 20,
      fontWeight: "900",
      lineHeight: 24,
      marginBottom: 0,
    },
    scrollArt: {
      height: 36,
      position: "relative",
      width: 36,
    },
    scrollPalm: {
      backgroundColor: "#FFC64D",
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
      borderTopLeftRadius: 8,
      bottom: 5,
      height: 20,
      left: 6,
      position: "absolute",
      transform: [{ rotate: "33deg" }],
      width: 18,
    },
    scrollFinger: {
      backgroundColor: "#FFC64D",
      borderRadius: 999,
      height: 30,
      left: 18,
      position: "absolute",
      top: 1,
      transform: [{ rotate: "34deg" }],
      width: 9,
    },
    feedArt: {
      alignItems: "center",
      backgroundColor: "#63D3CB",
      borderRadius: 7,
      height: 34,
      justifyContent: "center",
      width: 28,
    },
    feedLineLong: {
      backgroundColor: "#1D6D68",
      borderRadius: 999,
      height: 4,
      marginBottom: 6,
      width: 14,
    },
    feedLineShort: {
      backgroundColor: "#1D6D68",
      borderRadius: 999,
      height: 4,
      opacity: 0.72,
      width: 10,
    },
    catArt: { height: 38, position: "relative", width: 38 },
    catEarLeft: {
      backgroundColor: "#64748B",
      borderRadius: 4,
      height: 13,
      left: 7,
      position: "absolute",
      top: 5,
      transform: [{ rotate: "-35deg" }],
      width: 13,
    },
    catEarRight: {
      backgroundColor: "#64748B",
      borderRadius: 4,
      height: 13,
      position: "absolute",
      right: 7,
      top: 5,
      transform: [{ rotate: "35deg" }],
      width: 13,
    },
    catFace: {
      alignItems: "center",
      backgroundColor: "#64748B",
      borderRadius: 14,
      height: 27,
      justifyContent: "center",
      left: 5,
      position: "absolute",
      top: 9,
      width: 28,
    },
    catEyeRow: { flexDirection: "row", gap: 8, marginBottom: 5 },
    catEye: {
      backgroundColor: "#111827",
      borderRadius: 999,
      height: 3,
      width: 3,
    },
    catMouth: {
      backgroundColor: "#F3A6AD",
      borderRadius: 999,
      height: 5,
      width: 9,
    },
    lookArt: { height: 38, position: "relative", width: 38 },
    lookBagHandle: {
      borderColor: "#4B5563",
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      borderWidth: 2,
      borderBottomWidth: 0,
      height: 11,
      left: 11,
      position: "absolute",
      top: 3,
      width: 17,
    },
    lookBagBody: {
      backgroundColor: "#FB7185",
      borderRadius: 6,
      height: 22,
      left: 7,
      position: "absolute",
      top: 12,
      width: 24,
    },
    lookLens: {
      borderColor: "#4B5563",
      borderRadius: 999,
      borderWidth: 3,
      bottom: 2,
      height: 14,
      position: "absolute",
      right: 0,
      width: 14,
    },
    lookHandle: {
      backgroundColor: "#4B5563",
      borderRadius: 999,
      bottom: 0,
      height: 3,
      position: "absolute",
      right: -2,
      transform: [{ rotate: "45deg" }],
      width: 10,
    },
    drawCoin: {
      alignItems: "center",
      backgroundColor: "#FDBA2D",
      borderRadius: 999,
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    drawCoinText: {
      color: "#B9770E",
      fontSize: 12,
      fontWeight: "900",
      lineHeight: 15,
    },
    benefitMiniBadge: {
      backgroundColor: colors.blue,
      borderRadius: borderRadius.full,
      paddingHorizontal: 6,
      paddingVertical: 2,
      position: "absolute",
      right: -8,
      top: -7,
    },
    benefitMiniBadgeText: {
      color: colors.inverse,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0,
      lineHeight: 13,
    },
    benefitLabel: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 18,
      maxWidth: 64,
      textAlign: "center",
    },
    recommendSection: {
      paddingHorizontal: HOME_SIDE_PADDING,
    },
    productRow: {
      paddingBottom: spacing.lg + spacing.xxs,
    },
    productAd: {
      marginHorizontal: HOME_SIDE_PADDING,
      marginBottom: spacing.lg + spacing.xxs,
      width: "auto",
    },
    productGrid: {
      columnGap: spacing.md,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 18,
    },
    productEmpty: {
      alignItems: "center",
      backgroundColor: colors.panelBg,
      borderRadius: borderRadius.lg,
      justifyContent: "center",
      minHeight: 140,
    },
    productEmptyText: { color: colors.muted, fontSize: 15, fontWeight: "700" },
    categoryFilter: {
      backgroundColor: colors.bg,
      borderTopColor: colors.divider,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: 0,
      elevation: 0,
      paddingVertical: spacing.xs + spacing.xxs,
      zIndex: 2,
    },
    categoryFilterOverlay: {
      elevation: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
      zIndex: 20,
    },
    categoryFilterContent: {
      gap: spacing.sm,
      paddingHorizontal: HOME_SIDE_PADDING,
    },
    categoryChip: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      height: spacing["3xl"] + spacing.xs,
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
    },
    selectedCategoryChip: {
      backgroundColor: colors.text,
      borderColor: colors.text,
    },
    categoryChipText: {
      color: colors.text,
      fontWeight: "800",
      includeFontPadding: false,
    },
    selectedCategoryChipText: { color: colors.bg },
    notice: {
      backgroundColor: colors.warningSoft,
      borderRadius: borderRadius.md,
      marginBottom: spacing.md,
      padding: spacing.md,
    },
    noticeText: { color: colors.warning, fontSize: 12, textAlign: "center" },
  });
}

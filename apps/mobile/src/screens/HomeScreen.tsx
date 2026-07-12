import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  ActivityIndicator,
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';

import { SText } from '../components/ui/SText';
import { SearchGlyph } from '../components/ui/LineGlyphs';
import { DealCard } from '../components/DealCard';
import { CATEGORIES } from '../components/home/CategoryRow';
import { categoryForGroupBuy } from '../components/home/DealCardGrid';
import { WeeklyCalendarStrip } from '../components/home/WeeklyCalendarStrip';
import { fallbackGroupBuys, fetchGroupBuys } from '../api';
import { KeyboardFormScreen } from '../components/keyboard/KeyboardFormScreen';
import { borderRadius, spacing } from '../design/tokens';
import type { CategoryColorName } from '../design/tokens';
import { isGroupBuyActiveOnDate } from '../utils/groupBuyDates';
import { formatPriceKrw, selectHomeBannerItems } from '../utils/homeBanner';
import { useCommerceTheme } from '../design/useCommerceTheme';
import type { CommerceColorPalette } from '../design/commerce';
import type { GroupBuy, HomeScreenProps } from '../types';
import promoScrimSource from '../assets/promo-scrim.png';

type HomeAction = () => void;
type DealAction = Dispatch<GroupBuy>;
type HomeCategory = 'all' | CategoryColorName;

const HOME_CATEGORY_OPTIONS: Array<{ key: HomeCategory; label: string }> = [
  { key: 'all', label: '전체' },
  ...CATEGORIES.map(({ key, label }) => ({ key, label })),
];

type HomeScreenContentProps = {
  groupBuys: GroupBuy[];
  isError: boolean;
  isFetching: boolean;
  onRefresh: HomeAction;
  onOpenSearch: HomeAction;
  onOpenCalendar: HomeAction;
  onPressDeal: DealAction;
};

const HOME_SIDE_PADDING = 16;
const PROMO_CARD_GAP = 12;
const PROMO_AUTO_PLAY_MS = 3000;
const PROMO_WRAP_SETTLE_MS = 450;
const DAY_IN_MS = 86_400_000;

type PromoStatusCopy = {
  accentLabel: string;
  accessibilityLabel: string;
  detailLabel?: string;
  secondaryLabel?: string;
};

function getPromoVisual(item: GroupBuy) {
  const firstMedia = item.mediaItems?.[0];
  const firstMediaVisual =
    firstMedia?.mediaType === 'IMAGE'
      ? firstMedia.url.trim() || firstMedia.thumbnailUrl?.trim()
      : firstMedia?.thumbnailUrl?.trim();
  if (firstMediaVisual) return firstMediaVisual;

  const coverThumbnail = item.thumbnailUrl?.trim();
  if (coverThumbnail) return coverThumbnail;

  const firstImage = item.mediaItems?.find(
    (media) => media.mediaType === 'IMAGE' && media.url.trim(),
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
    (item.mediaType === 'IMAGE' ? item.mediaUrls[0] : null) ??
    item.thumbnailUrl?.trim() ??
    null
  );
}

function getDisplayItems(groupBuys: GroupBuy[]) {
  return groupBuys.length > 0 ? groupBuys : fallbackGroupBuys;
}

function normalizeHomeCategory(
  category: GroupBuy['category'],
): CategoryColorName | null {
  switch (category as string | null | undefined) {
    case 'lifestyle':
      return 'living';
    case 'digital':
      return 'electronics';
    default:
      return category ?? null;
  }
}

function getPromoFallbackMark(item: GroupBuy) {
  const source =
    item.brandName?.trim() || item.productName?.trim() || '공동구매';
  return source.replace(/\s/g, '').slice(0, 2).toUpperCase();
}

function parsePromoDate(value: string | null, endOfDay = false) {
  if (!value) return null;

  const trimmedValue = value.trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedValue);
  if (dateOnlyMatch) {
    const [, yearValue, monthValue, dayValue] = dateOnlyMatch;
    const year = Number(yearValue);
    const month = Number(monthValue) - 1;
    const day = Number(dayValue);
    const date = new Date(
      year,
      month,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
    );

    return date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === day
      ? date
      : null;
  }

  const date = new Date(trimmedValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPromoPrice(rawPrice: string | undefined) {
  if (!rawPrice) return null;
  const numericPrice = Number(rawPrice.replace(/,/g, ''));
  if (!Number.isSafeInteger(numericPrice) || numericPrice <= 0) return null;
  return `${numericPrice.toLocaleString('ko-KR')}원`;
}

function getPromoPrice(discountInfo: string | null) {
  if (!discountInfo) return null;

  const labeledPrices = Array.from(
    discountInfo.matchAll(
      /(?:공구가|판매가|할인가|최종가|특가|가격)\s*[:：]?\s*(?:₩\s*)?([0-9][0-9,]*)(?:\s*원|\b(?!\s*%))/gi,
    ),
  );
  const labeledPrice = labeledPrices.at(-1)?.[1];
  if (labeledPrice) return formatPromoPrice(labeledPrice);

  const candidates = [
    ...Array.from(
      discountInfo.matchAll(
        /([0-9][0-9,]*)\s*원(?!\s*(?:할인|쿠폰|적립|혜택|지원))/g,
      ),
      (match) => ({ index: match.index, rawPrice: match[1] }),
    ),
    ...Array.from(discountInfo.matchAll(/₩\s*([0-9][0-9,]*)/g), (match) => ({
      index: match.index,
      rawPrice: match[1],
    })),
  ]
    .filter(({ index }) => {
      const precedingCopy = discountInfo.slice(Math.max(0, index - 16), index);
      return !/(?:배송비|배송료|택배비|운임|수수료|보증금|예약금|쿠폰|적립금?|지원금?|혜택)\s*[:：]?\s*$/i.test(
        precedingCopy,
      );
    })
    .sort((left, right) => left.index - right.index);

  return candidates.length === 1
    ? formatPromoPrice(candidates[0].rawPrice)
    : null;
}

function getPromoDiscountPercent(discountInfo: string | null) {
  if (!discountInfo) return null;

  const patterns = [
    /(?:할인율|할인|특가|OFF)\s*[:：]?\s*([0-9]{1,3})\s*%/i,
    /([0-9]{1,3})\s*%\s*(?:할인|특가|OFF)/i,
    /^\s*([0-9]{1,2})\s*%(?=\s+(?:₩|[0-9][0-9,]*\s*원))/i,
  ];

  for (const pattern of patterns) {
    const match = discountInfo.match(pattern);
    const percent = match ? Number(match[1]) : Number.NaN;
    if (Number.isInteger(percent) && percent > 0 && percent <= 100) {
      return percent;
    }
  }

  return null;
}

function getPromoStatusCopy(item: GroupBuy, now = new Date()): PromoStatusCopy {
  const startDate = parsePromoDate(item.startDate);
  const endDate = parsePromoDate(item.endDate, true);

  if (endDate && endDate.getTime() < now.getTime()) {
    return {
      accentLabel: '공구 종료',
      accessibilityLabel: '공구 종료',
    };
  }

  const price = formatPriceKrw(item.priceKrw) ?? getPromoPrice(item.discountInfo);
  const discountPercent = getPromoDiscountPercent(item.discountInfo);

  if (startDate && startDate.getTime() > now.getTime()) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDay = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
    );
    const daysUntilStart = Math.max(
      0,
      Math.round((startDay.getTime() - today.getTime()) / DAY_IN_MS),
    );
    const timingLabel = daysUntilStart === 0 ? '오늘' : `D+${daysUntilStart}`;
    const spokenTiming =
      daysUntilStart === 0 ? '오늘 시작' : `${daysUntilStart}일 후 시작`;
    const dateLabel = `${startDate.getMonth() + 1}/${startDate.getDate()} 시작`;
    const priceLabel = price ?? '가격 공개 예정';

    return {
      accentLabel: timingLabel,
      accessibilityLabel: `${spokenTiming}, ${dateLabel}, ${priceLabel}`,
      detailLabel: dateLabel,
      secondaryLabel: priceLabel,
    };
  }

  if (discountPercent && price) {
    return {
      accentLabel: `${discountPercent}%`,
      accessibilityLabel: `${discountPercent}% 할인, ${price}`,
      detailLabel: price,
    };
  }

  if (discountPercent) {
    return {
      accentLabel: `${discountPercent}%`,
      accessibilityLabel: `${discountPercent}% 할인, 상세에서 가격 확인`,
      detailLabel: '상세에서 가격 확인',
    };
  }

  if (price) {
    return {
      accentLabel: '공구 진행 중',
      accessibilityLabel: `공구 진행 중, ${price}`,
      detailLabel: price,
    };
  }

  return {
    accentLabel: '공구 진행 중',
    accessibilityLabel: '공구 진행 중, 상세에서 가격 확인',
    detailLabel: '상세에서 가격 확인',
  };
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
  value,
  onChange,
  s,
}: {
  value: HomeCategory;
  onChange: Dispatch<SetStateAction<HomeCategory>>;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <View
      accessibilityRole="tablist"
      style={s.categoryFilter}
      testID="home-category-filter"
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
              style={[s.categoryChip, selected && s.selectedCategoryChip]}
            >
              <SText
                variant="label"
                style={[s.categoryChipText, selected && s.selectedCategoryChipText]}
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

  const promoItems = useMemo(
    () => {
      const displayItems = getDisplayItems(groupBuys);
      const hasBannerContract = displayItems.some((item) => item.isHomeBanner !== undefined);
      return (hasBannerContract ? selectHomeBannerItems(displayItems) : displayItems).slice(0, 6);
    },
    [groupBuys, homeBannerDateTick],
  );
  const scrollRef = useRef<ScrollView | null>(null);
  const currentPositionRef = useRef(promoItems.length > 1 ? 1 : 0);
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAutoPlayRef = useRef<() => void>(() => {});
  const snapInterval = cardWidth + PROMO_CARD_GAP;
  const canAutoPlay = promoItems.length > 1;
  const cardHeight = Math.min(
    260,
    Math.max(224, Math.round(cardWidth / 1.16)),
  );
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
      if (!canAutoPlay) return 0;
      if (position <= 0) return promoItems.length;
      if (position >= promoItems.length + 1) return 1;
      return position;
    },
    [canAutoPlay, promoItems.length],
  );

  const scheduleAutoPlay = useCallback(() => {
    clearAutoPlayTimer();
    if (!canAutoPlay) return;

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
    canAutoPlay,
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

      if (canAutoPlay && normalizedPosition !== settledPosition) {
        scrollToPosition(normalizedPosition, false);
      }

      scheduleAutoPlay();
    },
    [
      canAutoPlay,
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
    currentPositionRef.current = canAutoPlay ? 1 : 0;

    if (canAutoPlay) {
      scrollToPosition(1, false);
      scheduleAutoPlay();
    }

    return () => {
      clearAutoPlayTimer();
      clearWrapSettleTimer();
    };
  }, [
    canAutoPlay,
    clearAutoPlayTimer,
    clearWrapSettleTimer,
    promoItems.length,
    scheduleAutoPlay,
    scrollToPosition,
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
      contentContainerStyle={[
        s.promoRail,
        { paddingHorizontal: sidePadding },
      ]}
      contentOffset={canAutoPlay ? { x: snapInterval, y: 0 } : undefined}
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
        const productName = item.productName?.trim() || '공동구매 상품';
        const statusCopy = getPromoStatusCopy(item);
        const accessibilityLabel = [
          productName,
          statusCopy.accessibilityLabel,
          '상세 열기',
        ].join(', ');
        return (
          <Pressable
            accessibilityElementsHidden={clone}
            accessibilityLabel={clone ? undefined : accessibilityLabel}
            accessibilityRole="button"
            importantForAccessibility={clone ? 'no-hide-descendants' : 'auto'}
            key={`${item.id}-${renderIndex}-${clone ? 'clone' : 'real'}`}
            onPress={() => onPressDeal(item)}
            style={[s.promoCard, { height: cardHeight, width: cardWidth }]}
          >
            <View
              pointerEvents="none"
              style={s.promoBackground}
              testID={clone ? undefined : `promo-background-${item.id}`}
            >
              <PromoArtwork
                clone={clone}
                fallbackMark={getPromoFallbackMark(item)}
                itemId={item.id}
                key={`${item.id}:${visual ?? 'placeholder'}`}
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
              pointerEvents="none"
              style={s.promoOverlay}
              testID={clone ? undefined : `promo-overlay-${item.id}`}
            >
              <SText
                variant="cardTitle"
                numberOfLines={2}
                style={s.promoTitle}
              >
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
                  <SText
                    variant="label"
                    numberOfLines={1}
                    style={s.promoStatusDetail}
                  >
                    {statusCopy.detailLabel}
                  </SText>
                ) : null}
              </View>
              {statusCopy.secondaryLabel ? (
                <SText
                  variant="body"
                  numberOfLines={1}
                  style={s.promoSecondary}
                >
                  {statusCopy.secondaryLabel}
                </SText>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function WeeklyGroupBuysSection({
  groupBuys,
  onPressDeal,
  onOpenCalendar,
  s,
}: {
  groupBuys: GroupBuy[];
  onPressDeal: DealAction;
  onOpenCalendar: HomeAction;
  s: ReturnType<typeof makeStyles>;
}) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });

  // Use the full groupBuys list (same source as CalendarScreen) so the
  // per-day results stay in sync with the full calendar view.
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
    <View style={s.weeklySection}>
      <WeeklyCalendarStrip
        onPressCalendar={onOpenCalendar}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />
      {dayItems.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.weeklyList}
        >
          {dayItems.map((item, index) => (
            <View key={item.id} style={s.weeklyCard}>
              <DealCard
                item={item}
                category={categoryForGroupBuy(item, index)}
                onPress={() => onPressDeal(item)}
              />
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={s.weeklyEmpty}>
          <SText variant="body" style={s.weeklyEmptyText}>
            선택한 날짜에 공구가 없습니다
          </SText>
        </View>
      )}
    </View>
  );
}

function RecommendedProducts({
  groupBuys,
  onPressDeal,
  s,
}: {
  groupBuys: GroupBuy[];
  onPressDeal: DealAction;
  s: ReturnType<typeof makeStyles>;
}) {
  const products = groupBuys.slice(0, 8);

  return (
    <View style={s.recommendSection}>
      {products.length > 0 ? (
        <View style={s.productGrid}>
          {products.map((item, index) => (
            <DealCard
              item={item}
              key={item.id}
              onPress={() => onPressDeal(item)}
              category={categoryForGroupBuy(item, index)}
            />
          ))}
        </View>
      ) : (
        <View style={s.productEmpty}>
          <SText variant="body" style={s.productEmptyText}>
            선택한 카테고리에 공구가 없습니다
          </SText>
        </View>
      )}
    </View>
  );
}

export function HomeScreenContent({
  groupBuys,
  isError,
  isFetching,
  onRefresh,
  onOpenSearch,
  onOpenCalendar,
  onPressDeal,
}: HomeScreenContentProps) {
  const { colors, isDark } = useCommerceTheme();
  const { width } = useWindowDimensions();
  const [selectedCategory, setSelectedCategory] = useState<HomeCategory>('all');
  const filteredGroupBuys = useMemo(() => {
    const displayItems = getDisplayItems(groupBuys);
    if (selectedCategory === 'all') return displayItems;
    return displayItems.filter(
      (item) => normalizeHomeCategory(item.category) === selectedCategory,
    );
  }, [groupBuys, selectedCategory]);
  const promoCardWidth = Math.max(
    0,
    Math.min(width - HOME_SIDE_PADDING * 2, Math.max(260, width - 88)),
  );
  const promoSidePadding = Math.max(
    HOME_SIDE_PADDING,
    Math.round((width - promoCardWidth) / 2),
  );
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={s.container}>
        <KeyboardFormScreen
          keyboardShouldPersistTaps="always"
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          stickyHeaderIndices={[2]}
          contentContainerStyle={s.listContent}
        >
          <View style={s.content} testID="home-top-content">
            <HomeTopBar colors={colors} onOpenSearch={onOpenSearch} s={s} />
            <ShoppingHomeHeading s={s} />
            <PromoBanner
              cardWidth={promoCardWidth}
              groupBuys={groupBuys}
              onPressDeal={onPressDeal}
              s={s}
              sidePadding={promoSidePadding}
            />
          </View>
          <View style={s.content} testID="home-weekly-content">
            <WeeklyGroupBuysSection
              groupBuys={filteredGroupBuys}
              onPressDeal={onPressDeal}
              onOpenCalendar={onOpenCalendar}
              s={s}
            />
            {isError ? (
              <View style={s.notice}>
                <SText variant="caption" style={s.noticeText}>
                  네트워크 연결 상태를 확인해주세요. (샘플 데이터를 표시
                  중입니다)
                </SText>
              </View>
            ) : null}
            {isFetching && groupBuys.length === 0 ? (
              <ActivityIndicator color={colors.accent} />
            ) : null}
          </View>
          <HomeCategoryFilter
            onChange={setSelectedCategory}
            s={s}
            value={selectedCategory}
          />
          <View style={s.content} testID="home-deal-grid-content">
            <RecommendedProducts
              groupBuys={filteredGroupBuys}
              onPressDeal={onPressDeal}
              s={s}
            />
          </View>
        </KeyboardFormScreen>
      </View>
    </SafeAreaView>
  );
}

export function HomeScreen({ navigation }: HomeScreenProps) {
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const { data, isError, refetch } = useQuery({
    queryKey: ['group-buys'],
    queryFn: fetchGroupBuys,
    retry: false,
  });

  const handleManualRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsManualRefreshing(false);
    }
  }, [refetch]);

  const groupBuys = data?.length ? data : fallbackGroupBuys;

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  return (
    <HomeScreenContent
      groupBuys={groupBuys}
      isError={isError}
      isFetching={isManualRefreshing}
      onRefresh={handleManualRefresh}
      onOpenSearch={() => navigation.navigate('SearchScreen')}
      onOpenCalendar={() =>
        navigation.navigate('CalendarScreen', {
          initialDate: new Date().toISOString(),
        })
      }
      onPressDeal={(groupBuy) => navigation.navigate('Detail', { groupBuy })}
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
      paddingBottom: 122,
      paddingHorizontal: 0,
      paddingTop: 0,
    },
    topBar: {
      alignItems: 'center',
      flexDirection: 'row',
      paddingHorizontal: HOME_SIDE_PADDING,
      paddingTop: 8,
    },
    searchBox: {
      alignItems: 'center',
      backgroundColor: colors.softBg,
      borderRadius: 16,
      flex: 1,
      flexDirection: 'row',
      gap: 10,
      minHeight: 42,
      paddingHorizontal: 14,
    },
    searchPlaceholder: {
      color: colors.weak,
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0,
      lineHeight: 21,
    },
    shopHeadingRow: {
      paddingHorizontal: HOME_SIDE_PADDING,
      paddingTop: 8,
      paddingBottom: 11,
    },
    shopHeading: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.softBg,
      borderRadius: 12,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 8,
    },
    shopHeadingText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
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
      borderCurve: 'continuous',
      overflow: 'hidden',
      position: 'relative',
    },
    promoBackground: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.promoBg,
      overflow: 'hidden',
    },
    promoTitle: {
      color: colors.inverse,
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: -0.3,
      lineHeight: 26,
      textShadowColor: 'rgba(0, 0, 0, 0.38)',
      textShadowOffset: { height: 1, width: 0 },
      textShadowRadius: 4,
    },
    promoImage: { ...StyleSheet.absoluteFillObject },
    promoImagePending: { opacity: 0 },
    promoArtworkFallback: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      backgroundColor: colors.promoBg,
      gap: 6,
      justifyContent: 'center',
    },
    promoArtworkMark: {
      alignItems: 'center',
      backgroundColor: colors.softBg,
      borderCurve: 'continuous',
      borderRadius: borderRadius.full,
      height: 64,
      justifyContent: 'center',
      width: 64,
    },
    promoArtworkMarkText: {
      color: colors.promoText,
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: 24,
    },
    promoArtworkFallbackText: {
      color: colors.promoMuted,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0,
      lineHeight: 14,
    },
    promoScrim: {
      ...StyleSheet.absoluteFillObject,
    },
    promoShade: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.18)',
    },
    promoOverlay: {
      bottom: 0,
      left: 0,
      paddingBottom: 18,
      paddingHorizontal: 18,
      paddingTop: 38,
      position: 'absolute',
      right: 0,
    },
    promoStatusRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 7,
      marginTop: 7,
      minWidth: 0,
    },
    promoStatusAccent: {
      color: colors.accent,
      flexShrink: 0,
      fontSize: 14,
      fontWeight: '900',
      includeFontPadding: false,
      letterSpacing: 0,
      lineHeight: 19,
    },
    promoStatusDetail: {
      color: colors.inverse,
      flexShrink: 1,
      fontSize: 14,
      fontWeight: '800',
      includeFontPadding: false,
      letterSpacing: 0,
      lineHeight: 19,
    },
    promoSecondary: {
      color: 'rgba(255, 255, 255, 0.94)',
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0,
      lineHeight: 18,
      marginTop: 2,
    },
    promoCounter: {
      alignItems: 'center',
      backgroundColor: colors.overlay,
      borderRadius: borderRadius.full,
      borderCurve: 'continuous',
      justifyContent: 'center',
      minHeight: 22,
      minWidth: 36,
      paddingHorizontal: 7,
      position: 'absolute',
      right: 12,
      top: 12,
    },
    promoCounterText: {
      color: colors.inverse,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0,
      lineHeight: 15,
    },
    promoEmpty: {
      alignItems: 'center',
      backgroundColor: colors.panelBg,
      borderRadius: borderRadius.xl,
      justifyContent: 'center',
      marginHorizontal: spacing.lg,
      minHeight: 160,
    },
    promoEmptyText: { color: colors.muted, fontSize: 15, fontWeight: '700' },
    sectionTitleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    sectionTitle: {
      color: colors.text,
      flexShrink: 1,
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: 27,
    },
    weeklySection: {
      marginBottom: 36,
      paddingHorizontal: HOME_SIDE_PADDING,
    },
    seeAllButton: {
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    seeAllText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '800',
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
      alignItems: 'center',
      minHeight: 120,
      justifyContent: 'center',
    },
    weeklyEmptyText: { color: colors.muted, fontSize: 15, fontWeight: '700' },
    attendanceArt: {
      alignItems: 'center',
      backgroundColor: '#EDF2F7',
      borderRadius: 9,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    attendanceArtText: {
      color: '#4A9AF5',
      fontSize: 20,
      fontWeight: '900',
      lineHeight: 24,
      marginBottom: 0,
    },
    scrollArt: {
      height: 36,
      position: 'relative',
      width: 36,
    },
    scrollPalm: {
      backgroundColor: '#FFC64D',
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
      borderTopLeftRadius: 8,
      bottom: 5,
      height: 20,
      left: 6,
      position: 'absolute',
      transform: [{ rotate: '33deg' }],
      width: 18,
    },
    scrollFinger: {
      backgroundColor: '#FFC64D',
      borderRadius: 999,
      height: 30,
      left: 18,
      position: 'absolute',
      top: 1,
      transform: [{ rotate: '34deg' }],
      width: 9,
    },
    feedArt: {
      alignItems: 'center',
      backgroundColor: '#63D3CB',
      borderRadius: 7,
      height: 34,
      justifyContent: 'center',
      width: 28,
    },
    feedLineLong: {
      backgroundColor: '#1D6D68',
      borderRadius: 999,
      height: 4,
      marginBottom: 6,
      width: 14,
    },
    feedLineShort: {
      backgroundColor: '#1D6D68',
      borderRadius: 999,
      height: 4,
      opacity: 0.72,
      width: 10,
    },
    catArt: { height: 38, position: 'relative', width: 38 },
    catEarLeft: {
      backgroundColor: '#64748B',
      borderRadius: 4,
      height: 13,
      left: 7,
      position: 'absolute',
      top: 5,
      transform: [{ rotate: '-35deg' }],
      width: 13,
    },
    catEarRight: {
      backgroundColor: '#64748B',
      borderRadius: 4,
      height: 13,
      position: 'absolute',
      right: 7,
      top: 5,
      transform: [{ rotate: '35deg' }],
      width: 13,
    },
    catFace: {
      alignItems: 'center',
      backgroundColor: '#64748B',
      borderRadius: 14,
      height: 27,
      justifyContent: 'center',
      left: 5,
      position: 'absolute',
      top: 9,
      width: 28,
    },
    catEyeRow: { flexDirection: 'row', gap: 8, marginBottom: 5 },
    catEye: {
      backgroundColor: '#111827',
      borderRadius: 999,
      height: 3,
      width: 3,
    },
    catMouth: {
      backgroundColor: '#F3A6AD',
      borderRadius: 999,
      height: 5,
      width: 9,
    },
    lookArt: { height: 38, position: 'relative', width: 38 },
    lookBagHandle: {
      borderColor: '#4B5563',
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      borderWidth: 2,
      borderBottomWidth: 0,
      height: 11,
      left: 11,
      position: 'absolute',
      top: 3,
      width: 17,
    },
    lookBagBody: {
      backgroundColor: '#FB7185',
      borderRadius: 6,
      height: 22,
      left: 7,
      position: 'absolute',
      top: 12,
      width: 24,
    },
    lookLens: {
      borderColor: '#4B5563',
      borderRadius: 999,
      borderWidth: 3,
      bottom: 2,
      height: 14,
      position: 'absolute',
      right: 0,
      width: 14,
    },
    lookHandle: {
      backgroundColor: '#4B5563',
      borderRadius: 999,
      bottom: 0,
      height: 3,
      position: 'absolute',
      right: -2,
      transform: [{ rotate: '45deg' }],
      width: 10,
    },
    drawCoin: {
      alignItems: 'center',
      backgroundColor: '#FDBA2D',
      borderRadius: 999,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    drawCoinText: {
      color: '#B9770E',
      fontSize: 12,
      fontWeight: '900',
      lineHeight: 15,
    },
    benefitMiniBadge: {
      backgroundColor: colors.blue,
      borderRadius: borderRadius.full,
      paddingHorizontal: 6,
      paddingVertical: 2,
      position: 'absolute',
      right: -8,
      top: -7,
    },
    benefitMiniBadgeText: {
      color: colors.inverse,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: 13,
    },
    benefitLabel: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0,
      lineHeight: 18,
      maxWidth: 64,
      textAlign: 'center',
    },
    recommendSection: {
      paddingHorizontal: HOME_SIDE_PADDING,
    },
    productGrid: {
      columnGap: spacing.md,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 18,
    },
    productEmpty: {
      alignItems: 'center',
      backgroundColor: colors.panelBg,
      borderRadius: borderRadius.lg,
      justifyContent: 'center',
      minHeight: 140,
    },
    productEmptyText: { color: colors.muted, fontSize: 15, fontWeight: '700' },
    categoryFilter: {
      backgroundColor: colors.bg,
      borderBottomColor: colors.divider,
      borderBottomWidth: StyleSheet.hairlineWidth,
      paddingVertical: spacing.sm,
      zIndex: 2,
    },
    categoryFilterContent: {
      gap: spacing.sm,
      paddingHorizontal: HOME_SIDE_PADDING,
    },
    categoryChip: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: spacing.lg,
    },
    selectedCategoryChip: {
      backgroundColor: colors.text,
      borderColor: colors.text,
    },
    categoryChipText: {
      color: colors.text,
      fontWeight: '800',
      includeFontPadding: false,
    },
    selectedCategoryChipText: { color: colors.bg },
    notice: {
      backgroundColor: colors.warningSoft,
      borderRadius: borderRadius.md,
      marginBottom: spacing.md,
      padding: spacing.md,
    },
    noticeText: { color: colors.warning, fontSize: 12, textAlign: 'center' },
  });
}

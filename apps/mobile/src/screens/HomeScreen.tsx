import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
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
import { WeeklyCalendarStrip } from '../components/home/WeeklyCalendarStrip';
import { fallbackGroupBuys, fetchGroupBuys } from '../api';
import { KeyboardFormScreen } from '../components/keyboard/KeyboardFormScreen';
import { borderRadius, categoryColors, spacing } from '../design/tokens';
import { getDaysRemaining } from '../utils';
import { isGroupBuyActiveOnDate } from '../utils/groupBuyDates';
import { useCommerceTheme } from '../design/useCommerceTheme';
import type { CommerceColorPalette } from '../design/commerce';
import type { GroupBuy, HomeScreenProps } from '../types';

type HomeAction = () => void;
type DealAction = Dispatch<GroupBuy>;

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
const TRANSPARENT_PRODUCT_IMAGE_PATTERN = /\.(?:png|webp)(?:[?#]|$)/i;
const PROMO_DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  day: 'numeric',
  month: 'numeric',
  timeZone: 'Asia/Seoul',
});

function getVisual(item: GroupBuy) {
  return (
    item.thumbnailUrl ??
    item.mediaItems?.find((media) => media.thumbnailUrl)?.thumbnailUrl ??
    item.mediaUrls?.[0] ??
    null
  );
}

function getPromoVisual(item: GroupBuy) {
  const transparentProductImage =
    item.mediaItems?.find(
      (media) =>
        media.mediaType === 'IMAGE' &&
        TRANSPARENT_PRODUCT_IMAGE_PATTERN.test(media.url),
    )?.url ??
    item.mediaUrls.find((url) => TRANSPARENT_PRODUCT_IMAGE_PATTERN.test(url));

  return (
    transparentProductImage ??
    getVisual(item) ??
    item.mediaItems?.find((media) => media.mediaType === 'IMAGE')?.url ??
    null
  );
}

function getDisplayItems(groupBuys: GroupBuy[]) {
  return groupBuys.length > 0 ? groupBuys : fallbackGroupBuys;
}

function formatDeadlineLabel(endDate: string | null) {
  if (!endDate) return '마감일 확인 중';

  const date = new Date(endDate);
  if (Number.isNaN(date.getTime())) return '마감일 확인 중';

  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return '마감';
  if (days === 0) return '오늘 마감';
  if (days === 1) return '내일 마감';
  if (days <= 7) return `${days}일 남음`;
  return `${date.getMonth() + 1}/${date.getDate()} 마감`;
}

function formatPromoDate(dateValue: string | null) {
  if (!dateValue) return '확인 중';

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '확인 중';

  return PROMO_DATE_FORMATTER.format(date)
    .replace(/\s/g, '')
    .replace(/\.$/, '');
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

function PromoProductMockup({
  s,
  testID,
}: {
  s: ReturnType<typeof makeStyles>;
  testID?: string;
}) {
  const packs = [
    { tone: '#D95E6A', label: 'REAL' },
    { tone: '#3484B9', label: 'FRESH' },
  ];

  return (
    <View
      accessibilityElementsHidden
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={s.promoMockupGrid}
      testID={testID}
    >
      {packs.map((pack, index) => (
        <View
          key={`${pack.label}-${index}`}
          style={[s.promoMockupPack, { backgroundColor: pack.tone }]}
        >
          <SText variant="caption" style={s.promoMockupText}>
            {pack.label}
          </SText>
          <View style={s.promoMockupLeaf} />
        </View>
      ))}
    </View>
  );
}

function PromoArtwork({
  clone,
  itemId,
  s,
  uri,
}: {
  clone: boolean;
  itemId: string;
  s: ReturnType<typeof makeStyles>;
  uri: string | null;
}) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <>
      {!isLoaded ? (
        <PromoProductMockup
          s={s}
          testID={clone ? undefined : `promo-artwork-placeholder-${itemId}`}
        />
      ) : null}
      {uri ? (
        <Image
          accessible={false}
          onError={() => setIsLoaded(false)}
          onLoad={() => setIsLoaded(true)}
          resizeMode="contain"
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

function PromoBanner({
  groupBuys,
  onPressDeal,
  s,
  cardWidth,
}: {
  groupBuys: GroupBuy[];
  onPressDeal: DealAction;
  s: ReturnType<typeof makeStyles>;
  cardWidth: number;
}) {
  const promoItems = useMemo(
    () => getDisplayItems(groupBuys).slice(0, 6),
    [groupBuys],
  );
  const scrollRef = useRef<ScrollView | null>(null);
  const currentPositionRef = useRef(promoItems.length > 1 ? 1 : 0);
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAutoPlayRef = useRef<() => void>(() => {});
  const snapInterval = cardWidth + PROMO_CARD_GAP;
  const canAutoPlay = promoItems.length > 1;
  const isCompact = cardWidth < 320;
  const visualWidth = Math.min(136, Math.max(96, Math.round(cardWidth * 0.36)));
  const visualHeight = Math.min(
    146,
    Math.max(112, Math.round(visualWidth * 1.08)),
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
      contentContainerStyle={s.promoRail}
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
        const startDateLabel = formatPromoDate(item.startDate);
        const endDateLabel = formatPromoDate(item.endDate);
        return (
          <Pressable
            accessibilityElementsHidden={clone}
            accessibilityLabel={
              clone
                ? undefined
                : `${item.productName ?? '공구'} 특가 배너, 시작일 ${startDateLabel}, 마감일 ${endDateLabel}, 열기`
            }
            accessibilityRole="button"
            importantForAccessibility={clone ? 'no-hide-descendants' : 'auto'}
            key={`${item.id}-${renderIndex}-${clone ? 'clone' : 'real'}`}
            onPress={() => onPressDeal(item)}
            style={[
              s.promoCard,
              isCompact && s.promoCardCompact,
              { width: cardWidth },
            ]}
          >
            <View style={[s.promoMain, isCompact && s.promoMainCompact]}>
              <View style={s.promoCopy}>
                <SText variant="label" numberOfLines={1} style={s.promoLead}>
                  {index === 0 ? '1,500명 선착순' : '오늘의 공구 특가'}
                </SText>
                <SText
                  variant="cardTitle"
                  numberOfLines={2}
                  style={s.promoTitle}
                >
                  {item.productName ?? '공동구매 상품'}
                </SText>
                <SText
                  variant="cardTitle"
                  numberOfLines={1}
                  style={s.promoPrice}
                >
                  {item.discountInfo ?? '혜택 확인'}
                </SText>
                <SText
                  variant="body"
                  numberOfLines={2}
                  style={s.promoDescription}
                >
                  {item.brandName ??
                    `@${item.rawPost.influencer.instagramUsername}`}
                </SText>
              </View>
              <View
                style={[
                  s.promoVisual,
                  { height: visualHeight, width: visualWidth },
                ]}
                testID={clone ? undefined : `promo-visual-${item.id}`}
              >
                <PromoArtwork
                  clone={clone}
                  itemId={item.id}
                  key={`${item.id}:${visual ?? 'placeholder'}`}
                  s={s}
                  uri={visual}
                />
                <View
                  pointerEvents="none"
                  style={s.promoCounter}
                  testID={clone ? undefined : `promo-counter-${item.id}`}
                >
                  <SText variant="caption" style={s.promoCounterText}>
                    {index + 1} | {promoItems.length}
                  </SText>
                </View>
              </View>
            </View>
            <View
              style={s.promoDateRow}
              testID={clone ? undefined : `promo-date-row-${item.id}`}
            >
              <SText
                variant="caption"
                numberOfLines={1}
                style={s.promoDateText}
                testID={clone ? undefined : 'promo-start-date'}
              >
                시작일 {startDateLabel}
              </SText>
              <View style={s.promoDateDivider} />
              <SText
                variant="caption"
                numberOfLines={1}
                style={s.promoDateText}
                testID={clone ? undefined : 'promo-end-date'}
              >
                마감일 {endDateLabel}
              </SText>
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
  const weeklyItems = useMemo(() => getDisplayItems(groupBuys), [groupBuys]);

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
          {dayItems.map((item) => {
            const visual = getVisual(item);
            const days = getDaysRemaining(item.endDate);
            const categoryToken = categoryColors[item.category ?? 'beauty'];
            return (
              <Pressable
                accessibilityLabel={`${item.productName ?? '공구'} 상세 보기`}
                accessibilityRole="button"
                key={item.id}
                onPress={() => onPressDeal(item)}
                style={({ pressed }) => [
                  s.weeklyCard,
                  pressed && s.weeklyCardPressed,
                ]}
              >
                <View style={s.weeklyImageWrap}>
                  {visual ? (
                    <Image source={{ uri: visual }} style={s.weeklyImage} />
                  ) : (
                    <View
                      style={[
                        s.weeklyFallback,
                        { backgroundColor: categoryToken.bg },
                      ]}
                    >
                      <SText
                        variant="cardTitle"
                        style={[
                          s.weeklyFallbackText,
                          { color: categoryToken.text },
                        ]}
                      >
                        {(item.brandName ?? item.productName ?? '공구').slice(
                          0,
                          2,
                        )}
                      </SText>
                    </View>
                  )}
                  <View style={s.weeklyDeadlineBadge}>
                    <SText variant="caption" style={s.weeklyDeadlineText}>
                      {days === 0 ? '오늘 마감' : `${days}일 남음`}
                    </SText>
                  </View>
                </View>
                <SText variant="body" numberOfLines={1} style={s.weeklyBrand}>
                  {item.brandName ??
                    `@${item.rawPost.influencer.instagramUsername}`}
                </SText>
                <SText
                  variant="caption"
                  numberOfLines={2}
                  style={s.weeklyTitle}
                >
                  {item.productName ?? '공동구매 상품'}
                </SText>
              </Pressable>
            );
          })}
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
  const products = getDisplayItems(groupBuys).slice(0, 8);

  return (
    <View style={s.recommendSection}>
      <View style={s.sectionTitleRow}>
        <SText variant="cardTitle" style={s.sectionTitle}>
          장수영님을 위한 추천 상품
        </SText>
      </View>
      {products.length > 0 ? (
        <View style={s.productGrid}>
          {products.map((item, index) => (
            <RecommendedProductCard
              item={item}
              key={item.id}
              label={index % 2 === 0 ? '역대급특가' : '25% 특가'}
              onPress={() => onPressDeal(item)}
              s={s}
            />
          ))}
        </View>
      ) : (
        <View style={s.productEmpty}>
          <SText variant="body" style={s.productEmptyText}>
            추천 상품을 준비 중입니다
          </SText>
        </View>
      )}
    </View>
  );
}

function RecommendedProductCard({
  item,
  label,
  onPress,
  s,
}: {
  item: GroupBuy;
  label: string;
  onPress: HomeAction;
  s: ReturnType<typeof makeStyles>;
}) {
  const visual = getVisual(item);
  const categoryToken = categoryColors[item.category ?? 'beauty'];

  return (
    <Pressable
      accessibilityLabel={`${item.productName ?? '공구'} 상세 보기`}
      accessibilityRole="button"
      onPress={onPress}
      style={s.productCard}
    >
      <View style={s.productImageWrap}>
        {visual ? (
          <Image source={{ uri: visual }} style={s.productImage} />
        ) : (
          <View
            style={[s.productFallback, { backgroundColor: categoryToken.bg }]}
          >
            <SText
              variant="cardTitle"
              style={[s.productFallbackText, { color: categoryToken.text }]}
            >
              {(item.brandName ?? item.productName ?? '공구').slice(0, 2)}
            </SText>
          </View>
        )}
        <View style={s.productBadge}>
          <SText variant="label" style={s.productBadgeText}>
            {label}
          </SText>
        </View>
      </View>
      <SText variant="subtitle" numberOfLines={2} style={s.productTitle}>
        {item.productName ?? '공동구매 상품'}
      </SText>
      <SText variant="caption" numberOfLines={1} style={s.productMeta}>
        {item.brandName ?? `@${item.rawPost.influencer.instagramUsername}`}
      </SText>
      <SText variant="cardBrand" numberOfLines={1} style={s.productDeal}>
        {item.discountInfo ?? formatDeadlineLabel(item.endDate)}
      </SText>
    </Pressable>
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
  const promoCardWidth = Math.max(0, width - HOME_SIDE_PADDING * 2);
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
          contentContainerStyle={s.listContent}
        >
          <View style={s.content}>
            <HomeTopBar colors={colors} onOpenSearch={onOpenSearch} s={s} />
            <ShoppingHomeHeading s={s} />
            <PromoBanner
              cardWidth={promoCardWidth}
              groupBuys={groupBuys}
              onPressDeal={onPressDeal}
              s={s}
            />
            <WeeklyGroupBuysSection
              groupBuys={groupBuys}
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
            <RecommendedProducts
              groupBuys={groupBuys}
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
      paddingHorizontal: HOME_SIDE_PADDING,
      paddingTop: 4,
      paddingBottom: 30,
    },
    promoCard: {
      backgroundColor: colors.promoBg,
      borderRadius: 24,
      borderCurve: 'continuous',
      minHeight: 240,
      overflow: 'hidden',
      paddingBottom: 16,
      paddingHorizontal: 20,
      paddingTop: 18,
      position: 'relative',
    },
    promoCardCompact: {
      paddingHorizontal: 16,
    },
    promoMain: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      minHeight: 146,
    },
    promoMainCompact: {
      gap: 8,
    },
    promoCopy: { flex: 1, minWidth: 0 },
    promoLead: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: 19,
      marginBottom: 6,
    },
    promoTitle: {
      color: colors.promoText,
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: 26,
    },
    promoPrice: {
      color: colors.promoText,
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: 28,
      marginTop: 2,
    },
    promoDescription: {
      color: colors.promoMuted,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0,
      lineHeight: 18,
      marginTop: 8,
    },
    promoVisual: {
      alignSelf: 'center',
      backgroundColor: colors.inverse,
      borderCurve: 'continuous',
      borderRadius: 18,
      justifyContent: 'center',
      overflow: 'hidden',
      padding: 6,
      position: 'relative',
    },
    promoDateRow: {
      alignItems: 'center',
      borderTopColor: colors.borderLight,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
      minHeight: 32,
      paddingTop: 10,
    },
    promoDateText: {
      color: colors.promoMuted,
      flexShrink: 1,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0,
      lineHeight: 16,
    },
    promoDateDivider: { backgroundColor: colors.border, height: 12, width: 1 },
    promoImage: { height: '100%', width: '100%' },
    promoImagePending: { opacity: 0, position: 'absolute' },
    promoMockupGrid: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      height: '100%',
      justifyContent: 'center',
      paddingBottom: 24,
      paddingHorizontal: 6,
      paddingTop: 4,
      width: '100%',
    },
    promoMockupPack: {
      alignItems: 'center',
      borderColor: 'rgba(17, 24, 39, 0.08)',
      borderRadius: 4,
      borderWidth: 1,
      height: 72,
      justifyContent: 'center',
      width: 44,
    },
    promoMockupText: {
      color: '#FFFFFF',
      fontSize: 6,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: 9,
    },
    promoMockupLeaf: {
      backgroundColor: 'rgba(56, 161, 105, 0.45)',
      borderRadius: 999,
      height: 10,
      marginTop: 4,
      width: 10,
    },
    promoCounter: {
      alignItems: 'center',
      backgroundColor: colors.overlay,
      borderRadius: borderRadius.full,
      bottom: 8,
      justifyContent: 'center',
      minHeight: 26,
      minWidth: 42,
      paddingHorizontal: 8,
      position: 'absolute',
      right: 8,
    },
    promoCounterText: {
      color: colors.inverse,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0,
      lineHeight: 18,
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
    weeklyCardPressed: { opacity: 0.8 },
    weeklyImageWrap: {
      backgroundColor: colors.softBg,
      borderRadius: borderRadius.lg,
      height: 148,
      marginBottom: 8,
      overflow: 'hidden',
      position: 'relative',
      width: 148,
    },
    weeklyImage: { height: '100%', resizeMode: 'cover', width: '100%' },
    weeklyFallback: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    weeklyFallbackText: { fontSize: 22, fontWeight: '900' },
    weeklyDeadlineBadge: {
      backgroundColor: colors.overlay,
      borderBottomLeftRadius: borderRadius.lg,
      borderBottomRightRadius: borderRadius.lg,
      bottom: 0,
      left: 0,
      paddingHorizontal: 8,
      paddingVertical: 4,
      position: 'absolute',
      right: 0,
    },
    weeklyDeadlineText: {
      color: colors.inverse,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: 15,
    },
    weeklyBrand: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0,
      lineHeight: 18,
      marginBottom: 2,
    },
    weeklyTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 0,
      lineHeight: 19,
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
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 18,
    },
    productCard: {
      minHeight: 206,
      width: '48.4%',
    },
    productImageWrap: {
      aspectRatio: 1,
      backgroundColor: colors.panelBg,
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative',
      width: '100%',
    },
    productImage: { height: '100%', resizeMode: 'cover', width: '100%' },
    productFallback: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    productFallbackText: { fontSize: 18, fontWeight: '900' },
    productBadge: {
      backgroundColor: colors.accent,
      borderRadius: 6,
      left: 7,
      paddingHorizontal: 7,
      paddingVertical: 4,
      position: 'absolute',
      top: 7,
    },
    productBadgeText: {
      color: colors.inverse,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: 16,
    },
    productTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0,
      lineHeight: 18,
      marginTop: 8,
    },
    productMeta: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0,
      lineHeight: 15,
      marginTop: 2,
    },
    productDeal: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: 16,
      marginTop: 2,
    },
    productEmpty: {
      alignItems: 'center',
      backgroundColor: colors.panelBg,
      borderRadius: borderRadius.lg,
      justifyContent: 'center',
      minHeight: 140,
    },
    productEmptyText: { color: colors.muted, fontSize: 15, fontWeight: '700' },
    notice: {
      backgroundColor: colors.warningSoft,
      borderRadius: borderRadius.md,
      marginBottom: spacing.md,
      padding: spacing.md,
    },
    noticeText: { color: colors.warning, fontSize: 12, textAlign: 'center' },
  });
}

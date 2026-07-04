import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  onOpenBookmarks: HomeAction;
  onOpenNotifications: HomeAction;
  onOpenSearch: HomeAction;
  onOpenCalendar: HomeAction;
  onPressDeal: DealAction;
};

const SHOP_TABS = ['쇼핑 홈', '카테고리', '특가', '핫딜템', '쿠팡템', '여름생존템'] as const;
type ShopTab = typeof SHOP_TABS[number];
const HOME_SIDE_PADDING = 16;
const PROMO_CARD_GAP = 12;
const PROMO_AUTO_PLAY_MS = 3000;
const PROMO_WRAP_SETTLE_MS = 450;

function getVisual(item: GroupBuy) {
  return item.thumbnailUrl ?? item.mediaItems?.find((media) => media.thumbnailUrl)?.thumbnailUrl ?? item.mediaUrls?.[0] ?? null;
}

function getDisplayItems(groupBuys: GroupBuy[]) {
  return groupBuys.length > 0 ? groupBuys : fallbackGroupBuys;
}

function getRecommendedItems(groupBuys: GroupBuy[], selectedTab: ShopTab) {
  const items = getDisplayItems(groupBuys);
  const filtered = items.filter((item) => {
    const productName = item.productName ?? '';
    const discountInfo = item.discountInfo ?? '';
    const category = item.category ?? '';

    switch (selectedTab) {
      case '쇼핑 홈':
      case '카테고리':
        return true;
      case '특가':
        return /특가|할인|sale/i.test(discountInfo) || productName.includes('특가');
      case '핫딜템':
        return /핫딜|hot/i.test(productName) || /특가|할인|sale/i.test(discountInfo);
      case '쿠팡템':
        return /쿠팡|coupang/i.test(productName) || /로켓|배송/i.test(discountInfo);
      case '여름생존템':
        return /여름|선크림|쿨|마스크팩|양산|샌들/.test(productName) || category === 'beauty' || category === 'fashion';
    }
  });

  return filtered.length > 0 ? filtered : items;
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

function ProfileGlyph({ color }: { color: string }) {
  return (
    <View style={glyphStyles.profileFrame}>
      <View style={[glyphStyles.profileHead, { borderColor: color }]} />
      <View style={[glyphStyles.profileBody, { borderColor: color }]} />
    </View>
  );
}

function BagGlyph({ color }: { color: string }) {
  return (
    <View style={glyphStyles.bagFrame}>
      <View style={[glyphStyles.bagHandle, { borderColor: color }]} />
      <View style={[glyphStyles.bagBody, { borderColor: color }]} />
    </View>
  );
}

function HomeTopBar({
  onOpenBookmarks,
  onOpenNotifications,
  onOpenSearch,
  s,
  colors,
}: {
  onOpenBookmarks: HomeAction;
  onOpenNotifications: HomeAction;
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
      <Pressable
        accessibilityLabel="알림 열기"
        accessibilityRole="button"
        onPress={onOpenNotifications}
        style={s.headerIconButton}
      >
        <ProfileGlyph color={colors.text} />
      </Pressable>
      <Pressable
        accessibilityLabel="북마크 열기"
        accessibilityRole="button"
        onPress={onOpenBookmarks}
        style={s.headerIconButton}
      >
        <BagGlyph color={colors.text} />
      </Pressable>
    </View>
  );
}

function PromoProductMockup({ s }: { s: ReturnType<typeof makeStyles> }) {
  const packs = [
    { tone: '#D95E6A', label: 'REAL' },
    { tone: '#3484B9', label: 'FRESH' },
    { tone: '#E9F7EA', label: 'ALOE' },
    { tone: '#F4FAF3', label: 'HERB' },
    { tone: '#EAF7EC', label: 'TEA' },
  ];

  return (
    <View style={s.promoMockupGrid}>
      {packs.map((pack, index) => (
        <View key={`${pack.label}-${index}`} style={[s.promoMockupPack, { backgroundColor: pack.tone }]}>
          <SText variant="caption" style={[s.promoMockupText, index >= 2 && s.promoMockupTextDark]}>
            {pack.label}
          </SText>
          <View style={s.promoMockupLeaf} />
        </View>
      ))}
    </View>
  );
}


function ShopTabRow({
  selectedTab,
  onSelectTab,
  s,
}: {
  selectedTab: ShopTab;
  onSelectTab: Dispatch<ShopTab>;
  s: ReturnType<typeof makeStyles>;
}) {
  const scrollRef = useRef<ScrollView | null>(null);
  const tabLayoutsRef = useRef<Record<string, { x: number; width: number }>>({});
  const screenWidth = useWindowDimensions().width;

  // Scroll the selected tab into view whenever it changes.
  useEffect(() => {
    const layout = tabLayoutsRef.current[selectedTab];
    if (!layout || !scrollRef.current) return;
    // Center the selected tab so left and right navigation both feel natural.
    const targetX = Math.max(0, layout.x + layout.width / 2 - screenWidth / 2);
    scrollRef.current.scrollTo({ x: targetX, animated: true });
  }, [selectedTab]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.shopTabs}
    >
      {SHOP_TABS.map((tab) => {
        const selected = tab === selectedTab;
        return (
          <Pressable
            accessibilityLabel={`${tab} 탭`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={tab}
            onPress={() => onSelectTab(tab)}
            onLayout={(e) => {
              tabLayoutsRef.current[tab] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
            }}
            style={[s.shopTab, selected && s.shopTabSelected]}
          >
            <SText variant="label" style={[s.shopTabText, selected && s.shopTabTextSelected]}>
              {tab}
            </SText>
          </Pressable>
        );
      })}
    </ScrollView>
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
  const promoItems = useMemo(() => getDisplayItems(groupBuys).slice(0, 6), [groupBuys]);
  const scrollRef = useRef<ScrollView | null>(null);
  const currentPositionRef = useRef(promoItems.length > 1 ? 1 : 0);
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAutoPlayRef = useRef<() => void>(() => {});
  const snapInterval = cardWidth + PROMO_CARD_GAP;
  const canAutoPlay = promoItems.length > 1;
  const loopingPromoItems = useMemo(() => {
    if (promoItems.length <= 1) return promoItems.map((item, index) => ({ item, index, clone: false }));

    return [
      { item: promoItems[promoItems.length - 1], index: promoItems.length - 1, clone: true },
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

  const scrollToPosition = useCallback((position: number, animated: boolean) => {
    scrollRef.current?.scrollTo({ x: position * snapInterval, animated });
  }, [snapInterval]);

  const normalizePosition = useCallback((position: number) => {
    if (!canAutoPlay) return 0;
    if (position <= 0) return promoItems.length;
    if (position >= promoItems.length + 1) return 1;
    return position;
  }, [canAutoPlay, promoItems.length]);

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
  }, [canAutoPlay, clearAutoPlayTimer, clearWrapSettleTimer, normalizePosition, scrollToPosition]);

  scheduleAutoPlayRef.current = scheduleAutoPlay;

  const handleScrollBeginDrag = useCallback(() => {
    clearAutoPlayTimer();
    clearWrapSettleTimer();
  }, [clearAutoPlayTimer, clearWrapSettleTimer]);

  const handleScrollEndDrag = useCallback(() => {
    scheduleAutoPlay();
  }, [scheduleAutoPlay]);

  const handleMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    clearWrapSettleTimer();

    const settledPosition = Math.round(event.nativeEvent.contentOffset.x / snapInterval);
    const normalizedPosition = normalizePosition(settledPosition);
    currentPositionRef.current = normalizedPosition;

    if (canAutoPlay && normalizedPosition !== settledPosition) {
      scrollToPosition(normalizedPosition, false);
    }

    scheduleAutoPlay();
  }, [canAutoPlay, clearWrapSettleTimer, normalizePosition, scheduleAutoPlay, scrollToPosition, snapInterval]);

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
  }, [canAutoPlay, clearAutoPlayTimer, clearWrapSettleTimer, promoItems.length, scheduleAutoPlay, scrollToPosition]);

  if (promoItems.length === 0) {
    return (
      <View style={s.promoEmpty}>
        <SText variant="body" style={s.promoEmptyText}>오늘의 특가를 준비 중입니다</SText>
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
        const visual = getVisual(item);
        return (
          <Pressable
            accessibilityElementsHidden={clone}
            accessibilityLabel={clone ? undefined : `${item.productName ?? '공구'} 특가 배너 열기`}
            accessibilityRole="button"
            importantForAccessibility={clone ? 'no-hide-descendants' : 'auto'}
            key={`${item.id}-${renderIndex}-${clone ? 'clone' : 'real'}`}
            onPress={() => onPressDeal(item)}
            style={[s.promoCard, { width: cardWidth }]}
          >
            <View style={s.promoCopy}>
              <SText variant="label" numberOfLines={1} style={s.promoLead}>
                {index === 0 ? '1,500명 선착순' : '오늘의 공구 특가'}
              </SText>
              <SText variant="cardTitle" numberOfLines={2} style={s.promoTitle}>
                {item.productName ?? '공동구매 상품'}
              </SText>
              <SText variant="cardTitle" numberOfLines={1} style={s.promoPrice}>
                {item.discountInfo ?? '혜택 확인'}
              </SText>
              <SText variant="body" numberOfLines={2} style={s.promoDescription}>
                {item.brandName ?? `@${item.rawPost.influencer.instagramUsername}`}
              </SText>
              <SText variant="caption" numberOfLines={1} style={s.promoLimit}>
                *{formatDeadlineLabel(item.endDate)}
              </SText>
            </View>
            <View style={s.promoVisual}>
              {visual ? (
                <Image source={{ uri: visual }} style={s.promoImage} />
              ) : (
                <PromoProductMockup s={s} />
              )}
            </View>
            <View style={s.promoCounter}>
              <SText variant="caption" style={s.promoCounterText}>{index + 1} | {promoItems.length}</SText>
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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const weeklyItems = useMemo(() => {
    const items = getDisplayItems(groupBuys);
    return items
      .filter((item) => {
        const days = getDaysRemaining(item.endDate);
        return days >= 0 && days <= 7;
      })
      .sort((a, b) => getDaysRemaining(a.endDate) - getDaysRemaining(b.endDate));
  }, [groupBuys]);

  // Show items whose deadline falls on the selected day, or all weekly items
  // when no specific day is picked yet.
  const dayItems = useMemo(() => {
    if (!selectedDate) return weeklyItems;
    // Match the CalendarScreen logic: a deal shows on a day when its
    // start-end range overlaps that day, not only on its deadline.
    return weeklyItems.filter((item) => isGroupBuyActiveOnDate(item, selectedDate));
  }, [weeklyItems, selectedDate]);

  return (
    <View style={s.weeklySection}>
      <WeeklyCalendarStrip
        onPressCalendar={onOpenCalendar}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />
      {dayItems.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.weeklyList}>
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
                style={({ pressed }) => [s.weeklyCard, pressed && s.weeklyCardPressed]}
              >
                <View style={s.weeklyImageWrap}>
                  {visual ? (
                    <Image source={{ uri: visual }} style={s.weeklyImage} />
                  ) : (
                    <View style={[s.weeklyFallback, { backgroundColor: categoryToken.bg }]}>
                      <SText variant="cardTitle" style={[s.weeklyFallbackText, { color: categoryToken.text }]}>
                        {(item.brandName ?? item.productName ?? '공구').slice(0, 2)}
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
                  {item.brandName ?? `@${item.rawPost.influencer.instagramUsername}`}
                </SText>
                <SText variant="caption" numberOfLines={2} style={s.weeklyTitle}>
                  {item.productName ?? '공동구매 상품'}
                </SText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <View style={s.weeklyEmpty}>
          <SText variant="body" style={s.weeklyEmptyText}>선택한 날짜에 공구가 없습니다</SText>
        </View>
      )}
    </View>
  );
}

function RecommendedProducts({
  groupBuys,
  selectedTab,
  onPressDeal,
  s,
}: {
  groupBuys: GroupBuy[];
  selectedTab: ShopTab;
  onPressDeal: DealAction;
  s: ReturnType<typeof makeStyles>;
}) {
  const products = getRecommendedItems(groupBuys, selectedTab).slice(0, 8);

  return (
    <View style={s.recommendSection}>
      <View style={s.sectionTitleRow}>
        <SText variant="cardTitle" style={s.sectionTitle}>장수영님을 위한 추천 상품</SText>
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
          <SText variant="body" style={s.productEmptyText}>추천 상품을 준비 중입니다</SText>
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
          <View style={[s.productFallback, { backgroundColor: categoryToken.bg }]}>
            <SText variant="cardTitle" style={[s.productFallbackText, { color: categoryToken.text }]}>
              {(item.brandName ?? item.productName ?? '공구').slice(0, 2)}
            </SText>
          </View>
        )}
        <View style={s.productBadge}>
          <SText variant="label" style={s.productBadgeText}>{label}</SText>
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
  onOpenBookmarks,
  onOpenNotifications,
  onOpenSearch,
  onOpenCalendar,
  onPressDeal,
}: HomeScreenContentProps) {
  const { colors, isDark } = useCommerceTheme();
  const { width } = useWindowDimensions();
  const [selectedTab, setSelectedTab] = useState<ShopTab>('쇼핑 홈');
  const promoCardWidth = Math.max(300, width - HOME_SIDE_PADDING * 2);
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={s.container}>
        <KeyboardFormScreen
          keyboardShouldPersistTaps="always"
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor={colors.accent} />}
          contentContainerStyle={s.listContent}
        >
          <View style={s.content}>
            <HomeTopBar
              colors={colors}
              onOpenBookmarks={onOpenBookmarks}
              onOpenNotifications={onOpenNotifications}
              onOpenSearch={onOpenSearch}
              s={s}
            />
            <ShopTabRow selectedTab={selectedTab} onSelectTab={setSelectedTab} s={s} />
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
                <SText variant="caption" style={s.noticeText}>네트워크 연결 상태를 확인해주세요. (샘플 데이터를 표시 중입니다)</SText>
              </View>
            ) : null}
            {isFetching && groupBuys.length === 0 ? <ActivityIndicator color={colors.accent} /> : null}
            <RecommendedProducts groupBuys={groupBuys} selectedTab={selectedTab} onPressDeal={onPressDeal} s={s} />
          </View>
        </KeyboardFormScreen>
      </View>
    </SafeAreaView>
  );
}

export function HomeScreen({ navigation }: HomeScreenProps) {
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ['group-buys'],
    queryFn: fetchGroupBuys,
    retry: false,
  });

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
      isFetching={isFetching}
      onRefresh={refetch}
      onOpenBookmarks={() => Alert.alert('준비 중', '북마크 기능은 준비 중입니다.\n곧 업데이트될 예정입니다.')}
      onOpenNotifications={() => Alert.alert('준비 중', '알림 기능은 준비 중입니다.\n곧 업데이트될 예정입니다.')}
      onOpenSearch={() => navigation.navigate('SearchScreen')}
      onOpenCalendar={() => navigation.navigate('CalendarScreen', { initialDate: new Date().toISOString() })}
      onPressDeal={(groupBuy) => navigation.navigate('Detail', { groupBuy })}
    />
  );
}

const glyphStyles = StyleSheet.create({
  profileFrame: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    position: 'relative',
    width: 28,
  },
  profileHead: {
    borderRadius: 999,
    borderWidth: 2.2,
    height: 10,
    position: 'absolute',
    top: 3,
    width: 10,
  },
  profileBody: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 2.2,
    bottom: 2,
    height: 13,
    position: 'absolute',
    width: 22,
  },
  bagFrame: {
    height: 28,
    position: 'relative',
    width: 28,
  },
  bagHandle: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderWidth: 2.1,
    borderBottomWidth: 0,
    height: 10,
    left: 8,
    position: 'absolute',
    top: 2,
    width: 12,
  },
  bagBody: {
    borderRadius: 5,
    borderWidth: 2.1,
    bottom: 2,
    height: 19,
    left: 4,
    position: 'absolute',
    width: 20,
  },
});

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
      gap: 11,
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
    searchPlaceholder: { color: colors.weak, flex: 1, fontSize: 16, fontWeight: '700', letterSpacing: 0, lineHeight: 21 },
    headerIconButton: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      minWidth: 42,
    },
    shopTabs: {
      gap: 20,
      paddingHorizontal: HOME_SIDE_PADDING,
      paddingTop: 8,
      paddingBottom: 11,
    },
    shopTab: {
      alignItems: 'center',
      borderRadius: 12,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 8,
    },
    shopTabSelected: {
      backgroundColor: colors.softBg,
    },
    shopTabText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: 21,
    },
    shopTabTextSelected: {
      color: colors.text,
    },
    promoRail: {
      gap: 12,
      paddingHorizontal: HOME_SIDE_PADDING,
      paddingTop: 4,
      paddingBottom: 30,
    },
    promoCard: {
      backgroundColor: colors.promoBg,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      flexDirection: 'row',
      minHeight: 238,
      overflow: 'hidden',
      paddingBottom: 22,
      paddingHorizontal: 24,
      paddingTop: 28,
      position: 'relative',
    },
    promoCopy: { flex: 1, paddingRight: 8 },
    promoLead: { color: colors.accent, fontSize: 14, fontWeight: '900', letterSpacing: 0, lineHeight: 19, marginBottom: 8 },
    promoTitle: { color: colors.promoText, fontSize: 22, fontWeight: '900', letterSpacing: 0, lineHeight: 29 },
    promoPrice: { color: colors.promoText, fontSize: 24, fontWeight: '900', letterSpacing: 0, lineHeight: 31, marginTop: 0 },
    promoDescription: { color: colors.promoMuted, fontSize: 14, fontWeight: '800', letterSpacing: 0, lineHeight: 21, marginTop: 11 },
    promoLimit: { bottom: 24, color: colors.promoMuted, fontSize: 12, fontWeight: '800', letterSpacing: 0, lineHeight: 16, position: 'absolute' },
    promoVisual: {
      alignSelf: 'center',
      borderRadius: 14,
      height: 160,
      overflow: 'hidden',
      width: 150,
    },
    promoImage: { height: '100%', resizeMode: 'cover', width: '100%' },
    promoMockupGrid: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      height: '100%',
      justifyContent: 'center',
      padding: 2,
      width: '100%',
    },
    promoMockupPack: {
      alignItems: 'center',
      borderColor: 'rgba(17, 24, 39, 0.08)',
      borderRadius: 4,
      borderWidth: 1,
      height: 62,
      justifyContent: 'center',
      width: 44,
    },
    promoMockupText: { color: '#FFFFFF', fontSize: 6, fontWeight: '900', letterSpacing: 0, lineHeight: 9 },
    promoMockupTextDark: { color: '#2F5F3A' },
    promoMockupLeaf: {
      backgroundColor: 'rgba(56, 161, 105, 0.45)',
      borderRadius: 999,
      height: 10,
      marginTop: 4,
      width: 10,
    },
    promoCounter: {
      alignItems: 'center',
      backgroundColor: 'rgba(96, 107, 122, 0.72)',
      borderRadius: borderRadius.full,
      bottom: 12,
      justifyContent: 'center',
      minHeight: 30,
      minWidth: 48,
      paddingHorizontal: 9,
      position: 'absolute',
      right: 12,
    },
    promoCounterText: { color: colors.inverse, fontSize: 13, fontWeight: '800', letterSpacing: 0, lineHeight: 18 },
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
    sectionTitle: { color: colors.text, flexShrink: 1, fontSize: 20, fontWeight: '900', letterSpacing: 0, lineHeight: 27 },
    weeklySection: {
      marginBottom: 36,
      paddingHorizontal: HOME_SIDE_PADDING,
    },
    seeAllButton: {
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    seeAllText: { color: colors.muted, fontSize: 13, fontWeight: '800', letterSpacing: 0, lineHeight: 18 },
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
    weeklyDeadlineText: { color: colors.inverse, fontSize: 11, fontWeight: '900', letterSpacing: 0, lineHeight: 15 },
    weeklyBrand: { color: colors.muted, fontSize: 13, fontWeight: '700', letterSpacing: 0, lineHeight: 18, marginBottom: 2 },
    weeklyTitle: { color: colors.text, fontSize: 14, fontWeight: '800', letterSpacing: 0, lineHeight: 19 },
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
    attendanceArtText: { color: '#4A9AF5', fontSize: 20, fontWeight: '900', lineHeight: 24, marginBottom: 0 },
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
    feedLineLong: { backgroundColor: '#1D6D68', borderRadius: 999, height: 4, marginBottom: 6, width: 14 },
    feedLineShort: { backgroundColor: '#1D6D68', borderRadius: 999, height: 4, opacity: 0.72, width: 10 },
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
    catEye: { backgroundColor: '#111827', borderRadius: 999, height: 3, width: 3 },
    catMouth: { backgroundColor: '#F3A6AD', borderRadius: 999, height: 5, width: 9 },
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
    lookBagBody: { backgroundColor: '#FB7185', borderRadius: 6, height: 22, left: 7, position: 'absolute', top: 12, width: 24 },
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
    drawCoinText: { color: '#B9770E', fontSize: 12, fontWeight: '900', lineHeight: 15 },
    benefitMiniBadge: {
      backgroundColor: colors.blue,
      borderRadius: borderRadius.full,
      paddingHorizontal: 6,
      paddingVertical: 2,
      position: 'absolute',
      right: -8,
      top: -7,
    },
    benefitMiniBadgeText: { color: colors.inverse, fontSize: 10, fontWeight: '900', letterSpacing: 0, lineHeight: 13 },
    benefitLabel: { color: colors.muted, fontSize: 13, fontWeight: '800', letterSpacing: 0, lineHeight: 18, maxWidth: 64, textAlign: 'center' },
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
    productBadgeText: { color: colors.inverse, fontSize: 12, fontWeight: '900', letterSpacing: 0, lineHeight: 16 },
    productTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0,
      lineHeight: 18,
      marginTop: 8,
    },
    productMeta: { color: colors.muted, fontSize: 11, fontWeight: '600', letterSpacing: 0, lineHeight: 15, marginTop: 2 },
    productDeal: { color: colors.accent, fontSize: 12, fontWeight: '900', letterSpacing: 0, lineHeight: 16, marginTop: 2 },
    productEmpty: {
      alignItems: 'center',
      backgroundColor: colors.panelBg,
      borderRadius: borderRadius.lg,
      justifyContent: 'center',
      minHeight: 140,
    },
    productEmptyText: { color: colors.muted, fontSize: 15, fontWeight: '700' },
    notice: { backgroundColor: colors.warningSoft, borderRadius: borderRadius.md, marginBottom: spacing.md, padding: spacing.md },
    noticeText: { color: colors.warning, fontSize: 12, textAlign: 'center' },
  });
}

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
import { fallbackGroupBuys, fetchGroupBuys } from '../api';
import { KeyboardFormScreen } from '../components/keyboard/KeyboardFormScreen';
import { borderRadius, categoryColors, spacing } from '../design/tokens';
import { useTheme } from '../context/ThemeContext';
import type { GroupBuy, HomeScreenProps } from '../types';
import type { ColorPalette } from '../context/ThemeContext';

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
  onPressDeal: DealAction;
  onPressSubmit: HomeAction;
};

const SHOP_TABS = ['쇼핑 홈', '카테고리', '종근당건강', '특가', '여름생존템'] as const;
type ShopTab = typeof SHOP_TABS[number];
const HOME_TEXT = '#111827';
const HOME_MUTED_TEXT = '#6B7280';
const HOME_WEAK_TEXT = '#9CA3AF';
const HOME_CANVAS_BG = '#FFFFFF';
const HOME_SURFACE = '#FFFFFF';
const HOME_SOFT_BG = '#F3F5F8';
const HOME_PANEL_BG = '#F8FAFC';
const HOME_STROKE = '#E5E7EB';
const HOME_ACCENT = '#F0445E';
const HOME_SIDE_PADDING = 16;
const PROMO_CARD_GAP = 12;
const PROMO_AUTO_PLAY_MS = 3000;
const PROMO_WRAP_SETTLE_MS = 450;

const BENEFIT_ACTIONS = [
  { label: '연속 출석', icon: '1', badge: null },
  { label: '스크롤하기', icon: '👆', badge: '60원' },
  { label: '포인트피드', icon: '▤', badge: null },
  { label: '고양이', icon: '🐱', badge: null },
  { label: '3초구경', icon: '⌕', badge: null },
  { label: '상품 뽑기', icon: '100', badge: null },
] as const;

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
    const brandName = item.brandName ?? '';
    const discountInfo = item.discountInfo ?? '';
    const category = item.category ?? '';

    switch (selectedTab) {
      case '쇼핑 홈':
      case '카테고리':
        return true;
      case '종근당건강':
        return brandName.includes('종근당') || productName.includes('건강') || category === 'lifestyle';
      case '특가':
        return /특가|할인|sale/i.test(discountInfo) || productName.includes('특가');
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
  colors: ColorPalette;
}) {
  return (
    <View style={s.topBar}>
      <Pressable
        accessibilityLabel="상품 검색"
        accessibilityRole="button"
        onPress={onOpenSearch}
        style={s.searchBox}
      >
        <SearchGlyph color={colors.textTertiary} size={20} />
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
        <ProfileGlyph color={colors.textPrimary} />
      </Pressable>
      <Pressable
        accessibilityLabel="북마크 열기"
        accessibilityRole="button"
        onPress={onOpenBookmarks}
        style={s.headerIconButton}
      >
        <BagGlyph color={colors.textPrimary} />
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
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.shopTabs}>
      {SHOP_TABS.map((tab) => {
        const selected = tab === selectedTab;
        return (
          <Pressable
            accessibilityLabel={`${tab} 탭`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={tab}
            onPress={() => onSelectTab(tab)}
            style={s.shopTab}
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

function BenefitGrid({
  onOpenSearch,
  onPressSubmit,
  s,
}: {
  onOpenSearch: HomeAction;
  onPressSubmit: HomeAction;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={s.benefitSection}>
      <View style={s.sectionTitleRow}>
        <SText variant="cardTitle" style={s.sectionTitle}>포인트 · 쿠폰 받기</SText>
        <View style={s.smallBlueBadge}>
          <SText variant="caption" style={s.smallBlueBadgeText}>최대 100원</SText>
        </View>
      </View>
      <View style={s.benefitGrid}>
        {BENEFIT_ACTIONS.map((action) => (
          <Pressable
            accessibilityLabel={`${action.label} 열기`}
            accessibilityRole="button"
            key={action.label}
            onPress={action.label === '상품 뽑기' ? onPressSubmit : onOpenSearch}
            style={s.benefitItem}
          >
            <View style={s.benefitIconBox}>
              {action.badge ? (
                <View style={s.benefitMiniBadge}>
                  <SText variant="caption" style={s.benefitMiniBadgeText}>{action.badge}</SText>
                </View>
              ) : null}
              <SText variant="cardTitle" style={s.benefitIconText}>{action.icon}</SText>
            </View>
            <SText variant="caption" numberOfLines={1} style={s.benefitLabel}>
              {action.label}
            </SText>
          </Pressable>
        ))}
      </View>
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
        <View style={s.recommendBadges}>
          <View style={s.outlineBadge}>
            <SText variant="caption" style={s.outlineBadgeText}>AI</SText>
          </View>
          <View style={s.outlineBadge}>
            <SText variant="caption" style={s.outlineBadgeText}>광고</SText>
          </View>
        </View>
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
        <View style={[s.productBadge, { backgroundColor: HOME_ACCENT }]}>
          <SText variant="label" style={s.productBadgeText}>{label}</SText>
        </View>
        {item.mediaType === 'VIDEO' ? (
          <View style={s.videoBadge}>
            <SText variant="caption" style={s.videoBadgeText}>영상</SText>
          </View>
        ) : null}
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
  onPressDeal,
  onPressSubmit,
}: HomeScreenContentProps) {
  const { colors, isDark } = useTheme();
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
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor={colors.primary} />}
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
            <BenefitGrid onOpenSearch={onOpenSearch} onPressSubmit={onPressSubmit} s={s} />
            {isError ? (
              <View style={s.notice}>
                <SText variant="caption" style={s.noticeText}>네트워크 연결 상태를 확인해주세요. (샘플 데이터를 표시 중입니다)</SText>
              </View>
            ) : null}
            {isFetching && groupBuys.length === 0 ? <ActivityIndicator color={colors.primary} /> : null}
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
      onPressDeal={(groupBuy) => navigation.navigate('Detail', { groupBuy })}
      onPressSubmit={() => navigation.navigate('Submit')}
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

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: HOME_CANVAS_BG },
    container: { flex: 1, backgroundColor: HOME_CANVAS_BG },
    content: {
      backgroundColor: HOME_CANVAS_BG,
      paddingBottom: 24,
      paddingHorizontal: 0,
      paddingTop: 4,
    },
    listContent: {
      paddingBottom: 122,
      paddingHorizontal: 0,
      paddingTop: 0,
    },
    topBar: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: HOME_SIDE_PADDING,
      paddingTop: 4,
    },
    searchBox: {
      alignItems: 'center',
      backgroundColor: HOME_SOFT_BG,
      borderRadius: 16,
      flex: 1,
      flexDirection: 'row',
      gap: 10,
      minHeight: 48,
      paddingHorizontal: 14,
    },
    searchPlaceholder: { color: HOME_WEAK_TEXT, flex: 1, fontSize: 15, fontWeight: '600', letterSpacing: 0, lineHeight: 20 },
    headerIconButton: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      minWidth: 42,
    },
    shopTabs: {
      gap: 20,
      paddingHorizontal: HOME_SIDE_PADDING,
      paddingTop: 10,
      paddingBottom: 8,
    },
    shopTab: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    shopTabText: {
      color: HOME_TEXT,
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 0,
      lineHeight: 21,
    },
    shopTabTextSelected: {
      backgroundColor: HOME_SOFT_BG,
      borderRadius: 10,
      overflow: 'hidden',
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    promoRail: {
      gap: 12,
      paddingHorizontal: HOME_SIDE_PADDING,
      paddingTop: 2,
      paddingBottom: 26,
    },
    promoCard: {
      backgroundColor: HOME_PANEL_BG,
      borderColor: HOME_STROKE,
      borderRadius: 24,
      borderWidth: 1,
      flexDirection: 'row',
      minHeight: 188,
      overflow: 'hidden',
      paddingBottom: 20,
      paddingHorizontal: 22,
      paddingTop: 24,
      position: 'relative',
    },
    promoCopy: { flex: 1, paddingRight: 8 },
    promoLead: { color: HOME_ACCENT, fontSize: 13, fontWeight: '800', letterSpacing: 0, lineHeight: 18, marginBottom: 6 },
    promoTitle: { color: HOME_TEXT, fontSize: 20, fontWeight: '900', letterSpacing: 0, lineHeight: 26 },
    promoPrice: { color: HOME_TEXT, fontSize: 22, fontWeight: '900', letterSpacing: 0, lineHeight: 28, marginTop: 0 },
    promoDescription: { color: HOME_MUTED_TEXT, fontSize: 13, fontWeight: '700', letterSpacing: 0, lineHeight: 20, marginTop: 9 },
    promoLimit: { bottom: 20, color: HOME_WEAK_TEXT, fontSize: 11, fontWeight: '800', letterSpacing: 0, lineHeight: 15, position: 'absolute' },
    promoVisual: {
      alignSelf: 'center',
      borderRadius: 12,
      height: 116,
      overflow: 'hidden',
      width: 116,
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
      height: 48,
      justifyContent: 'center',
      width: 34,
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
      bottom: 10,
      justifyContent: 'center',
      minHeight: 26,
      minWidth: 44,
      paddingHorizontal: 8,
      position: 'absolute',
      right: 10,
    },
    promoCounterText: { color: colors.textInverse, fontSize: 13, fontWeight: '800', letterSpacing: 0, lineHeight: 18 },
    promoEmpty: {
      alignItems: 'center',
      backgroundColor: colors.surfaceHover,
      borderRadius: borderRadius.xl,
      justifyContent: 'center',
      marginHorizontal: spacing.lg,
      minHeight: 160,
    },
    promoEmptyText: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
    benefitSection: {
      marginBottom: 34,
      paddingHorizontal: HOME_SIDE_PADDING,
    },
    sectionTitleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    sectionTitle: { color: HOME_TEXT, flexShrink: 1, fontSize: 18, fontWeight: '800', letterSpacing: 0, lineHeight: 25 },
    smallBlueBadge: {
      backgroundColor: '#EEF6FF',
      borderRadius: borderRadius.sm,
      marginLeft: spacing.sm,
      paddingHorizontal: 7,
      paddingVertical: 4,
    },
    smallBlueBadgeText: { color: '#267DD9', fontSize: 11, fontWeight: '900', letterSpacing: 0, lineHeight: 15 },
    benefitGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: 16,
    },
    benefitItem: {
      alignItems: 'center',
      minHeight: 74,
      width: '20%',
    },
    benefitIconBox: {
      alignItems: 'center',
      backgroundColor: HOME_SURFACE,
      borderColor: HOME_STROKE,
      borderRadius: 14,
      borderWidth: 1,
      height: 54,
      justifyContent: 'center',
      marginBottom: 7,
      position: 'relative',
      width: 54,
    },
    benefitIconText: { color: '#4A9AF5', fontSize: 16, fontWeight: '800', letterSpacing: 0, lineHeight: 21 },
    benefitMiniBadge: {
      backgroundColor: colors.textLink,
      borderRadius: borderRadius.full,
      paddingHorizontal: 6,
      paddingVertical: 2,
      position: 'absolute',
      right: -8,
      top: -7,
    },
    benefitMiniBadgeText: { color: colors.textInverse, fontSize: 10, fontWeight: '900', letterSpacing: 0, lineHeight: 13 },
    benefitLabel: { color: HOME_MUTED_TEXT, fontSize: 12, fontWeight: '700', letterSpacing: 0, lineHeight: 17, maxWidth: 64, textAlign: 'center' },
    recommendSection: {
      paddingHorizontal: HOME_SIDE_PADDING,
    },
    recommendBadges: {
      flexDirection: 'row',
      gap: 5,
      marginLeft: 8,
    },
    outlineBadge: {
      borderColor: HOME_STROKE,
      borderRadius: 7,
      borderWidth: 1,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    outlineBadgeText: { color: HOME_WEAK_TEXT, fontSize: 10, fontWeight: '800', letterSpacing: 0, lineHeight: 13 },
    productGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: 10,
      rowGap: 18,
    },
    productCard: {
      flexBasis: '47%',
      flexGrow: 1,
      minHeight: 206,
    },
    productImageWrap: {
      aspectRatio: 1,
      backgroundColor: HOME_PANEL_BG,
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
      borderRadius: 6,
      left: 7,
      paddingHorizontal: 7,
      paddingVertical: 4,
      position: 'absolute',
      top: 7,
    },
    productBadgeText: { color: colors.textInverse, fontSize: 12, fontWeight: '900', letterSpacing: 0, lineHeight: 16 },
    videoBadge: {
      backgroundColor: 'rgba(255, 255, 255, 0.82)',
      borderRadius: borderRadius.full,
      bottom: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      position: 'absolute',
      right: spacing.sm,
    },
    videoBadgeText: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
    productTitle: {
      color: HOME_TEXT,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0,
      lineHeight: 18,
      marginTop: 8,
    },
    productMeta: { color: HOME_MUTED_TEXT, fontSize: 11, fontWeight: '600', letterSpacing: 0, lineHeight: 15, marginTop: 2 },
    productDeal: { color: HOME_ACCENT, fontSize: 12, fontWeight: '900', letterSpacing: 0, lineHeight: 16, marginTop: 2 },
    productEmpty: {
      alignItems: 'center',
      backgroundColor: colors.surfaceHover,
      borderRadius: borderRadius.lg,
      justifyContent: 'center',
      minHeight: 140,
    },
    productEmptyText: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
    notice: { backgroundColor: colors.warningBg, borderRadius: borderRadius.md, marginBottom: spacing.md, padding: spacing.md },
    noticeText: { color: colors.noticeText, fontSize: 12, textAlign: 'center' },
  });
}

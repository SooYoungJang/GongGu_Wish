import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { RankingCategoryChips, SellerRankingList } from '../components/ranking';
import { SearchGlyph } from '../components/ui/LineGlyphs';
import { SText } from '../components/ui/SText';
import { ScreenHeader } from '../components/ScreenHeader';
import { spacing } from '../design/tokens';
import { commerceRadius, type CommerceColorPalette } from '../design/commerce';
import { useCommerceTheme } from '../design/useCommerceTheme';
import {
  RANKING_CATEGORIES,
  RANKING_PERIOD_LABELS,
  type RankingCategory,
  type RankingPeriod,
  type RankingSort,
  type RankingThumbnail,
  type SellerRanking,
} from '../features/ranking/types';
import { usePopularGroupBuys } from '../features/ranking/usePopularGroupBuys';
import { syncNotification } from '../api';
import { useNotifications } from '../hooks/useLocalDeals';
import type { StoreScreenProps, GroupBuy } from '../types';

// Space reserved for the floating absolute-positioned tab bar:
// 70pt bar height + spacing.lg margin + safe area bottom + extra breathing room
const TAB_BAR_HEIGHT = 70;
const TAB_BAR_BOTTOM_MARGIN = spacing.lg;
const FLOATING_TAB_RESERVED_HEIGHT = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_MARGIN;

// 랭킹 행을 GroupBuy로 변환해 useNotifications.toggleNotification에 넘긴다.
// startDate/endDate가 있으면 시작 1시간 전 푸시가 예약되고, 없어도 알림 항목은
// 마이페이지·릴스가 읽는 공유 스토어에 저장된다.
function rankingToGroupBuy(item: SellerRanking): GroupBuy {
  const groupBuyId = item.representativeGroupBuyId ?? item.id;
  return {
    id: groupBuyId,
    productName: item.displayName,
    brandName: null,
    category: item.category,
    startDate: item.startDate ?? null,
    endDate: item.endDate ?? null,
    purchaseUrl: null,
    discountInfo: null,
    summary: null,
    confidence: 0,
    thumbnailUrl: item.thumbnails[0]?.imageUrl ?? null,
    videoUrl: null,
    mediaUrls: [],
    mediaType: null,
    rawPost: { postUrl: '', influencer: { instagramUsername: item.username } },
  };
}

export function StoreScreen({ navigation }: StoreScreenProps) {
  const insets = useSafeAreaInsets();
 const { colors } = useCommerceTheme();
 const s = useMemo(() => makeStyles(colors), [colors]);
 const [selectedCategory, setSelectedCategory] = useState<RankingCategory>('all');
  const [period, setPeriod] = useState<RankingPeriod>('weekly');
  const [sort, setSort] = useState<RankingSort>('popular');

 const rankingState = usePopularGroupBuys(period, selectedCategory, sort);
 const { isNotifying, toggleNotification } = useNotifications();

 const patchedRankingState = useMemo(() => {
   if (rankingState.status !== 'ready' || !rankingState.data) return rankingState;
   return {
     ...rankingState,
     data: rankingState.data.map((item) => ({
       ...item,
       // 알림 버튼은 진짜 알림 설정 상태를 반영한다. useNotifications 스토어는
       // 마이페이지("알림 설정한 공구")와 릴스(bell)가 함께 읽는 같은 저장소다.
       isFollowing: isNotifying(item.representativeGroupBuyId ?? item.id),
     })),
   };
 }, [rankingState, isNotifying]);

 const bottomPadding = FLOATING_TAB_RESERVED_HEIGHT + insets.bottom + spacing['2xl'];

  const handlePressSeller = useCallback(
    (item: SellerRanking) => {
      navigation.navigate('InfluencerGroupBuys', {
        influencerUsername: item.username,
        influencerDisplayName: item.displayName,
      });
    },
    [navigation],
  );

  const handlePressThumbnail = useCallback((_thumbnail: RankingThumbnail, item: SellerRanking) => {
    navigation.navigate('InfluencerGroupBuys', {
      influencerUsername: item.username,
      influencerDisplayName: item.displayName,
    });
  }, [navigation]);

 const handleToggleNotification = useCallback(
   (item: SellerRanking) => {
     const groupBuyId = item.representativeGroupBuyId;
     if (!groupBuyId) return;
     const willEnable = !isNotifying(groupBuyId);
     // 서버 인기도 집계용 미러 (fire-and-forget)
     void syncNotification(groupBuyId, willEnable);
     // 진짜 알림 등록/해제: useNotifications 스토어에 쓰면 마이페이지·릴스에 즉시 반영되고,
     // startDate가 있으면 시작 1시간 전 푸시도 예약된다.
     void toggleNotification(rankingToGroupBuy(item));
   },
   [isNotifying, toggleNotification],
 );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.safeArea}>
      <View style={s.header}>
        <ScreenHeader
          title="쇼핑몰 랭킹"
          right={
            <View style={s.headerActions}>
              <Pressable accessibilityLabel="랭킹 검색" accessibilityRole="button" style={s.iconButton} onPress={() => navigation.navigate('SearchScreen')}>
                <SearchGlyph color={colors.text} size={19} />
              </Pressable>
              <Pressable accessibilityLabel="랭킹 알림" accessibilityRole="button" style={s.iconButton} onPress={() => Alert.alert('준비 중', '알림 기능은 준비 중입니다.\n곧 업데이트될 예정입니다.')}>
                <SText variant="body" style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>♡</SText>
              </Pressable>
            </View>
          }
       />

     </View>

     <View style={s.filterSection}>
        <View style={s.periodRow}>
          {(['today', 'weekly', 'monthly'] as const).map((nextPeriod) => {
            const selected = nextPeriod === period;
            return (
              <Pressable
                key={nextPeriod}
                accessibilityLabel={`${RANKING_PERIOD_LABELS[nextPeriod]} 랭킹 기간`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setPeriod(nextPeriod)}
                style={[s.periodChip, selected && s.selectedPeriodChip]}
              >
                <SText variant="caption" style={[{ fontWeight: '900', color: colors.muted, includeFontPadding: false }, selected && { color: colors.accent }]}>
                  {RANKING_PERIOD_LABELS[nextPeriod]}
                </SText>
              </Pressable>
            );
          })}
        </View>

        <RankingCategoryChips
          value={selectedCategory}
          categories={RANKING_CATEGORIES}
          sort={sort}
          onChange={setSelectedCategory}
          onChangeSort={setSort}
        />
      </View>

      <View style={s.listContainer}>
        <SellerRankingList
          state={patchedRankingState}
          bottomPadding={bottomPadding}
         onPressItem={handlePressSeller}
         onPressThumbnail={handlePressThumbnail}
         onToggleFollow={handleToggleNotification}
       />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    filterSection: {
      backgroundColor: colors.bg,
      gap: spacing.sm,
      paddingBottom: spacing.sm,
    },
    header: {
      backgroundColor: colors.bg,
      gap: spacing.md,
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
    },
    headerActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    iconButton: {
      alignItems: 'center',
      backgroundColor: colors.softBg,
      borderRadius: commerceRadius.full,
      height: 42,
      justifyContent: 'center',
      width: 42,
    },
    listContainer: {
      backgroundColor: colors.bg,
      flex: 1,
      paddingHorizontal: spacing.lg,
    },
    periodChip: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: commerceRadius.full,
      borderWidth: 1,
      justifyContent: 'center',
      height: 34,
      paddingHorizontal: spacing.md,
      paddingVertical: 0,
    },
    periodRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    safeArea: {
      backgroundColor: colors.bg,
      flex: 1,
    },
    selectedPeriodChip: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
  });
}

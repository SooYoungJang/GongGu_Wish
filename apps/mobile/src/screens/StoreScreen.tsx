import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { RankingCategoryChips, RankingTabs, SellerRankingList } from '../components/ranking';
import { SearchGlyph } from '../components/ui/LineGlyphs';
import { SText } from '../components/ui/SText';
import { ScreenHeader } from '../components/ScreenHeader';
import { spacing } from '../design/tokens';
import { commerceRadius, type CommerceColorPalette } from '../design/commerce';
import { useCommerceTheme } from '../design/useCommerceTheme';
import { MOCK_RANKINGS } from '../features/ranking/rankingFixtures';
import {
  RANKING_CATEGORIES,
  RANKING_PERIOD_LABELS,
  type RankingCategory,
  type RankingPeriod,
  type RankingSort,
  type RankingTab,
  type RankingThumbnail,
  type SellerRanking,
} from '../features/ranking/types';
import { usePopularGroupBuys } from '../features/ranking/usePopularGroupBuys';
import { syncNotification } from '../api';
import type { StoreScreenProps } from '../types';

// Space reserved for the floating absolute-positioned tab bar:
// 70pt bar height + spacing.lg margin + safe area bottom + extra breathing room
const TAB_BAR_HEIGHT = 70;
const TAB_BAR_BOTTOM_MARGIN = spacing.lg;
const FLOATING_TAB_RESERVED_HEIGHT = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_MARGIN;

export function StoreScreen({ navigation }: StoreScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useCommerceTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<RankingTab>('ranking');
  const [selectedCategory, setSelectedCategory] = useState<RankingCategory>('all');
  const [period, setPeriod] = useState<RankingPeriod>('weekly');
  const [sort, setSort] = useState<RankingSort>('popular');

  const rankingState = usePopularGroupBuys(period, selectedCategory, sort);

  const [followedIds, setFollowedIds] = useState<Set<string>>(() => new Set());

  const patchedRankingState = useMemo(() => {
    if (rankingState.status !== 'ready' || !rankingState.data) return rankingState;
    return {
      ...rankingState,
      data: rankingState.data.map((item) => ({
        ...item,
        isFollowing: followedIds.has(item.sellerId),
      })),
    };
  }, [rankingState, followedIds]);

  const rankingCount = MOCK_RANKINGS.length;
  const followingCount = useMemo(() => followedIds.size, [followedIds]);
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

  const handleToggleFollow = useCallback((item: SellerRanking) => {
    const willFollow = !followedIds.has(item.sellerId);
    if (item.representativeGroupBuyId) {
      void syncNotification(item.representativeGroupBuyId, willFollow);
    }
    setFollowedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.sellerId)) {
        next.delete(item.sellerId);
      } else {
        next.add(item.sellerId);
      }
      return next;
    });
  }, [followedIds]);

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

        <RankingTabs
          value={activeTab}
          rankingCount={rankingCount}
          followingCount={followingCount}
          onChange={setActiveTab}
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
          onToggleFollow={handleToggleFollow}
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

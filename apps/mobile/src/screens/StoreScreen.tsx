import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { RankingCategoryChips, RankingTabs, SellerRankingList } from '../components/ranking';
import { SText } from '../components/ui/SText';
import { borderRadius, spacing } from '../design/tokens';
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
import { useSellerRankings } from '../features/ranking/useSellerRankings';
import type { StoreScreenProps } from '../types';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';

// Space reserved for the floating absolute-positioned tab bar:
// 70pt bar height + spacing.lg margin + safe area bottom + extra breathing room
const TAB_BAR_HEIGHT = 70;
const TAB_BAR_BOTTOM_MARGIN = spacing.lg;
const FLOATING_TAB_RESERVED_HEIGHT = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_MARGIN;

export function StoreScreen({ navigation }: StoreScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<RankingTab>('ranking');
  const [selectedCategory, setSelectedCategory] = useState<RankingCategory>('all');
  const [period, setPeriod] = useState<RankingPeriod>('weekly');
  const [sort, setSort] = useState<RankingSort>('popular');

  const rankingState = useSellerRankings({
    tab: activeTab,
    category: selectedCategory,
    period,
    sort,
  });

  const [followedIds, setFollowedIds] = useState<Set<string>>(
    () => new Set(MOCK_RANKINGS.filter((item) => item.isFollowing).map((item) => item.sellerId)),
  );

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
    setFollowedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.sellerId)) {
        next.delete(item.sellerId);
      } else {
        next.add(item.sellerId);
      }
      return next;
    });
  }, []);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.safeArea}>
      <View style={s.header}>
        <View style={s.titleRow}>
          <View>
            <SText variant="eyebrow">스토어 랭킹</SText>
            <SText variant="title" style={{ fontWeight: '900', letterSpacing: -0.6 }}>
              쇼핑몰 랭킹
            </SText>
          </View>
          <View style={s.headerActions}>
            <Pressable accessibilityLabel="랭킹 검색" accessibilityRole="button" style={s.iconButton} onPress={() => navigation.navigate('SearchScreen')}>
              <SText variant="body" style={{ fontSize: 16, fontWeight: '900', color: colors.textPrimary }}>⌕</SText>
            </Pressable>
            <Pressable accessibilityLabel="랭킹 알림" accessibilityRole="button" style={s.iconButton} onPress={() => Alert.alert('준비 중', '알림 기능은 준비 중입니다.\n곧 업데이트될 예정입니다.')}>
              <SText variant="body" style={{ fontSize: 16, fontWeight: '900', color: colors.textPrimary }}>♡</SText>
            </Pressable>
          </View>
        </View>

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
                <SText variant="caption" style={[{ fontWeight: '800', color: colors.textSecondary, includeFontPadding: false }, selected && { color: colors.primary }]}>
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

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    filterSection: {
      gap: spacing.sm,
      paddingBottom: spacing.sm,
    },
    header: {
      backgroundColor: colors.bg,
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    headerActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    iconButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    listContainer: {
      flex: 1,
      paddingHorizontal: spacing.lg,
    },
    periodChip: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      justifyContent: 'center',
      height: 32,
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
      backgroundColor: colors.primaryBg,
      borderColor: colors.primaryLight,
    },
    titleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
  });
}

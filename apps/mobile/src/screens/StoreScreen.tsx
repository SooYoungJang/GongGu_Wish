import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { RankingCategoryChips, RankingTabs, SellerRankingList } from '../components/ranking';
import { borderRadius, colors, spacing, typography } from '../design/tokens';
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

// Space reserved for the floating absolute-positioned tab bar:
// 70pt bar height + spacing.lg margin + safe area bottom + extra breathing room
const TAB_BAR_HEIGHT = 70;
const TAB_BAR_BOTTOM_MARGIN = spacing.lg;
const FLOATING_TAB_RESERVED_HEIGHT = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_MARGIN;

export function StoreScreen({ navigation }: StoreScreenProps) {
  const insets = useSafeAreaInsets();
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
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View>
            <Text style={typography.eyebrow}>스토어 랭킹</Text>
            <Text style={styles.title}>쇼핑몰 랭킹</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable accessibilityLabel="랭킹 검색" accessibilityRole="button" style={styles.iconButton}>
              <Text style={styles.iconText}>⌕</Text>
            </Pressable>
            <Pressable accessibilityLabel="랭킹 알림" accessibilityRole="button" style={styles.iconButton}>
              <Text style={styles.iconText}>♡</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.searchPreview} accessibilityLabel="브랜드명, 제품명, 셀러명으로 검색">
          <Text style={styles.searchIcon}>⌕</Text>
          <Text style={styles.searchPlaceholder}>브랜드명, 제품명, 셀러명으로 검색</Text>
        </View>

        <RankingTabs
          value={activeTab}
          rankingCount={rankingCount}
          followingCount={followingCount}
          onChange={setActiveTab}
        />
      </View>

      <View style={styles.filterSection}>
        <View style={styles.periodRow}>
          {(['today', 'weekly', 'monthly'] as const).map((nextPeriod) => {
            const selected = nextPeriod === period;
            return (
              <Pressable
                key={nextPeriod}
                accessibilityLabel={`${RANKING_PERIOD_LABELS[nextPeriod]} 랭킹 기간`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setPeriod(nextPeriod)}
                style={[styles.periodChip, selected && styles.selectedPeriodChip]}
              >
                <Text style={[styles.periodText, selected && styles.selectedPeriodText]}>
                  {RANKING_PERIOD_LABELS[nextPeriod]}
                </Text>
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

      <View style={styles.listContainer}>
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

const styles = StyleSheet.create({
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
  iconText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  periodChip: {
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    minHeight: 32,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  periodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  periodText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  safeArea: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  searchIcon: {
    color: colors.textTertiary,
    fontSize: 14,
    fontWeight: '900',
  },
  searchPlaceholder: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  searchPreview: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  selectedPeriodChip: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primaryLight,
  },
  selectedPeriodText: {
    color: colors.primary,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

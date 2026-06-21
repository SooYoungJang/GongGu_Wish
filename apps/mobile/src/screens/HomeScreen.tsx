import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { fallbackGroupBuys, fetchGroupBuys, fetchInfluencers, searchInfluencers } from '../api';
import { CategoryRow } from '../components/home/CategoryRow';
import { ExpiringSoonSection } from '../components/home/ExpiringSoonSection';
import { HomeHeader } from '../components/home/HomeHeader';
import { MonthlyBannerCarousel } from '../components/home/MonthlyBannerCarousel';
import { SearchBar } from '../components/home/SearchBar';
import { SearchResultsPanel } from '../components/home/SearchResultsPanel';
import { SubmitPrompt } from '../components/home/SubmitPrompt';
import { ThisWeekDeals } from '../components/home/ThisWeekDeals';
import { WeeklyCalendarStrip } from '../components/home/WeeklyCalendarStrip';
import { borderRadius, colors, spacing, typography } from '../design/tokens';
import type { GroupBuy, HomeScreenProps, Influencer } from '../types';

type HomeAction = () => void;

type HomeScreenContentProps = {
  groupBuys: GroupBuy[];
  influencers: Influencer[];
  isError: boolean;
  isFetching: boolean;
  searchQuery: string;
  searchResults: Influencer[];
  onChangeSearchQuery: (value: string) => void;
  onClearSearchQuery: HomeAction;
  onRefresh: HomeAction;
  onOpenBookmarks: HomeAction;
  onOpenNotifications: HomeAction;
  onPressCalendar: HomeAction;
  onPressCategory: (category: string) => void;
  onPressDeal: (groupBuy: GroupBuy) => void;
  onPressInfluencer: (influencer: Influencer) => void;
  onPressSubmit: HomeAction;
};

function getFallbackInfluencers(groupBuys: GroupBuy[]): Influencer[] {
  const influencers = new Map<string, Influencer>();

  for (const groupBuy of groupBuys) {
    const username = groupBuy.rawPost.influencer.instagramUsername.replace(/^@/, '');
    const key = username.toLowerCase();

    if (!influencers.has(key)) {
      influencers.set(key, {
        id: `fallback-${key}`,
        instagramUsername: username,
        displayName: null,
        isActive: true,
      });
    }
  }

  return Array.from(influencers.values()).sort((a, b) => a.instagramUsername.localeCompare(b.instagramUsername));
}

export function HomeScreenContent({
  groupBuys,
  isError,
  isFetching,
  searchQuery,
  searchResults,
  onChangeSearchQuery,
  onClearSearchQuery,
  onRefresh,
  onOpenBookmarks,
  onOpenNotifications,
  onPressCalendar,
  onPressCategory,
  onPressDeal,
  onPressInfluencer,
  onPressSubmit,
}: HomeScreenContentProps) {
  const showSearchResults = searchQuery.trim().length > 0;
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <FlatList
          data={[{ key: 'home-discovery-feed' }]}
          keyExtractor={(item) => item.key}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={() => (
            <View style={styles.content}>
              <HomeHeader onOpenBookmarks={onOpenBookmarks} onOpenNotifications={onOpenNotifications} />
              {isError ? (
                <View style={styles.notice}>
                  <Text style={styles.noticeText}>로컬 API가 꺼져 있어 샘플 데이터를 표시 중입니다.</Text>
                </View>
              ) : null}
              <SearchBar value={searchQuery} onChangeText={onChangeSearchQuery} onClear={onClearSearchQuery} />
              {showSearchResults ? <SearchResultsPanel results={searchResults} onPressInfluencer={onPressInfluencer} /> : null}
              {isFetching && groupBuys.length === 0 ? <ActivityIndicator color={colors.primary} /> : null}
              <MonthlyBannerCarousel groupBuys={groupBuys} onPressDeal={onPressDeal} />
              <CategoryRow onPressCategory={onPressCategory} />
              <WeeklyCalendarStrip onPressCalendar={onPressCalendar} />
              <ThisWeekDeals groupBuys={groupBuys} onPressDeal={onPressDeal} />
              <ExpiringSoonSection groupBuys={groupBuys} onPressDeal={onPressDeal} />
              <SubmitPrompt onPressSubmit={onPressSubmit} />
            </View>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: spacing['3xl'] + insets.bottom }]}
        />
      </View>
    </SafeAreaView>
  );
}

export function HomeScreen({ navigation }: HomeScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ['group-buys'],
    queryFn: fetchGroupBuys,
    retry: false,
  });

  const { data: influencersData } = useQuery({
    queryKey: ['influencers'],
    queryFn: fetchInfluencers,
    retry: false,
  });

  const groupBuys = data?.length ? data : fallbackGroupBuys;
  const influencers = influencersData?.length ? influencersData : getFallbackInfluencers(groupBuys);
  const searchResults = useMemo(() => searchInfluencers(influencers, searchQuery).slice(0, 5), [influencers, searchQuery]);

  return (
    <HomeScreenContent
      groupBuys={groupBuys}
      influencers={influencers}
      isError={isError}
      isFetching={isFetching}
      searchQuery={searchQuery}
      searchResults={searchResults}
      onChangeSearchQuery={setSearchQuery}
      onClearSearchQuery={() => setSearchQuery('')}
      onRefresh={refetch}
      onOpenBookmarks={() => undefined}
      onOpenNotifications={() => undefined}
      onPressCalendar={() => navigation.navigate('CalendarScreen', {})}
      onPressCategory={() => undefined}
      onPressDeal={(groupBuy) => navigation.navigate('Detail', { groupBuy })}
      onPressInfluencer={(influencer) => {
        setSearchQuery('');
        navigation.navigate('InfluencerGroupBuys', {
          influencerUsername: influencer.instagramUsername,
          influencerDisplayName: influencer.displayName,
        });
      }}
      onPressSubmit={() => navigation.navigate('Submit')}
    />
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 132 },
  listContent: { paddingBottom: spacing['3xl'] },
  notice: { backgroundColor: colors.warningBg, borderRadius: borderRadius.sm, marginBottom: spacing.md, padding: spacing.md },
  noticeText: { color: colors.noticeText, fontSize: 13, textAlign: 'center' },
});

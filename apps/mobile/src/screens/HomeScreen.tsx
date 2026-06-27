import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { SText } from '../components/ui/SText';
import { fallbackGroupBuys, fetchGroupBuys, fetchFeeds, fetchInfluencers, searchInfluencers } from '../api';
import { CategoryRow } from '../components/home/CategoryRow';
import { ExpiringSoonSection } from '../components/home/ExpiringSoonSection';
import { FeedSection } from '../components/home/FeedSection';
import { HomeHeader } from '../components/home/HomeHeader';
import { MonthlyBannerCarousel } from '../components/home/MonthlyBannerCarousel';
import { SearchBar } from '../components/home/SearchBar';
import { SearchResultsPanel } from '../components/home/SearchResultsPanel';
import { SubmitPrompt } from '../components/home/SubmitPrompt';
import { ThisWeekDeals } from '../components/home/ThisWeekDeals';
import { WeeklyCalendarStrip } from '../components/home/WeeklyCalendarStrip';
import { borderRadius, spacing } from '../design/tokens';
import { useTheme } from '../context/ThemeContext';
import type { FeedPost, GroupBuy, HomeScreenProps, Influencer } from '../types';
import type { ColorPalette } from '../context/ThemeContext';

type HomeAction = () => void;

type HomeScreenContentProps = {
  groupBuys: GroupBuy[];
  feedPosts: FeedPost[];
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
  onPressFeed: (feedPost: FeedPost) => void;
  onPressInfluencer: (influencer: Influencer) => void;
  onPressSubmit: HomeAction;
  feedsLoading: boolean;
  feedsError: boolean;
  onRetryFeed: () => void;
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
  feedPosts,
  influencers,
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
  onPressFeed,
  onPressInfluencer,
  onPressSubmit,
  feedsLoading,
  feedsError,
  onRetryFeed,
}: HomeScreenContentProps) {
  const showSearchResults = searchQuery.trim().length > 0;
  const { colors, isDark } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={s.container}>
        <ScrollView
          keyboardShouldPersistTaps="always"
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.listContent}
        >
          <View style={s.content}>
            <HomeHeader onOpenBookmarks={onOpenBookmarks} onOpenNotifications={onOpenNotifications} />
            <FeedSection feedPosts={feedPosts} onPressFeed={onPressFeed} isLoading={feedsLoading} isError={feedsError} onRetry={onRetryFeed} />
            {isError ? (
              <View style={s.notice}>
                <SText variant="caption" style={s.noticeText}>로컬 API가 꺼져 있어 샘플 데이터를 표시 중입니다.</SText>
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
        </ScrollView>
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

  const { data: feedsData, isError: feedsError, isLoading: feedsLoading, refetch: refetchFeeds } = useQuery({
    queryKey: ['feeds'],
    queryFn: () => fetchFeeds(1, 20),
    retry: 3,
    staleTime: 0,
  });

  const groupBuys = data?.length ? data : fallbackGroupBuys;
  const influencers = influencersData?.length ? influencersData : getFallbackInfluencers(groupBuys);
  const feedPosts = feedsData?.items ?? [];
  const searchResults = useMemo(() => searchInfluencers(influencers, searchQuery).slice(0, 5), [influencers, searchQuery]);

  return (
    <HomeScreenContent
      groupBuys={groupBuys}
      feedPosts={feedPosts}
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
      onPressFeed={(feedPost) => navigation.navigate('FeedDetail', { feedId: feedPost.id })}
      feedsLoading={feedsLoading}
      feedsError={feedsError}
      onRetryFeed={refetchFeeds}
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

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },
    container: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    listContent: { paddingBottom: 120 },
    notice: { backgroundColor: colors.warningBg, borderRadius: borderRadius.sm, marginBottom: spacing.md, padding: spacing.md },
    noticeText: { color: colors.noticeText, fontSize: 12, textAlign: 'center' },
  });
}

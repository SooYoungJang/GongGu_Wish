import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';

import { SText } from '../components/ui/SText';
import { fallbackGroupBuys, fetchGroupBuys, fetchFeeds, fetchInfluencers } from '../api';
import { CategoryRow } from '../components/home/CategoryRow';
import { ExpiringSoonSection } from '../components/home/ExpiringSoonSection';
import { FeedSection } from '../components/home/FeedSection';
import { HomeHeader } from '../components/home/HomeHeader';
import { MonthlyBannerCarousel } from '../components/home/MonthlyBannerCarousel';
import { SubmitPrompt } from '../components/home/SubmitPrompt';
import { ThisWeekDeals } from '../components/home/ThisWeekDeals';
import { WeeklyCalendarStrip } from '../components/home/WeeklyCalendarStrip';
import { KeyboardFormScreen } from '../components/keyboard/KeyboardFormScreen';
import { borderRadius, spacing } from '../design/tokens';
import type { CategoryColorName } from '../design/tokens';
import { useTheme } from '../context/ThemeContext';
import type { FeedPost, GroupBuy, HomeScreenProps, Influencer } from '../types';
import type { ColorPalette } from '../context/ThemeContext';
import { formatDateKey } from '../utils/groupBuyDates';

type HomeAction = () => void;
type CalendarAction = (date: Date | null) => void;

type HomeScreenContentProps = {
  groupBuys: GroupBuy[];
  feedPosts: FeedPost[];
  influencers: Influencer[];
  isError: boolean;
  isFetching: boolean;
  onRefresh: HomeAction;
  onOpenBookmarks: HomeAction;
  onOpenNotifications: HomeAction;
  onOpenSearch: HomeAction;
  onPressCalendar: CalendarAction;
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
  onRefresh,
  onOpenBookmarks,
  onOpenNotifications,
  onOpenSearch,
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
  const { colors, isDark, shadows } = useTheme();
  const s = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [selectedCategory, setSelectedCategory] = useState<CategoryColorName | null>(null);
  const visibleGroupBuys = useMemo(() => {
    if (!selectedCategory) return groupBuys;
    return groupBuys.filter((item) => item.category === selectedCategory);
  }, [groupBuys, selectedCategory]);
  const handlePressCategory = useCallback((category: CategoryColorName) => {
    setSelectedCategory((current) => (current === category ? null : category));
    onPressCategory(category);
  }, [onPressCategory]);

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
            <HomeHeader onOpenBookmarks={onOpenBookmarks} onOpenNotifications={onOpenNotifications} onOpenSearch={onOpenSearch} />
            <FeedSection feedPosts={feedPosts} onPressFeed={onPressFeed} isLoading={feedsLoading} isError={feedsError} onRetry={onRetryFeed} />
            {isError ? (
              <View style={s.notice}>
                <SText variant="caption" style={s.noticeText}>네트워크 연결 상태를 확인해주세요. (샘플 데이터를 표시 중입니다)</SText>
              </View>
            ) : null}
            {isFetching && groupBuys.length === 0 ? <ActivityIndicator color={colors.primary} /> : null}
            <MonthlyBannerCarousel groupBuys={groupBuys} onPressDeal={onPressDeal} />
            <CategoryRow selectedCategory={selectedCategory} onPressCategory={handlePressCategory} />
            <WeeklyCalendarStrip
              onPressCalendar={() => onPressCalendar(selectedDate)}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
            <ThisWeekDeals
              groupBuys={visibleGroupBuys}
              onPressDeal={onPressDeal}
              selectedDate={selectedDate}
            />
            <ExpiringSoonSection groupBuys={visibleGroupBuys} onPressDeal={onPressDeal} />
            <SubmitPrompt onPressSubmit={onPressSubmit} />
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

  useFocusEffect(
    useCallback(() => {
      void refetch();
      void refetchFeeds();
    }, [refetch, refetchFeeds]),
  );

  return (
    <HomeScreenContent
      groupBuys={groupBuys}
      feedPosts={feedPosts}
      influencers={influencers}
      isError={isError}
      isFetching={isFetching}
      onRefresh={refetch}
      onOpenBookmarks={() => Alert.alert('준비 중', '북마크 기능은 준비 중입니다.\n곧 업데이트될 예정입니다.')}
      onOpenNotifications={() => Alert.alert('준비 중', '알림 기능은 준비 중입니다.\n곧 업데이트될 예정입니다.')}
      onOpenSearch={() => navigation.navigate('SearchScreen')}
      onPressCalendar={(date) => navigation.navigate('CalendarScreen', {
        initialDate: date ? formatDateKey(date) : undefined,
      })}
      onPressCategory={() => undefined}
      onPressDeal={(groupBuy) => navigation.navigate('Detail', { groupBuy })}
      onPressFeed={(feedPost) => {
        const groupBuy = groupBuys.find((item) => item.id === feedPost.id);
        if (groupBuy) {
          navigation.navigate('Detail', { groupBuy });
        } else {
          navigation.navigate('FeedDetail', { feedId: feedPost.id });
        }
      }}
      feedsLoading={feedsLoading}
      feedsError={feedsError}
      onRetryFeed={refetchFeeds}
      onPressInfluencer={(influencer) => {
        navigation.navigate('InfluencerGroupBuys', {
          influencerUsername: influencer.instagramUsername,
          influencerDisplayName: influencer.displayName,
        });
      }}
      onPressSubmit={() => navigation.navigate('Submit')}
    />
  );
}

function makeStyles(colors: ColorPalette, shadows: Record<'sm' | 'md' | 'lg', any>) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },
    container: { flex: 1, backgroundColor: colors.bg },
    content: {
      backgroundColor: 'transparent',
      paddingBottom: spacing['2xl'],
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
    },
    listContent: {
      paddingBottom: 132,
      paddingHorizontal: 0,
      paddingTop: 0,
    },
    notice: { backgroundColor: colors.warningBg, borderRadius: borderRadius.md, marginBottom: spacing.md, padding: spacing.md },
    noticeText: { color: colors.noticeText, fontSize: 12, textAlign: 'center' },
  });
}

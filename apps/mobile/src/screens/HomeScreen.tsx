import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { fallbackGroupBuys, fetchGroupBuys, fetchInfluencers, searchInfluencers } from '../api';
import {
  borderRadius,
  cardOverlayGradientStops,
  categoryColors,
  colors,
  shadows,
  spacing,
  typography,
  type CategoryColorName,
} from '../design/tokens';
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
  onPressCategory: (category: CategoryColorName) => void;
  onPressDeal: (groupBuy: GroupBuy) => void;
  onPressInfluencer: (influencer: Influencer) => void;
  onPressSubmit: HomeAction;
};

type CategoryItem = {
  key: CategoryColorName;
  label: string;
  icon: string;
};

const CATEGORIES: CategoryItem[] = [
  { key: 'beauty', label: '뷰티', icon: '✦' },
  { key: 'fashion', label: '패션', icon: '◒' },
  { key: 'food', label: '푸드', icon: '●' },
  { key: 'lifestyle', label: '라이프', icon: '◇' },
  { key: 'baby', label: '육아', icon: '♡' },
  { key: 'digital', label: '디지털', icon: '⌁' },
];


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

function formatDeadline(endDate: string | null) {
  if (!endDate) return '마감일 미정';
  const date = new Date(endDate);
  if (Number.isNaN(date.getTime())) return '마감일 확인 필요';

  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return '오늘 마감';
  if (days === 1) return '내일 마감';
  if (days <= 7) return `${days}일 남음`;
  return `${date.getMonth() + 1}월 ${date.getDate()}일 마감`;
}

function getWeekDays() {
  const labels = ['월', '화', '수', '목', '금', '토', '일'];
  const today = new Date();
  const current = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - current);

  return labels.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { label, day: date.getDate(), selected: index === current };
  });
}

function categoryForIndex(index: number): CategoryColorName {
  return CATEGORIES[index % CATEGORIES.length].key;
}

function HomeHeader({ onOpenBookmarks, onOpenNotifications }: Pick<HomeScreenContentProps, 'onOpenBookmarks' | 'onOpenNotifications'>) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerEyebrow}>GongGu Alert</Text>
        <Text style={styles.appName}>공구캘린더</Text>
      </View>
      <View style={styles.headerActions}>
        <Pressable accessibilityLabel="북마크 열기" accessibilityRole="button" onPress={onOpenBookmarks} style={styles.iconButton}>
          <Text style={styles.iconButtonText}>⌑</Text>
        </Pressable>
        <Pressable accessibilityLabel="알림 열기" accessibilityRole="button" onPress={onOpenNotifications} style={styles.iconButton}>
          <Text style={styles.iconButtonText}>◔</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SearchBar({ value, onChangeText, onClear }: { value: string; onChangeText: (value: string) => void; onClear: HomeAction }) {
  return (
    <View style={styles.searchBar}>
      <Text style={styles.searchIcon}>⌕</Text>
      <TextInput
        accessibilityLabel="공구 검색"
        placeholder="브랜드명, 제품명으로 검색해보세요"
        placeholderTextColor={colors.textTertiary}
        value={value}
        onChangeText={onChangeText}
        style={styles.searchInput}
      />
      {value ? (
        <Pressable accessibilityLabel="검색어 지우기" accessibilityRole="button" onPress={onClear} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function BannerCard({ item, onPress }: { item: GroupBuy; onPress: HomeAction }) {
  return (
    <Pressable accessibilityLabel={`${item.productName ?? '공구'} 배너 열기`} accessibilityRole="button" onPress={onPress} style={styles.bannerCard}>
      <ImageBackground source={{ uri: item.rawPost.postUrl }} style={styles.bannerImage} imageStyle={styles.bannerImageRadius}>
        <View style={styles.bannerOverlayTop} />
        <View style={styles.bannerOverlayBottom}>
          <Text style={styles.bannerEyebrow}>이달의 공구</Text>
          <Text style={styles.bannerTitle}>{item.productName ?? '새 공동구매'}</Text>
          <Text style={styles.bannerMeta}>{item.brandName ?? `@${item.rawPost.influencer.instagramUsername}`} · {item.discountInfo ?? '혜택 확인'}</Text>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

function MonthlyBannerCarousel({ groupBuys, onPressDeal }: Pick<HomeScreenContentProps, 'groupBuys' | 'onPressDeal'>) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>이달의 공구</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bannerCarousel}>
        {groupBuys.slice(0, 4).map((item) => (
          <BannerCard key={item.id} item={item} onPress={() => onPressDeal(item)} />
        ))}
      </ScrollView>
    </View>
  );
}

function CategoryIcon({ item, onPress }: { item: CategoryItem; onPress: (category: CategoryColorName) => void }) {
  const token = categoryColors[item.key];
  return (
    <Pressable
      accessibilityLabel={`${item.label} 카테고리 보기`}
      accessibilityRole="button"
      onPress={() => onPress(item.key)}
      style={[styles.categoryItem, { backgroundColor: token.bg, borderColor: token.border }]}
    >
      <Text style={[styles.categoryGlyph, { color: token.text }]}>{item.icon}</Text>
      <Text style={[styles.categoryLabel, { color: token.text }]}>{item.label}</Text>
    </Pressable>
  );
}

function CategoryRow({ onPressCategory }: Pick<HomeScreenContentProps, 'onPressCategory'>) {
  return (
    <View style={styles.categoryRow}>
      {CATEGORIES.map((item) => (
        <CategoryIcon key={item.key} item={item} onPress={onPressCategory} />
      ))}
    </View>
  );
}

function WeeklyCalendarStrip() {
  return (
    <View style={styles.calendarStrip}>
      {getWeekDays().map((day) => (
        <View key={`${day.label}-${day.day}`} style={styles.calendarDay}>
          <Text style={[styles.calendarWeekLabel, day.selected && styles.calendarWeekLabelSelected]}>{day.label}</Text>
          <View style={[styles.calendarDateCircle, day.selected && styles.calendarDateCircleSelected]}>
            <Text style={[styles.calendarDateText, day.selected && styles.calendarDateTextSelected]}>{day.day}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function DealCard({ item, category, onPress }: { item: GroupBuy; category: CategoryColorName; onPress: HomeAction }) {
  const token = categoryColors[category];
  return (
    <Pressable
      accessibilityLabel={`${item.productName ?? '공구'} 상세 보기`}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.dealCard}
    >
      <View style={[styles.dealImage, { backgroundColor: token.bg, borderColor: token.border }]}>
        <Text style={[styles.dealImageText, { color: token.text }]}>{item.brandName?.slice(0, 2) ?? '공구'}</Text>
      </View>
      <Text numberOfLines={2} style={styles.dealTitle}>{item.productName ?? '공동구매 상품'}</Text>
      <Text numberOfLines={1} style={styles.dealBrand}>{item.brandName ?? `@${item.rawPost.influencer.instagramUsername}`}</Text>
      <Text style={styles.dealDiscount}>{item.discountInfo ?? '혜택 확인'}</Text>
      <Text style={styles.dealDeadline}>{formatDeadline(item.endDate)}</Text>
    </Pressable>
  );
}

function DealCardGrid({ groupBuys, onPressDeal }: Pick<HomeScreenContentProps, 'groupBuys' | 'onPressDeal'>) {
  return (
    <View style={styles.dealGrid}>
      {groupBuys.map((item, index) => (
        <DealCard key={item.id} item={item} category={categoryForIndex(index)} onPress={() => onPressDeal(item)} />
      ))}
    </View>
  );
}

function FloatingCalendarCTA({ onPressCalendar, bottomInset }: Pick<HomeScreenContentProps, 'onPressCalendar'> & { bottomInset: number }) {
  return (
    <Pressable
      accessibilityLabel="캘린더 보기"
      accessibilityRole="button"
      onPress={onPressCalendar}
      style={[styles.floatingCta, { bottom: 86 + bottomInset }]}
    >
      <Text style={styles.floatingCtaIcon}>▦</Text>
      <Text style={styles.floatingCtaText}>캘린더 보기</Text>
    </Pressable>
  );
}


function SearchResultsPanel({ results, onPressInfluencer }: { results: Influencer[]; onPressInfluencer: (influencer: Influencer) => void }) {
  return (
    <View style={styles.searchPanel}>
      <Text style={styles.searchPanelTitle}>검색 결과</Text>
      {results.length > 0 ? (
        results.map((influencer) => (
          <Pressable
            key={influencer.id}
            accessibilityLabel={`${influencer.instagramUsername} 인플루언서 보기`}
            accessibilityRole="button"
            onPress={() => onPressInfluencer(influencer)}
            style={styles.searchResultRow}
          >
            <Text style={styles.searchResultName}>{influencer.displayName ?? influencer.instagramUsername}</Text>
            <Text style={styles.searchResultMeta}>@{influencer.instagramUsername.replace(/^@/, '')}</Text>
          </Pressable>
        ))
      ) : (
        <View style={styles.emptySearchResult}>
          <Text style={styles.emptySearchTitle}>검색 결과가 없어요</Text>
          <Text style={styles.emptySearchText}>인스타그램 username 또는 브랜드명을 다시 확인해 주세요.</Text>
        </View>
      )}
    </View>
  );
}

function SubmitPrompt({ onPressSubmit }: Pick<HomeScreenContentProps, 'onPressSubmit'>) {
  return (
    <View style={styles.submitPrompt}>
      <Text style={styles.submitPromptTitle}>놓치기 아까운 공구를 제보해 주세요</Text>
      <Text style={styles.submitPromptText}>승인된 제보만 캘린더와 알림에 표시돼요.</Text>
      <Pressable accessibilityLabel="공구 제보하기" accessibilityRole="button" onPress={onPressSubmit} style={styles.submitPromptButton}>
        <Text style={styles.submitPromptButtonText}>공구 제보하기</Text>
      </Pressable>
    </View>
  );
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
              <WeeklyCalendarStrip />
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionEyebrow}>DISCOVERY FEED</Text>
                  <Text style={styles.sectionTitle}>오늘 열려있는 공구</Text>
                </View>
                <Text style={styles.sectionAction}>전체보기</Text>
              </View>
              <DealCardGrid groupBuys={groupBuys} onPressDeal={onPressDeal} />
              <SubmitPrompt onPressSubmit={onPressSubmit} />
            </View>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: spacing['3xl'] + insets.bottom }]}
        />
        <FloatingCalendarCTA onPressCalendar={onPressCalendar} bottomInset={insets.bottom} />
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
      onPressCalendar={() => undefined}
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
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
  headerEyebrow: { ...typography.eyebrow, marginBottom: spacing.xs },
  appName: { color: colors.textPrimary, fontSize: 28, fontWeight: '800' },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    ...shadows.sm,
  },
  iconButtonText: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  notice: { backgroundColor: colors.warningBg, borderRadius: borderRadius.sm, marginBottom: spacing.md, padding: spacing.md },
  noticeText: { color: colors.noticeText, fontSize: 13, textAlign: 'center' },
  searchBar: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.lg,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    ...shadows.sm,
  },
  searchIcon: { color: colors.textSecondary, fontSize: 18, marginRight: spacing.sm },
  searchInput: { color: colors.textPrimary, flex: 1, fontSize: 15, minHeight: 44 },
  clearButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  clearButtonText: { color: colors.textSecondary, fontSize: 22 },
  searchPanel: { marginBottom: spacing.lg },
  searchPanelTitle: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.sm },
  searchResultRow: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginBottom: spacing.sm,
    minHeight: 56,
    padding: spacing.md,
  },
  searchResultName: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  searchResultMeta: { ...typography.caption, marginTop: spacing.xs },
  emptySearchResult: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginBottom: spacing.sm,
    padding: spacing.lg,
  },
  emptySearchTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: spacing.xs },
  emptySearchText: { ...typography.caption },
  section: { marginBottom: spacing.xl },
  sectionTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: spacing.md },
  bannerCarousel: { gap: spacing.md, paddingRight: spacing.lg },
  bannerCard: { borderRadius: 28, minHeight: 176, minWidth: 292, overflow: 'hidden', ...shadows.md },
  bannerImage: { backgroundColor: colors.ctaPurpleBg, flex: 1, justifyContent: 'space-between', minHeight: 176 },
  bannerImageRadius: { borderRadius: 28 },
  bannerOverlayTop: { backgroundColor: cardOverlayGradientStops[0], flex: 1 },
  bannerOverlayBottom: { backgroundColor: cardOverlayGradientStops[2], padding: spacing.lg },
  bannerEyebrow: { color: colors.ctaPurpleText, fontSize: 12, fontWeight: '700', marginBottom: spacing.xs },
  bannerTitle: { color: colors.ctaPurpleText, fontSize: 22, fontWeight: '800', marginBottom: spacing.xs },
  bannerMeta: { color: colors.ctaPurpleText, fontSize: 13, fontWeight: '600' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  categoryItem: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    flexBasis: '30%',
    flexGrow: 0,
    justifyContent: 'center',
    minHeight: 76,
    minWidth: 76,
    paddingVertical: spacing.md,
  },
  categoryGlyph: { fontSize: 22, fontWeight: '800', marginBottom: spacing.xs },
  categoryLabel: { fontSize: 13, fontWeight: '700' },
  calendarStrip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    padding: spacing.md,
  },
  calendarDay: { alignItems: 'center', minHeight: 58, minWidth: 38 },
  calendarWeekLabel: { color: colors.textTertiary, fontSize: 12, fontWeight: '700', marginBottom: spacing.xs },
  calendarWeekLabelSelected: { color: colors.ctaPurple },
  calendarDateCircle: { alignItems: 'center', borderRadius: borderRadius.full, justifyContent: 'center', minHeight: 36, minWidth: 36 },
  calendarDateCircleSelected: { backgroundColor: colors.ctaPurple },
  calendarDateText: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  calendarDateTextSelected: { color: colors.ctaPurpleText },
  sectionHeaderRow: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  sectionEyebrow: { ...typography.eyebrow, color: colors.ctaPurple },
  sectionAction: { color: colors.textLink, fontSize: 13, fontWeight: '700', paddingTop: spacing.xs },
  dealGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
  dealCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 236,
    padding: spacing.md,
    ...shadows.sm,
  },
  dealImage: { alignItems: 'center', borderRadius: 18, borderWidth: 1, justifyContent: 'center', marginBottom: spacing.md, minHeight: 104 },
  dealImageText: { fontSize: 18, fontWeight: '800' },
  dealTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '800', lineHeight: 20, marginBottom: spacing.xs },
  dealBrand: { color: colors.textSecondary, fontSize: 12, marginBottom: spacing.xs },
  dealDiscount: { color: colors.accent, fontSize: 13, fontWeight: '800', marginBottom: spacing.xs },
  dealDeadline: { color: colors.textTertiary, fontSize: 12, fontWeight: '700' },
  submitPrompt: { backgroundColor: colors.ctaPurpleBg, borderRadius: 24, marginBottom: spacing.xl, padding: spacing.lg },
  submitPromptTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: spacing.xs },
  submitPromptText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: spacing.md },
  submitPromptButton: {
    alignItems: 'center',
    backgroundColor: colors.ctaPurple,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  submitPromptButtonText: { color: colors.ctaPurpleText, fontSize: 14, fontWeight: '800' },
  floatingCta: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.ctaPurple,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    position: 'absolute',
    ...shadows.lg,
  },
  floatingCtaIcon: { color: colors.ctaPurpleText, fontSize: 16, fontWeight: '800' },
  floatingCtaText: { color: colors.ctaPurpleText, fontSize: 14, fontWeight: '800' },
});

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Pressable, StatusBar, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { KeyboardFormScreen } from '../components/keyboard/KeyboardFormScreen';
import { SearchResultsPanel } from '../components/home/SearchResultsPanel';
import { SearchGlyph } from '../components/ui/LineGlyphs';
import { SText } from '../components/ui/SText';
import { fallbackGroupBuys, fetchGroupBuys, fetchInfluencers, fetchPopularSearchTerms, logSearchTerm, searchInfluencers, type PopularSearchTerm } from '../api';
import { normalizeForSearch, pushRecentTerm } from '../utils/search';
import { spacing } from '../design/tokens';
import { useCommerceTheme } from '../design/useCommerceTheme';
import type { CommerceColorPalette } from '../design/commerce';
import type { GroupBuy, Influencer, RootStackParamList } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

function getFallbackInfluencers(groupBuys: GroupBuy[]): Influencer[] {
  const influencers = new Map<string, Influencer>();
  for (const gb of groupBuys) {
    const username = gb.rawPost.influencer.instagramUsername.replace(/^@/, '');
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
  return Array.from(influencers.values()).sort((a, b) =>
    a.instagramUsername.localeCompare(b.instagramUsername),
  );
}

const RECENT_KEY = 'search:recent';
const RECENT_MAX = 10;
const DEFAULT_RECENT_TERM = '가방';

const CATEGORY_LABELS: Record<string, string> = {
  beauty: '뷰티',
  fashion: '패션',
  food: '푸드',
  lifestyle: '라이프',
  baby: '육아',
  digital: '디지털',
};

function ClockGlyph({ s }: { s: ReturnType<typeof makeStyles> }) {
  return (
    <View style={s.clockGlyph}>
      <View style={s.clockHandLong} />
      <View style={s.clockHandShort} />
    </View>
  );
}

type DealSearchResultRowProps = {
  item: GroupBuy;
  // eslint-disable-next-line no-unused-vars
  onSelect: (item: GroupBuy) => void;
  s: ReturnType<typeof makeStyles>;
};

const DealSearchResultRow = memo(function DealSearchResultRow({ item, onSelect, s }: DealSearchResultRowProps) {
  const handlePress = useCallback(() => {
    onSelect(item);
  }, [item, onSelect]);

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${item.productName ?? item.rawPost.influencer.instagramUsername} 보기`}
      onPress={handlePress}
      style={({ pressed }) => [s.resultRow, pressed && s.pressed]}
    >
      <View style={s.resultLeft}>
        <SText variant="body" style={s.resultName}>{item.productName ?? '제품명 없음'}</SText>
        <SText variant="body" style={s.resultMeta}>
          @{item.rawPost.influencer.instagramUsername.replace(/^@/, '')}
          {item.discountInfo ? ` · ${item.discountInfo}` : ''}
        </SText>
      </View>
      <SText variant="body" style={s.resultArrow}>›</SText>
    </Pressable>
  );
});

export function SearchScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'SearchScreen'>>();
  const inputRef = useRef<TextInput>(null);
  const { colors, isDark } = useCommerceTheme();
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);

  // Debounce: 검색은 유저가 입력을 멈춘 뒤 150ms 후에 실행
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 150);
    return () => clearTimeout(t);
  }, [query]);

  const { data: groupBuysData } = useQuery({ queryKey: ['group-buys'], queryFn: fetchGroupBuys, retry: false });
  const { data: influencersData } = useQuery({ queryKey: ['influencers'], queryFn: fetchInfluencers, retry: false });
  const { data: popularTerms } = useQuery({
    queryKey: ['popular-search-terms'],
    // Rolling 24-hour window keeps the ranking populated even right after midnight.
    queryFn: () => fetchPopularSearchTerms(10, 24),
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setRecent(Array.isArray(parsed) ? parsed : [DEFAULT_RECENT_TERM]);
        } catch {
          setRecent([DEFAULT_RECENT_TERM]);
        }
      } else {
        setRecent([DEFAULT_RECENT_TERM]);
      }
    }).catch(() => setRecent([DEFAULT_RECENT_TERM]));
  }, []);

  // Focus the search input every time the tab is entered so the keyboard
  // comes up automatically on each visit, not just the first.
  useFocusEffect(
    useCallback(() => {
      let focusTimer: ReturnType<typeof setTimeout> | null = null;
      const interactionTask = InteractionManager?.runAfterInteractions?.(() => {
        focusTimer = setTimeout(() => inputRef.current?.focus(), 220);
      }) ?? { cancel: () => {} };

      return () => {
        interactionTask.cancel?.();
        if (focusTimer) clearTimeout(focusTimer);
      };
    }, []),
  );

  const saveRecent = useCallback((text: string) => {
    if (!text.trim()) return;
    setRecent((prev) => {
      const next = pushRecentTerm(prev, text, RECENT_MAX);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const removeRecent = useCallback((text: string) => {
    setRecent((prev) => {
      const next = prev.filter((s) => s !== text);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const groupBuys = useMemo(() => groupBuysData?.length ? groupBuysData : fallbackGroupBuys, [groupBuysData]);
  const influencers = useMemo(() => {
    if (influencersData?.length) return influencersData;
    return getFallbackInfluencers(groupBuys);
  }, [influencersData, groupBuys]);
  const searchResults = useMemo(
    () => searchInfluencers(influencers, debouncedQuery).slice(0, 8),
    [influencers, debouncedQuery],
  );
  const groupBuySearchIndex = useMemo(
    () => groupBuys.map((gb) => ({
      item: gb,
      text: [
        gb.productName,
        gb.brandName,
        gb.category ? CATEGORY_LABELS[gb.category] ?? gb.category : null,
        gb.category,
        gb.rawPost.influencer.instagramUsername,
      ]
        .filter(Boolean)
        .map((part) => normalizeForSearch(part))
        .join(' '),
    })),
    [groupBuys],
  );
  const dealResults = useMemo(() => {
    const q = normalizeForSearch(debouncedQuery);
    if (!q) return [];
    return groupBuySearchIndex
      .filter(({ text }) => text.includes(q))
      .slice(0, 10)
      .map(({ item }) => item);
  }, [groupBuySearchIndex, debouncedQuery]);

  const hasQuery = debouncedQuery.trim().length > 0;
  const recentTerms = useMemo(() => recent.slice(0, RECENT_MAX), [recent]);
  const s = useMemo(() => makeStyles(colors), [colors]);

  const handleSubmit = useCallback(() => {
    saveRecent(query);
    void logSearchTerm(query);
  }, [query, saveRecent]);

  const handleSelectInfluencer = useCallback((inf: Influencer) => {
    saveRecent(inf.instagramUsername);
    navigation.navigate('InfluencerGroupBuys', {
      influencerUsername: inf.instagramUsername,
      influencerDisplayName: inf.displayName,
    });
  }, [navigation, saveRecent]);

  const handleSelectDeal = useCallback((gb: GroupBuy) => {
    saveRecent(gb.productName ?? gb.rawPost.influencer.instagramUsername);
    // Record search-to-deal conversion for popularity scoring (only when a query is active).
    const activeQuery = query.trim();
    if (activeQuery) {
      void logSearchTerm(activeQuery, gb.id);
    }
    navigation.navigate('Detail', { groupBuy: gb });
}, [navigation, saveRecent, query]);

  const handleRecentTap = useCallback((text: string) => {
    setQuery(text);
    inputRef.current?.focus();
  }, []);

  const handlePopularTermTap = useCallback((text: string) => {
    setQuery(text);
    saveRecent(text);
    void logSearchTerm(text);
    inputRef.current?.blur();
  }, [saveRecent]);

  const handleClearQuery = useCallback(() => {
    setQuery('');
    inputRef.current?.focus();
  }, []);
  const canGoBack = navigation.canGoBack();
  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  return (
    <View style={s.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <SText variant="caption" style={[s.headerPoints, { top: Math.max(insets.top - 12, 8) }]}>59</SText>
        {canGoBack ? (
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel="뒤로가기"
            hitSlop={8}
            onPress={handleBack}
            style={s.backBtn}
          >
            <SText variant="body" style={s.backIcon}>←</SText>
          </Pressable>
        ) : null}
        <View style={s.inputWrap}>
          <SearchGlyph color={colors.weak} size={20} />
          <TextInput
            ref={inputRef}
            accessibilityLabel="공구 검색"
            placeholder="상품을 검색해보세요"
            placeholderTextColor={colors.weak}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            style={s.input}
          />
          {query ? (
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel="검색어 지우기"
              hitSlop={8}
              onPress={handleClearQuery}
              style={s.clearBtn}
            >
              <SText variant="body" style={s.clearIcon}>×</SText>
            </Pressable>
          ) : null}
        </View>
      </View>

      <KeyboardFormScreen
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scrollContent}
      >
        {hasQuery ? (
          <View style={s.resultsWrap}>
            {dealResults.length > 0 && (
              <>
                <SText variant="label" style={s.resultTitle}>공구</SText>
                {dealResults.map((gb) => (
                  <DealSearchResultRow
                    key={gb.id}
                    item={gb}
                    onSelect={handleSelectDeal}
                    s={s}
                  />
                ))}
              </>
            )}
            {searchResults.length > 0 && (
              <SearchResultsPanel results={searchResults} onPressInfluencer={handleSelectInfluencer} />
            )}
            {dealResults.length === 0 && searchResults.length === 0 && (
              <View style={s.emptyState}>
                <SText variant="body" style={s.emptyIcon}>⌕</SText>
                <SText variant="body" style={s.emptyTitle}>검색 결과가 없어요</SText>
                <SText variant="body" style={s.emptyDesc}>브랜드명, 제품명 또는 인플루언서 username을 다시 확인해 주세요.</SText>
              </View>
            )}
          </View>
        ) : (
          <View style={s.suggestWrap}>
            {recentTerms.length > 0 ? (
              <>
                <SText variant="label" style={s.sectionTitle}>최근 검색어</SText>
                {recentTerms.map((text) => (
                  <View key={text} style={s.recentRow}>
                    <Pressable
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={`${text} 검색`}
                      style={({ pressed }) => [s.recentLeft, pressed && s.pressed]}
                      onPress={() => handleRecentTap(text)}
                    >
                      <ClockGlyph s={s} />
                      <SText variant="body" style={s.recentText}>{text}</SText>
                    </Pressable>
                    <Pressable
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={`${text} 삭제`}
                      hitSlop={8}
                      onPress={() => removeRecent(text)}
                      style={s.recentRemove}
                    >
                      <SText variant="body" style={s.recentRemoveIcon}>×</SText>
                    </Pressable>
                  </View>
               ))}
             </>
           ) : null}
            {popularTerms && popularTerms.length > 0 ? (
              <>
                <SText variant="label" style={[s.sectionTitle, s.popularTitle]}>인기 검색어</SText>
                <View style={s.popularGrid}>
                  {popularTerms.map((term: PopularSearchTerm) => (
                    <Pressable
                      key={`${term.rank}-${term.keyword}`}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={`인기 검색어 ${term.rank}위 ${term.keyword}`}
                      hitSlop={6}
                      onPress={() => handlePopularTermTap(term.keyword)}
                      style={({ pressed }) => [s.popularItem, pressed && s.pressed]}
                    >
                      <SText variant="label" style={s.popularRank}>{term.rank}</SText>
                      <SText variant="body" style={s.popularKeyword} numberOfLines={1}>{term.keyword}</SText>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
          </View>
        )}
      </KeyboardFormScreen>
    </View>
  );
}

function makeStyles(colors: CommerceColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 18,
      paddingBottom: 0,
      backgroundColor: colors.bg,
      position: 'relative',
    },
    headerPoints: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '900',
      lineHeight: 17,
      position: 'absolute',
      right: 25,
    },
    backBtn: { width: 28, height: 48, alignItems: 'flex-start', justifyContent: 'center' },
    backIcon: { fontSize: 30, color: colors.text, fontWeight: '500', lineHeight: 36 },
    inputWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.softBg,
      borderRadius: 16,
      paddingHorizontal: 14,
      height: 48,
    },
    input: {
      flex: 1,
      fontSize: 18,
      color: colors.text,
      fontWeight: '500',
      height: 48,
      letterSpacing: 0,
      lineHeight: 24,
      padding: 0,
    },
    clearBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
    clearIcon: { fontSize: 24, color: colors.disabled, fontWeight: '300', lineHeight: 26 },
    scrollContent: { paddingBottom: spacing['4xl'], paddingHorizontal: 18 },

    resultsWrap: { paddingTop: 36 },
    resultTitle: { color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: 0, lineHeight: 26, marginBottom: 14 },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    resultLeft: { flex: 1 },
    resultName: { fontSize: 15, fontWeight: '700', color: colors.text, letterSpacing: 0, lineHeight: 21 },
    resultMeta: { fontSize: 12, color: colors.weak, fontWeight: '500', letterSpacing: 0, lineHeight: 17, marginTop: 3 },
    resultArrow: { fontSize: 22, color: colors.weak, lineHeight: 26 },

    emptyState: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: 72 },
    emptyIcon: { fontSize: 40, color: colors.weak, marginBottom: spacing.md, opacity: 0.4 },
    emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
    emptyDesc: { fontSize: 13, color: colors.weak, lineHeight: 20, textAlign: 'center' },

    suggestWrap: { paddingTop: 32 },
    sectionTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: 27,
      marginBottom: 24,
    },
    recentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 36,
    },
    popularTitle: { marginTop: 52 },
    popularGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    popularItem: {
      alignItems: 'center',
      backgroundColor: colors.softBg,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    popularRank: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0,
      lineHeight: 17,
    },
    popularKeyword: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 0,
      lineHeight: 19,
      maxWidth: 120,
    },
    recentLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 36 },
    clockGlyph: {
      alignItems: 'center',
      borderColor: colors.weak,
      borderRadius: 999,
      borderWidth: 1.8,
      height: 20,
      justifyContent: 'center',
      position: 'relative',
      width: 20,
    },
    clockHandLong: {
      backgroundColor: colors.weak,
      borderRadius: 999,
      height: 6,
      left: 9,
      position: 'absolute',
      top: 4,
      transform: [{ rotate: '32deg' }],
      width: 1.8,
    },
    clockHandShort: {
      backgroundColor: colors.weak,
      borderRadius: 999,
      height: 1.8,
      left: 6,
      position: 'absolute',
      top: 10,
      width: 6,
    },
    recentText: { color: colors.muted, fontSize: 16, fontWeight: '600', letterSpacing: 0, lineHeight: 23 },
    recentRemove: { alignItems: 'center', height: 38, justifyContent: 'center', marginRight: -3, width: 38 },
    recentRemoveIcon: { color: colors.disabled, fontSize: 28, fontWeight: '200', lineHeight: 32 },
    pressed: { opacity: 0.6 },
  });
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { KeyboardFormScreen } from '../components/keyboard/KeyboardFormScreen';
import { SearchResultsPanel } from '../components/home/SearchResultsPanel';
import { SText } from '../components/ui/SText';
import { fallbackGroupBuys, fetchGroupBuys, fetchInfluencers, searchInfluencers } from '../api';
import { borderRadius, spacing, typography } from '../design/tokens';
import { useTheme } from '../context/ThemeContext';
import type { ColorPalette } from '../context/ThemeContext';
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
const RECENT_MAX = 8;

const TRENDING_DEFAULT = [
  '클렌징 오일',
  '린넨 원피스',
  '선크림',
  '색조 세트',
  '여름 니트',
  '다이어리',
];

const CATEGORY_LABELS: Record<string, string> = {
  beauty: '뷰티',
  fashion: '패션',
  food: '푸드',
  lifestyle: '라이프',
  baby: '육아',
  digital: '디지털',
};

export function SearchScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'SearchScreen'>>();
  const inputRef = useRef<TextInput>(null);
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

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then((raw) => {
      if (raw) {
        try { setRecent(JSON.parse(raw)); } catch { /* ignore */ }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const saveRecent = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setRecent((prev) => {
      const next = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, RECENT_MAX);
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

  const clearAllRecent = useCallback(() => {
    setRecent([]);
    AsyncStorage.removeItem(RECENT_KEY).catch(() => {});
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
  const dealResults = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return [];
    return groupBuys.filter((gb) => {
      const name = (gb.productName ?? '').toLowerCase();
      const category = (gb.category ? CATEGORY_LABELS[gb.category] ?? gb.category : '').toLowerCase();
      const user = gb.rawPost.influencer.instagramUsername.toLowerCase();
      return name.includes(q) || category.includes(q) || user.includes(q);
    }).slice(0, 10);
  }, [groupBuys, debouncedQuery]);

  const hasQuery = debouncedQuery.trim().length > 0;
  const s = useMemo(() => makeStyles(colors), [colors]);

  const handleSubmit = useCallback(() => {
    saveRecent(query);
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
    navigation.navigate('Detail', { groupBuy: gb });
  }, [navigation, saveRecent]);

  const handleRecentTap = useCallback((text: string) => {
    setQuery(text);
    inputRef.current?.focus();
  }, []);

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
          hitSlop={8}
          onPress={() => navigation.goBack()}
          style={s.backBtn}
        >
          <SText variant="body" style={s.backIcon}>←</SText>
        </Pressable>
        <View style={s.inputWrap}>
          <SText variant="body" style={s.searchIcon}>⌕</SText>
          <TextInput
            ref={inputRef}
            accessibilityLabel="공구 검색"
            placeholder="카테고리, 제품명, 인플루언서 검색"
            placeholderTextColor={colors.textTertiary}
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
              onPress={() => { setQuery(''); inputRef.current?.focus(); }}
              style={s.clearBtn}
            >
              <SText variant="body" style={s.clearIcon}>×</SText>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel="취소"
          hitSlop={8}
          onPress={() => navigation.goBack()}
          style={s.cancelBtn}
        >
          <SText variant="body" style={s.cancelText}>취소</SText>
        </Pressable>
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
                  <Pressable
                    key={gb.id}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={`${gb.productName ?? gb.rawPost.influencer.instagramUsername} 보기`}
                    onPress={() => handleSelectDeal(gb)}
                    style={({ pressed }) => [s.resultRow, pressed && s.pressed]}
                  >
                    <View style={s.resultLeft}>
                      <SText variant="body" style={s.resultName}>{gb.productName ?? '제품명 없음'}</SText>
                      <SText variant="body" style={s.resultMeta}>
                        @{gb.rawPost.influencer.instagramUsername.replace(/^@/, '')}
                        {gb.discountInfo ? ` · ${gb.discountInfo}` : ''}
                      </SText>
                    </View>
                    <SText variant="body" style={s.resultArrow}>›</SText>
                  </Pressable>
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
            {recent.length > 0 && (
              <>
                <View style={s.sectionHeader}>
                  <SText variant="label" style={s.sectionTitle}>최근 검색</SText>
                  <Pressable accessible accessibilityRole="button" accessibilityLabel="전체 삭제" hitSlop={8} onPress={clearAllRecent}>
                    <SText variant="body" style={s.clearAllText}>전체 삭제</SText>
                  </Pressable>
                </View>
                {recent.map((text) => (
                  <View key={text} style={s.recentRow}>
                    <Pressable
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={`${text} 검색`}
                      style={({ pressed }) => [s.recentLeft, pressed && s.pressed]}
                      onPress={() => handleRecentTap(text)}
                    >
                      <SText variant="body" style={s.recentIcon}>⟳</SText>
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
            )}
            <SText variant="label" style={[s.sectionTitle, { marginTop: recent.length > 0 ? spacing.xl : 0 }]}>인기 검색어</SText>
            <View style={s.trendingWrap}>
              {TRENDING_DEFAULT.map((text, i) => (
                <Pressable
                  key={text}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`인기 검색어 ${i + 1}위 ${text}`}
                  style={({ pressed }) => [s.trendingChip, i === 0 && s.trendingHot, pressed && s.pressed]}
                  onPress={() => handleRecentTap(text)}
                >
                  <SText variant="body" style={[s.trendingRank, i === 0 && s.trendingRankHot]}>{i + 1}</SText>
                  <SText variant="body" style={[s.trendingText, i === 0 && s.trendingTextHot]}>{text}</SText>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </KeyboardFormScreen>
    </View>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      backgroundColor: colors.bg,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backIcon: { fontSize: 22, color: colors.textPrimary, lineHeight: 28 },
    inputWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.md,
      height: 44,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    searchIcon: { fontSize: 18, color: colors.textTertiary },
    input: { flex: 1, fontSize: 15, color: colors.textPrimary, padding: 0, height: 44 },
    clearBtn: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
    clearIcon: { fontSize: 20, color: colors.textTertiary, lineHeight: 22 },
    cancelBtn: { paddingHorizontal: spacing.xs, height: 36, alignItems: 'center', justifyContent: 'center' },
    cancelText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
    scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing['4xl'] },

    resultsWrap: { paddingTop: spacing.md },
    resultTitle: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.sm },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    resultLeft: { flex: 1 },
    resultName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    resultMeta: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
    resultArrow: { fontSize: 20, color: colors.textTertiary, lineHeight: 24 },

    emptyState: { alignItems: 'center', paddingVertical: spacing['4xl'], paddingHorizontal: spacing.xl },
    emptyIcon: { fontSize: 48, color: colors.textTertiary, marginBottom: spacing.md, opacity: 0.4 },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },
    emptyDesc: { fontSize: 13, color: colors.textTertiary, lineHeight: 20, textAlign: 'center' },

    suggestWrap: { paddingTop: spacing.md },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    sectionTitle: { ...typography.label, color: colors.textPrimary },
    clearAllText: { fontSize: 12, color: colors.textTertiary, fontWeight: '500' },
    recentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    recentLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
    recentIcon: { fontSize: 16, color: colors.textTertiary, lineHeight: 20 },
    recentText: { fontSize: 14, color: colors.textPrimary },
    recentRemove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    recentRemoveIcon: { fontSize: 18, color: colors.textTertiary, lineHeight: 22 },

    trendingWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    trendingChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    trendingHot: { backgroundColor: colors.primaryBg, borderColor: colors.primaryLight },
    trendingRank: { fontSize: 11, fontWeight: '800', color: colors.primary },
    trendingRankHot: { color: colors.primary },
    trendingText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    trendingTextHot: { color: colors.primary },
    pressed: { opacity: 0.6 },
  });
}

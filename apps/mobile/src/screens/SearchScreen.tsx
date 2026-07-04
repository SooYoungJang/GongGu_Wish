import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { KeyboardFormScreen } from '../components/keyboard/KeyboardFormScreen';
import { SearchResultsPanel } from '../components/home/SearchResultsPanel';
import { SearchGlyph } from '../components/ui/LineGlyphs';
import { SText } from '../components/ui/SText';
import { fallbackGroupBuys, fetchGroupBuys, fetchInfluencers, searchInfluencers } from '../api';
import { spacing } from '../design/tokens';
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
const DEFAULT_RECENT_TERM = '가방';
const SEARCH_BG = '#FFFFFF';
const SEARCH_TEXT = '#111827';
const SEARCH_MUTED = '#6B7280';
const SEARCH_WEAK = '#9CA3AF';
const SEARCH_SOFT_BG = '#F3F5F8';
const SEARCH_ACCENT = '#F0445E';
const SEARCH_STAR = '#F6C343';
const SEARCH_BADGE_BG = '#F3F4F6';

const CATEGORY_LABELS: Record<string, string> = {
  beauty: '뷰티',
  fashion: '패션',
  food: '푸드',
  lifestyle: '라이프',
  baby: '육아',
  digital: '디지털',
};

function getVisual(item: GroupBuy) {
  return item.thumbnailUrl ?? item.mediaItems?.find((media) => media.thumbnailUrl)?.thumbnailUrl ?? item.mediaUrls?.[0] ?? null;
}

function getDiscountPercent(item: GroupBuy) {
  const match = item.discountInfo?.match(/(\d+)\s*%/);
  return match ? `${match[1]}%` : '41%';
}

function formatRecentProductName(item: GroupBuy) {
  return item.productName ?? '뒤척임 제로 경추 베개, 그레이, 74...';
}

function ClockGlyph({ s }: { s: ReturnType<typeof makeStyles> }) {
  return (
    <View style={s.clockGlyph}>
      <View style={s.clockHandLong} />
      <View style={s.clockHandShort} />
    </View>
  );
}

function ProductFallbackArt({ s }: { s: ReturnType<typeof makeStyles> }) {
  return (
    <View style={s.productFallbackArt}>
      <View style={[s.pillowShape, s.pillowBack]} />
      <View style={[s.pillowShape, s.pillowFront]} />
      <View style={s.pillowEndLeft} />
      <View style={s.pillowEndRight} />
    </View>
  );
}

function RecentProductCard({
  item,
  onPress,
  s,
}: {
  item: GroupBuy;
  onPress: () => void;
  s: ReturnType<typeof makeStyles>;
}) {
  const visual = getVisual(item);
  const discountPercent = getDiscountPercent(item);

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${formatRecentProductName(item)} 최근 본 상품 보기`}
      onPress={onPress}
      style={({ pressed }) => [s.recentProductCard, pressed && s.pressed]}
    >
      <View style={s.productImageWrap}>
        {visual ? (
          <Image source={{ uri: visual }} style={s.productImage} />
        ) : (
          <ProductFallbackArt s={s} />
        )}
        <View style={s.productSaleBadge}>
          <SText variant="label" style={s.productSaleBadgeText}>{discountPercent} 특가</SText>
        </View>
        <View style={s.heartButton}>
          <SText variant="body" style={s.heartText}>♡</SText>
        </View>
      </View>
      <SText variant="body" numberOfLines={2} style={s.productName}>
        {formatRecentProductName(item)}
      </SText>
      <View style={s.priceRow}>
        <SText variant="body" style={s.discountText}>{discountPercent}</SText>
        <SText variant="body" style={s.priceText}>14,652원</SText>
      </View>
      <View style={s.ratingRow}>
        <SText variant="body" style={s.starText}>★</SText>
        <SText variant="body" style={s.ratingText}>3.7 (527)</SText>
      </View>
      <View style={s.sellerBadge}>
        <SText variant="caption" style={s.sellerBadgeText}>베스트판매자</SText>
      </View>
    </Pressable>
  );
}

export function SearchScreen() {
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
      const brand = (gb.brandName ?? '').toLowerCase();
      const category = (gb.category ? CATEGORY_LABELS[gb.category] ?? gb.category : '').toLowerCase();
      const user = gb.rawPost.influencer.instagramUsername.toLowerCase();
      return name.includes(q) || brand.includes(q) || category.includes(q) || user.includes(q);
    }).slice(0, 10);
  }, [groupBuys, debouncedQuery]);

  const hasQuery = debouncedQuery.trim().length > 0;
  const recentTerms = recent.slice(0, 1);
  const recentProduct = groupBuys[0] ?? null;
  const s = useMemo(() => makeStyles(), []);

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
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
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
          <SearchGlyph color={SEARCH_WEAK} size={20} />
          <TextInput
            ref={inputRef}
            accessibilityLabel="공구 검색"
            placeholder="상품을 검색해보세요"
            placeholderTextColor={SEARCH_WEAK}
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
            <SText variant="label" style={s.recentProductTitle}>최근 본 상품</SText>
            {recentProduct ? (
              <RecentProductCard item={recentProduct} onPress={() => handleSelectDeal(recentProduct)} s={s} />
            ) : null}
          </View>
        )}
      </KeyboardFormScreen>
    </View>
  );
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: SEARCH_BG },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 0,
      backgroundColor: SEARCH_BG,
    },
    backBtn: { width: 40, height: 48, alignItems: 'flex-start', justifyContent: 'center' },
    backIcon: { fontSize: 30, color: SEARCH_TEXT, fontWeight: '500', lineHeight: 36 },
    inputWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: SEARCH_SOFT_BG,
      borderRadius: 16,
      paddingHorizontal: 14,
      height: 48,
    },
    input: {
      flex: 1,
      fontSize: 18,
      color: SEARCH_TEXT,
      fontWeight: '500',
      height: 48,
      letterSpacing: 0,
      lineHeight: 24,
      padding: 0,
    },
    clearBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
    clearIcon: { fontSize: 24, color: '#D1D5DB', fontWeight: '300', lineHeight: 26 },
    scrollContent: { paddingBottom: spacing['4xl'], paddingHorizontal: 24 },

    resultsWrap: { paddingTop: 44 },
    resultTitle: { color: SEARCH_TEXT, fontSize: 20, fontWeight: '800', letterSpacing: 0, lineHeight: 26, marginBottom: 14 },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#EEF0F3',
    },
    resultLeft: { flex: 1 },
    resultName: { fontSize: 15, fontWeight: '700', color: SEARCH_TEXT, letterSpacing: 0, lineHeight: 21 },
    resultMeta: { fontSize: 12, color: SEARCH_WEAK, fontWeight: '500', letterSpacing: 0, lineHeight: 17, marginTop: 3 },
    resultArrow: { fontSize: 22, color: SEARCH_WEAK, lineHeight: 26 },

    emptyState: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: 72 },
    emptyIcon: { fontSize: 40, color: SEARCH_WEAK, marginBottom: spacing.md, opacity: 0.4 },
    emptyTitle: { fontSize: 15, fontWeight: '800', color: SEARCH_TEXT, marginBottom: spacing.xs },
    emptyDesc: { fontSize: 13, color: SEARCH_WEAK, lineHeight: 20, textAlign: 'center' },

    suggestWrap: { paddingTop: 50 },
    sectionTitle: {
      color: SEARCH_TEXT,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: 0,
      lineHeight: 27,
      marginBottom: 24,
    },
    recentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 36,
    },
    recentLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 36 },
    clockGlyph: {
      alignItems: 'center',
      borderColor: '#B9C0CA',
      borderRadius: 999,
      borderWidth: 1.8,
      height: 20,
      justifyContent: 'center',
      position: 'relative',
      width: 20,
    },
    clockHandLong: {
      backgroundColor: '#B9C0CA',
      borderRadius: 999,
      height: 6,
      left: 9,
      position: 'absolute',
      top: 4,
      transform: [{ rotate: '32deg' }],
      width: 1.8,
    },
    clockHandShort: {
      backgroundColor: '#B9C0CA',
      borderRadius: 999,
      height: 1.8,
      left: 6,
      position: 'absolute',
      top: 10,
      width: 6,
    },
    recentText: { color: SEARCH_MUTED, fontSize: 16, fontWeight: '600', letterSpacing: 0, lineHeight: 23 },
    recentRemove: { alignItems: 'center', height: 38, justifyContent: 'center', marginRight: -3, width: 38 },
    recentRemoveIcon: { color: '#D1D5DB', fontSize: 28, fontWeight: '200', lineHeight: 32 },
    recentProductTitle: {
      color: SEARCH_TEXT,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: 0,
      lineHeight: 27,
      marginBottom: 20,
      marginTop: 52,
    },
    recentProductCard: {
      minHeight: 250,
      width: 128,
    },
    productImageWrap: {
      backgroundColor: '#DEDCD5',
      borderRadius: 10,
      height: 128,
      overflow: 'hidden',
      position: 'relative',
      width: 128,
    },
    productImage: { height: '100%', resizeMode: 'cover', width: '100%' },
    productFallbackArt: {
      alignItems: 'center',
      backgroundColor: '#DAD7D0',
      flex: 1,
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
    },
    pillowShape: {
      backgroundColor: '#F6F7F8',
      borderColor: 'rgba(156, 163, 175, 0.22)',
      borderRadius: 16,
      borderWidth: 1,
      height: 42,
      position: 'absolute',
      width: 100,
    },
    pillowBack: {
      left: 17,
      top: 49,
      transform: [{ rotate: '-8deg' }],
    },
    pillowFront: {
      left: 8,
      top: 63,
      transform: [{ rotate: '-18deg' }],
    },
    pillowEndLeft: {
      backgroundColor: '#1F2937',
      borderRadius: 999,
      height: 13,
      left: 5,
      position: 'absolute',
      top: 79,
      transform: [{ rotate: '-19deg' }],
      width: 32,
    },
    pillowEndRight: {
      backgroundColor: '#1F2937',
      borderRadius: 999,
      height: 14,
      position: 'absolute',
      right: 6,
      top: 65,
      transform: [{ rotate: '-11deg' }],
      width: 28,
    },
    productSaleBadge: {
      alignItems: 'center',
      backgroundColor: SEARCH_ACCENT,
      borderRadius: 7,
      justifyContent: 'center',
      left: 9,
      minHeight: 28,
      paddingHorizontal: 9,
      position: 'absolute',
      top: 9,
    },
    productSaleBadgeText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 0, lineHeight: 19 },
    heartButton: {
      alignItems: 'center',
      bottom: 9,
      height: 32,
      justifyContent: 'center',
      position: 'absolute',
      right: 8,
      width: 32,
    },
    heartText: {
      color: '#FFFFFF',
      fontSize: 32,
      fontWeight: '300',
      lineHeight: 35,
      textShadowColor: 'rgba(31, 41, 55, 0.2)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    productName: {
      color: SEARCH_MUTED,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0,
      lineHeight: 23,
      marginTop: 10,
    },
    priceRow: {
      alignItems: 'baseline',
      flexDirection: 'row',
      gap: 4,
      marginTop: 2,
    },
    discountText: { color: SEARCH_MUTED, fontSize: 16, fontWeight: '800', letterSpacing: 0, lineHeight: 22 },
    priceText: { color: SEARCH_TEXT, fontSize: 18, fontWeight: '900', letterSpacing: 0, lineHeight: 24 },
    ratingRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
      marginTop: 5,
    },
    starText: { color: SEARCH_STAR, fontSize: 13, lineHeight: 17 },
    ratingText: { color: SEARCH_MUTED, fontSize: 13, fontWeight: '600', letterSpacing: 0, lineHeight: 18 },
    sellerBadge: {
      alignSelf: 'flex-start',
      backgroundColor: SEARCH_BADGE_BG,
      borderRadius: 4,
      marginTop: 6,
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    sellerBadgeText: { color: SEARCH_WEAK, fontSize: 11, fontWeight: '800', letterSpacing: 0, lineHeight: 14 },
    pressed: { opacity: 0.6 },
  });
}

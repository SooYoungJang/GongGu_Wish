import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── Mock native modules that api.ts depends on ── */
vi.mock('react-native', () => ({
  Platform: { select: (obj: Record<string, string>) => obj.default },
  StyleSheet: { create: (s: unknown) => s },
}));
vi.mock('expo-secure-store', () => ({
  default: { getItemAsync: vi.fn(), setItemAsync: vi.fn(), deleteItemAsync: vi.fn() },
}));

/* ── Pure function: applyRankingQuery ── */
import { applyRankingQuery } from '../useSellerRankings';
import { MOCK_RANKINGS } from '../rankingFixtures';
import type { SellerRanking, SellerRankingQuery } from '../types';

/* =========================================================================
 * Helpers
 * ========================================================================= */

const BASE_QUERY: SellerRankingQuery = {
  category: 'all',
  period: 'weekly',
  sort: 'popular',
};

function rankingFixture(overrides: Partial<SellerRanking> = {}): SellerRanking {
  return {
    id: 'rank-test',
    sellerId: 'seller-test',
    rank: 10,
    previousRank: null,
    trend: { kind: 'new' },
    displayName: '테스트셀러',
    username: 'test.seller',
    avatarUrl: null,
    category: 'food',
    followerCount: 1000,
    activeDealCount: 3,
    endingSoonCount: 1,
    trustScore: 90,
    isFollowing: false,
    isSponsored: false,
    thumbnails: [],
    representativeGroupBuyId: null,
    ...overrides,
  };
}

/* =========================================================================
 * Tests: applyRankingQuery (pure function — no mocking needed)
 * ========================================================================= */

describe('applyRankingQuery', () => {
  const allItems: SellerRanking[] = [
    rankingFixture({ id: 'a', rank: 1, category: 'food', displayName: '가마', isFollowing: true, endingSoonCount: 5, followerCount: 50000, trend: { kind: 'up', delta: 10 } }),
    rankingFixture({ id: 'b', rank: 2, category: 'beauty', displayName: '뷰티샵', isFollowing: false, endingSoonCount: 3, followerCount: 30000, trend: { kind: 'up', delta: 3 } }),
    rankingFixture({ id: 'c', rank: 3, category: 'fashion', displayName: '패션하우스', isFollowing: true, endingSoonCount: 1, followerCount: 20000, trend: { kind: 'same' } }),
    rankingFixture({ id: 'd', rank: 4, category: 'food', displayName: '다담', isFollowing: false, endingSoonCount: 0, followerCount: 10000, trend: { kind: 'down', delta: 2 } }),
    rankingFixture({ id: 'e', rank: 5, category: 'electronics', displayName: '테크샵', isFollowing: false, endingSoonCount: 7, followerCount: 80000, trend: { kind: 'new' } }),
 ];

/* ── Category filter (7 categories) ── */

  it('filters by specific category', () => {
    const q: SellerRankingQuery = { ...BASE_QUERY, category: 'food' };
    const result = applyRankingQuery(allItems, q);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.category === 'food')).toBe(true);
  });

  it('returns all items when category=all', () => {
    const q: SellerRankingQuery = { ...BASE_QUERY, category: 'all' };
    const result = applyRankingQuery(allItems, q);
    expect(result).toHaveLength(allItems.length);
  });

  it('can filter every category', () => {
    const categories: SellerRankingQuery['category'][] = ['beauty', 'fashion', 'food', 'living', 'baby', 'electronics'];
    for (const category of categories) {
      const q: SellerRankingQuery = { ...BASE_QUERY, category };
      const result = applyRankingQuery(allItems, q);
      expect(result.every((r) => r.category === category)).toBe(true);
    }
  });

  /* ── Period-based sort (3 periods) ── */

  it('sorts by endingSoonCount descending when period=today', () => {
    const q: SellerRankingQuery = { ...BASE_QUERY, period: 'today' };
    const result = applyRankingQuery(allItems, q);
    const counts = result.map((r) => r.endingSoonCount ?? 0);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
  });

  it('sorts by followerCount descending when period=monthly', () => {
    const q: SellerRankingQuery = { ...BASE_QUERY, period: 'monthly' };
    const result = applyRankingQuery(allItems, q);
    const counts = result.map((r) => r.followerCount ?? 0);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
  });

  it('keeps original order when period=weekly (no period sort)', () => {
    const q: SellerRankingQuery = { ...BASE_QUERY, period: 'weekly' };
    const result = applyRankingQuery(allItems, q);
    expect(result.map((r) => r.id)).toEqual(allItems.map((r) => r.id));
  });

  /* ── Sort dimension (5 sorts) ── */

  it('sorts by rising trend delta descending when sort=rising', () => {
    const q: SellerRankingQuery = { ...BASE_QUERY, sort: 'rising' };
    const result = applyRankingQuery(allItems, q);
    expect(result[0].id).toBe('a'); // delta=10
    expect(result[1].id).toBe('b'); // delta=3
  });

  it('sorts by endingSoonCount descending when sort=deadlineSoon', () => {
    const q: SellerRankingQuery = { ...BASE_QUERY, sort: 'deadlineSoon' };
    const result = applyRankingQuery(allItems, q);
    const counts = result.map((r) => r.endingSoonCount ?? 0);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
  });

  it('sorts newDeal items first when sort=newDeal', () => {
    const q: SellerRankingQuery = { ...BASE_QUERY, sort: 'newDeal' };
    const result = applyRankingQuery(allItems, q);
    expect(result[0].id).toBe('e'); // only item with trend.kind === 'new'
  });

  it('can apply every sort type', () => {
    const sorts: SellerRankingQuery['sort'][] = ['popular', 'rising', 'deadlineSoon', 'newDeal'];
    for (const sort of sorts) {
      const q: SellerRankingQuery = { ...BASE_QUERY, sort };
      const result = applyRankingQuery(allItems, q);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(allItems.length);
    }
  });

  /* ── Combinations ── */

  it('applies category filter on its own', () => {
    const q: SellerRankingQuery = { category: 'food', period: 'weekly', sort: 'popular' };
    const result = applyRankingQuery(allItems, q);
    expect(result.every((r) => r.category === 'food')).toBe(true);
  });

  it('combines category filter with sort', () => {
    const q: SellerRankingQuery = { ...BASE_QUERY, category: 'food', sort: 'popular' };
    const result = applyRankingQuery(allItems, q);
    expect(result.length).toBeLessThanOrEqual(allItems.length);
  });

 it('applies all 7 categories × 3 periods × 5 sorts without error', () => {
   const categories: SellerRankingQuery['category'][] = ['all', 'beauty', 'fashion', 'food', 'living', 'baby', 'electronics'];
   const periods: SellerRankingQuery['period'][] = ['today', 'weekly', 'monthly'];
   const sorts: SellerRankingQuery['sort'][] = ['popular', 'rising', 'deadlineSoon', 'newDeal'];
    let totalCombos = 0;
    for (const category of categories) {
      for (const period of periods) {
        for (const sort of sorts) {
       const q: SellerRankingQuery = { category, period, sort };
          const result = applyRankingQuery(allItems, q);
          expect(Array.isArray(result)).toBe(true);
          totalCombos++;
        }
      }
    }
    expect(totalCombos).toBe(7 * 3 * 4);
  });

  /* ── Edge cases ── */

  it('handles empty items gracefully', () => {
    const result = applyRankingQuery([], BASE_QUERY);
    expect(result).toEqual([]);
  });

  it('sort=rising ranks up-trend items before same/down/new with rank tiebreaker', () => {
    const q: SellerRankingQuery = { ...BASE_QUERY, sort: 'rising' };
    const result = applyRankingQuery(allItems, q);
    expect(result[0].id).toBe('a'); // up delta=10
    expect(result[1].id).toBe('b'); // up delta=3
  });

  it('period sort runs before sort override (latter wins order)', () => {
    const q: SellerRankingQuery = { ...BASE_QUERY, period: 'today', sort: 'rising' };
    const result = applyRankingQuery(allItems, q);
    expect(result[0].id).toBe('a'); // rising sort wins final order
  });
});

/* =========================================================================
 * Tests: Fallback mechanism (MOCK_RANKINGS + applyRankingQuery)
 *
 * The hook's queryFn does:
 *   try { return await fetchSellerRankings(query) }
 *   catch { return applyRankingQuery(MOCK_RANKINGS, query) }
 *
 * These tests verify the catch path works correctly.
 * ========================================================================= */

describe('try-API-then-fallback (fallback path)', () => {
  it('fallback returns filtered data from MOCK_RANKINGS', () => {
    const result = applyRankingQuery(MOCK_RANKINGS, BASE_QUERY);
    expect(result.length).toBeGreaterThan(0);
    // Default query (all/weekly/popular) returns all items
    expect(result).toEqual(MOCK_RANKINGS);
  });

  it('fallback filters MOCK_RANKINGS by category', () => {
    const q: SellerRankingQuery = { ...BASE_QUERY, category: 'food' };
    const result = applyRankingQuery(MOCK_RANKINGS, q);
    expect(result.every((r) => r.category === 'food')).toBe(true);
  });

 it('fallback with failing API scenario — no items match extreme filter', () => {
   // Unlikely-to-match filter should still run without throwing
   const q: SellerRankingQuery = { category: 'electronics', period: 'today', sort: 'newDeal' };
   const result = applyRankingQuery(MOCK_RANKINGS, q);
   // Assert it ran without error (may be empty depending on data)
   expect(Array.isArray(result)).toBe(true);
 });
});

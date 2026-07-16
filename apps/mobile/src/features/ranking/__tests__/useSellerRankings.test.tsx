import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { select: (obj: Record<string, string>) => obj.default },
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock('expo-secure-store', () => ({
  default: { getItemAsync: vi.fn(), setItemAsync: vi.fn(), deleteItemAsync: vi.fn() },
}));

import { useSellerRankings } from '../useSellerRankings';
import type {
  GroupBuyRankingItem,
  GroupBuyRankingQuery,
  GroupBuyRankingResponse,
  RankingLoadState,
} from '../types';

const queryMock = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
  options: undefined as
    | { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> }
    | undefined,
}));

const apiMock = vi.hoisted(() => ({
  fetchGroupBuyRankings: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: typeof queryMock.options) => {
    queryMock.options = options;
    return queryMock.current;
  },
}));

vi.mock('../../../api', () => apiMock);

const BASE_QUERY: GroupBuyRankingQuery = {
  category: 'all',
  period: 'weekly',
  sort: 'popular',
  limit: 20,
};

function rankingItem(id: string): GroupBuyRankingItem {
  return {
    groupBuyId: id,
    rank: 1,
    previousRank: null,
    trend: { kind: 'new' },
    productName: id,
    brandName: null,
    username: `${id}.seller`,
    category: 'food',
    thumbnailUrl: null,
    mediaUrls: [],
    startDate: null,
    endDate: null,
    priceKrw: null,
    metrics: {
      deepViews: 10,
      bookmarks: 2,
      notifications: 1,
      searchClicks: 3,
      score: 37,
      scoreDelta: 37,
    },
    scoreVersion: 'v2',
  };
}

function response(data: GroupBuyRankingItem[]): GroupBuyRankingResponse {
  return {
    data,
    pageInfo: { limit: 20, hasMore: false, nextCursor: null },
    meta: {
      category: 'all',
      period: 'weekly',
      sort: 'popular',
      scoreVersion: 'v2',
      generatedAt: '2026-07-16T00:00:00.000Z',
    },
  };
}

function renderRanking(query: GroupBuyRankingQuery): RankingLoadState {
  let state: RankingLoadState = { status: 'loading' };

  function Harness() {
    state = useSellerRankings(query);
    return null;
  }

  act(() => {
    TestRenderer.create(<Harness />);
  });
  return state;
}

describe('useSellerRankings', () => {
  beforeEach(() => {
    queryMock.options = undefined;
    queryMock.current = {
      data: response([]),
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    };
    apiMock.fetchGroupBuyRankings.mockReset();
  });

  it('passes filters to the shared server ranking query without client sorting', async () => {
    const query: GroupBuyRankingQuery = {
      category: 'food',
      period: 'monthly',
      sort: 'rising',
      limit: 10,
      cursor: 'cursor-1',
    };
    const first = rankingItem('first');
    const second = rankingItem('second');
    queryMock.current.data = response([second, first]);
    apiMock.fetchGroupBuyRankings.mockResolvedValue(response([second, first]));

    const state = renderRanking(query);

    expect(state.status).toBe('ready');
    if (state.status === 'ready') {
      expect(state.data.map((item) => item.groupBuyId)).toEqual(['second', 'first']);
    }
    expect(queryMock.options?.queryKey).toEqual([
      'group-buy-rankings',
      'food',
      'monthly',
      'rising',
      10,
      'cursor-1',
    ]);
    await queryMock.options?.queryFn();
    expect(apiMock.fetchGroupBuyRankings).toHaveBeenCalledWith(query);
  });

  it('keeps backend failures as error instead of falling back to mock data', () => {
    queryMock.current = {
      data: undefined,
      isError: true,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    };

    const state = renderRanking(BASE_QUERY);

    expect(state.status).toBe('error');
    if (state.status === 'error') {
      expect(state.data).toBeUndefined();
      expect(state.retry).toBe(queryMock.current.refetch);
    }
  });

  it('distinguishes an empty success response from an error', () => {
    const state = renderRanking(BASE_QUERY);

    expect(state.status).toBe('empty');
    if (state.status === 'empty') {
      expect(state.updatedAt).toBe(Date.parse('2026-07-16T00:00:00.000Z'));
    }
  });

  it('keeps cached rankings visible when a background refresh fails', () => {
    const cached = rankingItem('cached');
    queryMock.current = {
      data: response([cached]),
      isError: true,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    };

    const state = renderRanking(BASE_QUERY);

    expect(state.status).toBe('ready');
    if (state.status === 'ready') {
      expect(state.data).toEqual([cached]);
      expect(state.refreshError).toContain('최신');
    }
  });
});

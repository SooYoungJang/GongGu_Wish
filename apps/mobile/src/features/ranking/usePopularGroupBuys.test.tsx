import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  GroupBuyRankingItem,
  GroupBuyRankingResponse,
  RankingLoadState,
  RankingSort,
} from './types';
import { usePopularGroupBuys } from './usePopularGroupBuys';

const queryMock = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
  options: undefined as
    | {
        queryKey: readonly unknown[];
        queryFn: () => Promise<unknown>;
      }
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

vi.mock('../../api', () => apiMock);

function rankingItem(
  id: string,
  overrides: Partial<GroupBuyRankingItem> = {},
): GroupBuyRankingItem {
  return {
    groupBuyId: id,
    rank: 1,
    previousRank: null,
    trend: { kind: 'same' },
    productName: id,
    brandName: null,
    username: `${id}.seller`,
    category: 'living',
    thumbnailUrl: null,
    mediaUrls: [],
    startDate: null,
    endDate: null,
    priceKrw: null,
    metrics: {
      deepViews: 0,
      bookmarks: 0,
      notifications: 0,
      searchClicks: 0,
      score: 0,
      scoreDelta: 0,
    },
    scoreVersion: 'v2',
    ...overrides,
  };
}

function response(data: GroupBuyRankingItem[]): GroupBuyRankingResponse {
  return {
    data,
    pageInfo: { limit: 30, hasMore: false, nextCursor: null },
    meta: {
      category: 'all',
      period: 'weekly',
      sort: 'popular',
      scoreVersion: 'v2',
      generatedAt: '2026-07-16T00:00:00.000Z',
    },
  };
}

function renderRanking(
  period: 'today' | 'weekly' | 'monthly' = 'weekly',
  category: 'all' | 'food' | 'living' = 'all',
  sort: RankingSort = 'popular',
): RankingLoadState {
  let state: RankingLoadState = { status: 'loading', data: undefined };

  function Harness() {
    state = usePopularGroupBuys(period, category, sort);
    return null;
  }

  act(() => {
    TestRenderer.create(<Harness />);
  });

  return state;
}

describe('usePopularGroupBuys', () => {
  beforeEach(() => {
    queryMock.options = undefined;
    queryMock.current = {
      data: response([]),
      dataUpdatedAt: 1_720_000_000_000,
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    };
    apiMock.fetchGroupBuyRankings.mockReset();
  });

  it('preserves the server ranking order and does not re-filter response data', () => {
    const first = rankingItem('first', { rank: 7, category: 'food' });
    const second = rankingItem('second', { rank: 2, category: 'living' });
    queryMock.current.data = response([first, second]);

    const state = renderRanking('weekly', 'food', 'rising');

    expect(state.status).toBe('ready');
    if (state.status === 'ready') {
      expect(state.data).toEqual([first, second]);
    }
    expect(queryMock.options?.queryKey).toEqual([
      'group-buy-rankings',
      'weekly',
      'food',
      'rising',
      30,
    ]);
  });

  it('sends all ranking filters to the shared API contract', async () => {
    const request = {
      category: 'food' as const,
      period: 'monthly' as const,
      sort: 'deadlineSoon' as const,
      limit: 30,
    };
    apiMock.fetchGroupBuyRankings.mockResolvedValue(response([]));

    renderRanking(request.period, request.category, request.sort);

    await queryMock.options?.queryFn();
    expect(apiMock.fetchGroupBuyRankings).toHaveBeenCalledWith(request);
  });

  it('preserves the server-generated time for an empty success response', () => {
    const state = renderRanking();

    expect(state.status).toBe('empty');
    if (state.status === 'empty') {
      expect(state.updatedAt).toBe(Date.parse('2026-07-16T00:00:00.000Z'));
    }
  });

  it('keeps API failures as an error state instead of showing fallback rankings', () => {
    queryMock.current = {
      ...queryMock.current,
      data: undefined,
      isError: true,
      isLoading: false,
    };

    const state = renderRanking();

    expect(state.status).toBe('error');
    if (state.status === 'error') {
      expect(state.data).toBeUndefined();
      expect(state.retry).toBe(queryMock.current.refetch);
    }
  });
});

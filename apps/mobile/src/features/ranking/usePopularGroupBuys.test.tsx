import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GroupBuy } from '../../types';
import type { RankingLoadState, RankingSort } from './types';
import { usePopularGroupBuys } from './usePopularGroupBuys';

const queryMock = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => queryMock.current,
}));

vi.mock('../../api', () => ({
  POPULAR_PERIOD_HOURS: { today: 24, weekly: 168, monthly: 720 },
  fetchPopularGroupBuysWithDetail: vi.fn(),
}));

function groupBuy(id: string): GroupBuy {
  return {
    id,
    productName: id,
    brandName: null,
    category: 'living',
    startDate: null,
    endDate: null,
    purchaseUrl: null,
    discountInfo: null,
    summary: null,
    confidence: 0,
    thumbnailUrl: null,
    videoUrl: null,
    mediaUrls: [],
    mediaType: null,
    rawPost: { postUrl: '', influencer: { instagramUsername: `${id}.seller` } },
  };
}

function renderRanking(sort: RankingSort): RankingLoadState {
  let state: RankingLoadState = { status: 'loading', data: undefined };

  function Harness() {
    state = usePopularGroupBuys('weekly', 'all', sort);
    return null;
  }

  act(() => {
    TestRenderer.create(<Harness />);
  });

  return state;
}

describe('usePopularGroupBuys', () => {
  beforeEach(() => {
    queryMock.current = {
      data: [],
      dataUpdatedAt: 1_720_000_000_000,
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    };
  });

  it('sorts rising deals by recent search clicks with deterministic tie breakers', () => {
    queryMock.current.data = [
      {
        groupBuyId: 'popular',
        deepViews: 100,
        bookmarks: 3,
        searchClicks: 1,
        score: 100,
        groupBuy: groupBuy('popular'),
      },
      {
        groupBuyId: 'rising',
        deepViews: 20,
        bookmarks: 2,
        searchClicks: 9,
        score: 30,
        groupBuy: groupBuy('rising'),
      },
    ];

    const state = renderRanking('rising');

    expect(state.status).toBe('ready');
    if (state.status === 'ready') {
      expect(state.data.map((item) => item.representativeGroupBuyId)).toEqual(['rising', 'popular']);
    }
  });

  it('preserves the completed refresh time for empty filtered results', () => {
    const state = renderRanking('popular');

    expect(state.status).toBe('empty');
    if (state.status === 'empty') {
      expect(state.updatedAt).toBe(1_720_000_000_000);
    }
  });

  it.each([
    ['lifestyle', 'living'],
    ['digital', 'electronics'],
  ] as const)('maps the legacy %s category to %s for ranking filters', (legacy, canonical) => {
    queryMock.current.data = [
      {
        groupBuyId: legacy,
        deepViews: 1,
        bookmarks: 0,
        searchClicks: 0,
        score: 1,
        groupBuy: { ...groupBuy(legacy), category: legacy },
      },
    ];

    const state = renderRanking('popular');

    expect(state.status).toBe('ready');
    if (state.status === 'ready') {
      expect(state.data[0].category).toBe(canonical);
    }
  });
});

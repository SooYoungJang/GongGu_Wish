import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { POPULAR_PERIOD_HOURS, fetchPopularGroupBuysWithDetail } from '../../api';
import type { GroupBuy } from '../../types';
import {
  type RankingCategory,
  type RankingLoadState,
  type RankingPeriod,
  type RankingSort,
  type SellerRanking,
} from './types';

function groupBuyToSellerRanking(
  index: number,
  popular: {
    groupBuyId: string;
    deepViews: number;
    bookmarks: number;
    searchClicks: number;
    score: number;
    groupBuy?: GroupBuy;
  },
): SellerRanking | null {
  const gb = popular.groupBuy;
  if (!gb) return null;
  const username = gb.rawPost.influencer.instagramUsername || 'unknown';
  const category: RankingCategory =
    gb.category === 'lifestyle'
      ? 'living'
      : gb.category === 'digital'
        ? 'electronics'
        : (gb.category ?? 'living');
  return {
    id: `pop-${popular.groupBuyId}`,
    sellerId: popular.groupBuyId,
    rank: index + 1,
    previousRank: null,
    trend: { kind: 'same' },
    displayName: gb.productName ?? gb.brandName ?? username,
    username,
    avatarUrl: null,
    category,
    followerCount: popular.deepViews,
    activeDealCount: popular.bookmarks,
    endingSoonCount: popular.searchClicks,
    trustScore: Math.round(Number(popular.score)),
    isFollowing: false,
    isSponsored: false,
    thumbnails: gb.thumbnailUrl
      ? [
          {
            id: `thumb-${popular.groupBuyId}`,
            imageUrl: gb.thumbnailUrl,
            label: null,
            groupBuyId: popular.groupBuyId,
          },
        ]
      : (gb.mediaUrls ?? []).slice(0, 3).map((url, mediaIndex) => ({
          id: `thumb-${popular.groupBuyId}-${mediaIndex}`,
          imageUrl: url,
          label: null,
          groupBuyId: popular.groupBuyId,
        })),
    representativeGroupBuyId: popular.groupBuyId,
    startDate: gb.startDate,
    endDate: gb.endDate,
  };
}

export function usePopularGroupBuys(
  period: RankingPeriod,
  category: RankingCategory = 'all',
  sort: RankingSort = 'popular',
  limit = 30,
): RankingLoadState {
  const hours = POPULAR_PERIOD_HOURS[period];

  const query = useQuery({
    queryKey: ['popular-group-buys', period, limit],
    queryFn: () => fetchPopularGroupBuysWithDetail(limit, hours),
    staleTime: 1000 * 60 * 5,
  });

  return useMemo((): RankingLoadState => {
    if (query.isLoading) {
      return { status: 'loading', data: undefined };
    }

    if (query.isError) {
      return {
        status: 'error',
        data: undefined,
        message: '인기 공구 랭킹 데이터를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.',
        retry: query.refetch,
      };
    }

    const rows = (query.data ?? []).filter((item) => {
      if (!item.groupBuy) return false;
      // Category filter: 'all' shows everything (including uncategorized);
      // a specific category only shows items that match it.
      if (category === 'all') return true;
      return item.groupBuy.category === category;
    });
    // Re-sort by the selected sort chip (server already ranks by score).
    const sorted = [...rows];
    if (sort === 'rising') {
      sorted.sort((a, b) => b.searchClicks - a.searchClicks || b.deepViews - a.deepViews || b.bookmarks - a.bookmarks);
    } else if (sort === 'newDeal') {
      sorted.sort((a, b) => {
        const ta = a.groupBuy?.createdAt ? Date.parse(a.groupBuy.createdAt) : 0;
        const tb = b.groupBuy?.createdAt ? Date.parse(b.groupBuy.createdAt) : 0;
        return tb - ta;
      });
    } else if (sort === 'deadlineSoon') {
      sorted.sort((a, b) => {
        const ta = a.groupBuy?.endDate ? Date.parse(a.groupBuy.endDate) : Number.MAX_SAFE_INTEGER;
        const tb = b.groupBuy?.endDate ? Date.parse(b.groupBuy.endDate) : Number.MAX_SAFE_INTEGER;
        return ta - tb;
      });
    }
    // 'popular' keeps the server score order.
    const data: SellerRanking[] = [];
    sorted.forEach((row, index) => {
      const mapped = groupBuyToSellerRanking(index, row);
      if (mapped) data.push(mapped);
    });

    if (data.length === 0) {
      return {
        status: 'empty',
        message: '이 기간에 인기 공구가 없습니다.',
        updatedAt: query.dataUpdatedAt || undefined,
      };
    }

    return {
      status: 'ready',
      data,
      refreshing: query.isFetching && !query.isLoading,
      updatedAt: query.dataUpdatedAt || undefined,
    };
  }, [period, category, sort, query.data, query.isError, query.isFetching, query.isLoading, query.refetch]);
}

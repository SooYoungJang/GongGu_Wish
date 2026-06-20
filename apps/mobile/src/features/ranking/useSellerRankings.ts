import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { MOCK_RANKINGS } from './rankingFixtures';
import type { RankingLoadState, SellerRanking, SellerRankingQuery } from './types';

function applyRankingQuery(items: SellerRanking[], query: SellerRankingQuery): SellerRanking[] {
  let next = items;

  if (query.tab === 'following') {
    next = next.filter((item) => item.isFollowing);
  }

  if (query.category !== 'all') {
    next = next.filter((item) => item.category === query.category);
  }

  if (query.period === 'today') {
    next = [...next].sort((a, b) => (b.endingSoonCount ?? 0) - (a.endingSoonCount ?? 0) || a.rank - b.rank);
  }

  if (query.period === 'monthly') {
    next = [...next].sort((a, b) => (b.followerCount ?? 0) - (a.followerCount ?? 0) || a.rank - b.rank);
  }

  if (query.sort === 'rising') {
    next = [...next].sort((a, b) => {
      const aDelta = a.trend.kind === 'up' ? a.trend.delta : 0;
      const bDelta = b.trend.kind === 'up' ? b.trend.delta : 0;
      return bDelta - aDelta || a.rank - b.rank;
    });
  }

  if (query.sort === 'deadlineSoon') {
    next = [...next].sort((a, b) => (b.endingSoonCount ?? 0) - (a.endingSoonCount ?? 0) || a.rank - b.rank);
  }

  if (query.sort === 'newDeal') {
    next = [...next].sort((a, b) => (a.trend.kind === 'new' ? -1 : 0) - (b.trend.kind === 'new' ? -1 : 0) || a.rank - b.rank);
  }

  if (query.sort === 'brand') {
    next = [...next].sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko-KR'));
  }

  return next;
}

export function useSellerRankings(query: SellerRankingQuery): RankingLoadState {
  const rankingsQuery = useQuery({
    queryKey: ['seller-rankings', query],
    queryFn: async () => applyRankingQuery(MOCK_RANKINGS, query),
    staleTime: 1000 * 60 * 5,
  });

  return useMemo((): RankingLoadState => {
    if (rankingsQuery.isLoading) {
      return { status: 'loading', data: rankingsQuery.data };
    }

    if (rankingsQuery.isError) {
      return {
        status: 'error',
        data: rankingsQuery.data,
        message: '랭킹을 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
        retry: rankingsQuery.refetch,
      };
    }

    const data = rankingsQuery.data ?? [];

    if (data.length === 0) {
      return {
        status: 'empty',
        message: query.tab === 'following' ? '팔로우한 셀러가 없어요' : '아직 집계된 랭킹이 없어요',
      };
    }

    return { status: 'ready', data, refreshing: rankingsQuery.isFetching && !rankingsQuery.isLoading };
  }, [query.tab, rankingsQuery.data, rankingsQuery.isError, rankingsQuery.isFetching, rankingsQuery.isLoading, rankingsQuery.refetch]);
}

export { applyRankingQuery };

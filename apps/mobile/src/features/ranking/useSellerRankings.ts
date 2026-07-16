import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchGroupBuyRankings } from '../../api';
import type { GroupBuyRankingQuery, RankingLoadState } from './types';

export function useSellerRankings(query: GroupBuyRankingQuery): RankingLoadState {
  const rankingsQuery = useQuery({
    queryKey: [
      'group-buy-rankings',
      query.category,
      query.period,
      query.sort,
      query.limit,
      query.cursor,
    ],
    queryFn: () => fetchGroupBuyRankings(query),
  });

  return useMemo((): RankingLoadState => {
    const response = rankingsQuery.data;
    const updatedAt = response?.meta.generatedAt
      ? Date.parse(response.meta.generatedAt)
      : undefined;

    if (rankingsQuery.isLoading) {
      return { status: 'loading', data: response?.data, refresh: rankingsQuery.refetch };
    }

    if (rankingsQuery.isError) {
      return {
        status: 'error',
        data: response?.data,
        message: '랭킹을 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
        retry: rankingsQuery.refetch,
        refresh: rankingsQuery.refetch,
      };
    }

    const data = response?.data ?? [];

    if (data.length === 0) {
      return {
        status: 'empty',
        message: '아직 집계된 랭킹이 없어요',
        updatedAt,
        refresh: rankingsQuery.refetch,
      };
    }

    return {
      status: 'ready',
      data,
      refreshing: rankingsQuery.isFetching && !rankingsQuery.isLoading,
      updatedAt,
      refresh: rankingsQuery.refetch,
    };
  }, [rankingsQuery.data, rankingsQuery.isError, rankingsQuery.isFetching, rankingsQuery.isLoading, rankingsQuery.refetch]);
}

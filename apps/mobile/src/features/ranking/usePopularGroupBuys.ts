import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchGroupBuyRankings } from '../../api';
import type {
  RankingCategory,
  RankingLoadState,
  RankingPeriod,
  RankingSort,
} from './types';

export function usePopularGroupBuys(
  period: RankingPeriod,
  category: RankingCategory = 'all',
  sort: RankingSort = 'popular',
  limit = 30,
): RankingLoadState {
  const query = useQuery({
    queryKey: ['group-buy-rankings', period, category, sort, limit],
    queryFn: () =>
      fetchGroupBuyRankings({
        category,
        period,
        sort,
        limit,
      }),
  });

  return useMemo((): RankingLoadState => {
    const response = query.data;
    const updatedAt = response?.meta.generatedAt
      ? Date.parse(response.meta.generatedAt)
      : query.dataUpdatedAt || undefined;

    if (query.isLoading) {
      return {
        status: 'loading',
        data: response?.data,
        refresh: query.refetch,
      };
    }

    const data = response?.data ?? [];

    if (query.isError && data.length === 0) {
      return {
        status: 'error',
        data: response?.data,
        message: '인기 공구 랭킹 데이터를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.',
        retry: query.refetch,
        refresh: query.refetch,
      };
    }

    if (data.length === 0) {
      return {
        status: 'empty',
        message: '이 기간에 인기 공구가 없습니다.',
        updatedAt,
        refresh: query.refetch,
      };
    }

    return {
      status: 'ready',
      data,
      refreshError: query.isError
        ? '최신 랭킹을 확인하지 못했어요. 저장된 랭킹을 표시하고 있습니다.'
        : undefined,
      refreshing: query.isFetching && !query.isLoading,
      updatedAt,
      refresh: query.refetch,
    };
  }, [query.data, query.dataUpdatedAt, query.isError, query.isFetching, query.isLoading, query.refetch]);
}

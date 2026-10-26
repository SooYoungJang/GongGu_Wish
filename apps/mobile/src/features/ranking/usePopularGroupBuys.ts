import { useCallback, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

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
  limit = 10,
): RankingLoadState {
  const query = useInfiniteQuery({
    queryKey: ['group-buy-rankings', period, category, sort, limit, 'pages'],
    queryFn: ({ pageParam }) =>
      fetchGroupBuyRankings({
        category,
        period,
        sort,
        limit,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: null as string | null,
    getNextPageParam: page => page.pageInfo.hasMore ? page.pageInfo.nextCursor ?? undefined : undefined,
  });
  const { fetchNextPage, hasNextPage, isFetching } = query;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetching) void fetchNextPage({ cancelRefetch: false });
  }, [fetchNextPage, hasNextPage, isFetching]);

  return useMemo((): RankingLoadState => {
    const response = query.data?.pages[0];
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

    const seen = new Set<string>();
    const data = query.data?.pages.flatMap(page => page.data).filter(item => {
      if (seen.has(item.groupBuyId)) return false;
      seen.add(item.groupBuyId);
      return true;
    }) ?? [];

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
      refreshError: query.isError && !query.isFetchNextPageError
        ? '최신 랭킹을 확인하지 못했어요. 저장된 랭킹을 표시하고 있습니다.'
        : undefined,
      refreshing: query.isFetching && !query.isLoading && !query.isFetchingNextPage,
      hasNextPage: query.hasNextPage,
      loadingMore: query.isFetchingNextPage,
      loadMoreError: query.isFetchNextPageError,
      loadMore,
      updatedAt,
      refresh: query.refetch,
    };
  }, [query.data, query.dataUpdatedAt, query.isError, query.isFetching, query.isLoading, query.refetch, query.hasNextPage, query.isFetchingNextPage, query.isFetchNextPageError, loadMore]);
}

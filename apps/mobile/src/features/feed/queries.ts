import { useCallback, useMemo } from "react";
import { infiniteQueryOptions, useInfiniteQuery } from "@tanstack/react-query";

import { fetchGroupBuyPage, type GroupBuyCursor, type GroupBuyFeedFilter, type GroupBuyPage } from "./api";
import { formatDateKey } from "../../utils/groupBuyDates";

export const GROUP_BUY_FEED_STALE_TIME_MS = 30_000;

export function getGroupBuyFeedOptions(filter: GroupBuyFeedFilter = {}) {
  const normalized = {
    category: filter.category ?? "all",
    username: filter.username?.replace(/^@/, "").toLowerCase() ?? "",
    from: filter.from,
    to: filter.to,
    today: filter.today ?? formatDateKey(new Date()),
  };
  return infiniteQueryOptions({
    queryKey: ["group-buys", "feed", normalized] as const,
    queryFn: ({ pageParam, signal }) => fetchGroupBuyPage(normalized, pageParam, signal),
    initialPageParam: null as GroupBuyCursor | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    refetchOnMount: false,
    staleTime: GROUP_BUY_FEED_STALE_TIME_MS,
  });
}

export function flattenGroupBuyPages(pages: GroupBuyPage[] = []) {
  const seen = new Set<string>();
  return pages.flatMap(page => page.items).filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function useGroupBuyFeed(filter: GroupBuyFeedFilter = {}) {
  const query = useInfiniteQuery(getGroupBuyFeedOptions(filter));
  const items = useMemo(() => flattenGroupBuyPages(query.data?.pages), [query.data]);
  const { fetchNextPage, hasNextPage, isFetching } = query;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetching) {
      void fetchNextPage({ cancelRefetch: false });
    }
  }, [fetchNextPage, hasNextPage, isFetching]);
  return { ...query, items, loadMore };
}

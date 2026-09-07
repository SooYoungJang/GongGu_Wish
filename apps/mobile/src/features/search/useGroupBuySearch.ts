import { useInfiniteQuery } from "@tanstack/react-query";

import { searchGroupBuys, type GroupBuySearchCursor } from "../../api";
import { formatDateKey } from "../../utils/groupBuyDates";
import { normalizeForSearch } from "../../utils/search";

export function useGroupBuySearch(query: string) {
  const normalizedQuery = normalizeForSearch(query);
  return useInfiniteQuery({
    queryKey: ["group-buy-search", normalizedQuery, formatDateKey(new Date())],
    queryFn: ({ pageParam, signal }) => searchGroupBuys(query, pageParam, signal),
    initialPageParam: null as GroupBuySearchCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: normalizedQuery.length > 0,
  });
}

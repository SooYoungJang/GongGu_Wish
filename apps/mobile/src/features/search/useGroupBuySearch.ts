import { useInfiniteQuery } from "@tanstack/react-query";

import { searchGroupBuys, type GroupBuySearchCursor } from "../../api";
import { formatDateKey } from "../../utils/groupBuyDates";
import { normalizeForSearch } from "../../utils/search";
import { telemetry } from "../../telemetry/telemetry";
import { searchInfluencerPage, type InfluencerSearchCursor } from "./api";

export function useGroupBuySearch(query: string) {
  const normalizedQuery = normalizeForSearch(query);
  return useInfiniteQuery({
    queryKey: ["group-buy-search", normalizedQuery, formatDateKey(new Date())],
    queryFn: async ({ pageParam, signal }) => {
      const page = await searchGroupBuys(query, pageParam, signal);
      // Counts successful first-page requests, including explicit revalidation.
      if (!pageParam && !signal.aborted) telemetry.record("search_results", page.items.length === 0 ? "zero" : page.nextCursor ? "many" : "some");
      return page;
    },
    initialPageParam: null as GroupBuySearchCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: normalizedQuery.length > 0,
  });
}

export function useInfluencerSearch(query: string) {
  const term = normalizeForSearch(query.trim().replace(/^@/, ""));
  return useInfiniteQuery({
    queryKey: ["influencer-search", term],
    queryFn: ({ pageParam, signal }) => searchInfluencerPage(query, pageParam, signal),
    initialPageParam: null as InfluencerSearchCursor | null,
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: term.length > 0,
  });
}

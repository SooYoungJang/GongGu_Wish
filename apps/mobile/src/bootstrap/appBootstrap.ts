import type { QueryClient } from "@tanstack/react-query";

import { fetchHomeBannerGroupBuys } from "../api";
import { getHomeBannerDateKey } from "@gonggu/shared/utils/homeBanner";
import { getGroupBuyFeedOptions } from "../features/feed/queries";

export const HOME_DATA_STALE_TIME_MS = 30_000;
export const HOME_BOOTSTRAP_TIMEOUT_MS = 3_000;

export const GROUP_BUYS_QUERY_KEY = ["group-buys", "feed"] as const;

export function getGroupBuysQueryOptions() {
  return getGroupBuyFeedOptions();
}

export function getHomeBannerQueryOptions(dateKey: string) {
  return {
    queryKey: ["home-banner-group-buys", dateKey] as const,
    queryFn: () => fetchHomeBannerGroupBuys(),
    refetchOnMount: false,
    staleTime: HOME_DATA_STALE_TIME_MS,
  } as const;
}

type QueryPrefetcher = Pick<QueryClient, "prefetchQuery" | "prefetchInfiniteQuery">;

export async function prefetchHomeBootstrap(
  queryClient: QueryPrefetcher,
  now = new Date(),
): Promise<{ failed: number; succeeded: number }> {
  const dateKey = getHomeBannerDateKey(now);
  const results = await Promise.allSettled([
    queryClient.prefetchInfiniteQuery(getGroupBuysQueryOptions()),
    queryClient.prefetchQuery(getHomeBannerQueryOptions(dateKey)),
  ]);

  return results.reduce(
    (summary, result) => {
      if (result.status === "fulfilled") {
        summary.succeeded += 1;
      } else {
        summary.failed += 1;
      }
      return summary;
    },
    { failed: 0, succeeded: 0 },
  );
}

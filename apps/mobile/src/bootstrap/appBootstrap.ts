import type { QueryClient } from "@tanstack/react-query";

import { fetchGroupBuys, fetchHomeBannerGroupBuys } from "../api";
import { getHomeBannerDateKey } from "@gonggu/shared/utils/homeBanner";

export const HOME_DATA_STALE_TIME_MS = 30_000;
export const HOME_BOOTSTRAP_TIMEOUT_MS = 3_000;

export const GROUP_BUYS_QUERY_KEY = ["group-buys"] as const;

export function getGroupBuysQueryOptions() {
  return {
    queryKey: GROUP_BUYS_QUERY_KEY,
    queryFn: fetchGroupBuys,
    refetchOnMount: false,
    staleTime: HOME_DATA_STALE_TIME_MS,
  } as const;
}

export function getHomeBannerQueryOptions(dateKey: string) {
  return {
    queryKey: ["home-banner-group-buys", dateKey] as const,
    queryFn: () => fetchHomeBannerGroupBuys(),
    refetchOnMount: false,
    staleTime: HOME_DATA_STALE_TIME_MS,
  } as const;
}

type QueryPrefetcher = Pick<QueryClient, "prefetchQuery">;

export async function prefetchHomeBootstrap(
  queryClient: QueryPrefetcher,
  now = new Date(),
): Promise<{ failed: number; succeeded: number }> {
  const dateKey = getHomeBannerDateKey(now);
  const results = await Promise.allSettled([
    queryClient.prefetchQuery(getGroupBuysQueryOptions()),
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

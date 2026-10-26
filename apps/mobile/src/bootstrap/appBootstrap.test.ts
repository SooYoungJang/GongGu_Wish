import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-query", (importOriginal) => importOriginal());

import {
  HOME_DATA_STALE_TIME_MS,
  getGroupBuysQueryOptions,
  getHomeBannerQueryOptions,
  prefetchHomeBootstrap,
} from "./appBootstrap";

describe("home bootstrap query contract", () => {
  it("shares the home query keys and a bounded freshness window", () => {
    expect(getGroupBuysQueryOptions()).toMatchObject({
      queryKey: ["group-buys", "feed", expect.objectContaining({ category: "all" })],
      initialPageParam: null,
      refetchOnMount: false,
      staleTime: HOME_DATA_STALE_TIME_MS,
    });
    expect(getHomeBannerQueryOptions("2026-08-11")).toMatchObject({
      queryKey: ["home-banner-group-buys", "2026-08-11"],
      refetchOnMount: false,
      staleTime: HOME_DATA_STALE_TIME_MS,
    });
  });

  it("prefetches both home payloads and tolerates one failed request", async () => {
    const prefetchInfiniteQuery = vi.fn().mockResolvedValue(undefined);
    const prefetchQuery = vi.fn().mockRejectedValue(new Error("offline"));

    const result = await prefetchHomeBootstrap(
      { prefetchQuery, prefetchInfiniteQuery },
      new Date(2026, 7, 11),
    );

    expect(prefetchInfiniteQuery).toHaveBeenCalledTimes(1);
    expect(prefetchQuery).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ failed: 1, succeeded: 1 });
  });
});

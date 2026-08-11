import { describe, expect, it, vi } from "vitest";

import {
  HOME_DATA_STALE_TIME_MS,
  getGroupBuysQueryOptions,
  getHomeBannerQueryOptions,
  prefetchHomeBootstrap,
} from "./appBootstrap";

describe("home bootstrap query contract", () => {
  it("shares the home query keys and a bounded freshness window", () => {
    expect(getGroupBuysQueryOptions()).toMatchObject({
      queryKey: ["group-buys"],
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
    const prefetchQuery = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("offline"));

    const result = await prefetchHomeBootstrap(
      { prefetchQuery },
      new Date(2026, 7, 11),
    );

    expect(prefetchQuery).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ failed: 1, succeeded: 1 });
  });
});

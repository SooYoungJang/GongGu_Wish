import { afterEach, describe, expect, it, vi } from "vitest";

vi.unmock("@tanstack/react-query");

import { focusManager } from "@tanstack/react-query";
import { ApiError } from "./api-types";
import {
  createMobileQueryClient,
  reportQueryError,
  shouldRetryMobileQuery,
  syncQueryFocus,
} from "./query-client";

describe("mobile query policy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    focusManager.setFocused(undefined);
  });

  it("treats cached data as stale and revalidates on app lifecycle events", () => {
    const client = createMobileQueryClient();

    expect(client.getDefaultOptions().queries).toMatchObject({
      gcTime: 300_000,
      refetchOnMount: "always",
      refetchOnReconnect: "always",
      refetchOnWindowFocus: "always",
      staleTime: 0,
    });
    expect(client.getDefaultOptions().queries?.retry).toBe(
      shouldRetryMobileQuery,
    );
  });

  it("retries one transient failure but never retries client or abort errors", () => {
    expect(
      shouldRetryMobileQuery(0, new TypeError("Network request failed")),
    ).toBe(true);
    expect(
      shouldRetryMobileQuery(1, new TypeError("Network request failed")),
    ).toBe(false);
    expect(shouldRetryMobileQuery(0, new ApiError(503, "Unavailable"))).toBe(
      true,
    );
    expect(shouldRetryMobileQuery(0, new ApiError(429, "Slow down"))).toBe(
      true,
    );
    expect(shouldRetryMobileQuery(0, new ApiError(400, "Bad request"))).toBe(
      false,
    );
    expect(
      shouldRetryMobileQuery(
        0,
        Object.assign(new Error("Aborted"), { name: "AbortError" }),
      ),
    ).toBe(false);
  });

  it("bridges native AppState changes to the TanStack focus manager", () => {
    const setFocused = vi.spyOn(focusManager, "setFocused");

    syncQueryFocus("background", "android");
    syncQueryFocus("active", "android");
    syncQueryFocus("background", "web");

    expect(setFocused).toHaveBeenNthCalledWith(1, false);
    expect(setFocused).toHaveBeenNthCalledWith(2, true);
    expect(setFocused).toHaveBeenCalledTimes(2);
  });

  it("logs query failures with a key and safe error metadata", () => {
    const error = new ApiError(503, "Unavailable");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    reportQueryError(error, ["home-banner-group-buys", "2026-07-17"]);

    expect(consoleError).toHaveBeenCalledWith("[Query] request failed", {
      message: "Unavailable",
      name: "ApiError",
      queryKey: ["home-banner-group-buys", "2026-07-17"],
      status: 503,
    });
  });
});

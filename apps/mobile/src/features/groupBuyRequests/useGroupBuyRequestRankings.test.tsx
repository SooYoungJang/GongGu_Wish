import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GROUP_BUY_REQUEST_RANKINGS_QUERY_KEY } from "./queryKeys";
import { useGroupBuyRequestRankings } from "./useGroupBuyRequestRankings";

const queryMock = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
  options: undefined as
    | {
        queryKey: readonly unknown[];
        queryFn: () => Promise<unknown>;
      }
    | undefined,
}));

const apiMock = vi.hoisted(() => ({
  fetchGroupBuyRequestRankings: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: typeof queryMock.options) => {
    queryMock.options = options;
    return queryMock.current;
  },
}));

vi.mock("./api", () => apiMock);

describe("useGroupBuyRequestRankings", () => {
  beforeEach(() => {
    queryMock.options = undefined;
    queryMock.current = {
      data: [],
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    };
    apiMock.fetchGroupBuyRequestRankings.mockReset();
  });

  it("uses the shared ranking key and fetch function", async () => {
    const expected = [
      {
        rank: 1,
        requestId: "request-1",
        productName: "에어팟 프로",
        requestCount: 3,
      },
    ];
    apiMock.fetchGroupBuyRequestRankings.mockResolvedValue(expected);

    let result: unknown;
    function Harness() {
      result = useGroupBuyRequestRankings();
      return null;
    }

    act(() => {
      TestRenderer.create(<Harness />);
    });

    expect(result).toBe(queryMock.current);
    expect(queryMock.options?.queryKey).toBe(
      GROUP_BUY_REQUEST_RANKINGS_QUERY_KEY,
    );
    await expect(queryMock.options?.queryFn()).resolves.toEqual(expected);
    expect(apiMock.fetchGroupBuyRequestRankings).toHaveBeenCalledOnce();
  });
});

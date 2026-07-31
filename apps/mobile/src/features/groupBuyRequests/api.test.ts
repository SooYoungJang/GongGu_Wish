import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchGroupBuyRequestRankings,
  GroupBuyRequestResponseError,
  GroupBuyRequestSessionUnavailableError,
  requestGroupBuy,
} from "./api";
import { ApiError } from "../../lib/api-types";

const postgrestMock = vi.hoisted(() => ({
  postgrestFetch: vi.fn(),
}));

const supabaseMock = vi.hoisted(() => ({
  getSupabase: vi.fn(),
  invoke: vi.fn(),
}));

const sessionMock = vi.hoisted(() => ({
  getSessionId: vi.fn(),
}));

vi.mock("../../lib/postgrest-client", () => postgrestMock);
vi.mock("../../lib/supabase", () => ({
  getSupabase: supabaseMock.getSupabase,
}));
vi.mock("../../utils/session", () => sessionMock);

describe("group buy request API", () => {
  beforeEach(() => {
    postgrestMock.postgrestFetch.mockReset();
    supabaseMock.getSupabase.mockReset();
    supabaseMock.invoke.mockReset();
    supabaseMock.getSupabase.mockReturnValue({
      functions: { invoke: supabaseMock.invoke },
    });
    sessionMock.getSessionId.mockReset();
    sessionMock.getSessionId.mockResolvedValue("session-1");
  });

  it("does not call the server when behavior-signal collection cannot provide a session id", async () => {
    sessionMock.getSessionId.mockResolvedValue(null);

    await expect(requestGroupBuy("에어팟 프로")).rejects.toBeInstanceOf(
      GroupBuyRequestSessionUnavailableError,
    );
    expect(postgrestMock.postgrestFetch).not.toHaveBeenCalled();
  });

  it("submits the product and install session through the Edge Function and maps its response", async () => {
    supabaseMock.invoke.mockResolvedValue({
      data: {
        request_id: "request-1",
        product_name: "에어팟 프로",
        request_count: 2,
        already_requested: false,
        ranking_eligible: true,
      },
      error: null,
    });

    await expect(requestGroupBuy("에어팟 프로")).resolves.toEqual({
      requestId: "request-1",
      productName: "에어팟 프로",
      requestCount: 2,
      alreadyRequested: false,
      rankingEligible: true,
    });
    expect(supabaseMock.invoke).toHaveBeenCalledWith("group-buy-request", {
      body: {
        product_name: "에어팟 프로",
        session_id: "session-1",
      },
    });
    expect(postgrestMock.postgrestFetch).not.toHaveBeenCalled();
  });

  it("rejects a malformed Edge Function response at the network boundary", async () => {
    supabaseMock.invoke.mockResolvedValue({
      data: {
        request_id: "request-1",
        product_name: "에어팟 프로",
        request_count: "2",
        already_requested: false,
        ranking_eligible: true,
      },
      error: null,
    });

    await expect(requestGroupBuy("에어팟 프로")).rejects.toBeInstanceOf(
      GroupBuyRequestResponseError,
    );
  });

  it("rejects a non-positive request count", async () => {
    supabaseMock.invoke.mockResolvedValue({
      data: {
        request_id: "request-1",
        product_name: "에어팟 프로",
        request_count: 0,
        already_requested: false,
        ranking_eligible: false,
      },
      error: null,
    });

    await expect(requestGroupBuy("에어팟 프로")).rejects.toBeInstanceOf(
      GroupBuyRequestResponseError,
    );
  });

  it("maps an Edge Function error response to the shared typed API error", async () => {
    supabaseMock.invoke.mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: new Response(
          JSON.stringify({
            error: "24시간 요청 한도를 초과했습니다.",
            code: "RATE_LIMITED",
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          },
        ),
      },
    });

    const error = await requestGroupBuy("에어팟 프로").catch(
      (reason) => reason,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 429,
      message: "24시간 요청 한도를 초과했습니다.",
    });
  });

  it("fetches at most three monthly request rankings and maps them in server order", async () => {
    postgrestMock.postgrestFetch.mockResolvedValue({
      data: [
        {
          rank: 1,
          request_id: "r-1",
          product_name: "상품 A",
          request_count: 8,
        },
        {
          rank: 2,
          request_id: "r-2",
          product_name: "상품 B",
          request_count: 5,
        },
      ],
    });

    await expect(fetchGroupBuyRequestRankings()).resolves.toEqual([
      { rank: 1, requestId: "r-1", productName: "상품 A", requestCount: 8 },
      { rank: 2, requestId: "r-2", productName: "상품 B", requestCount: 5 },
    ]);
    expect(postgrestMock.postgrestFetch).toHaveBeenCalledWith(
      "rpc/get_group_buy_request_rankings",
      {
        method: "POST",
        body: { p_limit_count: 3 },
      },
    );
  });

  it("accepts an empty ranking list", async () => {
    postgrestMock.postgrestFetch.mockResolvedValue({ data: [] });

    await expect(fetchGroupBuyRequestRankings()).resolves.toEqual([]);
  });

  it("rejects a malformed ranking RPC response at the network boundary", async () => {
    postgrestMock.postgrestFetch.mockResolvedValue({
      data: [
        { rank: 1, request_id: null, product_name: "상품 A", request_count: 8 },
      ],
    });

    await expect(fetchGroupBuyRequestRankings()).rejects.toBeInstanceOf(
      GroupBuyRequestResponseError,
    );
  });

  it("rejects a non-positive rank", async () => {
    postgrestMock.postgrestFetch.mockResolvedValue({
      data: [
        {
          rank: 0,
          request_id: "r-1",
          product_name: "상품 A",
          request_count: 2,
        },
      ],
    });

    await expect(fetchGroupBuyRequestRankings()).rejects.toBeInstanceOf(
      GroupBuyRequestResponseError,
    );
  });
});

import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  AdminGroupBuyRequestContractError,
  mapAdminGroupBuyRequest,
  mapAdminGroupBuyRequestList,
} from "./groupBuyRequestContract.ts";

Deno.test(
  "maps the aggregate request contract without exposing actor identity",
  () => {
    const result = mapAdminGroupBuyRequest({
      id: "request-1",
      productName: "에어프라이어",
      status: "OPEN",
      requestCount: 7,
      createdAt: "2026-07-01T00:00:00.000Z",
      latestRequestedAt: "2026-08-01T00:00:00.000Z",
      user_id: "user-1",
      session_hashes: ["secret"],
      ip_hash: "secret",
      actor_hash: "secret",
    });

    assertEquals(result, {
      id: "request-1",
      productName: "에어프라이어",
      status: "OPEN",
      requestCount: 7,
      createdAt: "2026-07-01T00:00:00.000Z",
      latestRequestedAt: "2026-08-01T00:00:00.000Z",
    });
    assertEquals("userId" in result, false);
    assertEquals("sessionHashes" in result, false);
    assertEquals("ipHash" in result, false);
    assertEquals("actorHash" in result, false);
  },
);

Deno.test("fails closed when aggregate fields violate the RPC contract", () => {
  assertThrows(
    () =>
      mapAdminGroupBuyRequest({
        id: "request-2",
        productName: "청소기",
        status: "UNKNOWN",
        requestCount: -3,
        createdAt: "2026-07-02T00:00:00.000Z",
        latestRequestedAt: null,
      }),
    AdminGroupBuyRequestContractError,
  );
});

Deno.test("validates and maps the RPC list envelope", () => {
  assertEquals(
    mapAdminGroupBuyRequestList({
      items: [
        {
          id: "request-3",
          productName: "식기세척기",
          status: "HIDDEN",
          requestCount: 0,
          createdAt: "2026-07-03T00:00:00.000Z",
          latestRequestedAt: null,
        },
      ],
      total: 1,
    }),
    {
      items: [
        {
          id: "request-3",
          productName: "식기세척기",
          status: "HIDDEN",
          requestCount: 0,
          createdAt: "2026-07-03T00:00:00.000Z",
          latestRequestedAt: null,
        },
      ],
      total: 1,
    },
  );
  assertThrows(
    () => mapAdminGroupBuyRequestList({ items: [], total: "1" }),
    AdminGroupBuyRequestContractError,
  );
});

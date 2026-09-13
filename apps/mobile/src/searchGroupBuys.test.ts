import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { searchGroupBuys } from "./api";
import { configurePostgrest } from "./lib/postgrest-client";

vi.mock("./utils/auth", () => ({ getAuthToken: async () => null }));

const row = (index: number) => ({
  id: `search-${index}`,
  product_name: `상품 ${index}`,
  confidence: 0,
  created_at: "2026-09-06T01:00:00",
  raw_post_id: null,
});

describe("server group-buy search", () => {
  beforeEach(() => {
    configurePostgrest("sb_publishable_search_test");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps 20 results and uses the last visible row as the cursor", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify(Array.from({ length: 21 }, (_, i) => row(i))),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;

    const page = await searchGroupBuys("크림 & 100%_", null, signal);

    expect(page.items).toHaveLength(20);
    expect(page.items[19].id).toBe("search-19");
    expect(page.nextCursor).toEqual({ id: "search-19", createdAt: row(19).created_at });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toMatch(/\/rpc\/search_public_group_buys$/);
    expect(url.searchParams.get("p_query")).toBe("크림 & 100%_");
    expect(url.searchParams.get("p_limit")).toBe("21");
    expect(fetchMock.mock.calls[0][1].signal).toBe(signal);
  });

  it("sends a text id cursor and finishes when no lookahead row remains", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([row(20)])));
    vi.stubGlobal("fetch", fetchMock);
    const cursor = { createdAt: row(19).created_at, id: "legacy/id & 19" };

    const page = await searchGroupBuys("크림", cursor);

    expect(page.items.map((item) => item.id)).toEqual(["search-20"]);
    expect(page.nextCursor).toBeNull();
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("p_before_created_at")).toBe(cursor.createdAt);
    expect(url.searchParams.get("p_before_id")).toBe(cursor.id);
  });

  it("does not request a blank search and preserves request failures for retry", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await searchGroupBuys(" \t ")).toEqual({ items: [], nextCursor: null });
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(searchGroupBuys("크림")).rejects.toThrow("offline");
  });
});

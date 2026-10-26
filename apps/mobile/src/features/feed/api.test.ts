import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchGroupBuyPage, fetchGroupBuysForRange } from "./api";
import { configurePostgrest } from "../../lib/postgrest-client";

vi.mock("../../utils/auth", () => ({ getAuthToken: async () => null }));

const row = (id: number) => ({
  id: `feed-${id}`,
  product_name: `상품 ${id}`,
  confidence: 0,
  created_at: "2026-10-26T01:00:00.123456",
  raw_post_id: null,
});

describe("public feed pages", () => {
  beforeEach(() => {
    configurePostgrest("sb_publishable_feed_test");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns only the first 10 rows and preserves the timestamp/id cursor", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(
      Array.from({ length: 11 }, (_, i) => row(i)),
    )));
    vi.stubGlobal("fetch", request);

    const page = await fetchGroupBuyPage();

    expect(page.items).toHaveLength(10);
    expect(page.nextCursor).toEqual({ id: "feed-9", createdAt: row(9).created_at });
    const url = new URL(request.mock.calls[0][0]);
    expect(url.pathname).toMatch(/\/rpc\/list_public_group_buys$/);
    expect(url.searchParams.get("p_limit")).toBe("11");
    expect(url.searchParams.get("select")).toContain("raw_post_id(post_url,");
    expect(url.searchParams.get("select")).not.toContain("raw_post_id(*");
  });

  it("sends category, seller and date filters before limiting, and supports cancellation", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify([row(20)])));
    vi.stubGlobal("fetch", request);
    const cursor = { id: "legacy/id & 19", createdAt: row(19).created_at };
    const signal = new AbortController().signal;

    const page = await fetchGroupBuyPage({
      category: "living", username: " @@  Seller \t", from: "2026-10-01", to: "2026-10-31",
      today: "2026-10-26",
    }, cursor, signal);

    const url = new URL(request.mock.calls[0][0]);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      p_category: "living", p_username: "seller", p_from: "2026-10-01", p_to: "2026-10-31",
      p_today: "2026-10-26", p_before_id: cursor.id, p_before_created_at: cursor.createdAt,
    });
    expect(request.mock.calls[0][1].signal).toBe(signal);
    expect(page.items.map(item => item.id)).toEqual(["feed-20"]);
    expect(page.nextCursor).toBeNull();
  });

  it("loads a complete bounded calendar range even when it spans more than one page", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(Array.from({ length: 11 }, (_, i) => row(i)))))
      .mockResolvedValueOnce(new Response(JSON.stringify(Array.from({ length: 11 }, (_, i) => row(i + 10)))))
      .mockResolvedValueOnce(new Response(JSON.stringify([row(20), row(21)])));
    vi.stubGlobal("fetch", request);

    const items = await fetchGroupBuysForRange("2026-10-01", "2026-10-31");

    expect(items).toHaveLength(22);
    expect(new Set(items.map(item => item.id)).size).toBe(22);
    const secondUrl = new URL(request.mock.calls[1][0]);
    expect(secondUrl.searchParams.get("p_before_id")).toBe("feed-9");
    expect(secondUrl.searchParams.get("p_from")).toBe("2026-10-01");
    expect(secondUrl.searchParams.get("p_to")).toBe("2026-10-31");
    expect(new URL(request.mock.calls[2][0]).searchParams.get("p_before_id")).toBe("feed-19");
  });

  it("keeps failures visible and rejects an unusable next-page cursor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(fetchGroupBuyPage()).rejects.toThrow("offline");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(
      Array.from({ length: 11 }, (_, i) => ({ ...row(i), created_at: null })),
    ))));
    await expect(fetchGroupBuyPage()).rejects.toThrow(/cursor|response/);
  });

  it.each(["UNKNOWN", ""])("does not turn an invalid seller %j into an unfiltered catalog request", async username => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    expect(await fetchGroupBuyPage({ username })).toEqual({ items: [], nextCursor: null });
    expect(request).not.toHaveBeenCalled();
  });
});

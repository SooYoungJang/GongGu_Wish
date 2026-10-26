import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchInfluencerPage } from "./api";
import { configurePostgrest } from "../../lib/postgrest-client";

vi.mock("../../utils/auth", () => ({ getAuthToken: async () => null }));

describe("bounded seller search", () => {
  beforeEach(() => configurePostgrest("sb_publishable_seller_search_test"));
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("returns ten matching sellers instead of downloading the seller table", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(
      Array.from({ length: 11 }, (_, index) => ({ id: `seller-${index}`, instagram_username: `Seller_${index}` })),
    )));
    vi.stubGlobal("fetch", request);
    const signal = new AbortController().signal;
    const page = await searchInfluencerPage("@Seller name", null, signal);
    expect(page.items).toHaveLength(10);
    expect(page.nextCursor).toEqual({ username: "seller_9", id: "seller-9" });
    const url = new URL(request.mock.calls[0][0]);
    expect(url.pathname).toMatch(/\/rpc\/search_public_influencers$/);
    expect(url.searchParams.get("p_query")).toBe("sellername");
    expect(url.searchParams.get("p_limit")).toBe("11");
    expect(request.mock.calls[0][1].signal).toBe(signal);
  });

  it("keeps the next cursor encoded and does not fetch an empty search", async () => {
    const request = vi.fn().mockResolvedValue(new Response("[]"));
    vi.stubGlobal("fetch", request);
    expect(await searchInfluencerPage("@")).toEqual({ items: [], nextCursor: null });
    expect(request).not.toHaveBeenCalled();
    const cursor = { username: "seller_name", id: "legacy/id & value" };
    expect((await searchInfluencerPage("100%_", cursor)).nextCursor).toBeNull();
    const url = new URL(request.mock.calls[0][0]);
    expect(url.searchParams.get("p_query")).toBe("100%_");
    expect(url.searchParams.get("p_after_username")).toBe(cursor.username);
    expect(url.searchParams.get("p_after_id")).toBe(cursor.id);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAccountBookmarks, setAccountBookmark } from "./api";
import { configurePostgrest } from "./lib/postgrest-client";

vi.mock("./utils/auth", () => ({ getAuthToken: async () => "user-token" }));

describe("account bookmark RPCs", () => {
  beforeEach(() => {
    configurePostgrest("sb_publishable_test");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("restores every page with the expected owner and text cursor", async () => {
    const row = (i: number) => ({ group_buy_id: `deal-${i}`, snapshot: {
      id: `deal-${i}`, product_name: "저장한 공구", confidence: 1, raw_post_id: null,
    } });
    const mock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(Array.from({ length: 100 }, (_, i) => row(i)))))
      .mockResolvedValueOnce(new Response(JSON.stringify([row(100)])));
    vi.stubGlobal("fetch", mock);
    expect(await fetchAccountBookmarks("user-a")).toHaveLength(101);
    expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual({ p_expected_user_id: "user-a", p_after_id: null, p_limit: 100 });
    expect(JSON.parse(mock.mock.calls[1][1].body).p_after_id).toBe("deal-99");
  });

  it("sends only owner, product id and selection, preserving authorization failures", async () => {
    const mock = vi.fn().mockResolvedValueOnce(new Response("null"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "42501", message: "Account changed" }), { status: 403 }));
    vi.stubGlobal("fetch", mock);
    await setAccountBookmark("user-a", "product-1", true);
    expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual({ p_expected_user_id: "user-a", p_group_buy_id: "product-1", p_selected: true });
    await expect(setAccountBookmark("user-a", "product-1", false)).rejects.toThrow();
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getLocalSupabaseConfig, hasLocalSupabaseConfig } from "./localSupabaseHarness";

const describeLocal = hasLocalSupabaseConfig() ? describe : describe.skip;

describeLocal("public group-buy search contract", () => {
  const prefix = `search-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const today = "2026-09-06";
  const createdAt = "2026-09-06T01:00:00";
  const id = (i: number) => `${prefix}-${String(i).padStart(3, "0")}`;
  const influencerIds = [`${prefix}-direct`, `${prefix}-post`];

  async function rest(path: string, method = "GET", body?: unknown, service = true) {
    // This guard rejects remote hosts before every fixture mutation.
    const config = getLocalSupabaseConfig();
    if (!config) throw new Error("Local Supabase configuration is required");
    const key = service ? config.serviceRoleKey : config.anonKey;
    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      method,
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error(`Search contract ${method} failed: ${response.status} ${await response.text()}`);
    return response.status === 204 || method !== "GET" ? null : response.json();
  }

  function search(params: Record<string, string> = {}) {
    const query = new URLSearchParams({ p_query: prefix, p_today: today, ...params });
    return rest(`rpc/search_public_group_buys?${query}`, "GET", undefined, false);
  }

  beforeAll(async () => {
    await rest("influencers", "POST", influencerIds.map((value, i) => ({
      id: value,
      instagram_username: `${prefix.replaceAll("-", "_")}_${i}`,
      display_name: `${prefix} ${i === 0 ? "현재 판매자" : "원본 판매자"}`,
      updated_at: createdAt,
    })));
    await rest("raw_posts", "POST", Array.from({ length: 63 }, (_, i) => ({
      id: id(i), instagram_post_id: id(i), influencer_id: influencerIds[1],
      caption: "search fixture", post_url: `https://www.instagram.com/p/${id(i)}/`,
      taken_at: createdAt, content_hash: id(i), is_candidate: true,
      collected_at: createdAt, updated_at: createdAt,
    })));
    await rest("group_buys", "POST", Array.from({ length: 63 }, (_, i) => ({
      id: id(i), raw_post_id: id(i), influencer_id: i === 0 ? influencerIds[0] : null,
      product_name: `${prefix} ${i === 0 ? "100%_ 크림" : `상품 ${i}`}`,
      brand_name: `${prefix} Brand Name`, category: "kitchen", confidence: 0.99,
      status: i === 60 ? "REVIEW_REQUIRED" : i === 62 ? "REJECTED" : "APPROVED",
      end_date: i === 0 ? `${today}T00:00:00` : i === 61 ? "2026-09-05T23:59:59" : null,
      created_at: createdAt, updated_at: createdAt,
    })));
  }, 30_000);

  afterAll(async () => {
    // Only this test's generated identifiers are removed, including partial setup.
    const ids = Array.from({ length: 63 }, (_, i) => id(i)).join(",");
    await rest(`group_buys?id=in.(${ids})`, "DELETE");
    await rest(`raw_posts?id=in.(${ids})`, "DELETE");
    await rest(`influencers?id=in.(${influencerIds.join(",")})`, "DELETE");
  }, 30_000);

  it("paginates tied timestamps without gaps or duplicates and enforces public expiry", async () => {
    const found: string[] = [];
    let cursor: Record<string, string> = {};
    for (let page = 0; page < 10; page += 1) {
      const rows = await search({ p_limit: "7", ...cursor });
      found.push(...rows.map((row: { id: string }) => row.id));
      if (rows.length < 7) break;
      const last = rows.at(-1);
      cursor = { p_before_created_at: last.created_at, p_before_id: last.id };
    }
    expect(found).toEqual(Array.from({ length: 60 }, (_, i) => id(59 - i)));
    expect(new Set(found).size).toBe(60);
    expect(found).toContain(id(0)); // Today's deadline remains visible.
  });

  it("bounds page size and treats search punctuation literally", async () => {
    expect(await search()).toHaveLength(21);
    expect(await search({ p_limit: "99999" })).toHaveLength(51);
    expect(await search({ p_query: `${prefix} 100%_` })).toHaveLength(1);
    expect(await search({ p_query: `${prefix}%` })).toHaveLength(0);
    expect(await search({ p_query: `${prefix}_` })).toHaveLength(0);
    expect(await search({ p_query: "  " })).toHaveLength(0);
  });

  it("normalizes names and searches both influencer relations with public embedding", async () => {
    expect(await search({ p_query: `${prefix} bRANDname`, p_limit: "51" })).toHaveLength(51);
    const direct = await search({
      p_query: `${prefix} 현재판매자`,
      select: "id,influencer_id(id),raw_post_id(id,influencer_id(id))",
    });
    expect(direct).toEqual([{
      id: id(0), influencer_id: { id: influencerIds[0] },
      raw_post_id: { id: id(0), influencer_id: { id: influencerIds[1] } },
    }]);
    expect(await search({ p_query: `${prefix} 원본판매자`, p_limit: "51" })).toHaveLength(51);
  });
});

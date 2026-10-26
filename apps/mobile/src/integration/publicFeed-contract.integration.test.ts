import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getLocalSupabaseConfig, hasLocalSupabaseConfig } from "./localSupabaseHarness";

const describeLocal = hasLocalSupabaseConfig() ? describe : describe.skip;

describeLocal("public feed cursor and eligibility contract", () => {
  const prefix = `feed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const username = prefix.replaceAll("-", "_");
  const today = "2026-10-26";
  const createdAt = "2026-10-26T01:00:00.123456";
  const id = (i: number) => `${prefix}-${String(i).padStart(3, "0")}`;
  const sellers = Array.from({ length: 13 }, (_, index) => ({
    id: index === 0 ? prefix : `${prefix}-seller-${String(index).padStart(2, "0")}`,
    instagram_username: index === 0 ? username : `${username}_${String(index).padStart(2, "0")}`,
    display_name: `${prefix} 셀러 ${index}`,
    updated_at: createdAt,
  }));

  async function rest(path: string, method = "GET", body?: unknown, service = true) {
    const config = getLocalSupabaseConfig();
    if (!config) throw new Error("Local Supabase configuration is required");
    const key = service ? config.serviceRoleKey : config.anonKey;
    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      method,
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error(`Feed contract ${method} failed: ${response.status} ${await response.text()}`);
    return response.status === 204 || method !== "GET" ? null : response.json();
  }

  function feed(params: Record<string, string> = {}) {
    const query = new URLSearchParams({ p_username: username, p_today: today, ...params });
    return rest(`rpc/list_public_group_buys?${query}`, "GET", undefined, false);
  }

  beforeAll(async () => {
    await rest("influencers", "POST", sellers);
    await rest("raw_posts", "POST", Array.from({ length: 64 }, (_, i) => ({
      id: id(i), instagram_post_id: id(i), influencer_id: prefix,
      caption: "Collector payload excluded from feed cards. ".repeat(512),
      post_url: `https://www.instagram.com/p/${id(i)}/`,
      taken_at: createdAt, content_hash: id(i), is_candidate: true,
      collected_at: createdAt, updated_at: createdAt,
    })));
    await rest("group_buys", "POST", Array.from({ length: 64 }, (_, i) => ({
      id: id(i), raw_post_id: id(i), influencer_id: i % 2 ? prefix : null,
      instagram_username: i === 63 ? "different_current_seller" : i === 3 || i === 4 ? "UNKNOWN" : i === 6 ? `@@   ${username}  ` : i % 3 ? null : `@${username}`,
      product_name: `${prefix} 상품 ${i}`, category: i % 2 ? "food" : "lifestyle", confidence: 0.99,
      status: i === 60 ? "REVIEW_REQUIRED" : i === 62 ? "REJECTED" : "APPROVED",
      start_date: `${today}T00:00:00`,
      end_date: i === 61 ? "2026-10-25T23:59:59" : i < 10 ? "2026-10-31T00:00:00" : `${today}T00:00:00`,
      created_at: createdAt, updated_at: createdAt,
    })));
  }, 30_000);

  afterAll(async () => {
    const ids = Array.from({ length: 64 }, (_, i) => id(i)).join(",");
    await rest(`group_buys?id=in.(${ids})`, "DELETE");
    await rest(`raw_posts?id=in.(${ids})`, "DELETE");
    await rest(`influencers?id=in.(${sellers.map(item => item.id).join(",")})`, "DELETE");
  }, 30_000);

  it("traverses tied timestamps exactly once and excludes expired/unapproved/other-seller rows", async () => {
    const found: string[] = [];
    let cursor: Record<string, string> = {};
    for (let page = 0; page < 10; page += 1) {
      const rows = await feed({ p_limit: "7", ...cursor });
      found.push(...rows.map((row: { id: string }) => row.id));
      if (rows.length < 7) break;
      const last = rows.at(-1);
      cursor = { p_before_created_at: last.created_at, p_before_id: last.id };
    }
    expect(found).toEqual(Array.from({ length: 60 }, (_, i) => id(59 - i)));
    expect(new Set(found).size).toBe(60);
    expect(await feed({ p_username: `@${username.toUpperCase()}` })).toHaveLength(21);
  });

  it("applies category aliases and overlapping dates before its bounded page limit", async () => {
    const living = await feed({ p_category: "living", p_limit: "7" });
    expect(living.map((row: { id: string }) => row.id)).toEqual([58, 56, 54, 52, 50, 48, 46].map(id));
    const dated = await feed({ p_from: "2026-10-28", p_to: "2026-10-30", p_limit: "51" });
    expect(dated.map((row: { id: string }) => row.id)).toEqual(Array.from({ length: 10 }, (_, i) => id(9 - i)));
    expect(await feed({ p_limit: "9999" })).toHaveLength(51);
  });

  it("retains public relationship embedding while reducing the first response payload", async () => {
    const old = await rest(`group_buys?select=*,influencer_id(*),raw_post_id(*,influencer_id(*))&id=like.${prefix}*&status=eq.APPROVED`, "GET", undefined, false);
    const page = await feed({ select: "*,influencer_id(instagram_username,profile_image_url),raw_post_id(post_url,influencer_id(instagram_username,profile_image_url))" });
    expect(page).toHaveLength(21);
    expect(page[0].raw_post_id.post_url).toContain(id(59));
    expect(page[0].raw_post_id).not.toHaveProperty("caption");
    const beforeBytes = Buffer.byteLength(JSON.stringify(old));
    const afterBytes = Buffer.byteLength(JSON.stringify(page));
    expect(afterBytes).toBeLessThan(beforeBytes / 10);
    console.info("Feed fixture payload bytes", { beforeBytes, afterBytes, rowsBefore: old.length, rowsAfter: page.length });
  });

  it("paginates seller matches by username/id and treats punctuation literally", async () => {
    const search = (params: Record<string, string>) => rest(`rpc/search_public_influencers?${new URLSearchParams({ p_query: username, ...params })}`, "GET", undefined, false);
    const first = await search({ p_limit: "9" });
    expect(first).toHaveLength(9);
    const lastVisible = first[7];
    const next = await search({ p_limit: "9", p_after_username: lastVisible.instagram_username, p_after_id: lastVisible.id });
    const ids = [...first.slice(0, 8), ...next].map(row => row.id);
    expect(new Set(ids)).toEqual(new Set(sellers.map(item => item.id)));
    expect(ids).toHaveLength(13);
    expect(await search({ p_query: `${prefix}셀러` })).toHaveLength(9);
    expect(await search({ p_query: `${username}%` })).toHaveLength(0);
    expect(await search({ p_query: "" })).toHaveLength(0);
  });
});

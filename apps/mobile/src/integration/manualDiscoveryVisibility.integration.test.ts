import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  getLocalSupabaseConfig,
  hasLocalSupabaseConfig,
  type LocalSupabaseConfig,
} from "./localSupabaseHarness";

const describeLocal = hasLocalSupabaseConfig() ? describe : describe.skip;

type RestOptions = {
  authorization?: string;
  body?: unknown;
  key: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  prefer?: string;
};

type GroupBuyRow = { id: string };
type RawPostRow = { id: string };
type PopularGroupBuyRow = { group_buy_id: string };

async function request<T>(
  config: LocalSupabaseConfig,
  path: string,
  options: RestOptions,
): Promise<{ payload: T; status: number }> {
  const headers: Record<string, string> = {
    apikey: options.key,
    "Content-Type": "application/json",
  };
  const authorization =
    options.authorization ??
    (options.key.split(".").length === 3 ? options.key : null);
  if (authorization) headers.Authorization = `Bearer ${authorization}`;
  if (options.prefer) headers.Prefer = options.prefer;

  const response = await fetch(`${config.url}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T) : (null as T);
  if (!response.ok) {
    throw new Error(`Local visibility fixture ${options.method ?? "GET"} ${path} failed: ${response.status} ${text}`);
  }
  return { payload, status: response.status };
}

describeLocal("local Supabase manual-discovery public visibility", () => {
  const suffix = `manual-visibility-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const influencerId = `${suffix}-influencer`;
  const states = [
    { name: "pending", status: "REVIEW_REQUIRED", review: "PENDING", source: "MANUAL_DISCOVERY", visible: false },
    { name: "rejected", status: "REJECTED", review: "REJECTED", source: "MANUAL_DISCOVERY", visible: false },
    { name: "approved", status: "APPROVED", review: "APPROVED", source: "MANUAL_DISCOVERY", visible: true },
    { name: "expired", status: "EXPIRED", review: "APPROVED", source: "MANUAL_DISCOVERY", visible: true },
    { name: "non-manual", status: "REVIEW_REQUIRED", review: "PENDING", source: "PLAYWRIGHT_PUBLIC", visible: true },
  ] as const;
  const rawPostIds = states.map(({ name }) => `${suffix}-raw-${name}`);
  const groupBuyIds = states.map(({ name }) => `${suffix}-group-${name}`);
  const invalidStateRawPostId = `${suffix}-raw-invalid-review-state`;
  const mismatchRawPostId = `${suffix}-raw-source-mismatch`;
  const invalidGroupBuyId = `${suffix}-group-invalid-review-state`;
  const mismatchGroupBuyId = `${suffix}-group-source-mismatch`;

  const expectedVisibleIds = states
    .flatMap((state, index) => state.visible ? [groupBuyIds[index]] : [])
    .sort();
  const expectedAdminIds = [...groupBuyIds].sort();
  const expectedVisibleRawPostIds = states
    .flatMap((state, index) => state.visible ? [rawPostIds[index]] : [])
    .sort();
  let config: LocalSupabaseConfig;
  let userId: string | null = null;
  let adminUserId: string | null = null;
  let userToken = "";
  let adminToken = "";

  async function createUser(role?: "admin") {
    const email = `${suffix}-${role ?? "user"}@example.test`;
    const password = `Visibility!${randomUUID()}`;
    const created = await request<{ id: string }>(config, "/auth/v1/admin/users", {
      method: "POST",
      key: config.serviceRoleKey,
      body: {
        email,
        password,
        email_confirm: true,
        ...(role ? { app_metadata: { role } } : {}),
      },
    });
    const session = await request<{ access_token: string }>(
      config,
      "/auth/v1/token?grant_type=password",
      { method: "POST", key: config.anonKey, body: { email, password } },
    );
    return { id: created.payload.id, token: session.payload.access_token };
  }

  async function directRead<T>(table: "group_buys" | "raw_posts", key: string, authorization?: string) {
    const ids = table === "group_buys" ? groupBuyIds : rawPostIds;
    return request<T[]>(
      config,
      `/rest/v1/${table}?id=in.(${ids.join(",")})&select=id&order=id.asc`,
      { key, authorization },
    );
  }

  beforeAll(async () => {
    // getLocalSupabaseConfig rejects non-local hosts before any fixture mutation.
    config = getLocalSupabaseConfig();
    const now = new Date().toISOString();
    await request(config, "/rest/v1/influencers", {
      method: "POST",
      key: config.serviceRoleKey,
      prefer: "return=minimal",
      body: {
        id: influencerId,
        instagram_username: suffix.replaceAll("-", "_"),
        display_name: "Manual visibility fixture",
        updated_at: now,
      },
    });
    await request(config, "/rest/v1/raw_posts", {
      method: "POST",
      key: config.serviceRoleKey,
      prefer: "return=minimal",
      body: states.map((state, index) => ({
        id: rawPostIds[index],
        instagram_post_id: `${suffix}-instagram-${state.name}`,
        influencer_id: influencerId,
        caption: `${suffix} ${state.name}`,
        post_url: `https://instagram.com/p/${suffix}-${state.name}`,
        taken_at: now,
        content_hash: `${suffix}-hash-${state.name}`,
        collection_source: state.source,
        is_candidate: true,
        collected_at: now,
        updated_at: now,
      })),
    });
    await request(config, "/rest/v1/group_buys", {
      method: "POST",
      key: config.serviceRoleKey,
      prefer: "return=minimal",
      body: states.map((state, index) => ({
        id: groupBuyIds[index],
        raw_post_id: rawPostIds[index],
        influencer_id: influencerId,
        product_name: `${suffix} ${state.name}`,
        confidence: 0.99,
        status: state.status,
        source_type: state.source,
        collection_review_status: state.review,
        created_at: now,
        updated_at: now,
      })),
    });
    await request(config, "/rest/v1/raw_posts", {
      method: "POST",
      key: config.serviceRoleKey,
      prefer: "return=minimal",
      body: [
        {
          id: invalidStateRawPostId,
          instagram_post_id: `${suffix}-instagram-invalid-state`,
          influencer_id: influencerId,
          caption: `${suffix} invalid state`,
          post_url: `https://instagram.com/p/${suffix}-invalid-state`,
          taken_at: now,
          content_hash: `${suffix}-hash-invalid-state`,
          collection_source: "MANUAL_DISCOVERY",
          is_candidate: true,
          collected_at: now,
          updated_at: now,
        },
        {
          id: mismatchRawPostId,
          instagram_post_id: `${suffix}-instagram-source-mismatch`,
          influencer_id: influencerId,
          caption: `${suffix} source mismatch`,
          post_url: `https://instagram.com/p/${suffix}-source-mismatch`,
          taken_at: now,
          content_hash: `${suffix}-hash-source-mismatch`,
          collection_source: "PLAYWRIGHT_PUBLIC",
          is_candidate: true,
          collected_at: now,
          updated_at: now,
        },
      ],
    });
    const user = await createUser();
    userId = user.id;
    userToken = user.token;
    const admin = await createUser("admin");
    adminUserId = admin.id;
    adminToken = admin.token;
  }, 30_000);

  afterAll(async () => {
    if (!config) return;
    await Promise.allSettled([
      request(
        config,
        `/rest/v1/group_buy_views?group_buy_id=in.(${groupBuyIds.join(",")})`,
        { method: "DELETE", key: config.serviceRoleKey },
      ),
    ]);
    await Promise.allSettled([
      request(
        config,
        `/rest/v1/group_buys?id=in.(${[...groupBuyIds, invalidGroupBuyId, mismatchGroupBuyId].join(",")})`,
        { method: "DELETE", key: config.serviceRoleKey },
      ),
    ]);
    await Promise.allSettled([
      request(
        config,
        `/rest/v1/raw_posts?id=in.(${[...rawPostIds, invalidStateRawPostId, mismatchRawPostId].join(",")})`,
        { method: "DELETE", key: config.serviceRoleKey },
      ),
    ]);
    await Promise.allSettled([
      request(
        config,
        `/rest/v1/influencers?id=eq.${encodeURIComponent(influencerId)}`,
        { method: "DELETE", key: config.serviceRoleKey },
      ),
      ...[userId, adminUserId]
        .filter((id): id is string => Boolean(id))
        .flatMap((id) => [
          request(
            config,
            `/rest/v1/users?id=eq.${encodeURIComponent(id)}`,
            { method: "DELETE", key: config.serviceRoleKey },
          ),
          request(
            config,
            `/auth/v1/admin/users/${encodeURIComponent(id)}`,
            { method: "DELETE", key: config.serviceRoleKey },
          ),
        ]),
    ]);
  }, 30_000);

  it("rejects a manual group buy whose public status contradicts its pending review state", async () => {
    await expect(
      request(config, "/rest/v1/group_buys", {
        method: "POST",
        key: config.serviceRoleKey,
        prefer: "return=minimal",
        body: {
          id: invalidGroupBuyId,
          raw_post_id: invalidStateRawPostId,
          influencer_id: influencerId,
          product_name: `${suffix} invalid approved pending state`,
          confidence: 0.99,
          status: "APPROVED",
          source_type: "MANUAL_DISCOVERY",
          collection_review_status: "PENDING",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }),
    ).rejects.toThrow(/group_buys_manual_discovery_review_state_check/);
  });

  it("rejects a manual group buy linked to a non-manual raw post", async () => {
    await expect(
      request(config, "/rest/v1/group_buys", {
        method: "POST",
        key: config.serviceRoleKey,
        prefer: "return=minimal",
        body: {
          id: mismatchGroupBuyId,
          raw_post_id: mismatchRawPostId,
          influencer_id: influencerId,
          product_name: `${suffix} mismatched source`,
          confidence: 0.99,
          status: "REVIEW_REQUIRED",
          source_type: "MANUAL_DISCOVERY",
          collection_review_status: "PENDING",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }),
    ).rejects.toThrow(/Manual discovery source markers must match/);
  });

  it("rejects a raw-post source change that would mismatch its linked manual state", async () => {
    await expect(
      request(config, `/rest/v1/raw_posts?id=eq.${encodeURIComponent(rawPostIds[4])}`, {
        method: "PATCH",
        key: config.serviceRoleKey,
        prefer: "return=minimal",
        body: { collection_source: "MANUAL_DISCOVERY" },
      }),
    ).rejects.toThrow(/Manual discovery source markers must match/);
  });

  it("excludes pending and rejected manual IDs from the public popularity definer RPC", async () => {
    const viewedAt = new Date().toISOString();
    await request(config, "/rest/v1/group_buy_views", {
      method: "POST",
      key: config.serviceRoleKey,
      prefer: "return=minimal",
      body: groupBuyIds.map((groupBuyId) => ({
        group_buy_id: groupBuyId,
        view_type: "deep",
        viewed_at: viewedAt,
      })),
    });

    const popular = await request<PopularGroupBuyRow[]>(
      config,
      "/rest/v1/rpc/get_popular_group_buys",
      {
        method: "POST",
        key: config.anonKey,
        body: { limit_count: 100, hours_window: 168 },
      },
    );
    const publicIds = popular.payload.map((row) => row.group_buy_id);

    expect(publicIds).toContain(groupBuyIds[2]);
    expect(publicIds).toContain(groupBuyIds[3]);
    expect(publicIds).toContain(groupBuyIds[4]);
    expect(publicIds).not.toContain(groupBuyIds[0]);
    expect(publicIds).not.toContain(groupBuyIds[1]);
  });

  it("hides pending and rejected manual rows from anon and authenticated non-admin PostgREST reads", async () => {
    const [anonGroupBuys, authenticatedGroupBuys, anonRawPosts, authenticatedRawPosts] = await Promise.all([
      directRead<GroupBuyRow>("group_buys", config.anonKey),
      directRead<GroupBuyRow>("group_buys", config.anonKey, userToken),
      directRead<RawPostRow>("raw_posts", config.anonKey),
      directRead<RawPostRow>("raw_posts", config.anonKey, userToken),
    ]);

    expect(anonGroupBuys.payload.map((row) => row.id)).toEqual(expectedVisibleIds);
    expect(authenticatedGroupBuys.payload.map((row) => row.id)).toEqual(expectedVisibleIds);
    expect(anonRawPosts.payload.map((row) => row.id)).toEqual(expectedVisibleRawPostIds);
    expect(authenticatedRawPosts.payload.map((row) => row.id)).toEqual(expectedVisibleRawPostIds);
  });

  it("allows an admin token to keep reading pending and rejected manual rows", async () => {
    const [groupBuys, rawPosts] = await Promise.all([
      directRead<GroupBuyRow>("group_buys", config.anonKey, adminToken),
      directRead<RawPostRow>("raw_posts", config.anonKey, adminToken),
    ]);

    expect(groupBuys.payload.map((row) => row.id)).toEqual(expectedAdminIds);
    expect(rawPosts.payload.map((row) => row.id)).toEqual([...rawPostIds].sort());
  });
});
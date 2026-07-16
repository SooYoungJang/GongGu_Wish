import { randomUUID } from "node:crypto";

export type LocalSupabaseConfig = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

export type LocalSupabaseFixture = {
  adminAccessToken: string;
  adminUserId: string;
  email: string;
  groupBuyIds: string[];
  influencerId: string;
  productName: string;
  rawPostIds: string[];
};

type RequestOptions = {
  authorization?: string;
  body?: unknown;
  key: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  prefer?: string;
};

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "10.0.2.2", "::1"]);

export function hasLocalSupabaseConfig(): boolean {
  return Boolean(
    process.env.LOCAL_SUPABASE_URL &&
    process.env.LOCAL_SUPABASE_ANON_KEY &&
    process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function requireLocalSupabaseConfig(): LocalSupabaseConfig {
  if (!hasLocalSupabaseConfig()) {
    throw new Error(
      "[local-supabase:setup] LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, and LOCAL_SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }
  return getLocalSupabaseConfig();
}

export function getLocalSupabaseConfig(): LocalSupabaseConfig {
  const config = {
    url: process.env.LOCAL_SUPABASE_URL ?? "",
    anonKey: process.env.LOCAL_SUPABASE_ANON_KEY ?? "",
    serviceRoleKey: process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ?? "",
  };
  const parsed = new URL(config.url);
  if (!LOCAL_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `[local-supabase:setup] Refusing fixture mutation outside a local host: ${parsed.hostname}`,
    );
  }
  if (!config.anonKey || !config.serviceRoleKey) {
    throw new Error("[local-supabase:setup] Local API keys are required");
  }
  return { ...config, url: parsed.origin };
}

export function phaseLog(phase: string, message: string): void {
  console.info(`[local-supabase:${phase}] ${message}`);
}

function isJwt(value: string): boolean {
  return value.split(".").length === 3;
}

async function requestJson<T>(
  config: LocalSupabaseConfig,
  phase: string,
  path: string,
  options: RequestOptions,
): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {
    apikey: options.key,
    "Content-Type": "application/json",
  };
  const authorization =
    options.authorization ?? (isJwt(options.key) ? options.key : null);
  if (authorization) headers.Authorization = `Bearer ${authorization}`;
  if (options.prefer) headers.Prefer = options.prefer;

  let response: Response;
  try {
    response = await fetch(`${config.url}${path}`, {
      method,
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    throw new Error(
      `[local-supabase:${phase}] ${method} ${path} network failure: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!response.ok) {
    throw new Error(
      `[local-supabase:${phase}] ${method} ${path} failed (${response.status}): ${JSON.stringify(payload)}`,
    );
  }
  return payload as T;
}

async function serviceRest<T>(
  config: LocalSupabaseConfig,
  phase: string,
  path: string,
  options: Omit<RequestOptions, "key"> = {},
): Promise<T> {
  return requestJson<T>(config, phase, `/rest/v1/${path}`, {
    ...options,
    key: config.serviceRoleKey,
  });
}

function isoOffset(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function dateOffset(days: number): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

export async function createLocalFixture(
  config: LocalSupabaseConfig,
): Promise<LocalSupabaseFixture> {
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const influencerId = `gon263-influencer-${suffix}`;
  const rawPostIds = Array.from(
    { length: 5 },
    (_, index) => `gon263-post-${index}-${suffix}`,
  );
  const groupBuyIds = Array.from(
    { length: 5 },
    (_, index) => `gon263-deal-${index}-${suffix}`,
  );
  const productName = `GON263 계약 공구 ${suffix}`;
  const email = `gon263-${suffix}@example.test`;
  const password = `Gon263!${randomUUID()}`;
  const now = new Date().toISOString();

  phaseLog("setup", "creating isolated Auth and commerce fixtures");
  await serviceRest(config, "setup", "influencers", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      id: influencerId,
      instagram_username: `gon263_${suffix.replace(/-/g, "_")}`,
      display_name: "GON-263 Integration Seller",
      updated_at: now,
    },
  });

  await serviceRest(config, "setup", "raw_posts", {
    method: "POST",
    prefer: "return=minimal",
    body: rawPostIds.map((id, index) => ({
      id,
      instagram_post_id: `gon263-instagram-${index}-${suffix}`,
      influencer_id: influencerId,
      caption: `GON-263 integration fixture ${index}`,
      post_url: `https://instagram.com/p/gon263-${index}-${suffix}`,
      taken_at: isoOffset(-4 + index),
      content_hash: `gon263-hash-${index}-${suffix}`,
      is_candidate: true,
      collected_at: now,
      updated_at: now,
    })),
  });

  const categories = ["food", "food", "food", "food", "beauty"];
  await serviceRest(config, "setup", "group_buys", {
    method: "POST",
    prefer: "return=minimal",
    body: groupBuyIds.map((id, index) => ({
      id,
      raw_post_id: rawPostIds[index],
      product_name: index === 0 ? productName : `${productName} ${index + 1}`,
      brand_name: "GON-263 Brand",
      category: categories[index],
      start_date: isoOffset(-24),
      end_date: index <= 2 ? null : isoOffset(24 * (index + 1)),
      purchase_url: `https://example.test/gon263/${index}`,
      discount_info: `${10 + index}% 할인`,
      price_krw: 10000 + index * 1000,
      summary: "Local Supabase integration fixture",
      confidence: 0.99,
      status: "APPROVED",
      is_home_banner: index === 0,
      home_banner_start_date: index === 0 ? dateOffset(-1) : null,
      home_banner_end_date: index === 0 ? dateOffset(7) : null,
      created_at: isoOffset(index === 2 ? -4 : -4 + index),
      updated_at: now,
    })),
  });

  // Two open-ended food fixtures deliberately tie on score, a third open-ended
  // fixture stays lower, and a fourth has a deadline. This exercises every
  // null-deadline score/ID branch plus the non-null-to-null transition.
  const currentViewCounts = [6, 9, 3, 4, 8];
  const views = currentViewCounts.flatMap((count, groupIndex) =>
    Array.from({ length: count }, (_, viewIndex) => ({
      group_buy_id: groupBuyIds[groupIndex],
      view_type: "deep",
      viewed_at: isoOffset(-1),
      session_id: `gon263-current-${groupIndex}-${viewIndex}-${suffix}`,
    })),
  );
  views.push(
    ...Array.from({ length: 3 }, (_, viewIndex) => ({
      group_buy_id: groupBuyIds[0],
      view_type: "deep",
      viewed_at: isoOffset(-49),
      session_id: `gon263-previous-${viewIndex}-${suffix}`,
    })),
  );
  await serviceRest(config, "setup", "group_buy_views", {
    method: "POST",
    prefer: "return=minimal",
    body: views,
  });

  const adminUser = await requestJson<{ id: string }>(
    config,
    "setup-auth",
    "/auth/v1/admin/users",
    {
      method: "POST",
      key: config.serviceRoleKey,
      body: {
        email,
        password,
        email_confirm: true,
        app_metadata: { role: "admin" },
      },
    },
  );
  const session = await requestJson<{ access_token: string }>(
    config,
    "setup-auth",
    "/auth/v1/token?grant_type=password",
    {
      method: "POST",
      key: config.anonKey,
      body: { email, password },
    },
  );

  return {
    adminAccessToken: session.access_token,
    adminUserId: adminUser.id,
    email,
    groupBuyIds,
    influencerId,
    productName,
    rawPostIds,
  };
}

export async function invokeAdmin<T>(
  config: LocalSupabaseConfig,
  fixture: LocalSupabaseFixture,
  phase: string,
  request: {
    path: string;
    method: "GET" | "PATCH";
    body?: unknown;
    params?: unknown;
  },
): Promise<T> {
  const response = await requestJson<{ data: T }>(
    config,
    phase,
    "/functions/v1/admin-api",
    {
      method: "POST",
      key: config.anonKey,
      authorization: fixture.adminAccessToken,
      body: request,
    },
  );
  return response.data;
}

export async function readGroupBuyRow<T>(
  config: LocalSupabaseConfig,
  groupBuyId: string,
): Promise<T> {
  const rows = await serviceRest<T[]>(
    config,
    "db-read",
    `group_buys?id=eq.${encodeURIComponent(groupBuyId)}&select=id,price_krw,is_home_banner,home_banner_start_date,home_banner_end_date`,
  );
  if (rows.length !== 1)
    throw new Error("[local-supabase:db-read] Fixture row was not found");
  return rows[0];
}

export async function cleanupLocalFixture(
  config: LocalSupabaseConfig,
  fixture: LocalSupabaseFixture | null,
): Promise<void> {
  if (!fixture) return;
  phaseLog("cleanup", "removing isolated fixtures");
  const inFilter = (values: string[]) =>
    `in.(${values.map(encodeURIComponent).join(",")})`;
  const cleanupRequests = [
    () =>
      serviceRest(
        config,
        "cleanup",
        `group_buy_views?group_buy_id=${inFilter(fixture.groupBuyIds)}`,
        { method: "DELETE" },
      ),
    () =>
      serviceRest(
        config,
        "cleanup",
        `group_buys?id=${inFilter(fixture.groupBuyIds)}`,
        { method: "DELETE" },
      ),
    () =>
      serviceRest(
        config,
        "cleanup",
        `raw_posts?id=${inFilter(fixture.rawPostIds)}`,
        { method: "DELETE" },
      ),
    () =>
      serviceRest(
        config,
        "cleanup",
        `influencers?id=eq.${encodeURIComponent(fixture.influencerId)}`,
        { method: "DELETE" },
      ),
    () =>
      requestJson(
        config,
        "cleanup",
        `/auth/v1/admin/users/${fixture.adminUserId}`,
        {
          method: "DELETE",
          key: config.serviceRoleKey,
        },
      ),
  ];
  for (const cleanup of cleanupRequests) {
    try {
      await cleanup();
    } catch (error) {
      console.warn(error instanceof Error ? error.message : String(error));
    }
  }
}

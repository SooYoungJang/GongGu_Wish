import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  getLocalSupabaseConfig,
  type LocalSupabaseConfig,
} from "./localSupabaseHarness";

type RpcResult = {
  request_id: string;
  product_name: string;
  request_count: number;
  already_requested: boolean;
  ranking_eligible: boolean;
};

type RankingRow = {
  rank: number;
  request_id: string;
  product_name: string;
  request_count: number;
};

type HttpResult<T> = {
  ok: boolean;
  payload: T;
  status: number;
};

async function requestJson<T>(
  config: LocalSupabaseConfig,
  path: string,
  options: {
    body?: unknown;
    key?: string;
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    token?: string;
  } = {},
): Promise<HttpResult<T>> {
  const key = options.key ?? config.anonKey;
  const response = await fetch(`${config.url}${path}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${options.token ?? key}`,
      "Content-Type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  const payload = (text ? JSON.parse(text) : null) as T;
  return { ok: response.ok, payload, status: response.status };
}

async function invokeRpc<T>(
  config: LocalSupabaseConfig,
  functionName: string,
  body: Record<string, unknown>,
  token?: string,
): Promise<T> {
  const result = await requestJson<T>(
    config,
    `/rest/v1/rpc/${encodeURIComponent(functionName)}`,
    { body, method: "POST", token },
  );
  if (!result.ok) {
    throw new Error(
      `${functionName} returned ${result.status}: ${JSON.stringify(result.payload)}`,
    );
  }
  return result.payload;
}

describe.sequential("group-buy request database contracts", () => {
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const requestIds = new Set<string>();
  let config: LocalSupabaseConfig;
  let userId = "";
  let userAccessToken = "";

  const remember = (rows: RpcResult[]) => {
    for (const row of rows) requestIds.add(row.request_id);
    return rows;
  };

  const requestGroupBuy = async (
    productName: string,
    sessionId: string,
    token?: string,
  ) =>
    remember(
      await invokeRpc<RpcResult[]>(
        config,
        "request_group_buy",
        {
          p_product_name: productName,
          p_session_id: sessionId,
        },
        token,
      ),
    );

  beforeAll(async () => {
    config = getLocalSupabaseConfig();
    const password = `Gbr!${randomUUID()}`;
    const email = `gbr-${suffix}@example.test`;
    const created = await requestJson<{ id: string }>(
      config,
      "/auth/v1/admin/users",
      {
        body: { email, password, email_confirm: true },
        key: config.serviceRoleKey,
        method: "POST",
      },
    );
    expect(created.ok).toBe(true);
    userId = created.payload.id;

    const session = await requestJson<{ access_token: string }>(
      config,
      "/auth/v1/token?grant_type=password",
      {
        body: { email, password },
        method: "POST",
      },
    );
    expect(session.ok).toBe(true);
    userAccessToken = session.payload.access_token;
  });

  afterAll(async () => {
    if (requestIds.size > 0) {
      const ids = [...requestIds].map(encodeURIComponent).join(",");
      await requestJson(config, `/rest/v1/group_buy_requests?id=in.(${ids})`, {
        key: config.serviceRoleKey,
        method: "DELETE",
      });
    }
    if (userId) {
      await requestJson(config, `/auth/v1/admin/users/${userId}`, {
        key: config.serviceRoleKey,
        method: "DELETE",
      });
    }
  });

  it("deduplicates a guest after login and the same account on another device", async () => {
    const productName = `월간 요청 ABC ${suffix}`;
    const guestSession = `s_${suffix}_guest_a`;
    const otherDeviceSession = `s_${suffix}_device_b`;
    const secondGuestSession = `s_${suffix}_guest_c`;

    const first = await requestGroupBuy(
      `  월간   요청 ABC ${suffix}  `,
      guestSession,
    );
    expect(first).toEqual([
      expect.objectContaining({
        product_name: productName,
        request_count: 1,
        already_requested: false,
        ranking_eligible: false,
      }),
    ]);

    const afterLogin = await requestGroupBuy(
      productName,
      guestSession,
      userAccessToken,
    );
    expect(afterLogin[0]).toMatchObject({
      request_count: 1,
      already_requested: true,
    });

    const otherDevice = await requestGroupBuy(
      productName,
      otherDeviceSession,
      userAccessToken,
    );
    expect(otherDevice[0]).toMatchObject({
      request_count: 1,
      already_requested: true,
    });

    const secondGuest = await requestGroupBuy(productName, secondGuestSession);
    expect(secondGuest[0]).toMatchObject({
      request_count: 2,
      already_requested: false,
      ranking_eligible: true,
    });

    const anonRawRead = await requestJson(
      config,
      "/rest/v1/group_buy_request_participations?select=id&limit=1",
    );
    expect(anonRawRead.ok).toBe(false);
    const authRawRead = await requestJson(
      config,
      "/rest/v1/group_buy_request_participations?select=id&limit=1",
      { token: userAccessToken },
    );
    expect(authRawRead.ok).toBe(false);

    const serviceRows = await requestJson<
      Array<{ session_hashes: string[]; user_id: string | null }>
    >(
      config,
      `/rest/v1/group_buy_request_participations?request_id=eq.${first[0].request_id}&select=session_hashes,user_id`,
      { key: config.serviceRoleKey },
    );
    expect(serviceRows.ok).toBe(true);
    expect(serviceRows.payload).toHaveLength(2);
    expect(JSON.stringify(serviceRows.payload)).not.toContain(guestSession);
    expect(
      serviceRows.payload
        .flatMap((row) => row.session_hashes)
        .every((hash) => /^\\x[0-9a-f]{64}$/.test(hash)),
    ).toBe(true);
  });

  it("allows the same installation to request again after 30 days", async () => {
    const productName = `재요청 ${suffix}`;
    const sessionId = `s_${suffix}_expired`;
    const first = await requestGroupBuy(productName, sessionId);
    const expiredAt = new Date(
      Date.now() - 31 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const updated = await requestJson(
      config,
      `/rest/v1/group_buy_request_participations?request_id=eq.${first[0].request_id}`,
      {
        body: { requested_at: expiredAt },
        key: config.serviceRoleKey,
        method: "PATCH",
      },
    );
    expect(updated.ok).toBe(true);

    const renewed = await requestGroupBuy(productName, sessionId);
    expect(renewed[0]).toMatchObject({
      request_count: 1,
      already_requested: false,
      ranking_eligible: false,
    });
  });

  it("limits an installation to five new products per 24 hours", async () => {
    const sessionId = `s_${suffix}_rate_limit`;
    const firstProductName = `요청제한 0 ${suffix}`;
    for (let index = 0; index < 5; index += 1) {
      const result = await requestGroupBuy(
        `요청제한 ${index} ${suffix}`,
        sessionId,
      );
      expect(result[0].already_requested).toBe(false);
    }

    const rejected = await requestJson<unknown>(
      config,
      "/rest/v1/rpc/request_group_buy",
      {
        body: {
          p_product_name: `요청제한 6 ${suffix}`,
          p_session_id: sessionId,
        },
        method: "POST",
      },
    );
    expect(rejected.ok).toBe(false);
    expect(JSON.stringify(rejected.payload)).toContain(
      "group_buy_request_rate_limited",
    );

    await requestGroupBuy(firstProductName, sessionId, userAccessToken);
    const rejectedOnOtherDevice = await requestJson<unknown>(
      config,
      "/rest/v1/rpc/request_group_buy",
      {
        body: {
          p_product_name: `요청제한 계정 ${suffix}`,
          p_session_id: `s_${suffix}_rate_limit_other_device`,
        },
        method: "POST",
        token: userAccessToken,
      },
    );
    expect(rejectedOnOtherDevice.ok).toBe(false);
    expect(JSON.stringify(rejectedOnOtherDevice.payload)).toContain(
      "group_buy_request_rate_limited",
    );
  });

  it("returns only the top three products with at least two recent actors", async () => {
    const rankingProducts = [
      { count: 5, name: `순위A ${suffix}` },
      { count: 4, name: `순위B ${suffix}` },
      { count: 3, name: `순위C ${suffix}` },
      { count: 2, name: `순위D ${suffix}` },
      { count: 1, name: `순위제외 ${suffix}` },
    ];
    for (const [productIndex, product] of rankingProducts.entries()) {
      for (let actorIndex = 0; actorIndex < product.count; actorIndex += 1) {
        await requestGroupBuy(
          product.name,
          `s_${suffix}_rank_${productIndex}_${actorIndex}`,
        );
      }
    }

    const rankings = await invokeRpc<RankingRow[]>(
      config,
      "get_group_buy_request_rankings",
      { p_limit_count: 99 },
    );
    expect(rankings).toHaveLength(3);
    expect(rankings.map((row) => row.product_name)).toEqual(
      rankingProducts.slice(0, 3).map((product) => product.name),
    );
    expect(rankings.map((row) => row.request_count)).toEqual([5, 4, 3]);
    expect(rankings.map((row) => row.rank)).toEqual([1, 2, 3]);
    expect(rankings.some((row) => row.product_name.includes("순위제외"))).toBe(
      false,
    );
  });
});

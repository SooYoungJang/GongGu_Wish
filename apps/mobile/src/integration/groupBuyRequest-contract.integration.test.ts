import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  getLocalSupabaseConfig,
  hasLocalSupabaseConfig,
  type LocalSupabaseConfig,
} from "./localSupabaseHarness";

const describeLocal = hasLocalSupabaseConfig() ? describe : describe.skip;

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

type AdminRequestList = {
  items: Array<{
    id: string;
    productName: string;
    status: "OPEN" | "FULFILLED" | "HIDDEN";
    requestCount: number;
    createdAt: string;
    latestRequestedAt: string | null;
  }>;
  total: number;
};

type AttemptLimitRow = {
  allowed: boolean;
  attempt_count: number;
  retry_after_seconds: number;
};

type HttpResult<T> = {
  headers: Headers;
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
    headers?: Record<string, string>;
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
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  const payload = (text ? JSON.parse(text) : null) as T;
  return {
    headers: response.headers,
    ok: response.ok,
    payload,
    status: response.status,
  };
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

describeLocal.sequential("group-buy request database contracts", () => {
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const requestIds = new Set<string>();
  let config: LocalSupabaseConfig;
  let userId = "";
  let userAccessToken = "";
  let nextGuestIp = 0;
  const guestIps = new Map<string, string>();
  const ipSeed = randomUUID().replaceAll("-", "");
  const ipSeedA = Number.parseInt(ipSeed.slice(0, 2), 16);
  const ipSeedB = Number.parseInt(ipSeed.slice(2, 4), 16);

  const allocateClientIp = () => {
    const index = nextGuestIp++;
    return `10.${
      ((ipSeedA + Math.floor(index / 62_500)) % 250) + 1
    }.${((ipSeedB + Math.floor(index / 250)) % 250) + 1}.${(index % 250) + 1}`;
  };

  const remember = (rows: RpcResult[]) => {
    for (const row of rows) requestIds.add(row.request_id);
    return rows;
  };

  const requestGroupBuy = async (
    productName: string,
    sessionId: string,
    token?: string,
    clientIp?: string,
  ) => {
    const ip = clientIp ?? guestIps.get(sessionId) ?? allocateClientIp();
    guestIps.set(sessionId, ip);
    const result = await requestJson<RpcResult>(
      config,
      "/functions/v1/group-buy-request",
      {
        body: { product_name: productName, session_id: sessionId },
        headers: { "x-forwarded-for": ip },
        method: "POST",
        token,
      },
    );
    if (!result.ok) {
      throw new Error(
        `group-buy-request returned ${result.status}: ${JSON.stringify(result.payload)}`,
      );
    }
    return remember([result.payload]);
  };

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

  it("rejects direct public access to the service-only write RPC", async () => {
    const body = {
      p_ip_hash: "1".repeat(64),
      p_product_name: `직접호출차단 ${suffix}`,
      p_session_hash: "2".repeat(64),
      p_user_id: null,
    };
    const guest = await requestJson(
      config,
      "/rest/v1/rpc/request_group_buy_internal",
      { body, method: "POST" },
    );
    const signedIn = await requestJson(
      config,
      "/rest/v1/rpc/request_group_buy_internal",
      { body, method: "POST", token: userAccessToken },
    );
    const guestLimiter = await requestJson(
      config,
      "/rest/v1/rpc/consume_group_buy_request_attempt",
      { body: { p_actor_hash: "3".repeat(64) }, method: "POST" },
    );
    const signedInLimiter = await requestJson(
      config,
      "/rest/v1/rpc/consume_group_buy_request_attempt",
      {
        body: { p_actor_hash: "3".repeat(64) },
        method: "POST",
        token: userAccessToken,
      },
    );
    const guestLimiterRows = await requestJson(
      config,
      "/rest/v1/group_buy_request_attempt_limits?select=actor_hash&limit=1",
    );

    expect(guest.ok).toBe(false);
    expect(signedIn.ok).toBe(false);
    expect(guestLimiter.ok).toBe(false);
    expect(signedInLimiter.ok).toBe(false);
    expect(guestLimiterRows.ok).toBe(false);
  });

  it("accepts 200-character product names and rejects 201 characters", async () => {
    const namePrefix = `길이경계-${suffix}-`;
    const acceptedName = `${namePrefix}${"가".repeat(200 - namePrefix.length)}`;
    expect(acceptedName).toHaveLength(200);

    const accepted = await requestGroupBuy(
      acceptedName,
      `s_${suffix}_length_200`,
    );
    expect(accepted[0].product_name).toBe(acceptedName);

    const rejected = await requestJson<{ error: string }>(
      config,
      "/functions/v1/group-buy-request",
      {
        body: {
          product_name: `${acceptedName}가`,
          session_id: `s_${suffix}_length_201`,
        },
        headers: { "x-forwarded-for": allocateClientIp() },
        method: "POST",
      },
    );
    expect(rejected.status).toBe(400);
    expect(rejected.payload.error).toBe("invalid_group_buy_request");
  });

  it("atomically saturates a fixed-window actor counter at 21", async () => {
    const actorHash = `${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll(
      "-",
      "",
    )}`;
    const sequentialRows: AttemptLimitRow[] = [];
    for (let attempt = 1; attempt <= 25; attempt += 1) {
      const consumed = await requestJson<AttemptLimitRow[]>(
        config,
        "/rest/v1/rpc/consume_group_buy_request_attempt",
        {
          body: { p_actor_hash: actorHash },
          key: config.serviceRoleKey,
          method: "POST",
        },
      );
      expect(consumed.ok).toBe(true);
      sequentialRows.push(consumed.payload[0]);
    }

    expect(sequentialRows.slice(0, 20).every((row) => row.allowed)).toBe(true);
    expect(sequentialRows.slice(20).every((row) => !row.allowed)).toBe(true);
    expect(sequentialRows.at(-1)).toEqual({
      allowed: false,
      attempt_count: 21,
      retry_after_seconds: 600,
    });

    const concurrentActorHash = `${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll(
      "-",
      "",
    )}`;
    const concurrentResults = await Promise.all(
      Array.from({ length: 25 }, () =>
        requestJson<AttemptLimitRow[]>(
          config,
          "/rest/v1/rpc/consume_group_buy_request_attempt",
          {
            body: { p_actor_hash: concurrentActorHash },
            key: config.serviceRoleKey,
            method: "POST",
          },
        ),
      ),
    );
    expect(concurrentResults.every((result) => result.ok)).toBe(true);
    const concurrentRows = concurrentResults.map((result) => result.payload[0]);
    expect(concurrentRows.filter((row) => row.allowed)).toHaveLength(20);
    expect(concurrentRows.filter((row) => !row.allowed)).toHaveLength(5);
    expect(
      concurrentRows
        .filter((row) => !row.allowed)
        .every((row) => row.attempt_count === 21),
    ).toBe(true);

    const otherActor = await requestJson<AttemptLimitRow[]>(
      config,
      "/rest/v1/rpc/consume_group_buy_request_attempt",
      {
        body: {
          p_actor_hash: `${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll(
            "-",
            "",
          )}`,
        },
        key: config.serviceRoleKey,
        method: "POST",
      },
    );
    expect(otherActor.ok).toBe(true);
    expect(otherActor.payload[0]).toEqual({
      allowed: true,
      attempt_count: 1,
      retry_after_seconds: 600,
    });
  });

  it("blocks the 21st duplicate attempt while another IP remains independent", async () => {
    const randomBytes = randomUUID().replaceAll("-", "");
    const firstIp = `198.51.${(Number.parseInt(randomBytes.slice(0, 2), 16) % 200) + 1}.${
      (Number.parseInt(randomBytes.slice(2, 4), 16) % 200) + 1
    }`;
    const secondIp = `198.52.${(Number.parseInt(randomBytes.slice(4, 6), 16) % 200) + 1}.${
      (Number.parseInt(randomBytes.slice(6, 8), 16) % 200) + 1
    }`;
    const productName = `시도제한 ${suffix}`;
    const sessionId = `s_${suffix}_attempt_limit`;

    for (let attempt = 1; attempt <= 20; attempt += 1) {
      const result = await requestJson<RpcResult>(
        config,
        "/functions/v1/group-buy-request",
        {
          body: { product_name: productName, session_id: sessionId },
          headers: { "x-forwarded-for": firstIp },
          method: "POST",
        },
      );
      expect(result.ok).toBe(true);
      requestIds.add(result.payload.request_id);
      expect(result.payload.already_requested).toBe(attempt > 1);
    }

    for (let attempt = 21; attempt <= 22; attempt += 1) {
      const blocked = await requestJson<{ error: string }>(
        config,
        "/functions/v1/group-buy-request",
        {
          body: { product_name: productName, session_id: sessionId },
          headers: { "x-forwarded-for": firstIp },
          method: "POST",
        },
      );
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get("retry-after")).toBe("600");
      expect(blocked.payload.error).toBe(
        "group_buy_request_attempt_rate_limited",
      );
    }

    const independent = await requestJson<RpcResult>(
      config,
      "/functions/v1/group-buy-request",
      {
        body: {
          product_name: productName,
          session_id: `s_${suffix}_attempt_other`,
        },
        headers: { "x-forwarded-for": secondIp },
        method: "POST",
      },
    );
    expect(independent.ok).toBe(true);
    requestIds.add(independent.payload.request_id);
    expect(independent.payload.request_count).toBe(2);
  });

  it("does not attach shared-IP history and enforces the 15-product daily limit", async () => {
    const randomBytes = randomUUID().replaceAll("-", "");
    const sharedIp = `192.0.2.${
      (Number.parseInt(randomBytes.slice(0, 2), 16) % 200) + 1
    }`;
    const otherIp = `192.0.3.${
      (Number.parseInt(randomBytes.slice(2, 4), 16) % 200) + 1
    }`;
    const guestSession = `s_${suffix}_shared_guest`;
    const memberSession = `s_${suffix}_shared_member`;
    const guestProducts: RpcResult[][] = [];

    for (let index = 0; index < 15; index += 1) {
      guestProducts.push(
        await requestGroupBuy(
          `공유IP 게스트 ${index} ${suffix}`,
          guestSession,
          undefined,
          sharedIp,
        ),
      );
    }
    expect(guestProducts).toHaveLength(15);

    const sameIpDuplicate = await requestGroupBuy(
      guestProducts[0][0].product_name,
      memberSession,
      userAccessToken,
      sharedIp,
    );
    expect(sameIpDuplicate[0]).toMatchObject({
      already_requested: true,
      request_count: 1,
      ranking_eligible: false,
    });

    const guestParticipationBefore = await requestJson<
      Array<{ session_hashes: string[]; user_id: string | null }>
    >(
      config,
      `/rest/v1/group_buy_request_participations?request_id=eq.${guestProducts[0][0].request_id}&select=session_hashes,user_id`,
      { key: config.serviceRoleKey },
    );
    expect(guestParticipationBefore.ok).toBe(true);
    expect(guestParticipationBefore.payload).toEqual([
      expect.objectContaining({ user_id: null }),
    ]);
    expect(guestParticipationBefore.payload[0].session_hashes).toHaveLength(1);

    const blockedSixteenthProduct = await requestJson<{ error: string }>(
      config,
      "/functions/v1/group-buy-request",
      {
        body: {
          product_name: `공유IP 회원 16번째 차단 ${suffix}`,
          session_id: memberSession,
        },
        headers: { "x-forwarded-for": sharedIp },
        method: "POST",
        token: userAccessToken,
      },
    );
    expect(blockedSixteenthProduct.status).toBe(429);
    expect(blockedSixteenthProduct.payload.error).toBe(
      "group_buy_request_rate_limited",
    );

    const memberOnOtherIp = await requestGroupBuy(
      `공유IP 회원 독립 ${suffix}`,
      memberSession,
      userAccessToken,
      otherIp,
    );
    expect(memberOnOtherIp[0]).toMatchObject({
      already_requested: false,
      request_count: 1,
      ranking_eligible: false,
    });
  });

  it("deduplicates a guest after login and the same account on another device", async () => {
    const productName = `월간 요청 ABC ${suffix}`;
    const guestSession = `s_${suffix}_guest_a`;
    const otherDeviceSession = `s_${suffix}_device_b`;
    const secondGuestSession = `s_${suffix}_guest_c`;
    const rotatedGuestSession = `s_${suffix}_rotated`;
    const guestIp = allocateClientIp();

    const first = await requestGroupBuy(
      `  월간   요청 ABC ${suffix}  `,
      guestSession,
      undefined,
      guestIp,
    );
    expect(first).toEqual([
      expect.objectContaining({
        product_name: productName,
        request_count: 1,
        already_requested: false,
        ranking_eligible: false,
      }),
    ]);

    const repeatedGuest = await requestGroupBuy(
      productName,
      guestSession,
      undefined,
      guestIp,
    );
    expect(repeatedGuest[0]).toMatchObject({
      request_count: 1,
      already_requested: true,
      ranking_eligible: false,
    });

    const rotatedGuest = await requestGroupBuy(
      productName,
      rotatedGuestSession,
      undefined,
      guestIp,
    );
    expect(rotatedGuest[0]).toMatchObject({
      request_count: 1,
      already_requested: true,
      ranking_eligible: false,
    });

    const afterLogin = await requestGroupBuy(
      productName,
      guestSession,
      userAccessToken,
      guestIp,
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

    const secondGuest = await requestGroupBuy(
      productName,
      secondGuestSession,
      undefined,
      allocateClientIp(),
    );
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
      Array<{
        ip_hash: string;
        session_hashes: string[];
        user_id: string | null;
      }>
    >(
      config,
      `/rest/v1/group_buy_request_participations?request_id=eq.${first[0].request_id}&select=ip_hash,session_hashes,user_id`,
      { key: config.serviceRoleKey },
    );
    expect(serviceRows.ok).toBe(true);
    expect(serviceRows.payload).toHaveLength(2);
    expect(JSON.stringify(serviceRows.payload)).not.toContain(guestSession);
    expect(JSON.stringify(serviceRows.payload)).not.toContain(guestIp);
    expect(
      serviceRows.payload.every((row) => /^\\x[0-9a-f]{64}$/.test(row.ip_hash)),
    ).toBe(true);
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

  it("exposes only aggregate request fields through the service-role admin RPC", async () => {
    const productName = `관리자목록 ${suffix}`;
    const first = await requestGroupBuy(
      productName,
      `s_${suffix}_admin_user`,
      userAccessToken,
    );
    await requestGroupBuy(productName, `s_${suffix}_admin_duplicate_user`);
    await requestGroupBuy(productName, `s_${suffix}_admin_current_guest`);
    await requestGroupBuy(productName, `s_${suffix}_admin_expired_guest`);
    const expiredAt = new Date(
      Date.now() - 31 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const participationRows = await requestJson<
      Array<{ id: string; requested_at: string; user_id: string | null }>
    >(
      config,
      `/rest/v1/group_buy_request_participations?request_id=eq.${first[0].request_id}&select=id,requested_at,user_id&order=requested_at.asc`,
      {
        key: config.serviceRoleKey,
      },
    );
    expect(
      participationRows.ok,
      JSON.stringify(participationRows.payload),
    ).toBe(true);
    const guestRows = participationRows.payload.filter(
      (row) => row.user_id === null,
    );
    expect(guestRows).toHaveLength(3);

    const duplicateUser = await requestJson(
      config,
      `/rest/v1/group_buy_request_participations?id=eq.${guestRows[0].id}`,
      {
        body: { user_id: userId },
        headers: { Prefer: "return=minimal" },
        key: config.serviceRoleKey,
        method: "PATCH",
      },
    );
    expect(duplicateUser.ok, JSON.stringify(duplicateUser.payload)).toBe(true);

    const expiredGuest = await requestJson(
      config,
      `/rest/v1/group_buy_request_participations?id=eq.${guestRows[2].id}`,
      {
        body: { requested_at: expiredAt },
        headers: { Prefer: "return=minimal" },
        key: config.serviceRoleKey,
        method: "PATCH",
      },
    );
    expect(expiredGuest.ok, JSON.stringify(expiredGuest.payload)).toBe(true);

    const params = {
      p_page: 1,
      p_limit_count: 30,
      p_status: "ALL",
      p_query: productName,
    };
    const serviceResult = await requestJson<AdminRequestList>(
      config,
      "/rest/v1/rpc/get_admin_group_buy_requests",
      {
        body: params,
        key: config.serviceRoleKey,
        method: "POST",
      },
    );

    expect(serviceResult.ok).toBe(true);
    expect(serviceResult.payload.total).toBe(1);
    expect(serviceResult.payload.items).toEqual([
      expect.objectContaining({
        productName,
        status: "OPEN",
        requestCount: 2,
      }),
    ]);
    expect(serviceResult.payload.items[0].latestRequestedAt).not.toBe(
      expiredAt,
    );
    expect(Object.keys(serviceResult.payload.items[0]).sort()).toEqual(
      [
        "createdAt",
        "id",
        "latestRequestedAt",
        "productName",
        "requestCount",
        "status",
      ].sort(),
    );
    expect(JSON.stringify(serviceResult.payload)).not.toMatch(
      /user_id|session_hashes|ip_hash|actor_hash/,
    );

    const emptyPage = await requestJson<AdminRequestList>(
      config,
      "/rest/v1/rpc/get_admin_group_buy_requests",
      {
        body: { ...params, p_page: 999 },
        key: config.serviceRoleKey,
        method: "POST",
      },
    );
    expect(emptyPage.ok).toBe(true);
    expect(emptyPage.payload).toEqual({ items: [], total: 1 });

    const anonResult = await requestJson(
      config,
      "/rest/v1/rpc/get_admin_group_buy_requests",
      { body: params, method: "POST" },
    );
    expect(anonResult.ok).toBe(false);
    const authenticatedResult = await requestJson(
      config,
      "/rest/v1/rpc/get_admin_group_buy_requests",
      { body: params, method: "POST", token: userAccessToken },
    );
    expect(authenticatedResult.ok).toBe(false);
  });

  it("limits an installation to five new products per 24 hours", async () => {
    const sessionId = `s_${suffix}_rate_limit`;
    const clientIp = allocateClientIp();
    const firstProductName = `요청제한 0 ${suffix}`;
    for (let index = 0; index < 5; index += 1) {
      const result = await requestGroupBuy(
        `요청제한 ${index} ${suffix}`,
        sessionId,
        undefined,
        clientIp,
      );
      expect(result[0].already_requested).toBe(false);
    }

    const rejected = await requestJson<unknown>(
      config,
      "/functions/v1/group-buy-request",
      {
        body: {
          product_name: `요청제한 6 ${suffix}`,
          session_id: sessionId,
        },
        headers: { "x-forwarded-for": clientIp },
        method: "POST",
      },
    );
    expect(rejected.ok).toBe(false);
    expect(JSON.stringify(rejected.payload)).toContain(
      "group_buy_request_rate_limited",
    );

    await requestGroupBuy(
      firstProductName,
      sessionId,
      userAccessToken,
      clientIp,
    );
    const rejectedOnOtherDevice = await requestJson<unknown>(
      config,
      "/functions/v1/group-buy-request",
      {
        body: {
          product_name: `요청제한 계정 ${suffix}`,
          session_id: `s_${suffix}_rate_limit_other_device`,
        },
        headers: { "x-forwarded-for": allocateClientIp() },
        method: "POST",
        token: userAccessToken,
      },
    );
    expect(rejectedOnOtherDevice.ok).toBe(false);
    expect(JSON.stringify(rejectedOnOtherDevice.payload)).toContain(
      "group_buy_request_rate_limited",
    );
  });

  it("returns up to the top ten products with at least two recent actors", async () => {
    const rankingProducts = [
      { count: 5, name: `순위A ${suffix}` },
      { count: 4, name: `순위B ${suffix}` },
      { count: 3, name: `순위C ${suffix}` },
      { count: 2, name: `순위D ${suffix}` },
      { count: 1, name: `순위제외 ${suffix}` },
    ];
    const rankingRequestIds = new Map<string, string>();
    for (const [productIndex, product] of rankingProducts.entries()) {
      for (let actorIndex = 0; actorIndex < product.count; actorIndex += 1) {
        const result = await requestGroupBuy(
          product.name,
          `s_${suffix}_rank_${productIndex}_${actorIndex}`,
        );
        rankingRequestIds.set(product.name, result[0].request_id);
      }
    }

    const rankings = await invokeRpc<RankingRow[]>(
      config,
      "get_group_buy_request_rankings",
      { p_limit_count: 99 },
    );
    expect(rankings.length).toBeLessThanOrEqual(10);
    const ownRankings = rankings.filter((row) =>
      rankingRequestIds.has(row.product_name),
    );
    expect(ownRankings.map((row) => row.product_name)).toEqual(
      rankingProducts.slice(0, 4).map((product) => product.name),
    );
    expect(ownRankings.map((row) => row.request_count)).toEqual([5, 4, 3, 2]);
    expect(ownRankings.map((row) => row.rank)).toEqual([1, 2, 3, 4]);
    expect(rankings.some((row) => row.product_name.includes("순위제외"))).toBe(
      false,
    );

    for (const [productName, status] of [
      [rankingProducts[0].name, "HIDDEN"],
      [rankingProducts[1].name, "FULFILLED"],
    ] as const) {
      const requestId = rankingRequestIds.get(productName);
      expect(requestId).toBeTruthy();
      const updated = await requestJson(
        config,
        `/rest/v1/group_buy_requests?id=eq.${encodeURIComponent(requestId!)}`,
        {
          body: { status },
          key: config.serviceRoleKey,
          method: "PATCH",
        },
      );
      expect(updated.ok).toBe(true);
    }

    const rankingsAfterStatusChange = await invokeRpc<RankingRow[]>(
      config,
      "get_group_buy_request_rankings",
      { p_limit_count: 3 },
    );
    const ownRankingsAfterStatusChange = rankingsAfterStatusChange.filter(
      (row) => rankingRequestIds.has(row.product_name),
    );
    expect(rankingsAfterStatusChange.length).toBeLessThanOrEqual(3);
    expect(
      rankingsAfterStatusChange.some((row) =>
        [rankingProducts[0].name, rankingProducts[1].name].includes(
          row.product_name,
        ),
      ),
    ).toBe(false);
    expect(ownRankingsAfterStatusChange.map((row) => row.product_name)).toEqual(
      [rankingProducts[2].name, rankingProducts[3].name],
    );
    expect(
      ownRankingsAfterStatusChange.map((row) => row.request_count),
    ).toEqual([3, 2]);
    expect(ownRankingsAfterStatusChange.map((row) => row.rank)).toEqual([1, 2]);
  });
});

import {
  assertEquals,
  assertMatch,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  createHandler,
  hmacSha256Hex,
  resolveTrustedClientIp,
} from "./index.ts";

type RpcArgs = {
  p_product_name: string;
  p_session_hash: string;
  p_ip_hash: string;
  p_user_id: string | null;
};

function legacyAnonKey(projectRef: string) {
  const encode = (value: Record<string, unknown>) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    ref: projectRef,
    role: "anon",
  })}.signature`;
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://example.test/functions/v1/group-buy-request", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": "203.0.113.7",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function fakeClient(
  options: {
    userId?: string | null;
    rpcError?: { message: string } | null;
    limiterAllowed?: boolean;
    limiterError?: { message: string } | null;
    onRpc?: (name: string, args: RpcArgs) => void;
    onAnyRpc?: (name: string, args: Record<string, unknown>) => void;
    onGetUser?: () => void;
  } = {},
) {
  return {
    auth: {
      getUser: async (_token: string) => {
        options.onGetUser?.();
        return {
          data: {
            user:
              options.userId === undefined
                ? null
                : options.userId === null
                  ? null
                  : { id: options.userId },
          },
          error: options.userId ? null : new Error("invalid token"),
        };
      },
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      options.onAnyRpc?.(name, args);
      if (name === "consume_group_buy_request_attempt") {
        const allowed = options.limiterAllowed ?? true;
        return {
          data: options.limiterError
            ? null
            : [
                {
                  allowed,
                  attempt_count: allowed ? 1 : 21,
                  retry_after_seconds: 600,
                },
              ],
          error: options.limiterError ?? null,
        };
      }
      const mainArgs = args as RpcArgs;
      options.onRpc?.(name, mainArgs);
      return {
        data: options.rpcError
          ? null
          : [
              {
                request_id: "request-1",
                product_name: mainArgs.p_product_name,
                request_count: 1,
                already_requested: false,
                ranking_eligible: false,
              },
            ],
        error: options.rpcError ?? null,
      };
    },
  };
}

Deno.test(
  "hosted requests trust only Cloudflare's single connecting IP",
  () => {
    const hosted = new Headers({
      "cf-connecting-ip": "203.0.113.7",
      "x-forwarded-for": "198.51.100.2",
    });
    assertEquals(
      resolveTrustedClientIp(hosted, "https://project.supabase.co"),
      "203.0.113.7",
    );
    assertEquals(
      resolveTrustedClientIp(
        new Headers({ "x-forwarded-for": "198.51.100.2" }),
        "https://project.supabase.co",
      ),
      null,
    );
    assertEquals(
      resolveTrustedClientIp(
        new Headers({ "cf-connecting-ip": "999.0.0.1" }),
        "https://project.supabase.co",
      ),
      null,
    );
  },
);

Deno.test(
  "local Supabase prefers forwarded fixture IPs over proxy headers",
  () => {
    assertEquals(
      resolveTrustedClientIp(
        new Headers({
          "cf-connecting-ip": "127.0.0.1",
          "x-forwarded-for": "198.51.100.2",
          "x-real-ip": "172.18.0.1",
        }),
        "http://kong:8000",
      ),
      "198.51.100.2",
    );
    assertEquals(
      resolveTrustedClientIp(
        new Headers({
          "x-forwarded-for": "127.0.0.1, 172.18.0.1",
        }),
        "http://kong:8000",
      ),
      "127.0.0.1",
    );
    assertEquals(
      resolveTrustedClientIp(
        new Headers({ "x-real-ip": "2001:db8::1" }),
        "http://127.0.0.1:54321",
      ),
      "2001:db8::1",
    );
  },
);

Deno.test(
  "hmacSha256Hex hides raw identifiers and separates domains",
  async () => {
    const sessionHash = await hmacSha256Hex(
      "existing-service-role-key",
      "session",
      "same-value",
    );
    const ipHash = await hmacSha256Hex(
      "existing-service-role-key",
      "ip",
      "same-value",
    );
    const userHash = await hmacSha256Hex(
      "existing-service-role-key",
      "user",
      "same-value",
    );

    assertMatch(sessionHash, /^[0-9a-f]{64}$/);
    assertMatch(ipHash, /^[0-9a-f]{64}$/);
    assertMatch(userHash, /^[0-9a-f]{64}$/);
    assertNotEquals(sessionHash, ipHash);
    assertNotEquals(userHash, ipHash);
    assertNotEquals(sessionHash.includes("same-value"), true);
  },
);

Deno.test(
  "guest requests send only server-derived hashes to the internal RPC",
  async () => {
    let captured: { name: string; args: RpcArgs } | null = null;
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const handler = createHandler({
      adminClient: fakeClient({
        onRpc: (name, args) => (captured = { name, args }),
        onAnyRpc: (name, args) => calls.push({ name, args }),
      }) as never,
      anonKey: "public-anon-key",
      serviceRoleKey: "existing-service-role-key",
      supabaseUrl: "https://project.supabase.co",
    });

    const response = await handler(
      request({
        product_name: "에어팟 프로",
        session_id: "install_session_123",
      }),
    );

    assertEquals(response.status, 200);
    assertEquals(captured?.name, "request_group_buy_internal");
    assertEquals(captured?.args.p_product_name, "에어팟 프로");
    assertEquals(captured?.args.p_user_id, null);
    assertMatch(captured?.args.p_session_hash ?? "", /^[0-9a-f]{64}$/);
    assertMatch(captured?.args.p_ip_hash ?? "", /^[0-9a-f]{64}$/);
    assertNotEquals(captured?.args.p_session_hash, "install_session_123");
    assertNotEquals(captured?.args.p_ip_hash, "203.0.113.7");
    assertEquals(
      calls.map((call) => call.name),
      ["consume_group_buy_request_attempt", "request_group_buy_internal"],
    );
    assertEquals(calls[0].args.p_actor_hash, captured?.args.p_ip_hash);
  },
);

Deno.test(
  "verified bearer identity is passed to the service-only RPC",
  async () => {
    let captured: RpcArgs | null = null;
    const limiterActorHashes: string[] = [];
    const callOrder: string[] = [];
    const handler = createHandler({
      adminClient: fakeClient({
        userId: "00000000-0000-4000-8000-000000000001",
        onRpc: (_name, args) => (captured = args),
        onGetUser: () => callOrder.push("auth.getUser"),
        onAnyRpc: (name, args) => {
          callOrder.push(name);
          if (name === "consume_group_buy_request_attempt") {
            limiterActorHashes.push(String(args.p_actor_hash ?? ""));
          }
        },
      }) as never,
      anonKey: "public-anon-key",
      serviceRoleKey: "existing-service-role-key",
      supabaseUrl: "https://project.supabase.co",
    });

    const response = await handler(
      request(
        { product_name: "다이슨 에어랩", session_id: "install_session_456" },
        {
          apikey: "legacy-public-anon-key",
          authorization: "Bearer valid-user-jwt",
        },
      ),
    );

    assertEquals(response.status, 200);
    assertEquals(captured?.p_user_id, "00000000-0000-4000-8000-000000000001");
    assertEquals(callOrder, [
      "consume_group_buy_request_attempt",
      "auth.getUser",
      "consume_group_buy_request_attempt",
      "request_group_buy_internal",
    ]);
    assertEquals(limiterActorHashes.length, 2);
    assertEquals(limiterActorHashes[0], captured?.p_ip_hash);
    assertMatch(limiterActorHashes[1], /^[0-9a-f]{64}$/);
    assertNotEquals(limiterActorHashes[1], captured?.p_ip_hash);
  },
);

Deno.test(
  "invalid credentials never fall back to a guest request",
  async () => {
    let rpcCalled = false;
    const callOrder: string[] = [];
    const handler = createHandler({
      adminClient: fakeClient({
        userId: null,
        onRpc: () => (rpcCalled = true),
        onAnyRpc: (name) => callOrder.push(name),
        onGetUser: () => callOrder.push("auth.getUser"),
      }) as never,
      anonKey: "public-anon-key",
      serviceRoleKey: "existing-service-role-key",
      supabaseUrl: "https://project.supabase.co",
    });

    const response = await handler(
      request(
        { product_name: "다이슨 에어랩", session_id: "install_session_456" },
        {
          apikey: "legacy-public-anon-key",
          authorization: "Bearer expired-user-jwt",
        },
      ),
    );

    assertEquals(response.status, 401);
    assertEquals(rpcCalled, false);
    assertEquals(callOrder, [
      "consume_group_buy_request_attempt",
      "auth.getUser",
    ]);
    assertEquals(await response.json(), { error: "invalid_authentication" });
  },
);

Deno.test(
  "a rotated legacy anon bearer sent by functions.invoke remains a guest",
  async () => {
    let captured: RpcArgs | null = null;
    let getUserCalls = 0;
    const handler = createHandler({
      adminClient: fakeClient({
        onRpc: (_name, args) => (captured = args),
        onGetUser: () => (getUserCalls += 1),
      }) as never,
      anonKey: "current-runtime-anon-key",
      serviceRoleKey: "existing-service-role-key",
      supabaseUrl: "https://project.supabase.co",
    });

    const response = await handler(
      request(
        { product_name: "다이슨 에어랩", session_id: "install_session_456" },
        {
          apikey: legacyAnonKey("project"),
          authorization: `Bearer ${legacyAnonKey("project")}`,
        },
      ),
    );

    assertEquals(response.status, 200);
    assertEquals(captured?.p_user_id, null);
    assertEquals(getUserCalls, 0);
  },
);

Deno.test(
  "a duplicated authenticated bearer is still verified as a user token",
  async () => {
    let captured: RpcArgs | null = null;
    let getUserCalls = 0;
    const handler = createHandler({
      adminClient: fakeClient({
        userId: "user-123",
        onRpc: (_name, args) => (captured = args),
        onGetUser: () => (getUserCalls += 1),
      }) as never,
      anonKey: "current-runtime-anon-key",
      serviceRoleKey: "existing-service-role-key",
      supabaseUrl: "https://project.supabase.co",
    });

    const response = await handler(
      request(
        { product_name: "콜드브루", session_id: "session-12345678" },
        {
          apikey: "valid-user-jwt",
          authorization: "Bearer valid-user-jwt",
        },
      ),
    );

    assertEquals(response.status, 200);
    assertEquals(captured?.p_user_id, "user-123");
    assertEquals(getUserCalls, 1);
  },
);

Deno.test(
  "a duplicated invalid user bearer never falls back to a guest",
  async () => {
    let getUserCalls = 0;
    const handler = createHandler({
      adminClient: fakeClient({
        userId: null,
        onGetUser: () => (getUserCalls += 1),
      }) as never,
      anonKey: "current-runtime-anon-key",
      serviceRoleKey: "existing-service-role-key",
      supabaseUrl: "https://project.supabase.co",
    });

    const response = await handler(
      request(
        { product_name: "콜드브루", session_id: "session-12345678" },
        {
          apikey: "expired-user-jwt",
          authorization: "Bearer expired-user-jwt",
        },
      ),
    );

    assertEquals(response.status, 401);
    assertEquals(getUserCalls, 1);
  },
);

Deno.test(
  "attempt limiter rejection blocks the main RPC with Retry-After 600",
  async () => {
    const rpcNames: string[] = [];
    const handler = createHandler({
      adminClient: fakeClient({
        limiterAllowed: false,
        onAnyRpc: (name) => rpcNames.push(name),
      }) as never,
      anonKey: "public-anon-key",
      serviceRoleKey: "existing-service-role-key",
      supabaseUrl: "https://project.supabase.co",
    });

    const response = await handler(
      request({
        product_name: "에어팟 프로",
        session_id: "install_session_123",
      }),
    );

    assertEquals(response.status, 429);
    assertEquals(response.headers.get("retry-after"), "600");
    assertEquals(await response.json(), {
      error: "group_buy_request_attempt_rate_limited",
    });
    assertEquals(rpcNames, ["consume_group_buy_request_attempt"]);
  },
);

Deno.test(
  "a blocked IP rejects fabricated bearer spam before Auth lookup",
  async () => {
    let authCalled = false;
    const rpcNames: string[] = [];
    const handler = createHandler({
      adminClient: fakeClient({
        limiterAllowed: false,
        onAnyRpc: (name) => rpcNames.push(name),
        onGetUser: () => (authCalled = true),
      }) as never,
      anonKey: "public-anon-key",
      serviceRoleKey: "existing-service-role-key",
      supabaseUrl: "https://project.supabase.co",
    });

    const response = await handler(
      request(
        { product_name: "에어팟 프로", session_id: "install_session_123" },
        { authorization: "Bearer fabricated-user-jwt" },
      ),
    );

    assertEquals(response.status, 429);
    assertEquals(authCalled, false);
    assertEquals(rpcNames, ["consume_group_buy_request_attempt"]);
  },
);

Deno.test("invalid request bodies still consume an IP attempt", async () => {
  const rpcNames: string[] = [];
  const handler = createHandler({
    adminClient: fakeClient({
      onAnyRpc: (name) => rpcNames.push(name),
    }) as never,
    anonKey: "public-anon-key",
    serviceRoleKey: "existing-service-role-key",
    supabaseUrl: "https://project.supabase.co",
  });

  const response = await handler(request({ unexpected: true }));

  assertEquals(response.status, 400);
  assertEquals(rpcNames, ["consume_group_buy_request_attempt"]);
});

for (const declaredLength of [undefined, "1"] as const) {
  Deno.test(
    `oversized streaming body is cancelled at 4097 bytes with content-length ${declaredLength ?? "missing"}`,
    async () => {
      let pullCount = 0;
      let cancelled = false;
      const stream = new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            pullCount += 1;
            controller.enqueue(new Uint8Array(2048));
          },
          cancel() {
            cancelled = true;
          },
        },
        { highWaterMark: 0 },
      );
      const headers: Record<string, string> = {
        "cf-connecting-ip": "203.0.113.7",
        "content-type": "application/json",
      };
      if (declaredLength) headers["content-length"] = declaredLength;
      const streamedRequest = new Request(
        "https://example.test/functions/v1/group-buy-request",
        { method: "POST", headers, body: stream },
      );
      const rpcNames: string[] = [];
      const handler = createHandler({
        adminClient: fakeClient({
          onAnyRpc: (name) => rpcNames.push(name),
        }) as never,
        anonKey: "public-anon-key",
        serviceRoleKey: "existing-service-role-key",
        supabaseUrl: "https://project.supabase.co",
      });

      const response = await handler(streamedRequest);

      assertEquals(response.status, 413);
      assertEquals(cancelled, true);
      assertEquals(pullCount, 3);
      assertEquals(rpcNames, ["consume_group_buy_request_attempt"]);
    },
  );
}

Deno.test("missing trusted client IP fails closed", async () => {
  let rpcCalled = false;
  const handler = createHandler({
    adminClient: fakeClient({ onRpc: () => (rpcCalled = true) }) as never,
    anonKey: "public-anon-key",
    serviceRoleKey: "existing-service-role-key",
    supabaseUrl: "https://project.supabase.co",
  });
  const noIpRequest = new Request(
    "https://example.test/functions/v1/group-buy-request",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        product_name: "다이슨 에어랩",
        session_id: "install_session_456",
      }),
    },
  );

  const response = await handler(noIpRequest);

  assertEquals(response.status, 503);
  assertEquals(rpcCalled, false);
  assertEquals(await response.json(), { error: "client_ip_unavailable" });
});

Deno.test("database request quota errors become HTTP 429", async () => {
  const handler = createHandler({
    adminClient: fakeClient({
      rpcError: { message: "group_buy_request_rate_limited" },
    }) as never,
    anonKey: "public-anon-key",
    serviceRoleKey: "existing-service-role-key",
    supabaseUrl: "https://project.supabase.co",
  });

  const response = await handler(
    request({
      product_name: "에어팟 프로",
      session_id: "install_session_123",
    }),
  );

  assertEquals(response.status, 429);
  assertEquals(response.headers.get("retry-after"), "86400");
  assertEquals(await response.json(), {
    error: "group_buy_request_rate_limited",
  });
});

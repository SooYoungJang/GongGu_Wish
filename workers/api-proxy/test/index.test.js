import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import worker from "../src/index.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function env(overrides = {}) {
  return {
    APP_ENV: "preview",
    CF_VERSION_METADATA: { tag: "a".repeat(40) },
    SUPABASE_ORIGIN: "https://xwblovggtvbpiusjfokq.supabase.co",
    ALLOWED_ORIGINS: "https://gongguwish.com,https://www.gongguwish.com",
    ...overrides,
  };
}

function request(
  path,
  init = {},
  envOverrides = {},
  origin = "api.gongguwish.com",
) {
  return worker.fetch(
    new Request(`https://${origin}${path}`, init),
    env(envOverrides),
  );
}

describe("gonggu API proxy", () => {
  it("serves the Preview Android App Link association", async () => {
    const response = await request(
      "/.well-known/assetlinks.json",
      {},
      {},
      "api-preview.gongguwish.com",
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^application\/json/);
    assert.equal(response.headers.get("cache-control"), "public, max-age=300");
    assert.deepEqual(await response.json(), [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.gonggu.wish.preview",
          sha256_cert_fingerprints: [
            "49:83:0D:45:2F:80:FC:9B:AF:6E:09:01:39:6B:CD:23:1E:DE:F2:26:1E:DC:49:D8:8D:D3:8C:9D:5A:60:DA:57",
          ],
        },
      },
    ]);
  });

  it("serves a Preview app-open fallback when the OS does not intercept", async () => {
    const response = await request(
      "/group-buy/20f3a346-d55d-404f-80f0-edf721b82e7e",
      {},
      {},
      "api-preview.gongguwish.com",
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/html/);
    assert.match(
      await response.text(),
      /gongguwish-preview:\/\/group-buy\/20f3a346-d55d-404f-80f0-edf721b82e7e/,
    );
    assert.equal(response.headers.get("cache-control"), "no-store");
  });

  it("never exposes the Preview association from the Production worker", async () => {
    const response = await request(
      "/.well-known/assetlinks.json",
      {},
      {
        APP_ENV: "production",
        SUPABASE_ORIGIN: "https://iosdoheblabfimkjnvfj.supabase.co",
      },
      "api.gongguwish.com",
    );

    assert.equal(response.status, 404);
  });

  it("rejects malformed group-buy fallback paths", async () => {
    const nestedPath = await request(
      "/group-buy/a/b",
      {},
      {},
      "api-preview.gongguwish.com",
    );
    const query = await request(
      "/group-buy/deal-one?redirect=https://evil.example",
      {},
      {},
      "api-preview.gongguwish.com",
    );

    assert.equal(nestedPath.status, 404);
    assert.equal(query.status, 404);
  });

  it("returns health without contacting Supabase", async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return new Response();
    };

    const response = await request("/health");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ok",
      environment: "preview",
      commitSha: "a".repeat(40),
      supabaseProjectRef: "xwblovggtvbpiusjfokq",
    });
    assert.equal(called, false);
  });

  it("rejects paths outside the explicit allowlist", async () => {
    const response = await request("/rest/v1/private_profiles", {
      headers: { apikey: "public-key" },
    });

    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, "ROUTE_NOT_FOUND");
  });

  it("rejects unsupported methods before contacting Supabase", async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return new Response();
    };

    const response = await request("/rest/v1/group_buys", {
      method: "PUT",
      headers: { apikey: "public-key" },
    });

    assert.equal(response.status, 405);
    assert.equal(called, false);
  });

  it("requires the Supabase API key on proxied requests", async () => {
    const response = await request("/rest/v1/group_buys");

    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, "API_KEY_REQUIRED");
  });

  it("rejects request bodies larger than one MiB before contacting Supabase", async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return new Response();
    };

    const response = await request("/functions/v1/public-submission", {
      method: "POST",
      headers: {
        apikey: "public-key",
        "Content-Type": "application/json",
      },
      body: "x".repeat(1024 * 1024 + 1),
    });

    assert.equal(response.status, 413);
    assert.equal((await response.json()).error.code, "PAYLOAD_TOO_LARGE");
    assert.equal(called, false);
  });

  it("forwards an allowlisted PostgREST request and response metadata", async () => {
    let upstreamRequest;
    globalThis.fetch = async (input) => {
      upstreamRequest = input;
      return Response.json([{ id: "deal-1" }], {
        status: 206,
        headers: { "content-range": "0-0/1" },
      });
    };

    const response = await request("/rest/v1/group_buys?select=id", {
      headers: {
        apikey: "public-key",
        "CF-Ray": "test-ray",
        Origin: "https://gongguwish.com",
        Range: "0-19",
      },
    });

    assert.equal(
      upstreamRequest.url,
      "https://xwblovggtvbpiusjfokq.supabase.co/rest/v1/group_buys?select=id",
    );
    assert.equal(upstreamRequest.method, "GET");
    assert.equal(upstreamRequest.headers.get("apikey"), "public-key");
    assert.equal(upstreamRequest.headers.get("range"), "0-19");
    assert.equal(upstreamRequest.headers.get("x-request-id"), "test-ray");
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("x-request-id"), "test-ray");
    assert.equal(response.headers.get("content-range"), "0-0/1");
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "https://gongguwish.com",
    );
    assert.equal(response.headers.get("cache-control"), "no-store");
  });

  it("forwards the allowlisted monthly group-buy ranking RPC", async () => {
    let upstreamRequest;
    globalThis.fetch = async (input) => {
      upstreamRequest = input;
      return Response.json([]);
    };

    const response = await request(
      "/rest/v1/rpc/get_group_buy_request_rankings",
      {
        method: "POST",
        headers: {
          apikey: "public-key",
          "content-type": "application/json",
        },
        body: JSON.stringify({ p_limit_count: 3 }),
      },
    );

    assert.equal(response.status, 200);
    assert.equal(
      upstreamRequest.url,
      "https://xwblovggtvbpiusjfokq.supabase.co/rest/v1/rpc/get_group_buy_request_rankings",
    );
    assert.equal(upstreamRequest.method, "POST");
    assert.deepEqual(await upstreamRequest.json(), { p_limit_count: 3 });
  });

  it("forwards product comment, moderation, and consent RPCs", async () => {
    const rpcBodies = {
      list_comment_roots: { p_group_buy_id: "deal-1", p_limit: 20 },
      list_comment_children: { p_group_buy_id: "deal-1", p_limit: 20 },
      create_comment: {
        p_group_buy_id: "deal-1",
        p_parent_id: null,
        p_body: "hello",
        p_client_request_id: "client-1",
        p_terms_version: "community-v1",
      },
      report_comment: {
        p_comment_id: "comment-1",
        p_reason: "spam",
        p_details: "details",
      },
      block_user_from_comment: { p_comment_id: "comment-1" },
      accept_comment_terms: { p_terms_version: "community-v1" },
    };

    for (const [rpc, body] of Object.entries(rpcBodies)) {
      let upstreamRequest;
      globalThis.fetch = async (input) => {
        upstreamRequest = input;
        return Response.json({ items: [] });
      };

      const response = await request(`/rest/v1/rpc/${rpc}`, {
        method: "POST",
        headers: {
          apikey: "public-key",
          Authorization: "Bearer user-jwt",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });

      assert.equal(response.status, 200);
      assert.equal(
        upstreamRequest.url,
        `https://xwblovggtvbpiusjfokq.supabase.co/rest/v1/rpc/${rpc}`,
      );
      assert.equal(upstreamRequest.method, "POST");
      assert.equal(
        upstreamRequest.headers.get("authorization"),
        "Bearer user-jwt",
      );
      assert.deepEqual(await upstreamRequest.json(), body);
    }
  });

  it("refuses to proxy when Preview points at the Production Supabase origin", async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return Response.json([]);
    };

    const response = await request(
      "/rest/v1/group_buys",
      { headers: { apikey: "public-key" } },
      { SUPABASE_ORIGIN: "https://iosdoheblabfimkjnvfj.supabase.co" },
    );

    assert.equal(response.status, 500);
    assert.equal((await response.json()).error.code, "PROXY_MISCONFIGURED");
    assert.equal(called, false);
  });

  it("refuses to proxy without an exact deployed commit identity", async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return Response.json([]);
    };

    const response = await request(
      "/rest/v1/group_buys",
      { headers: { apikey: "public-key" } },
      { CF_VERSION_METADATA: { tag: "latest" } },
    );

    assert.equal(response.status, 500);
    assert.equal((await response.json()).error.code, "PROXY_MISCONFIGURED");
    assert.equal(called, false);
  });

  it("forwards allowlisted Edge Function POST bodies and authorization", async () => {
    let upstreamRequest;
    globalThis.fetch = async (input) => {
      upstreamRequest = input;
      return Response.json({ ok: true });
    };

    const response = await request("/functions/v1/register-push-token", {
      method: "POST",
      headers: {
        apikey: "public-key",
        Authorization: "Bearer user-jwt",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: "ExponentPushToken[test]" }),
    });

    assert.equal(
      upstreamRequest.url,
      "https://xwblovggtvbpiusjfokq.supabase.co/functions/v1/register-push-token",
    );
    assert.equal(
      upstreamRequest.headers.get("authorization"),
      "Bearer user-jwt",
    );
    assert.deepEqual(await upstreamRequest.json(), {
      token: "ExponentPushToken[test]",
    });
    assert.equal(response.status, 200);
  });

  it("answers CORS preflight only for configured origins", async () => {
    const allowed = await request("/rest/v1/group_buys", {
      method: "OPTIONS",
      headers: { Origin: "https://www.gongguwish.com" },
    });
    const denied = await request("/rest/v1/group_buys", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example" },
    });

    assert.equal(allowed.status, 204);
    assert.equal(
      allowed.headers.get("access-control-allow-origin"),
      "https://www.gongguwish.com",
    );
    assert.equal(denied.status, 403);
  });

  it("returns a generic 502 when Supabase is unavailable", async () => {
    globalThis.fetch = async () => {
      throw new Error("internal upstream hostname and token");
    };

    const response = await request("/rest/v1/group_buys", {
      headers: { apikey: "public-key" },
    });
    const body = await response.text();

    assert.equal(response.status, 502);
    assert.match(body, /UPSTREAM_UNAVAILABLE/);
    assert.doesNotMatch(body, /internal upstream hostname and token/);
  });
});

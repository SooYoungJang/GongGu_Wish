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

function request(path, init = {}, envOverrides = {}) {
  return worker.fetch(
    new Request(`https://api.gongguwish.com${path}`, init),
    env(envOverrides),
  );
}

describe("gonggu API proxy", () => {
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

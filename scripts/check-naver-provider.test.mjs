import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNaverAuthorizeUrl,
  checkNaverProvider,
  resolveNaverTarget,
} from "./check-naver-provider.mjs";

const PREVIEW = {
  appVariant: "preview",
  projectRef: "xwblovggtvbpiusjfokq",
};
const PRODUCTION = {
  appVariant: "production",
  projectRef: "iosdoheblabfimkjnvfj",
};

function naverResponse({
  callback = "https://xwblovggtvbpiusjfokq.supabase.co/auth/v1/callback",
  clientId = "naver-client-id",
  host = "nid.naver.com",
  redirectTo = "gongguwish-preview://auth/callback",
  status = 302,
} = {}) {
  const location = new URL(`https://${host}/oauth2.0/authorize`);
  location.searchParams.set("client_id", clientId);
  // Supabase creates a separate PKCE pair for the external provider.
  location.searchParams.set("code_challenge", "B".repeat(43));
  location.searchParams.set("code_challenge_method", "S256");
  location.searchParams.set("redirect_to", redirectTo);
  location.searchParams.set("redirect_uri", callback);
  location.searchParams.set("response_type", "code");
  location.searchParams.set("state", "opaque-state");
  return new Response(null, {
    status,
    headers: { location: location.href },
  });
}

test("environment mapping keeps Preview and Production Naver OAuth isolated", () => {
  assert.deepEqual(resolveNaverTarget(PREVIEW), {
    appVariant: "preview",
    callbackUrl:
      "https://xwblovggtvbpiusjfokq.supabase.co/auth/v1/callback",
    projectRef: "xwblovggtvbpiusjfokq",
    redirectTo: "gongguwish-preview://auth/callback",
  });
  assert.deepEqual(resolveNaverTarget(PRODUCTION), {
    appVariant: "production",
    callbackUrl:
      "https://iosdoheblabfimkjnvfj.supabase.co/auth/v1/callback",
    projectRef: "iosdoheblabfimkjnvfj",
    redirectTo: "gongguwish://auth/callback",
  });
  assert.throws(
    () =>
      resolveNaverTarget({
        appVariant: "production",
        projectRef: PREVIEW.projectRef,
      }),
    /production must use its exact Supabase project ref/,
  );
});

test("authorize URL probes custom:naver with an exact app redirect and PKCE", () => {
  const target = resolveNaverTarget(PRODUCTION);
  const authorizeUrl = buildNaverAuthorizeUrl(target);

  assert.equal(authorizeUrl.origin, "https://iosdoheblabfimkjnvfj.supabase.co");
  assert.equal(authorizeUrl.pathname, "/auth/v1/authorize");
  assert.equal(authorizeUrl.searchParams.get("provider"), "custom:naver");
  assert.equal(
    authorizeUrl.searchParams.get("redirect_to"),
    "gongguwish://auth/callback",
  );
  assert.equal(authorizeUrl.searchParams.get("code_challenge")?.length, 43);
  assert.equal(authorizeUrl.searchParams.get("code_challenge_method"), "s256");
});

test("readiness succeeds only for Naver and the exact environment callbacks", async () => {
  const requests = [];
  const result = await checkNaverProvider({
    ...PREVIEW,
    fetchImpl: async (url, options) => {
      requests.push({ options, url: String(url) });
      return naverResponse();
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.redirect, "manual");
  assert.match(requests[0].url, /provider=custom%3Anaver/);
  assert.deepEqual(result, {
    appVariant: "preview",
    callbackUrl:
      "https://xwblovggtvbpiusjfokq.supabase.co/auth/v1/callback",
    projectRef: "xwblovggtvbpiusjfokq",
    providerHost: "nid.naver.com",
    status: 302,
  });
});

test("readiness rejects missing providers, cross-environment callbacks, and unsafe redirects", async () => {
  await assert.rejects(
    checkNaverProvider({
      ...PRODUCTION,
      fetchImpl: async () =>
        Response.json(
          { message: "custom provider custom:naver not found" },
          { status: 400 },
        ),
    }),
    /production Naver provider is not ready \(HTTP 400\)/,
  );

  await assert.rejects(
    checkNaverProvider({
      ...PREVIEW,
      fetchImpl: async () =>
        naverResponse({
          callback:
            "https://iosdoheblabfimkjnvfj.supabase.co/auth/v1/callback",
        }),
    }),
    /callback does not match preview/,
  );

  await assert.rejects(
    checkNaverProvider({
      ...PREVIEW,
      fetchImpl: async () => naverResponse({ host: "login.example.com" }),
    }),
    /did not redirect to Naver/,
  );
});

test("readiness retries transient failures without retrying a provider configuration error", async () => {
  let transientAttempts = 0;
  const result = await checkNaverProvider({
    ...PREVIEW,
    fetchImpl: async () => {
      transientAttempts += 1;
      if (transientAttempts === 1) return new Response(null, { status: 503 });
      return naverResponse();
    },
    maxAttempts: 2,
    retryDelayMs: 0,
  });
  assert.equal(transientAttempts, 2);
  assert.equal(result.status, 302);

  let configurationAttempts = 0;
  await assert.rejects(
    checkNaverProvider({
      ...PRODUCTION,
      fetchImpl: async () => {
        configurationAttempts += 1;
        return Response.json({ message: "provider missing" }, { status: 400 });
      },
      maxAttempts: 3,
      retryDelayMs: 0,
    }),
    /HTTP 400/,
  );
  assert.equal(configurationAttempts, 1);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildKakaoAuthorizeUrl,
  checkKakaoProvider,
  checkProductionAuthFallback,
  resolveKakaoTarget,
} from "./check-kakao-provider.mjs";

const PREVIEW = {
  appVariant: "preview",
  projectRef: "xwblovggtvbpiusjfokq",
};
const PRODUCTION = {
  appVariant: "production",
  projectRef: "iosdoheblabfimkjnvfj",
};

function kakaoResponse({
  callback = "https://xwblovggtvbpiusjfokq.supabase.co/auth/v1/callback",
  clientId = "private-client-id",
  host = "kauth.kakao.com",
  status = 302,
} = {}) {
  const location = new URL(`https://${host}/oauth/authorize`);
  location.searchParams.set("client_id", clientId);
  location.searchParams.set("redirect_uri", callback);
  return new Response(null, {
    status,
    headers: { location: location.href },
  });
}

function authFallbackResponse({
  location = "https://gongguwish.com/?error=access_denied",
  status = 303,
} = {}) {
  return new Response(null, {
    status,
    headers: { location },
  });
}

test("environment mapping keeps Preview and Production OAuth isolated", () => {
  assert.deepEqual(resolveKakaoTarget(PREVIEW), {
    appVariant: "preview",
    callbackUrl: "https://xwblovggtvbpiusjfokq.supabase.co/auth/v1/callback",
    projectRef: "xwblovggtvbpiusjfokq",
    redirectTo: "gongguwish-preview://auth/callback",
  });
  assert.deepEqual(resolveKakaoTarget(PRODUCTION), {
    appVariant: "production",
    callbackUrl: "https://iosdoheblabfimkjnvfj.supabase.co/auth/v1/callback",
    projectRef: "iosdoheblabfimkjnvfj",
    redirectTo: "gongguwish://auth/callback",
  });

  assert.throws(
    () =>
      resolveKakaoTarget({
        appVariant: "production",
        projectRef: PREVIEW.projectRef,
      }),
    /production must use its exact Supabase project ref/,
  );
  assert.throws(
    () => resolveKakaoTarget({ appVariant: "staging", projectRef: "anything" }),
    /APP_VARIANT must be preview or production/,
  );
});

test("authorize URL requests Kakao with only the app deep-link redirect", () => {
  const target = resolveKakaoTarget(PRODUCTION);
  const authorizeUrl = buildKakaoAuthorizeUrl(target);

  assert.equal(authorizeUrl.origin, "https://iosdoheblabfimkjnvfj.supabase.co");
  assert.equal(authorizeUrl.pathname, "/auth/v1/authorize");
  assert.equal(authorizeUrl.searchParams.get("provider"), "kakao");
  assert.equal(
    authorizeUrl.searchParams.get("redirect_to"),
    "gongguwish://auth/callback",
  );
});

test("readiness succeeds only for Kakao and the exact Supabase callback", async () => {
  const requests = [];
  const result = await checkKakaoProvider({
    ...PREVIEW,
    fetchImpl: async (url, options) => {
      requests.push({ options, url: String(url) });
      return kakaoResponse();
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.redirect, "manual");
  assert.match(requests[0].url, /provider=kakao/);
  assert.deepEqual(result, {
    appVariant: "preview",
    callbackUrl: "https://xwblovggtvbpiusjfokq.supabase.co/auth/v1/callback",
    projectRef: "xwblovggtvbpiusjfokq",
    providerHost: "kauth.kakao.com",
    status: 302,
  });
});

test("readiness rejects a non-Kakao redirect or a cross-environment callback", async () => {
  await assert.rejects(
    checkKakaoProvider({
      ...PREVIEW,
      fetchImpl: async () => kakaoResponse({ host: "login.example.com" }),
    }),
    /did not redirect to Kakao/,
  );

  await assert.rejects(
    checkKakaoProvider({
      ...PREVIEW,
      fetchImpl: async () =>
        kakaoResponse({
          callback: "https://iosdoheblabfimkjnvfj.supabase.co/auth/v1/callback",
        }),
    }),
    /callback does not match preview/,
  );
});

test("provider-disabled failures are deterministic and redact response data", async () => {
  let calls = 0;
  const privateValue = "client_id=do-not-log&state=do-not-log";

  await assert.rejects(
    checkKakaoProvider({
      ...PRODUCTION,
      fetchImpl: async () => {
        calls += 1;
        return new Response(privateValue, { status: 400 });
      },
      retryDelayMs: 0,
      wait: async () => {},
    }),
    (error) => {
      assert.match(error.message, /production Kakao provider is not ready/);
      assert.match(error.message, /HTTP 400/);
      assert.doesNotMatch(error.message, /client_id|state|do-not-log/);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test("transient network and 5xx failures retry, then return a sanitized result", async () => {
  const responses = [
    new TypeError("temporary network failure"),
    new Response(null, { status: 503 }),
    kakaoResponse(),
  ];
  const delays = [];

  const result = await checkKakaoProvider({
    ...PREVIEW,
    fetchImpl: async () => {
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return next;
    },
    retryDelayMs: 5,
    wait: async (delay) => delays.push(delay),
  });

  assert.equal(result.status, 302);
  assert.deepEqual(delays, [5, 10]);
});

test("Production Auth fallback rejects localhost Site URLs", async () => {
  await assert.rejects(
    checkProductionAuthFallback({
      ...PRODUCTION,
      fetchImpl: async () =>
        authFallbackResponse({
          location: "http://localhost:3000/?error=access_denied",
        }),
    }),
    /Production Supabase Auth Site URL must not use localhost/,
  );
});

test("Production Auth fallback accepts the public Site URL", async () => {
  const requests = [];
  const result = await checkProductionAuthFallback({
    ...PRODUCTION,
    fetchImpl: async (url, options) => {
      requests.push({ options, url: String(url) });
      return authFallbackResponse();
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.redirect, "manual");
  assert.match(requests[0].url, /auth\/v1\/callback/);
  assert.deepEqual(result, {
    appVariant: "production",
    fallbackOrigin: "https://gongguwish.com",
    projectRef: "iosdoheblabfimkjnvfj",
    status: 303,
  });
});

test("Preview skips the Production-only Auth fallback check", async () => {
  let calls = 0;
  const result = await checkProductionAuthFallback({
    ...PREVIEW,
    fetchImpl: async () => {
      calls += 1;
      return authFallbackResponse();
    },
  });

  assert.deepEqual(result, {
    appVariant: "preview",
    projectRef: "xwblovggtvbpiusjfokq",
    skipped: true,
  });
  assert.equal(calls, 0);
});

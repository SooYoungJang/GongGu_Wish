import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const TARGETS = Object.freeze({
  preview: Object.freeze({
    appVariant: "preview",
    projectRef: "xwblovggtvbpiusjfokq",
    redirectTo: "gongguwish-preview://auth/callback",
  }),
  production: Object.freeze({
    appVariant: "production",
    projectRef: "iosdoheblabfimkjnvfj",
    redirectTo: "gongguwish://auth/callback",
  }),
});

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 750;
const DEFAULT_TIMEOUT_MS = 10_000;
const PRODUCTION_AUTH_SITE_ORIGIN = "https://gongguwish.com";
const LOCAL_AUTH_FALLBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export function resolveKakaoTarget({ appVariant, projectRef }) {
  const target = TARGETS[appVariant];
  if (!target) {
    throw new Error("APP_VARIANT must be preview or production");
  }
  if (projectRef !== target.projectRef) {
    throw new Error(`${appVariant} must use its exact Supabase project ref`);
  }

  return {
    ...target,
    callbackUrl: `https://${target.projectRef}.supabase.co/auth/v1/callback`,
  };
}

export function buildKakaoAuthorizeUrl(target) {
  const authorizeUrl = new URL(
    "/auth/v1/authorize",
    `https://${target.projectRef}.supabase.co`,
  );
  authorizeUrl.searchParams.set("provider", "kakao");
  authorizeUrl.searchParams.set("redirect_to", target.redirectTo);
  return authorizeUrl;
}

function validatePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function validateNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

function inspectKakaoResponse(response, target) {
  if (response.status !== 302) {
    throw new Error(
      `${target.appVariant} Kakao provider is not ready (HTTP ${response.status})`,
    );
  }

  const location = response.headers.get("location");
  let kakaoUrl;
  try {
    kakaoUrl = new URL(location ?? "");
  } catch {
    throw new Error(
      `${target.appVariant} Kakao provider returned an invalid redirect`,
    );
  }

  if (
    kakaoUrl.protocol !== "https:" ||
    kakaoUrl.hostname !== "kauth.kakao.com"
  ) {
    throw new Error(
      `${target.appVariant} Kakao provider did not redirect to Kakao`,
    );
  }
  if (!kakaoUrl.searchParams.get("client_id")) {
    throw new Error(
      `${target.appVariant} Kakao provider redirect has no client id`,
    );
  }
  if (kakaoUrl.searchParams.get("redirect_uri") !== target.callbackUrl) {
    throw new Error(
      `Kakao callback does not match ${target.appVariant} Supabase`,
    );
  }

  return {
    appVariant: target.appVariant,
    callbackUrl: target.callbackUrl,
    projectRef: target.projectRef,
    providerHost: kakaoUrl.hostname,
    status: response.status,
  };
}

export async function checkKakaoProvider({
  appVariant,
  fetchImpl = globalThis.fetch,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  projectRef,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  wait = (delay) =>
    new Promise((resolveWait) => setTimeout(resolveWait, delay)),
}) {
  validatePositiveInteger(maxAttempts, "maxAttempts");
  validatePositiveInteger(timeoutMs, "timeoutMs");
  validateNonNegativeInteger(retryDelayMs, "retryDelayMs");
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch implementation is required");
  }

  const target = resolveKakaoTarget({ appVariant, projectRef });
  const authorizeUrl = buildKakaoAuthorizeUrl(target);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(authorizeUrl, {
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      if (attempt === maxAttempts) {
        throw new Error(
          `${target.appVariant} Kakao readiness request failed after ${maxAttempts} attempts`,
        );
      }
      await wait(retryDelayMs * attempt);
      continue;
    }

    if (response.status >= 500 && response.status <= 599) {
      if (attempt < maxAttempts) {
        await wait(retryDelayMs * attempt);
        continue;
      }
    }

    return inspectKakaoResponse(response, target);
  }

  throw new Error(`${target.appVariant} Kakao readiness check did not finish`);
}

export async function checkProductionAuthFallback({
  appVariant,
  fetchImpl = globalThis.fetch,
  projectRef,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  validatePositiveInteger(timeoutMs, "timeoutMs");
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch implementation is required");
  }

  const target = resolveKakaoTarget({ appVariant, projectRef });
  if (target.appVariant !== "production") {
    return {
      appVariant: target.appVariant,
      projectRef: target.projectRef,
      skipped: true,
    };
  }

  const probeUrl = new URL(target.callbackUrl);
  probeUrl.searchParams.set("error", "access_denied");
  probeUrl.searchParams.set("error_description", "callback_probe");
  probeUrl.searchParams.set("state", "invalid-callback-probe");

  let response;
  try {
    response = await fetchImpl(probeUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new Error("Production Supabase Auth fallback probe failed");
  }

  if (response.status < 300 || response.status > 399) {
    throw new Error(
      `Production Supabase Auth fallback returned HTTP ${response.status}`,
    );
  }

  let fallbackUrl;
  try {
    fallbackUrl = new URL(response.headers.get("location") ?? "");
  } catch {
    throw new Error(
      "Production Supabase Auth fallback returned an invalid redirect",
    );
  }

  if (LOCAL_AUTH_FALLBACK_HOSTS.has(fallbackUrl.hostname)) {
    throw new Error(
      "Production Supabase Auth Site URL must not use localhost; set it to https://gongguwish.com",
    );
  }

  if (fallbackUrl.origin !== PRODUCTION_AUTH_SITE_ORIGIN) {
    throw new Error(
      "Production Supabase Auth Site URL must be https://gongguwish.com",
    );
  }

  return {
    appVariant: target.appVariant,
    fallbackOrigin: fallbackUrl.origin,
    projectRef: target.projectRef,
    status: response.status,
  };
}

function isDirectRun() {
  if (!process.argv[1]) return false;
  return pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
}

if (isDirectRun()) {
  checkKakaoProvider({
    appVariant: process.env.APP_VARIANT,
    projectRef: process.env.SUPABASE_PROJECT_REF,
  })
    .then(async (result) => {
      const authFallback = await checkProductionAuthFallback({
        appVariant: process.env.APP_VARIANT,
        projectRef: process.env.SUPABASE_PROJECT_REF,
      });
      console.log(
        JSON.stringify({
          appVariant: result.appVariant,
          projectRef: result.projectRef,
          providerHost: result.providerHost,
          ...(authFallback.skipped
            ? { authFallback: "skipped" }
            : { authFallback: authFallback.fallbackOrigin }),
          status: "ready",
        }),
      );
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`[Kakao Auth] ${message}`);
      process.exitCode = 1;
    });
}

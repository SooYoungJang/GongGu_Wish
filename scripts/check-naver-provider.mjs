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
const NAVER_AUTH_HOST = "nid.naver.com";
const NAVER_AUTH_PATH = "/oauth2.0/authorize";
const PKCE_PROBE_CHALLENGE = "A".repeat(43);

export function resolveNaverTarget({ appVariant, projectRef }) {
  const target = TARGETS[appVariant];
  if (!target) throw new Error("APP_VARIANT must be preview or production");
  if (projectRef !== target.projectRef) {
    throw new Error(`${appVariant} must use its exact Supabase project ref`);
  }

  return {
    ...target,
    callbackUrl: `https://${target.projectRef}.supabase.co/auth/v1/callback`,
  };
}

export function buildNaverAuthorizeUrl(target) {
  const authorizeUrl = new URL(
    "/auth/v1/authorize",
    `https://${target.projectRef}.supabase.co`,
  );
  authorizeUrl.searchParams.set("provider", "custom:naver");
  authorizeUrl.searchParams.set("redirect_to", target.redirectTo);
  authorizeUrl.searchParams.set("code_challenge", PKCE_PROBE_CHALLENGE);
  authorizeUrl.searchParams.set("code_challenge_method", "s256");
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

function inspectNaverResponse(response, target) {
  if (response.status !== 302) {
    throw new Error(
      `${target.appVariant} Naver provider is not ready (HTTP ${response.status})`,
    );
  }

  const location = response.headers.get("location");
  let naverUrl;
  try {
    naverUrl = new URL(location ?? "");
  } catch {
    throw new Error(
      `${target.appVariant} Naver provider returned an invalid redirect`,
    );
  }

  if (
    naverUrl.protocol !== "https:" ||
    naverUrl.hostname !== NAVER_AUTH_HOST ||
    naverUrl.pathname !== NAVER_AUTH_PATH
  ) {
    throw new Error(
      `${target.appVariant} Naver provider did not redirect to Naver`,
    );
  }
  if (!naverUrl.searchParams.get("client_id")) {
    throw new Error(
      `${target.appVariant} Naver provider redirect has no client id`,
    );
  }
  if (naverUrl.searchParams.get("redirect_uri") !== target.callbackUrl) {
    throw new Error(
      `Naver callback does not match ${target.appVariant} Supabase`,
    );
  }
  if (naverUrl.searchParams.get("redirect_to") !== target.redirectTo) {
    throw new Error(
      `Naver app redirect does not match ${target.appVariant} mobile scheme`,
    );
  }
  const providerCodeChallenge = naverUrl.searchParams.get("code_challenge");
  if (
    !providerCodeChallenge ||
    providerCodeChallenge.length < 43 ||
    providerCodeChallenge.length > 128 ||
    naverUrl.searchParams.get("code_challenge_method")?.toUpperCase() !== "S256"
  ) {
    throw new Error(`${target.appVariant} Naver provider dropped PKCE`);
  }
  if (!naverUrl.searchParams.get("state")) {
    throw new Error(`${target.appVariant} Naver provider redirect has no state`);
  }

  return {
    appVariant: target.appVariant,
    callbackUrl: target.callbackUrl,
    projectRef: target.projectRef,
    providerHost: naverUrl.hostname,
    status: response.status,
  };
}

const wait = (durationMs) =>
  durationMs > 0
    ? new Promise((resolve) => setTimeout(resolve, durationMs))
    : Promise.resolve();

export async function checkNaverProvider({
  appVariant,
  fetchImpl = globalThis.fetch,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  projectRef,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  validatePositiveInteger(maxAttempts, "maxAttempts");
  validateNonNegativeInteger(retryDelayMs, "retryDelayMs");
  validatePositiveInteger(timeoutMs, "timeoutMs");
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch implementation is required");
  }

  const target = resolveNaverTarget({ appVariant, projectRef });
  const authorizeUrl = buildNaverAuthorizeUrl(target);

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
          `${target.appVariant} Naver readiness request failed after ${maxAttempts} attempts`,
        );
      }
      await wait(retryDelayMs * attempt);
      continue;
    }

    if (response.status >= 500 && response.status <= 599 && attempt < maxAttempts) {
      await wait(retryDelayMs * attempt);
      continue;
    }

    return inspectNaverResponse(response, target);
  }

  throw new Error(`${target.appVariant} Naver readiness check did not finish`);
}

function isDirectRun() {
  if (!process.argv[1]) return false;
  return pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
}

if (isDirectRun()) {
  checkNaverProvider({
    appVariant: process.env.APP_VARIANT,
    projectRef: process.env.SUPABASE_PROJECT_REF,
  })
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Naver Auth] ${message}`);
      process.exitCode = 1;
    });
}

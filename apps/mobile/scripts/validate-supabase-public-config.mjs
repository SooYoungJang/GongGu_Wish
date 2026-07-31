import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SETTINGS_PATH = "auth/v1/settings";
const SUPABASE_URL_PATTERN = /https:\/\/[a-z0-9-]+\.supabase\.co/g;
const PUBLISHABLE_KEY_PATTERN = /sb_publishable_[A-Za-z0-9._-]+/g;
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

export async function readStreamToBuffer(stream) {
  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function readLegacyAnonClaims(publicKey) {
  const segments = publicKey.split(".");
  if (segments.length !== 3 || !segments[0].startsWith("eyJ")) return null;

  try {
    return JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("The configured Supabase legacy anon key is malformed.");
  }
}

export async function validateSupabasePublicConfig({
  supabaseUrl,
  publicKey,
  fetchImpl = fetch,
  timeoutMs = 15_000,
}) {
  if (!supabaseUrl || !publicKey) {
    throw new Error("Supabase URL and public key are required.");
  }

  let baseUrl;
  try {
    baseUrl = new URL(supabaseUrl);
  } catch {
    throw new Error("The configured Supabase URL is invalid.");
  }

  if (
    baseUrl.protocol !== "https:" ||
    !baseUrl.hostname.endsWith(".supabase.co")
  ) {
    throw new Error(
      "The configured Supabase URL must use a project supabase.co HTTPS host.",
    );
  }

  const projectRef = baseUrl.hostname.slice(0, -".supabase.co".length);
  const claims = readLegacyAnonClaims(publicKey);
  if (!claims && !publicKey.startsWith("sb_publishable_")) {
    throw new Error(
      "The configured Supabase client key must be a legacy anon key or a publishable key.",
    );
  }

  if (claims) {
    if (claims.role !== "anon") {
      throw new Error(
        "The configured Supabase legacy key must use the anon role.",
      );
    }
    if (claims.ref !== projectRef) {
      throw new Error(
        "The configured Supabase legacy anon key does not match the configured Supabase project.",
      );
    }
  }

  const endpoint = new URL(
    SETTINGS_PATH,
    `${baseUrl.href.replace(/\/+$/, "")}/`,
  );
  let response;
  try {
    response = await fetchImpl(endpoint.href, {
      headers: { apikey: publicKey },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new Error(
      `Could not verify Supabase public configuration for ${baseUrl.hostname}.`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Supabase public configuration was rejected by ${baseUrl.hostname} (HTTP ${response.status}).`,
    );
  }
}

export async function validateBundledSupabasePublicConfig({
  bundle,
  expectedPublicKey,
  expectedSupabaseUrl,
  fetchImpl = fetch,
  timeoutMs = 15_000,
}) {
  const bundleText = Buffer.isBuffer(bundle)
    ? bundle.toString("latin1")
    : String(bundle ?? "");
  const urls = [...new Set(bundleText.match(SUPABASE_URL_PATTERN) ?? [])];
  const bundledUrl = urls.length === 1 ? urls[0] : null;
  const projectRef = bundledUrl
    ? new URL(bundledUrl).hostname.slice(0, -".supabase.co".length)
    : null;
  const candidates = [
    ...new Set([
      ...(bundleText.match(PUBLISHABLE_KEY_PATTERN) ?? []),
      ...(bundleText.match(JWT_PATTERN) ?? []),
    ]),
  ];
  const publicKeys = candidates.filter((candidate) => {
    if (candidate.startsWith("sb_publishable_")) return true;

    try {
      const claims = readLegacyAnonClaims(candidate);
      return claims?.role === "anon" && claims.ref === projectRef;
    } catch {
      return false;
    }
  });

  if (!bundledUrl || publicKeys.length !== 1) {
    throw new Error(
      "The Android bundle must contain exactly one Supabase public configuration.",
    );
  }

  let expectedOrigin;
  try {
    expectedOrigin = new URL(expectedSupabaseUrl).origin;
  } catch {
    throw new Error("The validated Supabase environment URL is invalid.");
  }

  if (
    bundledUrl !== expectedOrigin ||
    publicKeys[0] !== expectedPublicKey?.trim()
  ) {
    throw new Error(
      "The Android bundle Supabase configuration does not match the validated environment.",
    );
  }

  await validateSupabasePublicConfig({
    supabaseUrl: bundledUrl,
    publicKey: publicKeys[0],
    fetchImpl,
    timeoutMs,
  });
}

async function main() {
  if (process.argv.includes("--bundle-stdin")) {
    const bundle = await readStreamToBuffer(process.stdin);
    await validateBundledSupabasePublicConfig({
      bundle,
      expectedPublicKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      expectedSupabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    });
    console.log("Android bundle Supabase public configuration verified.");
    return;
  }

  await validateSupabasePublicConfig({
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publicKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });
  const hostname = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL).hostname;
  console.log(`Supabase public configuration verified for ${hostname}.`);
}

const isDirectExecution =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  main().catch((error) => {
    const message =
      error instanceof Error ? error.message : "Supabase validation failed.";
    console.error(`::error::${message}`);
    process.exitCode = 1;
  });
}

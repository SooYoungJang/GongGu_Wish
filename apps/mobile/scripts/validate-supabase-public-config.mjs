import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SETTINGS_PATH = "auth/v1/settings";

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

async function main() {
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

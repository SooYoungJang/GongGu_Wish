export const DEFAULT_SUPABASE_URL = "https://iosdoheblabfimkjnvfj.supabase.co";

const LOCAL_SUPABASE_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "10.0.2.2",
  "::1",
]);

type ResolveSupabaseUrlOptions = {
  requireLocal?: boolean;
};

/**
 * Resolve a Supabase origin once at app startup.
 * A trailing slash is removed so REST, Auth, and Edge paths share one format.
 */
export function resolveSupabaseUrl(
  supabaseUrl?: string,
  { requireLocal = false }: ResolveSupabaseUrlOptions = {},
): string {
  const configuredUrl = supabaseUrl?.trim();
  if (requireLocal && !configuredUrl) {
    throw new Error("[E2E] A local Supabase origin must be configured");
  }

  const resolved = (configuredUrl || DEFAULT_SUPABASE_URL).replace(/\/+$/, "");
  if (requireLocal) {
    let parsed: URL;
    try {
      parsed = new URL(resolved);
    } catch {
      throw new Error("[E2E] A valid local Supabase origin is required");
    }
    if (!LOCAL_SUPABASE_HOSTS.has(parsed.hostname)) {
      throw new Error(
        `[E2E] Refusing non-local Supabase origin: ${parsed.hostname}`,
      );
    }
  }

  return resolved;
}

/**
 * Resolve the origin used by PostgREST and Edge Function requests.
 * Automated E2E runs always stay on their required local Supabase instance.
 */
export function resolveDataApiUrl(
  supabaseUrl: string,
  apiProxyUrl?: string,
  { requireLocal = false }: ResolveSupabaseUrlOptions = {},
): string {
  const resolvedSupabaseUrl = resolveSupabaseUrl(supabaseUrl, { requireLocal });
  if (requireLocal) return resolvedSupabaseUrl;

  const configuredProxyUrl = apiProxyUrl?.trim();
  if (!configuredProxyUrl) return resolvedSupabaseUrl;

  let parsed: URL;
  try {
    parsed = new URL(configuredProxyUrl);
  } catch {
    throw new Error("A valid HTTPS API proxy origin is required");
  }

  const isLocalHttp =
    parsed.protocol === "http:" && LOCAL_SUPABASE_HOSTS.has(parsed.hostname);
  const isOriginOnly =
    !parsed.username &&
    !parsed.password &&
    parsed.pathname === "/" &&
    !parsed.search &&
    !parsed.hash;

  if ((parsed.protocol !== "https:" && !isLocalHttp) || !isOriginOnly) {
    throw new Error("A valid HTTPS API proxy origin is required");
  }

  return parsed.origin;
}

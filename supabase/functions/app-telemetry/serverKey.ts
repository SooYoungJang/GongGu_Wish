// Hosted functions provide a named secret-key dictionary. Local CLI versions
// can still provide only the legacy service-role JWT. Never fall back after an
// explicitly configured dictionary is malformed or missing its default key.
export function resolveServerKey(read: (name: string) => string | undefined): string {
  const dictionary = read("SUPABASE_SECRET_KEYS");
  if (dictionary) {
    let keys: unknown;
    try { keys = JSON.parse(dictionary); }
    catch { throw new Error("Invalid server key configuration"); }
    const key = keys && typeof keys === "object" && !Array.isArray(keys)
      ? (keys as Record<string, unknown>).default : undefined;
    if (typeof key !== "string" || !key.startsWith("sb_secret_") || key.trim() !== key) {
      throw new Error("Invalid server key configuration");
    }
    return key;
  }
  const key = read("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("Missing server key configuration");
  return key;
}

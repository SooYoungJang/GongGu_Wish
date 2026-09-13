import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import { parseTelemetryBatch } from "./contract.ts";
import { safeStorageFailure, safeJwtFailureReason } from "./storageFailure.ts";
import { resolveServerKey } from "./serverKey.ts";

const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store" };
async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Empty body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 32768) { await reader.cancel(); throw new Error("Body too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function handler(request: Request) {
  if (request.method === "OPTIONS") return new Response(null, { headers, status: 204 });
  const requestId = crypto.randomUUID(), started = performance.now();
  let status = 400, count = 0;
  let failureStage = "validation", storageCode: string | null = null;
  let storageStatus: number | null = null;
  let serverKeyKind: "secret" | "legacy" | null = null, jwtFailureReason: string | null = null;
  const respond = (body: unknown) => new Response(JSON.stringify({ ...body as Record<string, unknown>, requestId }), { status, headers: { ...headers, "X-Request-Id": requestId } });
  try {
    if (request.method !== "POST") { status = 405; return respond({ error: "Method not allowed" }); }
    let batch: ReturnType<typeof parseTelemetryBatch>;
    try { batch = parseTelemetryBatch(await readBody(request)); }
    catch { return respond({ error: "Invalid telemetry batch" }); }
    failureStage = "configuration";
    const key = resolveServerKey(name => Deno.env.get(name)), url = Deno.env.get("SUPABASE_URL");
    if (!key || !url) throw new Error("Configuration missing");
    serverKeyKind = key.startsWith("sb_secret_") ? "secret" : "legacy";
    failureStage = "source_hash";
    // Domain-separated HMAC: retain neither the address nor a reversible identifier.
    const address = (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown").slice(0, 128);
    const secret = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const digest = await crypto.subtle.sign("HMAC", secret, new TextEncoder().encode(`app-telemetry:${address}`));
    const sourceHash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
    failureStage = "storage";
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error, status: rpcStatus } = await client.rpc("ingest_app_telemetry", { p_source_hash: sourceHash, p_session_id: batch.sessionId, p_events: batch.events });
    if (error?.code === "PT429") { status = 429; return respond({ error: "Rate limited" }); }
    if (error) {
      // Only protocol identifiers, never SQL details, payloads or credentials.
      ({ storageCode, storageStatus } = safeStorageFailure(error, rpcStatus));
      if (storageCode === "PGRST303") jwtFailureReason = safeJwtFailureReason(error.message);
      throw new Error("Storage failed");
    }
    status = 200; count = typeof data === "number" ? data : 0;
    return respond({ accepted: count });
  } catch {
    status = 503; return respond({ error: "Telemetry unavailable", failureStage, storageCode, storageStatus, serverKeyKind, jwtFailureReason });
  } finally {
    console.log(JSON.stringify({ event: "app_telemetry_ingest", entryPoint: "app_telemetry_http", requestId, status, count, ...(status === 503 ? { failureStage, storageCode, storageStatus, serverKeyKind, jwtFailureReason } : {}), durationMs: Math.round(performance.now() - started) }));
  }
}
if (import.meta.main) serve(handler);

// ============================================================================
// Edge Function: group-buy-request
// Purpose: Abuse-resistant guest/authenticated group-buy request intake.
// ============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const MAX_BODY_BYTES = 4096;
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,200}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, apikey, x-client-info",
};

type UserResult = {
  data: { user: { id?: unknown } | null };
  error: unknown;
};

type RpcResult = {
  data: unknown;
  error: { message?: string } | null;
};

type AdminClient = {
  auth: { getUser(token: string): Promise<UserResult> };
  rpc(name: string, args: Record<string, unknown>): Promise<RpcResult>;
};

type HandlerDependencies = {
  adminClient: AdminClient;
  anonKey: string;
  serviceRoleKey: string;
  supabaseUrl: string;
};

function json(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function isLocalSupabaseUrl(rawUrl: string) {
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    return (
      hostname === "127.0.0.1" ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "kong" ||
      hostname === "host.docker.internal"
    );
  } catch {
    return false;
  }
}

function normalizeIp(rawValue: string | null, allowForwardedList: boolean) {
  if (!rawValue) return null;
  const candidate = allowForwardedList
    ? rawValue.split(",", 1)[0].trim()
    : rawValue.trim();
  if (!candidate || candidate.length > 64) return null;
  if (!allowForwardedList && candidate.includes(",")) return null;

  if (candidate.includes(":")) {
    if (!/^[0-9a-f:.]+$/i.test(candidate)) return null;
    try {
      new URL(`http://[${candidate}]/`);
      return candidate.toLowerCase();
    } catch {
      return null;
    }
  }

  const octets = candidate.split(".");
  if (octets.length !== 4) return null;
  if (
    octets.some(
      (octet) =>
        !/^\d{1,3}$/.test(octet) || Number(octet) < 0 || Number(octet) > 255,
    )
  )
    return null;
  return octets.map((octet) => String(Number(octet))).join(".");
}

export function resolveTrustedClientIp(headers: Headers, supabaseUrl: string) {
  const cloudflareIp = normalizeIp(headers.get("cf-connecting-ip"), false);
  if (cloudflareIp) return cloudflareIp;

  if (!isLocalSupabaseUrl(supabaseUrl)) return null;
  return (
    normalizeIp(headers.get("x-real-ip"), false) ??
    normalizeIp(headers.get("x-forwarded-for"), true)
  );
}

export async function hmacSha256Hex(
  secret: string,
  domain: "session" | "ip" | "user",
  value: string,
) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`group-buy-request:${domain}:v1\0${value}`),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function createDefaultDependencies(): HandlerDependencies {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY must be set",
    );
  }
  return {
    adminClient: createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }) as unknown as AdminClient,
    anonKey,
    serviceRoleKey,
    supabaseUrl,
  };
}

async function resolveOptionalUserId(
  authorization: string | null,
  apikey: string | null,
  deps: HandlerDependencies,
) {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw new Error("invalid_authentication");
  const token = match[1];

  // supabase.functions.invoke can send the project's public key as Bearer when
  // no user session exists. It represents a guest, not an invalid user JWT.
  if (
    token === deps.anonKey ||
    (token === apikey && /^sb_(?:publishable|anon)_/i.test(token))
  )
    return null;

  const { data, error } = await deps.adminClient.auth.getUser(token);
  const userId = data.user?.id;
  if (error || typeof userId !== "string" || !userId.trim()) {
    throw new Error("invalid_authentication");
  }
  return userId.trim();
}

async function readRequestBody(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new Error("invalid_group_buy_request");
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  try {
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("payload_too_large");
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;

      const retainedBytes = Math.min(
        value.byteLength,
        MAX_BODY_BYTES + 1 - totalBytes,
      );
      if (retainedBytes > 0) {
        chunks.push(value.slice(0, retainedBytes));
        totalBytes += retainedBytes;
      }
      if (totalBytes > MAX_BODY_BYTES || retainedBytes < value.byteLength) {
        await reader.cancel();
        throw new Error("payload_too_large");
      }
    }

    const bodyBytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bodyBytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let rawBody: string;
    try {
      rawBody = new TextDecoder("utf-8", { fatal: true }).decode(bodyBytes);
    } catch {
      throw new Error("invalid_group_buy_request");
    }
    try {
      return JSON.parse(rawBody) as unknown;
    } catch {
      throw new Error("invalid_group_buy_request");
    }
  } finally {
    reader.releaseLock();
  }
}

function isRequestBody(
  value: unknown,
): value is { product_name: string; session_id: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.product_name === "string" &&
    typeof body.session_id === "string" &&
    SESSION_ID_PATTERN.test(body.session_id)
  );
}

function isResultRow(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.request_id === "string" &&
    typeof row.product_name === "string" &&
    typeof row.request_count === "number" &&
    typeof row.already_requested === "boolean" &&
    typeof row.ranking_eligible === "boolean"
  );
}

function isAttemptLimitRow(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.allowed === "boolean" &&
    typeof row.attempt_count === "number" &&
    Number.isInteger(row.attempt_count) &&
    typeof row.retry_after_seconds === "number" &&
    Number.isInteger(row.retry_after_seconds)
  );
}

async function enforceAttemptLimit(
  deps: HandlerDependencies,
  actorHash: string,
): Promise<Response | null> {
  const { data, error } = await deps.adminClient.rpc(
    "consume_group_buy_request_attempt",
    { p_actor_hash: actorHash },
  );
  if (error) {
    console.error(
      JSON.stringify({
        event: "group_buy_request_attempt_limiter_failed",
        message: (error.message ?? "").slice(0, 200),
      }),
    );
    return json(
      { error: "group_buy_request_attempt_limiter_unavailable" },
      503,
    );
  }
  if (
    !Array.isArray(data) ||
    data.length !== 1 ||
    !isAttemptLimitRow(data[0])
  ) {
    return json(
      { error: "group_buy_request_attempt_limiter_unavailable" },
      503,
    );
  }
  if (!data[0].allowed) {
    return json({ error: "group_buy_request_attempt_rate_limited" }, 429, {
      "Retry-After": "600",
    });
  }
  return null;
}

export function createHandler(dependencies?: HandlerDependencies) {
  const deps = dependencies ?? createDefaultDependencies();

  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (req.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405, { Allow: "POST" });
    }

    const clientIp = resolveTrustedClientIp(req.headers, deps.supabaseUrl);
    if (!clientIp) {
      return json({ error: "client_ip_unavailable" }, 503);
    }

    const ipHash = await hmacSha256Hex(deps.serviceRoleKey, "ip", clientIp);
    if (!HASH_PATTERN.test(ipHash)) {
      return json({ error: "group_buy_request_failed" }, 500);
    }

    const ipLimitResponse = await enforceAttemptLimit(deps, ipHash);
    if (ipLimitResponse) return ipLimitResponse;

    let userId: string | null;
    try {
      userId = await resolveOptionalUserId(
        req.headers.get("authorization"),
        req.headers.get("apikey"),
        deps,
      );
    } catch {
      return json({ error: "invalid_authentication" }, 401);
    }

    if (userId) {
      const userActorHash = await hmacSha256Hex(
        deps.serviceRoleKey,
        "user",
        userId,
      );
      const userLimitResponse = await enforceAttemptLimit(deps, userActorHash);
      if (userLimitResponse) return userLimitResponse;
    }

    let body: unknown;
    try {
      body = await readRequestBody(req);
    } catch (error) {
      const code =
        error instanceof Error && error.message === "payload_too_large"
          ? "payload_too_large"
          : "invalid_group_buy_request";
      return json({ error: code }, code === "payload_too_large" ? 413 : 400);
    }
    if (!isRequestBody(body)) {
      return json({ error: "invalid_group_buy_request" }, 400);
    }

    const sessionHash = await hmacSha256Hex(
      deps.serviceRoleKey,
      "session",
      body.session_id,
    );
    if (!HASH_PATTERN.test(sessionHash) || !HASH_PATTERN.test(ipHash)) {
      return json({ error: "group_buy_request_failed" }, 500);
    }

    const { data, error } = await deps.adminClient.rpc(
      "request_group_buy_internal",
      {
        p_product_name: body.product_name,
        p_session_hash: sessionHash,
        p_ip_hash: ipHash,
        p_user_id: userId,
      },
    );

    if (error) {
      const message = error.message ?? "";
      if (message.includes("group_buy_request_rate_limited")) {
        return json({ error: "group_buy_request_rate_limited" }, 429, {
          "Retry-After": "86400",
        });
      }
      if (message.includes("invalid_group_buy_")) {
        return json({ error: "invalid_group_buy_request" }, 400);
      }
      console.error(
        JSON.stringify({
          event: "group_buy_request_failed",
          message: message.slice(0, 200),
        }),
      );
      return json({ error: "group_buy_request_failed" }, 500);
    }

    if (!Array.isArray(data) || data.length !== 1 || !isResultRow(data[0])) {
      return json({ error: "group_buy_request_failed" }, 500);
    }
    return json(data[0]);
  };
}

if (import.meta.main) {
  serve(createHandler());
}

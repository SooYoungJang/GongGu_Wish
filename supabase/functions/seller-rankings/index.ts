// GON-258: canonical group-buy ranking endpoint.
// POST /functions/v1/seller-rankings
// { category, period, sort, limit?, cursor? }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

import {
  buildRankingResponse,
  decodeRankingCursor,
  normalizeRankingRequest,
  type RankingRequest,
  type RankingRpcRow,
} from "./rankingContract.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function parseRequestCursor(request: RankingRequest) {
  if (!request.cursor) return undefined;
  const cursor = decodeRankingCursor(request.cursor);
  if (cursor.sort !== request.sort) {
    throw new Error("cursor sort does not match the requested ranking sort");
  }
  return cursor;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  let request: RankingRequest;
  let cursor;
  try {
    request = normalizeRankingRequest(body);
    cursor = parseRequestCursor(request);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Invalid ranking request" },
      400,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[seller-rankings] Supabase server configuration is missing");
    return jsonResponse({ error: "Ranking service is not configured" }, 503);
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase.rpc("get_group_buy_rankings", {
      category_filter: request.category,
      period_filter: request.period,
      sort_filter: request.sort,
      limit_count: request.limit + 1,
      cursor_numeric: cursor?.numericValue ?? null,
      cursor_timestamp: cursor?.timestampValue ?? null,
      cursor_group_buy_id: cursor?.groupBuyId ?? null,
    });

    if (error) throw new Error(error.message);
    if (!Array.isArray(data)) throw new Error("Ranking RPC returned a non-array response");

    return jsonResponse(
      buildRankingResponse(data as RankingRpcRow[], request),
    );
  } catch (error) {
    console.error(
      "[seller-rankings] ranking query failed:",
      error instanceof Error ? error.message : String(error),
    );
    return jsonResponse({ error: "랭킹 데이터를 불러오지 못했습니다." }, 500);
  }
});

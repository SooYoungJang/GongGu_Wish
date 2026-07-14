import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function getSupabaseEnv() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return { supabaseUrl, serviceRoleKey };
}

function createServiceClient() {
  const { supabaseUrl, serviceRoleKey } = getSupabaseEnv();
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isExpoPushToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(value)
  );
}

async function registerToken(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) return json({ error: "로그인이 필요합니다." }, 401);

  const supabase = createServiceClient();
  const { data: authData, error: authError } =
    await supabase.auth.getUser(accessToken);
  if (authError || !authData.user)
    return json({ error: "세션이 만료되었습니다." }, 401);

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ error: "요청 본문이 올바르지 않습니다." }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!isExpoPushToken(body.token)) {
    return json({ error: "유효한 Expo Push Token이 필요합니다." }, 400);
  }
  if (body.provider !== undefined && body.provider !== "expo") {
    return json({ error: "지원하지 않는 푸시 제공자입니다." }, 400);
  }

  const now = new Date().toISOString();
  const { data: existing, error: lookupError } = await supabase
    .from("users")
    .select("id")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  if (existing) {
    const { error } = await supabase
      .from("users")
      .update({
        push_token: body.token,
        push_provider: "expo",
        updated_at: now,
      })
      .eq("id", authData.user.id);
    if (error) throw new Error(error.message);
  } else {
    if (!authData.user.email)
      return json({ error: "사용자 이메일을 확인할 수 없습니다." }, 400);
    const { error } = await supabase.from("users").insert({
      id: authData.user.id,
      email: authData.user.email,
      push_token: body.token,
      push_provider: "expo",
      status: "ACTIVE",
      created_at: now,
      updated_at: now,
    });
    if (error) throw new Error(error.message);
  }

  return json({ data: { registered: true, provider: "expo" } });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    return await registerToken(req);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return json({ error: message }, 500);
  }
});

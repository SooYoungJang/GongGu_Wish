import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  fromNotificationPreferenceColumns,
  toNotificationPreferenceColumns,
  validatePushRegistrationInput,
} from "./contract.ts";

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

async function registerToken(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) return json({ error: "로그인이 필요합니다." }, 401);

  const supabase = createServiceClient();
  const { data: authData, error: authError } = await supabase.auth.getUser(
    accessToken,
  );
  if (authError || !authData.user) {
    return json({ error: "세션이 만료되었습니다." }, 401);
  }

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

  let input: ReturnType<typeof validatePushRegistrationInput>;
  try {
    input = validatePushRegistrationInput(body);
  } catch (error) {
    return json(
      {
        error: error instanceof Error
          ? error.message
          : "요청이 올바르지 않습니다.",
      },
      400,
    );
  }

  const now = new Date().toISOString();
  const { data: existing, error: lookupError } = await supabase
    .from("users")
    .select(
      "id, push_token, push_enabled, deadline_reminders_enabled, new_submissions_enabled, notification_reminder_days, followed_influencers, followed_brands",
    )
    .eq("id", authData.user.id)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  if (input.readOnly) {
    const preferences = existing
      ? fromNotificationPreferenceColumns(existing)
      : DEFAULT_NOTIFICATION_PREFERENCES;
    console.info(
      JSON.stringify({
        event: "notification_preferences_read",
        userRowExists: Boolean(existing),
      }),
    );
    return json({
      data: {
        preferences,
        registered: Boolean(existing?.push_token),
      },
    });
  }

  const preferenceColumns = input.preferences
    ? toNotificationPreferenceColumns(input.preferences)
    : {};
  const tokenColumns = input.tokenAction === "set"
    ? {}
    : input.tokenAction === "clear"
    ? { push_token: null, push_provider: null }
    : {};

  if (existing) {
    const { error } = await supabase
      .from("users")
      .update({
        ...preferenceColumns,
        ...tokenColumns,
        updated_at: now,
      })
      .eq("id", authData.user.id);
    if (error) throw new Error(error.message);
  } else {
    if (!authData.user.email) {
      return json({ error: "사용자 이메일을 확인할 수 없습니다." }, 400);
    }
    const { error } = await supabase.from("users").insert({
      id: authData.user.id,
      email: authData.user.email,
      ...toNotificationPreferenceColumns(
        input.preferences ?? DEFAULT_NOTIFICATION_PREFERENCES,
      ),
      ...tokenColumns,
      status: "ACTIVE",
      created_at: now,
      updated_at: now,
    });
    if (error) throw new Error(error.message);
  }

  let tokenClaimed = false;
  if (input.tokenAction === "set" && input.token) {
    const { data: claimed, error: claimError } = await supabase.rpc(
      "claim_expo_push_token",
      {
        p_user_id: authData.user.id,
        p_push_token: input.token,
      },
    );
    if (claimError) throw new Error(claimError.message);
    if (claimed !== true) {
      throw new Error("Push token owner row does not exist.");
    }
    tokenClaimed = true;
  }

  console.info(JSON.stringify({
    event: "push_registration_updated",
    preferencesSynced: Boolean(input.preferences),
    tokenAction: input.tokenAction,
  }));
  return json({
    data: {
      preferencesSynced: Boolean(input.preferences),
      provider: "expo",
      registered: tokenClaimed ||
        (input.tokenAction === "preserve" && Boolean(existing?.push_token)),
    },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    return await registerToken(req);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "push_registration_failed",
        errorName: error instanceof Error ? error.name : typeof error,
      }),
    );
    return json({ error: "푸시 알림 설정을 저장하지 못했습니다." }, 500);
  }
});

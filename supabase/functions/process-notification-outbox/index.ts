import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import { deliverPendingSubmissionApprovalPushes } from "../admin-api/submissionApprovalPush.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key)
    throw new Error("Supabase service configuration is missing");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function handler(request: Request) {
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  try {
    const body = (await request.json().catch(() => ({}))) as {
      limit?: unknown;
    };
    const requestedLimit = typeof body.limit === "number" ? body.limit : 50;
    const result = await deliverPendingSubmissionApprovalPushes(
      createAdminClient(),
      { limit: Math.min(Math.max(Math.trunc(requestedLimit), 1), 100) },
    );
    return json(result);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "notification_outbox_processing_failed",
        error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "unknown error",
      }),
    );
    return json({ error: "알림 발송 작업을 처리하지 못했습니다." }, 500);
  }
}

if (import.meta.main) serve(handler);

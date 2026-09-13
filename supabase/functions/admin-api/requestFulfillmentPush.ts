import { sendPushNotification } from "./pushNotifications.ts";
import { classifySubmissionApprovalDelivery, getSubmissionApprovalRetryDelayMinutes } from "./submissionApprovalPush.ts";

type PushClient = Parameters<typeof sendPushNotification>[0];
export type RequestFulfillmentEvent = {
  event_id: number;
  request_id: string;
  user_id: string;
  group_buy_id: string;
  product_name: string;
  attempt_count: number;
};
export function buildRequestFulfilledPush(event: RequestFulfillmentEvent) {
  return {
    title: "요청한 공구가 등록됐어요",
    body: `${event.product_name} 공구를 확인해 보세요.`,
    userIds: [event.user_id],
    data: {
      notificationType: "general",
      notificationEventId: `request-fulfilled:${event.event_id}`,
      requestId: event.request_id,
      groupBuyId: event.group_buy_id,
    },
  };
}

export async function deliverPendingRequestFulfillmentPushes(
  supabase: PushClient,
  options: { limit?: number; send?: typeof sendPushNotification } = {},
) {
  const { data, error } = await supabase.rpc("claim_request_fulfillment_push_events", { p_limit: options.limit ?? 50 });
  if (error) throw new Error("Request notification claim failed");
  const summary = { queued: 0, sent: 0, skipped: 0, retrying: 0, failed: 0 };
  const events = (data ?? []) as RequestFulfillmentEvent[];
  summary.queued = events.length;
  for (const event of events) {
    let status: "SENT" | "SKIPPED" | "RETRYING" | "FAILED";
    try {
      // Recheck opt-out and visibility even for a reclaimed processing lease.
      const [preference, product] = await Promise.all([
        supabase.from("group_buy_request_notification_preferences").select("enabled").eq("request_id", event.request_id).eq("user_id", event.user_id).maybeSingle(),
        supabase.from("group_buys").select("status").eq("id", event.group_buy_id).maybeSingle(),
      ]);
      if (preference.error || product.error) throw new Error("Delivery eligibility check failed");
      if (!preference.data?.enabled || product.data?.status !== "APPROVED") status = "SKIPPED";
      else status = classifySubmissionApprovalDelivery(await (options.send ?? sendPushNotification)(supabase, buildRequestFulfilledPush(event)));
    } catch {
      status = "RETRYING";
    }
    if (status === "RETRYING" && event.attempt_count >= 5) status = "FAILED";
    const now = new Date();
    const { error: updateError } = await supabase.from("request_fulfillment_push_outbox").update({
      status,
      updated_at: now.toISOString(),
      sent_at: status === "SENT" ? now.toISOString() : null,
      next_attempt_at: new Date(now.getTime() + (status === "RETRYING" ? getSubmissionApprovalRetryDelayMinutes(event.attempt_count) * 60_000 : 0)).toISOString(),
    }).eq("id", event.event_id).eq("status", "PROCESSING").eq("attempt_count", event.attempt_count);
    if (updateError) throw new Error("Request notification result save failed");
    if (status === "SENT") summary.sent++;
    else if (status === "SKIPPED") summary.skipped++;
    else if (status === "FAILED") summary.failed++;
    else summary.retrying++;
  }
  return summary;
}

export type SubmissionApprovalPushEvent = {
  id?: number;
  submissionId: string;
  groupBuyId: string;
  productName: string | null;
  userId: string;
  attemptCount?: number;
};

type DeliveryResult = {
  targeted: number;
  preferenceFiltered: number;
  sent: number;
  failed: number;
};

type PushClient = Parameters<typeof sendPushNotification>[0];
type PushSender = typeof sendPushNotification;

type ClaimedApprovalEventRow = {
  event_id: number;
  submission_id: string;
  user_id: string;
  group_buy_id: string;
  product_name: string | null;
  attempt_count: number;
};

export type SubmissionApprovalDeliverySummary = {
  status: "sent" | "skipped" | "retrying" | "failed";
  queued: number;
  sent: number;
  skipped: number;
  retrying: number;
  failed: number;
};

export type SubmissionApprovalDeliveryStatus = "SENT" | "SKIPPED" | "RETRYING";

export function buildSubmissionApprovedPush(
  event: SubmissionApprovalPushEvent,
) {
  const productName = event.productName?.trim() || "제보한 공동구매";
  return {
    title: "제보한 공구가 승인됐어요",
    body: `${productName}가 승인되어 등록됐어요. 지금 확인해 보세요.`,
    userIds: [event.userId],
    data: {
      notificationType: "submission_approved",
      submissionId: event.submissionId,
      groupBuyId: event.groupBuyId,
    },
  };
}

export function classifySubmissionApprovalDelivery(
  result: DeliveryResult,
): SubmissionApprovalDeliveryStatus {
  if (result.sent > 0 && result.failed === 0) return "SENT";
  if (result.targeted === 0 && result.failed === 0) return "SKIPPED";
  return "RETRYING";
}

export function getSubmissionApprovalRetryDelayMinutes(attemptCount: number) {
  return Math.min(60, 2 ** Math.max(0, attemptCount - 1));
}

function getFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown error";
  return message.slice(0, 500);
}

async function updateOutboxEvent(
  supabase: PushClient,
  event: ClaimedApprovalEventRow,
  status: "SENT" | "SKIPPED" | "RETRYING" | "FAILED",
  error: unknown = null,
) {
  const now = new Date();
  const nextAttemptAt =
    status === "RETRYING"
      ? new Date(
          now.getTime() +
            getSubmissionApprovalRetryDelayMinutes(event.attempt_count) *
              60_000,
        ).toISOString()
      : now.toISOString();
  const { error: updateError } = await supabase
    .from("submission_approval_push_outbox")
    .update({
      status,
      next_attempt_at: nextAttemptAt,
      last_error: error ? getFailureMessage(error) : null,
      sent_at: status === "SENT" ? now.toISOString() : null,
      updated_at: now.toISOString(),
    })
    .eq("id", event.event_id);
  if (updateError) throw new Error(updateError.message);
}

function emptySummary(): SubmissionApprovalDeliverySummary {
  return {
    status: "skipped",
    queued: 0,
    sent: 0,
    skipped: 0,
    retrying: 0,
    failed: 0,
  };
}

function finalizeSummary(summary: SubmissionApprovalDeliverySummary) {
  summary.status =
    summary.failed > 0
      ? "failed"
      : summary.retrying > 0
        ? "retrying"
        : summary.sent > 0
          ? "sent"
          : "skipped";
  return summary;
}

export async function deliverPendingSubmissionApprovalPushes(
  supabase: PushClient,
  options: {
    submissionId?: string | null;
    limit?: number;
    send?: PushSender;
  } = {},
): Promise<SubmissionApprovalDeliverySummary> {
  const { data, error } = await supabase.rpc(
    "claim_submission_approval_push_events",
    {
      p_limit: Math.min(Math.max(options.limit ?? 50, 1), 100),
      p_submission_id: options.submissionId ?? null,
    },
  );
  if (error) throw new Error(error.message);

  const events = (data ?? []) as ClaimedApprovalEventRow[];
  const summary = emptySummary();
  summary.queued = events.length;
  const send = options.send ?? sendPushNotification;

  for (const event of events) {
    try {
      const result = (await send(
        supabase,
        buildSubmissionApprovedPush({
          id: event.event_id,
          submissionId: event.submission_id,
          groupBuyId: event.group_buy_id,
          productName: event.product_name,
          userId: event.user_id,
          attemptCount: event.attempt_count,
        }),
      )) as PushNotificationResult;
      const classified = classifySubmissionApprovalDelivery(result);
      if (classified === "SENT") {
        await updateOutboxEvent(supabase, event, "SENT");
        summary.sent += 1;
      } else if (classified === "SKIPPED") {
        await updateOutboxEvent(supabase, event, "SKIPPED");
        summary.skipped += 1;
      } else if (event.attempt_count >= 5) {
        await updateOutboxEvent(supabase, event, "FAILED", "provider failure");
        summary.failed += 1;
      } else {
        await updateOutboxEvent(
          supabase,
          event,
          "RETRYING",
          "provider failure",
        );
        summary.retrying += 1;
      }
    } catch (error) {
      if (event.attempt_count >= 5) {
        await updateOutboxEvent(supabase, event, "FAILED", error);
        summary.failed += 1;
      } else {
        await updateOutboxEvent(supabase, event, "RETRYING", error);
        summary.retrying += 1;
      }
      console.error(
        JSON.stringify({
          event: "submission_approval_push_delivery_failed",
          submissionId: event.submission_id,
          groupBuyId: event.group_buy_id,
          attemptCount: event.attempt_count,
          error: getFailureMessage(error),
        }),
      );
    }
  }

  return finalizeSummary(summary);
}
import {
  sendPushNotification,
  type PushNotificationResult,
} from "./pushNotifications.ts";

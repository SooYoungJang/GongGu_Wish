import { sendPushNotification } from "./pushNotifications.ts";

type PushClient = Parameters<typeof sendPushNotification>[0];
type PushSender = typeof sendPushNotification;

type ApprovedGroupBuy = {
  id: string;
  productName?: string | null;
  product_name?: string | null;
};

type QueueNewSubmissionPushOptions = {
  send?: PushSender;
  waitUntil?: (task: Promise<unknown>) => void;
};

type EdgeRuntimeGlobal = typeof globalThis & {
  EdgeRuntime?: {
    waitUntil(task: Promise<unknown>): void;
  };
};

function getRuntimeWaitUntil() {
  const runtime = (globalThis as EdgeRuntimeGlobal).EdgeRuntime;
  return runtime?.waitUntil.bind(runtime) ?? null;
}

export function buildNewSubmissionPush(groupBuy: ApprovedGroupBuy) {
  const productName =
    groupBuy.productName?.trim() ||
    groupBuy.product_name?.trim() ||
    "새 공동구매";

  return {
    title: "새 공구가 등록됐어요",
    body: `${productName} - 새로 등록된 공구를 확인해 보세요.`,
    data: {
      notificationType: "new_submission",
      groupBuyId: groupBuy.id.trim(),
    },
  };
}

export function queueNewSubmissionPush(
  supabase: PushClient,
  groupBuy: ApprovedGroupBuy,
  options: QueueNewSubmissionPushOptions = {},
) {
  const send = options.send ?? sendPushNotification;
  const delivery = Promise.resolve()
    .then(() => send(supabase, buildNewSubmissionPush(groupBuy)))
    .then(() => undefined)
    .catch((error) => {
      console.error(
        JSON.stringify({
          event: "new_submission_push_failed",
          groupBuyId: groupBuy.id,
          error: error instanceof Error ? error.message : "unknown error",
        }),
      );
    });

  try {
    const waitUntil = options.waitUntil ?? getRuntimeWaitUntil();
    if (waitUntil) {
      waitUntil(delivery);
    } else {
      console.warn(
        JSON.stringify({
          event: "push_background_runtime_unavailable",
          groupBuyId: groupBuy.id,
        }),
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "push_background_registration_failed",
        groupBuyId: groupBuy.id,
        error: error instanceof Error ? error.message : "unknown error",
      }),
    );
  }
  return delivery;
}

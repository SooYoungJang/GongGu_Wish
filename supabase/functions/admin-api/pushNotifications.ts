import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import {
  isExpoPushToken,
  validatePushNotificationInput,
  type ValidatedPushNotificationInput,
} from "./pushNotificationContract.ts";

const EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100;

export type PushNotificationResult = {
  provider: "expo";
  targeted: number;
  sent: number;
  failed: number;
  invalidTokensRemoved: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function isDeviceNotRegisteredTicket(ticket: unknown) {
  if (!isRecord(ticket) || ticket.status !== "error") return false;
  const details = isRecord(ticket.details) ? ticket.details : null;
  return details?.error === "DeviceNotRegistered";
}

async function sendExpoBatch(
  input: ValidatedPushNotificationInput,
  tokens: string[],
) {
  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title: input.title,
    body: input.body,
    ...(input.data ? { data: input.data } : {}),
  }));

  const response = await fetch(EXPO_PUSH_SEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      isRecord(payload) && typeof payload.message === "string"
        ? payload.message
        : `Expo push request failed: ${response.status}`;
    throw new Error(message);
  }

  return isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];
}

export async function sendPushNotification(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
): Promise<PushNotificationResult> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("푸시 발송 요청 본문이 올바르지 않습니다.");
  }
  const input = validatePushNotificationInput(body);

  let query = supabase
    .from("users")
    .select("id, push_token")
    .eq("push_provider", "expo")
    .not("push_token", "is", null);

  if (input.userIds) query = query.in("id", input.userIds);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const tokens = [
    ...new Set(
      (data ?? [])
        .map((row) => (row as Record<string, unknown>).push_token)
        .filter(isExpoPushToken),
    ),
  ];

  if (tokens.length === 0) {
    return {
      provider: "expo",
      targeted: 0,
      sent: 0,
      failed: 0,
      invalidTokensRemoved: 0,
    };
  }

  let sent = 0;
  let failed = 0;
  const invalidTokens = new Set<string>();

  for (const tokenBatch of chunk(tokens, EXPO_BATCH_SIZE)) {
    const tickets = await sendExpoBatch(input, tokenBatch);
    for (let index = 0; index < tokenBatch.length; index += 1) {
      const ticket = tickets[index];
      if (isRecord(ticket) && ticket.status === "ok") {
        sent += 1;
      } else {
        failed += 1;
        if (isDeviceNotRegisteredTicket(ticket))
          invalidTokens.add(tokenBatch[index]);
      }
    }
  }

  let invalidTokensRemoved = 0;
  if (invalidTokens.size > 0) {
    const { error: cleanupError } = await supabase
      .from("users")
      .update({
        push_token: null,
        push_provider: null,
        updated_at: new Date().toISOString(),
      })
      .in("push_token", [...invalidTokens]);

    if (cleanupError) {
      console.error(
        "[admin-api] failed to clear invalid push tokens:",
        cleanupError.message,
      );
    } else {
      invalidTokensRemoved = invalidTokens.size;
    }
  }

  return {
    provider: "expo",
    targeted: tokens.length,
    sent,
    failed,
    invalidTokensRemoved,
  };
}

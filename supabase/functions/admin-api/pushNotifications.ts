import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import {
  isExpoPushToken,
  matchesPushPreferences,
  type ValidatedPushNotificationInput,
  validatePushNotificationInput,
} from "./pushNotificationContract.ts";

const EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100;
const PUSH_CANDIDATE_PAGE_SIZE = 500;
const PUSH_CANDIDATE_COLUMNS =
  "id, push_token, push_enabled, deadline_reminders_enabled, new_submissions_enabled, followed_influencers, followed_brands";

export type PushNotificationResult = {
  provider: "expo";
  audienceType: ValidatedPushNotificationInput["audience"]["type"];
  targeted: number;
  preferenceFiltered: number;
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
    const message = isRecord(payload) && typeof payload.message === "string"
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

  const rows = await collectPushCandidateRows(supabase, input.userIds);
  const { candidateTokens, tokens, duplicateTokens } =
    selectPushRecipientTokens(rows, input.audience);
  const preferenceFiltered = candidateTokens.length - tokens.length;

  if (tokens.length === 0) {
    const result: PushNotificationResult = {
      provider: "expo",
      audienceType: input.audience.type,
      targeted: 0,
      preferenceFiltered,
      sent: 0,
      failed: 0,
      invalidTokensRemoved: 0,
    };
    console.info(
      JSON.stringify({
        event: "push_delivery_completed",
        ...result,
        duplicateTokens,
      }),
    );
    return result;
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
        if (isDeviceNotRegisteredTicket(ticket)) {
          invalidTokens.add(tokenBatch[index]);
        }
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

  const result: PushNotificationResult = {
    provider: "expo",
    audienceType: input.audience.type,
    targeted: tokens.length,
    preferenceFiltered,
    sent,
    failed,
    invalidTokensRemoved,
  };
  console.info(
    JSON.stringify({
      event: "push_delivery_completed",
      ...result,
      duplicateTokens,
    }),
  );
  return result;
}

export async function collectPushCandidateRows(
  supabase: SupabaseClient,
  userIds: string[] | null,
) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0;; from += PUSH_CANDIDATE_PAGE_SIZE) {
    let query = supabase
      .from("users")
      .select(PUSH_CANDIDATE_COLUMNS)
      .eq("push_provider", "expo")
      .not("push_token", "is", null);
    if (userIds) query = query.in("id", userIds);
    const { data, error } = await query
      .order("id", { ascending: true })
      .range(from, from + PUSH_CANDIDATE_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PUSH_CANDIDATE_PAGE_SIZE) break;
  }
  return rows;
}

export function selectPushRecipientTokens(
  rows: Record<string, unknown>[],
  audience: ValidatedPushNotificationInput["audience"],
) {
  const rowsByToken = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const token = row.push_token;
    if (!isExpoPushToken(token)) continue;
    const owners = rowsByToken.get(token) ?? [];
    owners.push(row);
    rowsByToken.set(token, owners);
  }

  const candidateTokens = [...rowsByToken.keys()];
  const tokens: string[] = [];
  let duplicateTokens = 0;
  for (const [token, owners] of rowsByToken) {
    if (owners.length !== 1) {
      duplicateTokens += 1;
      continue;
    }
    if (matchesPushPreferences(owners[0], audience)) tokens.push(token);
  }
  return { candidateTokens, tokens, duplicateTokens };
}

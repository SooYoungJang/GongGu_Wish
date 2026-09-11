import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildRequestFulfilledPush, deliverPendingRequestFulfillmentPushes, type RequestFulfillmentEvent } from "./requestFulfillmentPush.ts";

const event: RequestFulfillmentEvent = { event_id: 7, request_id: "request", user_id: "owner", group_buy_id: "deal", product_name: "요청 상품", attempt_count: 1 };
Deno.test("request fulfillment targets one opted-in owner with a stable detail event", () => {
  const payload = buildRequestFulfilledPush(event);
  assertEquals(payload.userIds, ["owner"]);
  assertEquals(payload.data, { notificationType: "general", notificationEventId: "request-fulfilled:7", requestId: "request", groupBuyId: "deal" });
});

Deno.test("delivery rechecks opt-out and retries provider failures with bounded attempts", async () => {
  for (const scenario of [
    { enabled: false, attempt: 1, providerFails: false, expected: "SKIPPED" },
    { enabled: true, attempt: 1, providerFails: true, expected: "RETRYING" },
    { enabled: true, attempt: 5, providerFails: true, expected: "FAILED" },
    { enabled: true, attempt: 1, providerFails: false, expected: "SENT" },
  ]) {
    let sent = 0;
    let saved: Record<string, unknown> = {};
    const client = {
      rpc: () => Promise.resolve({ data: [{ ...event, attempt_count: scenario.attempt }], error: null }),
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: () => Promise.resolve({ data: table === "group_buys" ? { status: "APPROVED" } : { enabled: scenario.enabled }, error: null }),
          update: (value: Record<string, unknown>) => { saved = value; return query; },
          then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ error: null })),
        };
        return query;
      },
    };
    await deliverPendingRequestFulfillmentPushes(client as unknown as Parameters<typeof deliverPendingRequestFulfillmentPushes>[0], {
      send: async () => {
        sent++;
        if (scenario.providerFails) throw new Error("provider unavailable");
        return { provider: "expo", audienceType: "general", targeted: 1, preferenceFiltered: 0, sent: 1, failed: 0, invalidTokensRemoved: 0 };
      },
    });
    assertEquals(saved.status, scenario.expected);
    assertEquals(sent, scenario.enabled ? 1 : 0);
  }
});

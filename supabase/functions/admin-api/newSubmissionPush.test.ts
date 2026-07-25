import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildNewSubmissionPush,
  queueNewSubmissionPush,
} from "./newSubmissionPush.ts";

Deno.test(
  "builds a preference-aware deep-link payload for an approved submission",
  () => {
    assertEquals(
      buildNewSubmissionPush({
        id: "group-buy-1",
        product_name: "테스트 공구",
      }),
      {
        title: "새 공구가 등록됐어요",
        body: "테스트 공구 - 새로 등록된 공구를 확인해 보세요.",
        data: {
          notificationType: "new_submission",
          groupBuyId: "group-buy-1",
        },
      },
    );
  },
);

Deno.test(
  "queues new-submission delivery without blocking approval",
  async () => {
    let backgroundTask: Promise<unknown> | null = null;
    const sentBodies: Record<string, unknown>[] = [];

    const delivery = queueNewSubmissionPush(
      {} as never,
      { id: "group-buy-1", productName: "테스트 공구" },
      {
        send: async (_supabase, body) => {
          sentBodies.push(body);
          return {
            provider: "expo",
            audienceType: "new_submission",
            targeted: 1,
            preferenceFiltered: 0,
            sent: 1,
            failed: 0,
            invalidTokensRemoved: 0,
          };
        },
        waitUntil: (task) => {
          backgroundTask = task;
        },
      },
    );

    assert(backgroundTask === delivery);
    await delivery;
    assertEquals(sentBodies, [
      {
        title: "새 공구가 등록됐어요",
        body: "테스트 공구 - 새로 등록된 공구를 확인해 보세요.",
        data: {
          notificationType: "new_submission",
          groupBuyId: "group-buy-1",
        },
      },
    ]);
  },
);

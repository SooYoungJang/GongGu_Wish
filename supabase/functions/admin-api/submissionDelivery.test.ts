import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  getSubmissionNotificationDeliveryStatus,
  mapSubmissionDelivery,
  type SubmissionNotificationDelivery,
} from "./submissionDelivery.ts";

function delivery(
  patch: Partial<Omit<SubmissionNotificationDelivery, "status">> = {},
) {
  return {
    linkedSubmitterCount: 1,
    pendingCount: 0,
    processingCount: 0,
    sentCount: 0,
    skippedCount: 0,
    retryingCount: 0,
    failedCount: 0,
    ...patch,
  };
}

Deno.test("summarizes submission approval delivery states", () => {
  assertEquals(
    getSubmissionNotificationDeliveryStatus(
      delivery({ linkedSubmitterCount: 0 }),
    ),
    "NO_RECIPIENTS",
  );
  assertEquals(
    getSubmissionNotificationDeliveryStatus(delivery()),
    "NOT_STARTED",
  );
  assertEquals(
    getSubmissionNotificationDeliveryStatus(delivery({ retryingCount: 1 })),
    "PENDING",
  );
  assertEquals(
    getSubmissionNotificationDeliveryStatus(delivery({ sentCount: 1 })),
    "SENT",
  );
  assertEquals(
    getSubmissionNotificationDeliveryStatus(
      delivery({ sentCount: 1, failedCount: 1 }),
    ),
    "PARTIAL",
  );
  assertEquals(
    getSubmissionNotificationDeliveryStatus(delivery({ failedCount: 1 })),
    "FAILED",
  );
});

Deno.test("maps numeric database delivery counters", () => {
  assertEquals(
    mapSubmissionDelivery({
      linked_submitter_count: "2",
      pending_count: 0,
      processing_count: 0,
      sent_count: 2,
      skipped_count: 0,
      retrying_count: 0,
      failed_count: 0,
    }),
    {
      linkedSubmitterCount: 2,
      pendingCount: 0,
      processingCount: 0,
      sentCount: 2,
      skippedCount: 0,
      retryingCount: 0,
      failedCount: 0,
      status: "SENT",
    },
  );
});

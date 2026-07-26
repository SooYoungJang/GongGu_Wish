import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildSubmissionApprovedPush,
  classifySubmissionApprovalDelivery,
  getSubmissionApprovalRetryDelayMinutes,
} from "./submissionApprovalPush.ts";

Deno.test(
  "builds a targeted approval payload that opens product detail",
  () => {
    assertEquals(
      buildSubmissionApprovedPush({
        submissionId: "submission-1",
        groupBuyId: "group-buy-1",
        productName: "테스트 공구",
        userId: "user-1",
      }),
      {
        title: "제보한 공구가 승인됐어요",
        body: "테스트 공구가 승인되어 등록됐어요. 지금 확인해 보세요.",
        userIds: ["user-1"],
        data: {
          notificationType: "submission_approved",
          submissionId: "submission-1",
          groupBuyId: "group-buy-1",
        },
      },
    );
  },
);

Deno.test("classifies provider outcomes without rolling approval back", () => {
  assertEquals(
    classifySubmissionApprovalDelivery({
      targeted: 1,
      preferenceFiltered: 0,
      sent: 1,
      failed: 0,
    }),
    "SENT",
  );
  assertEquals(
    classifySubmissionApprovalDelivery({
      targeted: 0,
      preferenceFiltered: 1,
      sent: 0,
      failed: 0,
    }),
    "SKIPPED",
  );
  assertEquals(
    classifySubmissionApprovalDelivery({
      targeted: 1,
      preferenceFiltered: 0,
      sent: 0,
      failed: 1,
    }),
    "RETRYING",
  );
});

Deno.test("caps approval push retry backoff at one hour", () => {
  assertEquals(getSubmissionApprovalRetryDelayMinutes(1), 1);
  assertEquals(getSubmissionApprovalRetryDelayMinutes(3), 4);
  assertEquals(getSubmissionApprovalRetryDelayMinutes(10), 60);
});

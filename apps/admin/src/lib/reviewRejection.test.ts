import { describe, expect, it } from "vitest";
import {
  isReviewRejectDisabled,
  reviewRejectionReason,
} from "./reviewRejection";

describe("review rejection behavior", () => {
  it("keeps rejection actionable when an optional reason is blank", () => {
    expect(reviewRejectionReason("")).toBe("관리자 반려");
    expect(reviewRejectionReason("  판매 종료  ")).toBe("판매 종료");
  });

  it("enables rejection for a pending review until an action starts", () => {
    expect(isReviewRejectDisabled(false, true)).toBe(false);
    expect(isReviewRejectDisabled(true, true)).toBe(true);
    expect(isReviewRejectDisabled(false, false)).toBe(true);
  });
});

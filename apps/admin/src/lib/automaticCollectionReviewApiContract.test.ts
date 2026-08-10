import { describe, expect, it } from "vitest";

import {
  automaticInstagramPostUrl,
  collectionReviewFilter,
  normalizeRejectionReason,
  protectPendingAutomaticCatalogPatch,
  reviewedData,
  validateApprovalData,
} from "../../../../supabase/functions/admin-api/automaticCollectionReviewContract";

describe("automatic collection admin API contract", () => {
  it("allows only canonical Instagram post URLs for server-side Hiker lookup", () => {
    expect(
      automaticInstagramPostUrl("https://www.instagram.com/p/post-1/"),
    ).toBe("https://www.instagram.com/p/post-1/");
    expect(
      automaticInstagramPostUrl("https://instagram.com/reel/post-1/"),
    ).toBe("https://instagram.com/reel/post-1/");
    expect(
      automaticInstagramPostUrl("https://www.instagram.com/p/post-1/?next=/"),
    ).toBeNull();
    expect(
      automaticInstagramPostUrl("https://www.instagram.com/p/%2Fadmin/"),
    ).toBeNull();
    expect(automaticInstagramPostUrl("http://127.0.0.1/post-1")).toBeNull();
  });

  it("normalizes the review filter and rejects unsupported values", () => {
    expect(collectionReviewFilter("PENDING")).toBe("PENDING");
    expect(collectionReviewFilter("ALL")).toBeNull();
    expect(() => collectionReviewFilter("EXPIRED")).toThrow(
      "자동수집 검수 상태",
    );
  });

  it("validates approval fields without trusting a client-provided status", () => {
    const data = reviewedData({
      reviewedData: {
        productName: "제주 감귤",
        category: "food",
        purchaseUrl: "https://example.com/buy",
        endDate: "2026-08-15",
        status: "APPROVED",
        collectionReviewStatus: "APPROVED",
        reviewedBy: "forged-admin",
        sourceType: "SUBMISSION",
      },
    });

    expect(data.status).toBeUndefined();
    expect(data.collectionReviewStatus).toBeUndefined();
    expect(data.reviewedBy).toBeUndefined();
    expect(data.sourceType).toBeUndefined();
    expect(() => validateApprovalData(data)).not.toThrow();
    expect(() =>
      validateApprovalData({ ...data, purchaseUrl: "" }),
    ).toThrow("구매 URL");
    expect(() =>
      validateApprovalData({ ...data, endDate: "2026-99-99" }),
    ).toThrow("종료일");
    expect(() =>
      validateApprovalData({
        ...data,
        startDate: "2026-08-20",
        endDate: "2026-08-15",
      }),
    ).toThrow("종료일");
  });

  it("requires a useful rejection reason and caps it at 500 characters", () => {
    expect(normalizeRejectionReason({ reason: "  상품이 공구가 아님  " })).toBe(
      "상품이 공구가 아님",
    );
    expect(() => normalizeRejectionReason({ reason: " " })).toThrow(
      "반려 사유",
    );
    expect(
      normalizeRejectionReason({ reason: "가".repeat(700) }).length,
    ).toBe(500);
  });

  it("prevents a generic save from bypassing the pending review decision", () => {
    const pendingPatch = protectPendingAutomaticCatalogPatch(
      "PLAYWRIGHT_PUBLIC",
      "PENDING",
      { product_name: "수정", status: "APPROVED" },
    );
    const processedPatch = protectPendingAutomaticCatalogPatch(
      "PLAYWRIGHT_PUBLIC",
      "APPROVED",
      { status: "EXPIRED" },
    );

    expect(pendingPatch).toEqual({ product_name: "수정" });
    expect(processedPatch).toEqual({ status: "EXPIRED" });
  });
});

import { describe, expect, it } from "vitest";

import {
  AUTOMATIC_COLLECTION_RULESET_VERSION,
  buildCollectionReviewSnapshot,
  legacyCollectionReviewStatus,
  reviewTransition,
} from "../../../../supabase/functions/_shared/automaticCollectionReview";

describe("automatic collection review contract", () => {
  it("keeps only normalized learning fields in the review snapshot", () => {
    expect(
      buildCollectionReviewSnapshot({
        rawPostId: "raw-1",
        instagramPostId: "post-1",
        originalPostUrl: "https://www.instagram.com/p/post-1/",
        takenAt: "2026-08-09T01:00:00.000Z",
        productName: "  제주 감귤 3kg  ",
        brandName: "귤밭상회",
        instagramUsername: "@gyulbbad",
        profileImageUrl: "https://example.com/profile.jpg",
        category: "food",
        startDate: "2026-08-09",
        endDate: "2026-08-15",
        purchaseUrl: "https://example.com/buy",
        discountInfo: "19,900원",
        priceKrw: "19900",
        summary: "국내 배송 공구",
        thumbnailUrl: "https://example.com/thumb.jpg",
        mediaUrls: ["https://example.com/1.jpg"],
        mediaItems: [
          {
            url: "https://example.com/1.jpg",
            mediaType: "IMAGE",
            thumbnailUrl: null,
          },
        ],
        mediaType: "IMAGE",
        confidence: 0.5,
        postAudioUrl: null,
        postAudioStartTimeMs: null,
        postAudioDurationMs: null,
        isHomeBanner: false,
        homeBannerStartDate: null,
        homeBannerEndDate: null,
        ignored: "must not be persisted",
      }),
    ).toEqual({
      schemaVersion: 1,
      rawPostId: "raw-1",
      instagramPostId: "post-1",
      originalPostUrl: "https://www.instagram.com/p/post-1/",
      takenAt: "2026-08-09T01:00:00.000Z",
      productName: "제주 감귤 3kg",
      brandName: "귤밭상회",
      instagramUsername: "gyulbbad",
      profileImageUrl: "https://example.com/profile.jpg",
      category: "food",
      startDate: "2026-08-09",
      endDate: "2026-08-15",
      purchaseUrl: "https://example.com/buy",
      discountInfo: "19,900원",
      priceKrw: 19900,
      summary: "국내 배송 공구",
      thumbnailUrl: "https://example.com/thumb.jpg",
      mediaUrls: ["https://example.com/1.jpg"],
      mediaItems: [
        {
          url: "https://example.com/1.jpg",
          mediaType: "IMAGE",
          thumbnailUrl: null,
        },
      ],
      mediaType: "IMAGE",
      confidence: 0.5,
      postAudioUrl: null,
      postAudioStartTimeMs: null,
      postAudioDurationMs: null,
      isHomeBanner: false,
      homeBannerStartDate: null,
      homeBannerEndDate: null,
    });
    expect(AUTOMATIC_COLLECTION_RULESET_VERSION).toMatch(/^playwright-public-/);
  });

  it("separates legacy review decisions from the current catalog status", () => {
    expect(legacyCollectionReviewStatus("REVIEW_REQUIRED")).toBe("PENDING");
    expect(legacyCollectionReviewStatus("APPROVED")).toBe("APPROVED");
    expect(legacyCollectionReviewStatus("EXPIRED")).toBe("APPROVED");
    expect(legacyCollectionReviewStatus("REJECTED")).toBe("REJECTED");
  });

  it("allows one decision, treats a retry as idempotent, and blocks reversal", () => {
    expect(reviewTransition("PENDING", "APPROVED")).toBe("APPLY");
    expect(reviewTransition("APPROVED", "APPROVED")).toBe("IDEMPOTENT");
    expect(reviewTransition("APPROVED", "REJECTED")).toBe("CONFLICT");
  });
});

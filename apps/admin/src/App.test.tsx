import { describe, expect, it, vi } from "vitest";

vi.mock("@/supabase/client", () => ({
  adminRuntimeConfig: {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "test-anon-key",
  },
  supabase: {},
}));

import {
  applyHikerResult,
  applyInstagramUsernameChange,
  applyProfileImageUrlChange,
  formToPreviewDeal,
  groupBuyToForm,
  groupBuyPayload,
  tabTitle,
  submissionToForm,
  submissionPayload,
  validOriginalPostUrl,
} from "./App";
import { assertPersistedPriceMatches } from "./lib/priceKrw";

const submissionForm = {
  productName: "제주 감귤 3kg",
  brandName: "귤밭상회",
  instagramUsername: "gyulbbad",
  profileImageUrl: "",
  profileImageUrlTouched: false,
  category: "food",
  startDate: "2026-07-01",
  endDate: "2026-07-31",
  purchaseUrl: "https://example.com/buy",
  discountInfo: "공구가 19,900원",
  priceKrw: "19900",
  instagramUrl: "https://instagram.com/p/example",
  summary: "제철 감귤",
  adminMemo: "",
  thumbnailUrl: "https://example.com/hiker-thumbnail.jpg",
  mediaUrlsText: "https://example.com/carousel-slide.jpg",
  mediaItems: [
    {
      url: "https://example.com/carousel-slide.jpg",
      mediaType: "IMAGE" as const,
      thumbnailUrl: null,
    },
  ],
  mediaType: "IMAGE" as const,
  postAudioUrl: "",
  postAudioStartTimeMs: null,
  postAudioDurationMs: null,
  isHomeBanner: false,
  homeBannerStartDate: "2026-07-01",
  homeBannerEndDate: "2026-07-31",
};

describe("assertPersistedPriceMatches", () => {
  it("accepts the same persisted price", () => {
    expect(() => assertPersistedPriceMatches(200000, 200000)).not.toThrow();
  });

  it("rejects a list refresh that changes the persisted price", () => {
    expect(() => assertPersistedPriceMatches(200000, null)).toThrow(
      "저장된 가격",
    );
  });
});

describe("admin tab labels", () => {
  it("labels the automatic collection review tab separately from user submissions", () => {
    expect(tabTitle("submissions")).toBe("위시 검수");
    expect(tabTitle("autoCollection")).toBe("자동 수집 검수");
    expect(tabTitle("groupBuys")).toBe("공구 관리");
  });
});

describe("automatic collection source links", () => {
  it("allows only canonical Instagram post links", () => {
    expect(validOriginalPostUrl("https://www.instagram.com/p/example/")).toBe(
      "https://www.instagram.com/p/example/",
    );
    expect(validOriginalPostUrl("https://instagram.com/reel/example/")).toBe(
      "https://instagram.com/reel/example/",
    );
    expect(validOriginalPostUrl("javascript:alert(1)")).toBeNull();
    expect(validOriginalPostUrl("https://example.com/p/example/")).toBeNull();
  });
});

describe("formToPreviewDeal", () => {
  it("uses the Hiker representative thumbnail instead of a carousel image", () => {
    const preview = formToPreviewDeal({
      productName: "제주 감귤 3kg",
      brandName: "귤밭상회",
      profileImageUrl: "",
      category: "food",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      purchaseUrl: "https://example.com/buy",
      discountInfo: "공구가 19,900원",
      priceKrw: "19900",
      instagramUrl: "https://instagram.com/p/example",
      summary: "제철 감귤",
      adminMemo: "",
      thumbnailUrl: "https://example.com/hiker-thumbnail.jpg",
      mediaUrlsText: "https://example.com/carousel-slide.jpg",
      mediaItems: [
        {
          url: "https://example.com/carousel-slide.jpg",
          mediaType: "IMAGE",
          thumbnailUrl: null,
        },
      ],
      mediaType: "IMAGE",
      isHomeBanner: false,
      homeBannerStartDate: "2026-07-01",
      homeBannerEndDate: "2026-07-31",
    });

    expect(preview.imageUrl).toBe("https://example.com/hiker-thumbnail.jpg");
    expect(preview.homeBannerStartDate).toBe("");
    expect(preview.homeBannerEndDate).toBe("");
  });
});

describe("Hiker profile image admin flow", () => {
  it("applies the Hiker profile image to the form and live preview", () => {
    const next = applyHikerResult(submissionForm, {
      imageUrl: null,
      thumbnailUrl: null,
      videoUrl: null,
      mediaUrls: [],
      mediaItems: [],
      mediaType: null,
      caption: null,
      likeCount: null,
      username: "gyulbbad",
      profileImageUrl: "https://example.com/gyulbbad-profile.jpg",
      takenAt: null,
    });

    expect(next.profileImageUrl).toBe(
      "https://example.com/gyulbbad-profile.jpg",
    );
    expect(next.profileImageUrlTouched).toBe(true);
    expect(formToPreviewDeal(next).profileImageUrl).toBe(
      "https://example.com/gyulbbad-profile.jpg",
    );
  });

  it("keeps the Hiker Instagram account when LLM brand suggestions are present", () => {
    const next = applyHikerResult(
      { ...submissionForm, instagramUsername: "" },
      {
        imageUrl: null,
        thumbnailUrl: null,
        videoUrl: null,
        mediaUrls: [],
        mediaItems: [],
        mediaType: null,
        caption: "귤밭상회 감귤 공구",
        likeCount: null,
        username: "gyulbbad",
        profileImageUrl: "https://example.com/gyulbbad-profile.jpg",
        takenAt: null,
        suggestions: {
          productName: "제주 감귤 3kg",
          brandName: "귤밭상회",
          category: "food",
          discountInfo: "",
          startDate: "",
          endDate: "",
          priceKrw: "",
        },
      },
    );

    expect(next.brandName).toBe("귤밭상회");
    expect(next.instagramUsername).toBe("gyulbbad");
  });

  it("replaces a stale account and avatar when Hiker resolves a different owner", () => {
    const next = applyHikerResult(
      {
        ...submissionForm,
        instagramUsername: "old_owner",
        profileImageUrl: "https://example.com/old-owner.jpg",
      },
      {
        imageUrl: null,
        thumbnailUrl: null,
        videoUrl: null,
        mediaUrls: [],
        mediaItems: [],
        mediaType: null,
        caption: null,
        likeCount: null,
        username: "new_owner",
        profileImageUrl: "https://example.com/new-owner.jpg",
        takenAt: null,
      },
    );

    expect(next.instagramUsername).toBe("new_owner");
    expect(next.profileImageUrl).toBe("https://example.com/new-owner.jpg");
  });

  it("clears a stale avatar when the resolved owner has no profile image", () => {
    const next = applyHikerResult(
      {
        ...submissionForm,
        instagramUsername: "old_owner",
        profileImageUrl: "https://example.com/old-owner.jpg",
      },
      {
        imageUrl: null,
        thumbnailUrl: null,
        videoUrl: null,
        mediaUrls: [],
        mediaItems: [],
        mediaType: null,
        caption: null,
        likeCount: null,
        username: "new_owner",
        profileImageUrl: null,
        takenAt: null,
      },
    );

    expect(next.instagramUsername).toBe("new_owner");
    expect(next.profileImageUrl).toBe("");
  });

  it("includes profileImageUrl in submission approval and group-buy save payloads", () => {
    const profileImageUrl = "https://example.com/gyulbbad-profile.jpg";
    const submission = submissionPayload({
      ...submissionForm,
      profileImageUrl,
      profileImageUrlTouched: true,
    });
    const groupBuy = groupBuyPayload({
      ...submissionForm,
      profileImageUrl,
      profileImageUrlTouched: true,
      status: "APPROVED",
    });

    expect(submission.profileImageUrl).toBe(profileImageUrl);
    expect(groupBuy.profileImageUrl).toBe(profileImageUrl);
  });

  it("normalizes an empty profile image URL to null before saving", () => {
    expect(
      submissionPayload({
        ...submissionForm,
        profileImageUrlTouched: true,
      }).profileImageUrl,
    ).toBeNull();
  });

  it("omits profileImageUrl from untouched submission and group-buy payloads", () => {
    const untouchedForm = {
      ...submissionForm,
      profileImageUrl: "https://example.com/persisted-profile.jpg",
      profileImageUrlTouched: false,
    };

    expect(submissionPayload(untouchedForm)).not.toHaveProperty(
      "profileImageUrl",
    );
    expect(
      groupBuyPayload({ ...untouchedForm, status: "APPROVED" }),
    ).not.toHaveProperty("profileImageUrl");
  });

  it("restores a persisted group-buy profile image into the edit form", () => {
    const profileImageUrl = "https://example.com/persisted-profile.jpg";
    const form = groupBuyToForm({
      id: "group-buy-1",
      productName: "제주 감귤 3kg",
      brandName: "귤밭상회",
      instagramUsername: "gyulbbad",
      profileImageUrl,
      originalPostUrl: null,
      category: "food",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      purchaseUrl: "https://example.com/buy",
      discountInfo: "공구가 19,900원",
      priceKrw: 19900,
      summary: "제철 감귤",
      thumbnailUrl: "https://example.com/thumbnail.jpg",
      videoUrl: null,
      mediaUrls: [],
      mediaItems: [],
      mediaType: "IMAGE",
      status: "APPROVED",
      sourceType: "SUBMISSION",
      submissionId: null,
      isAllDay: false,
      isMonthlyFeatured: false,
      monthlyFeaturedRank: null,
      isHomeBanner: false,
      homeBannerStartDate: null,
      homeBannerEndDate: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });

    expect(form.profileImageUrl).toBe(profileImageUrl);
    expect(form.profileImageUrlTouched).toBe(false);
  });

  it("marks profile images untouched when submission data is first loaded", () => {
    const form = submissionToForm({
      productName: "제주 감귤 3kg",
      instagramUsername: "gyulbbad",
      profileImageUrl: "https://example.com/persisted-profile.jpg",
      imageUrls: [],
      mediaItems: [],
    } as Parameters<typeof submissionToForm>[0]);

    expect(form.profileImageUrl).toBe(
      "https://example.com/persisted-profile.jpg",
    );
    expect(form.profileImageUrlTouched).toBe(false);
  });

  it("clears and marks a stale avatar dirty when Hiker changes account without an image", () => {
    const next = applyHikerResult(
      {
        ...submissionForm,
        instagramUsername: "old_account",
        profileImageUrl: "https://example.com/old-account.jpg",
        profileImageUrlTouched: false,
      },
      {
        imageUrl: null,
        thumbnailUrl: null,
        videoUrl: null,
        mediaUrls: [],
        mediaItems: [],
        mediaType: null,
        caption: null,
        likeCount: null,
        username: "new_account",
        takenAt: null,
      },
    );

    expect(next.instagramUsername).toBe("new_account");
    expect(next.profileImageUrl).toBe("");
    expect(next.profileImageUrlTouched).toBe(true);
    expect(submissionPayload(next).profileImageUrl).toBeNull();
  });

  it("preserves an untouched avatar when Hiker returns the same normalized account without a valid image", () => {
    const profileImageUrl = "https://example.com/gyulbbad.jpg";
    const next = applyHikerResult(
      {
        ...submissionForm,
        instagramUsername: "@GyulBbad",
        profileImageUrl,
        profileImageUrlTouched: false,
      },
      {
        imageUrl: null,
        thumbnailUrl: null,
        videoUrl: null,
        mediaUrls: [],
        mediaItems: [],
        mediaType: null,
        caption: null,
        likeCount: null,
        username: "gyulbbad",
        profileImageUrl: "not-a-valid-url",
        takenAt: null,
      },
    );

    expect(next.profileImageUrl).toBe(profileImageUrl);
    expect(next.profileImageUrlTouched).toBe(false);
    expect(submissionPayload(next)).not.toHaveProperty("profileImageUrl");
  });

  it("clears an avatar on a manual account change but preserves it for equivalent normalized input", () => {
    const current = {
      ...submissionForm,
      instagramUsername: "gyulbbad",
      profileImageUrl: "https://example.com/gyulbbad.jpg",
      profileImageUrlTouched: true,
    };

    expect(applyInstagramUsernameChange(current, "other_account")).toMatchObject(
      {
        instagramUsername: "other_account",
        profileImageUrl: "",
        profileImageUrlTouched: true,
      },
    );
    expect(
      applyInstagramUsernameChange(current, " @GyulBbad "),
    ).toMatchObject({
      profileImageUrl: "https://example.com/gyulbbad.jpg",
      profileImageUrlTouched: true,
    });
  });

  it("marks manual profile URL input and deletion as touched", () => {
    expect(
      applyProfileImageUrlChange(
        submissionForm,
        "https://example.com/manual.jpg",
      ),
    ).toMatchObject({
      profileImageUrl: "https://example.com/manual.jpg",
      profileImageUrlTouched: true,
    });
    expect(applyProfileImageUrlChange(submissionForm, "")).toMatchObject({
      profileImageUrl: "",
      profileImageUrlTouched: true,
    });
  });
});

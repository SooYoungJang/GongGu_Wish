import { describe, expect, it, vi } from "vitest";

vi.mock("@/supabase/client", () => ({ supabase: {} }));

import { formToPreviewDeal } from "./App";

describe("formToPreviewDeal", () => {
  it("uses the Hiker representative thumbnail instead of a carousel image", () => {
    const preview = formToPreviewDeal({
      productName: "제주 감귤 3kg",
      brandName: "귤밭상회",
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
      videoUrl: "",
      mediaUrlsText: "https://example.com/carousel-slide.jpg",
      mediaItemsText: JSON.stringify([
        { url: "https://example.com/carousel-slide.jpg", mediaType: "IMAGE" },
      ]),
      mediaType: "IMAGE",
      isHomeBanner: false,
      homeBannerStartDate: "",
      homeBannerEndDate: "",
    });

    expect(preview.imageUrl).toBe("https://example.com/hiker-thumbnail.jpg");
  });
});

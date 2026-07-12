import { describe, expect, it } from "vitest";
import { inferHikerSuggestions } from "./hikerSuggestions";

describe("inferHikerSuggestions", () => {
  it("preserves existing non-empty product name and category", () => {
    expect(
      inferHikerSuggestions({
        caption: "제주 감귤 3kg 특가",
        currentProductName: "관리자가 입력한 상품",
        currentCategory: "living",
        mediaUrls: ["https://example.com/photo.jpg"],
      }),
    ).toEqual({
      productName: "관리자가 입력한 상품",
      category: "living",
      mediaType: "IMAGE",
    });
  });

  it("suggests the first meaningful product phrase while skipping promo-only lines", () => {
    expect(
      inferHikerSuggestions({
        caption: [
          "🔥 오늘만 공동구매",
          "2026.07.12 10:00 OPEN",
          "19,900원",
          "국산 저당 복숭아 2kg 산지직송 단단복숭아",
          "#공구 #과일 #food",
        ].join("\n"),
      }),
    ).toEqual({
      productName: "국산 저당 복숭아 2kg 산지직송 단단복숭아",
      category: "food",
      mediaType: null,
    });
  });

  it("limits inferred product names to 80 characters", () => {
    const longProductName = "프리미엄 리넨 수납 바스켓 ".repeat(8).trim();
    const result = inferHikerSuggestions({
      caption: longProductName,
    });

    expect(result.productName).toHaveLength(80);
    expect(result.productName).toBe(longProductName.slice(0, 80));
  });

  it("infers category from caption keywords and hashtags", () => {
    expect(
      inferHikerSuggestions({
        caption: "촉촉한 비건 앰플 세럼 #스킨케어 #beauty",
      }).category,
    ).toBe("beauty");
    expect(
      inferHikerSuggestions({
        caption: "강아지 산책 하네스 리드줄 세트 #반려견",
      }).category,
    ).toBe("pet");
  });

  it("returns a blank category when category signals are unclear", () => {
    expect(
      inferHikerSuggestions({
        caption: "좋은 물건 준비했어요 #공구 #추천",
      }),
    ).toMatchObject({
      productName: "좋은 물건 준비했어요",
      category: "",
    });
  });

  it("infers media type with video taking precedence over image", () => {
    expect(
      inferHikerSuggestions({
        caption: "",
        mediaItems: [
          { mediaType: "image", url: "https://example.com/photo.jpg" },
          { mediaType: "video", url: "https://example.com/clip.mp4" },
        ],
      }).mediaType,
    ).toBe("VIDEO");

    expect(
      inferHikerSuggestions({
        caption: "",
        videoUrl: "https://example.com/reel.mov",
        mediaUrls: ["https://example.com/photo.jpg"],
      }).mediaType,
    ).toBe("VIDEO");

    expect(
      inferHikerSuggestions({
        caption: "",
        mediaItems: [{ thumbnailUrl: "https://example.com/thumb.webp" }],
      }).mediaType,
    ).toBe("IMAGE");
  });
});

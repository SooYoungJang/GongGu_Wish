import { describe, expect, it } from "vitest";

import type { GroupBuy } from "../types";
import { resolveGroupBuyImageUrl } from "./groupBuyMedia";

type GroupBuyMedia = Pick<
  GroupBuy,
  "mediaItems" | "mediaType" | "mediaUrls" | "thumbnailUrl" | "videoUrl"
>;

const media = (overrides: Partial<GroupBuyMedia> = {}): GroupBuyMedia => ({
  mediaItems: [],
  mediaType: null,
  mediaUrls: [],
  thumbnailUrl: null,
  videoUrl: null,
  ...overrides,
});

describe("resolveGroupBuyImageUrl", () => {
  it("prefers the explicit group-buy thumbnail", () => {
    expect(
      resolveGroupBuyImageUrl(
        media({
          thumbnailUrl: " https://example.com/direct.jpg ",
          mediaItems: [
            {
              mediaType: "IMAGE",
              thumbnailUrl: null,
              url: "https://example.com/item.jpg",
            },
          ],
        }),
      ),
    ).toBe("https://example.com/direct.jpg");
  });

  it("preserves media order and uses an IMAGE asset URL without a thumbnail", () => {
    expect(
      resolveGroupBuyImageUrl(
        media({
          mediaItems: [
            {
              mediaType: "IMAGE",
              thumbnailUrl: null,
              url: "https://example.com/first-image.jpg",
            },
            {
              mediaType: "VIDEO",
              thumbnailUrl: "https://example.com/later-video-thumbnail.jpg",
              url: "https://example.com/later-video.mp4",
            },
          ],
        }),
      ),
    ).toBe("https://example.com/first-image.jpg");
  });

  it("uses a VIDEO asset thumbnail but never its raw video URL", () => {
    expect(
      resolveGroupBuyImageUrl(
        media({
          mediaItems: [
            {
              mediaType: "VIDEO",
              thumbnailUrl: "https://example.com/video-thumbnail.webp",
              url: "https://example.com/video.mp4",
            },
          ],
        }),
      ),
    ).toBe("https://example.com/video-thumbnail.webp");

    expect(
      resolveGroupBuyImageUrl(
        media({
          mediaItems: [
            {
              mediaType: "VIDEO",
              thumbnailUrl: null,
              url: "https://example.com/video.mp4",
            },
          ],
          mediaType: "VIDEO",
          mediaUrls: ["https://example.com/video.mp4"],
        }),
      ),
    ).toBeNull();
  });

  it("supports legacy image mediaUrls and ignores blank values", () => {
    expect(
      resolveGroupBuyImageUrl(
        media({
          mediaType: "IMAGE",
          mediaUrls: [" ", "https://example.com/legacy.png?size=large"],
        }),
      ),
    ).toBe("https://example.com/legacy.png?size=large");
  });

  it("uses an extensionless legacy Instagram image when mediaType is missing", () => {
    const imageUrl =
      "https://scontent.cdninstagram.com/v/t51.29350-15/123456789_1?stp=dst-jpg";

    expect(
      resolveGroupBuyImageUrl(
        media({
          mediaType: null,
          mediaUrls: [imageUrl],
        }),
      ),
    ).toBe(imageUrl);
  });

  it("does not mistake a known video URL for an extensionless image", () => {
    const videoUrl = "https://scontent.cdninstagram.com/o1/v/t16/video";
    const imageUrl =
      "https://scontent.cdninstagram.com/v/t51.29350-15/poster?stp=dst-jpg";

    expect(
      resolveGroupBuyImageUrl(
        media({
          mediaType: null,
          mediaUrls: [videoUrl, imageUrl],
          videoUrl,
        }),
      ),
    ).toBe(imageUrl);
  });
});

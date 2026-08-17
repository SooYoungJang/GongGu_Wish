import { describe, expect, it } from "vitest";

import type { GroupBuy } from "../types";
import { resolveGroupBuyImageUrl } from "./groupBuyMedia";

type GroupBuyMedia = Pick<
  GroupBuy,
  "mediaItems" | "mediaType" | "mediaUrls" | "thumbnailUrl"
>;

const media = (overrides: Partial<GroupBuyMedia> = {}): GroupBuyMedia => ({
  mediaItems: [],
  mediaType: null,
  mediaUrls: [],
  thumbnailUrl: null,
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
});

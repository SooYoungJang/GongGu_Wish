import {
  assertEquals,
  assertFalse,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  constantTimeTokenMatches,
  normalizeCollectorAction,
  normalizeCollectedPost,
} from "./index.ts";

Deno.test("accepts only the public collector actions", () => {
  assertEquals(normalizeCollectorAction({ action: "watchlist" }), "watchlist");
  assertEquals(normalizeCollectorAction({ action: "collect" }), "collect");
  assertEquals(normalizeCollectorAction({ action: "status" }), "status");
  assertThrows(() => normalizeCollectorAction({ action: "admin" }));
});

Deno.test("compares collector tokens without accepting empty values", () => {
  assertEquals(
    constantTimeTokenMatches("collector-secret", "collector-secret"),
    true,
  );
  assertFalse(constantTimeTokenMatches("collector-secret", "other-secret"));
  assertFalse(constantTimeTokenMatches("", ""));
});

Deno.test("normalizes a Playwright collected post", () => {
  assertEquals(
    normalizeCollectedPost({
      instagramPostId: "post-1",
      influencerUsername: "@Milkable",
      caption: "국내 배송 공구",
      postUrl: "https://www.instagram.com/p/post-1/",
      imageUrl: "https://scontent.cdninstagram.com/post.jpg",
      takenAt: "2026-08-08T00:00:00.000Z",
      collectedAt: "2026-08-08T00:01:00.000Z",
      collectionSource: "PLAYWRIGHT_PUBLIC",
    }),
    {
      instagramPostId: "post-1",
      influencerUsername: "milkable",
      caption: "국내 배송 공구",
      postUrl: "https://www.instagram.com/p/post-1/",
      imageUrl: "https://scontent.cdninstagram.com/post.jpg",
      takenAt: "2026-08-08T00:00:00.000Z",
      collectedAt: "2026-08-08T00:01:00.000Z",
      collectionSource: "PLAYWRIGHT_PUBLIC",
    },
  );
});

Deno.test("rejects non-Playwright collection sources", () => {
  assertThrows(() =>
    normalizeCollectedPost({
      instagramPostId: "post-1",
      influencerUsername: "milkable",
      caption: "공구",
      postUrl: "https://www.instagram.com/p/post-1/",
      takenAt: "2026-08-08T00:00:00.000Z",
      collectedAt: "2026-08-08T00:01:00.000Z",
      collectionSource: "LEGACY_INSTAGRAPI",
    }),
  );
});

Deno.test("rejects non-canonical or non-Instagram post URLs", () => {
  const post = {
    instagramPostId: "post-1",
    influencerUsername: "milkable",
    caption: "공구",
    takenAt: "2026-08-08T00:00:00.000Z",
    collectedAt: "2026-08-08T00:01:00.000Z",
    collectionSource: "PLAYWRIGHT_PUBLIC",
  };
  assertThrows(() =>
    normalizeCollectedPost({
      ...post,
      postUrl: "https://www.instagram.com/p/post-1/?utm_source=test",
    }),
  );
  assertThrows(() =>
    normalizeCollectedPost({
      ...post,
      postUrl: "https://example.com/p/post-1/",
    }),
  );
});

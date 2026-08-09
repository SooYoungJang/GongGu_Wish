import {
  assertEquals,
  assertFalse,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  applyAutomaticProfilePurchaseFallback,
  buildCampaignDedupeKey,
  buildAutomaticProposalSnapshot,
  constantTimeTokenMatches,
  isAutomaticCampaignCurrentOrUpcoming,
  normalizeCollectorAction,
  normalizeCollectPayload,
  normalizeCollectedPost,
  normalizeAutoParsedCaption,
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
      profileLinkCandidates: [
        {
          url: "https://shop.example/item?utm_source=instagram&color=red",
          label: "오늘 공구 구매",
        },
        {
          url: "https://shop.example/item?color=red",
          label: "중복",
        },
        {
          url: "http://127.0.0.1/admin",
          label: "위험한 링크",
        },
      ],
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
      profileLinkCandidates: [
        {
          url: "https://shop.example/item?color=red",
          label: "오늘 공구 구매",
          source: "PLAYWRIGHT_PROFILE",
        },
      ],
    },
  );
});

Deno.test("normalizes the worker's nested collect payload", () => {
  assertEquals(
    normalizeCollectPayload({
      action: "collect",
      post: {
        instagramPostId: "post-1",
        influencerUsername: "@Milkable",
        caption: "국내 배송 공구",
        postUrl: "https://www.instagram.com/p/post-1/",
        imageUrl: "https://scontent.cdninstagram.com/post.jpg",
        takenAt: "2026-08-08T00:00:00.000Z",
        collectedAt: "2026-08-08T00:01:00.000Z",
        collectionSource: "PLAYWRIGHT_PUBLIC",
      },
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
      profileLinkCandidates: [],
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

Deno.test(
  "replaces CTA-like automatic product names with a meaningful hashtag",
  () => {
    const normalized = normalizeAutoParsedCaption(
      {
        productName: "공구는 자정 낮 1시 입니다",
        brandName: undefined,
        purchaseUrl: "https://shop.example/items/1",
      },
      "국내 배송 공구 19,900원 #로슬러실링팬 #공구",
    );

    assertEquals(normalized.productName, "로슬러실링팬");
  },
);

Deno.test(
  "uses only one profile link as an automatic purchase URL fallback",
  () => {
    const oneCandidate = applyAutomaticProfilePurchaseFallback(
      { productName: "실링팬" },
      [
        {
          url: "https://shop.example/items/1",
          label: "실링팬 구매",
          source: "PLAYWRIGHT_PROFILE",
        },
      ],
    );
    assertEquals(oneCandidate.purchaseUrl, "https://shop.example/items/1");

    const captionLinkWins = applyAutomaticProfilePurchaseFallback(
      { productName: "실링팬", purchaseUrl: "https://caption.example/items/1" },
      [
        {
          url: "https://shop.example/items/1",
          label: null,
          source: "PLAYWRIGHT_PROFILE",
        },
      ],
    );
    assertEquals(
      captionLinkWins.purchaseUrl,
      "https://caption.example/items/1",
    );

    const ambiguous = applyAutomaticProfilePurchaseFallback(
      { productName: "실링팬" },
      [
        {
          url: "https://shop.example/items/1",
          label: "첫 번째",
          source: "PLAYWRIGHT_PROFILE",
        },
        {
          url: "https://shop.example/items/2",
          label: "두 번째",
          source: "PLAYWRIGHT_PROFILE",
        },
      ],
    );
    assertEquals(ambiguous.purchaseUrl, undefined);
  },
);

Deno.test("rejects automatic campaigns that already ended in Korea", () => {
  const referenceTime = "2026-08-09T15:30:00.000Z"; // 2026-08-10 KST

  assertFalse(
    isAutomaticCampaignCurrentOrUpcoming(
      { startDate: "2026-08-01", endDate: "2026-08-09" },
      referenceTime,
    ),
  );
  assertEquals(
    isAutomaticCampaignCurrentOrUpcoming(
      { startDate: "2026-08-01", endDate: "2026-08-10" },
      referenceTime,
    ),
    true,
  );
});

Deno.test("accepts active and upcoming automatic campaigns", () => {
  const referenceTime = "2026-08-10T00:00:00.000Z";

  assertEquals(
    isAutomaticCampaignCurrentOrUpcoming(
      { startDate: "2026-08-01", endDate: "2026-08-15" },
      referenceTime,
    ),
    true,
  );
  assertEquals(
    isAutomaticCampaignCurrentOrUpcoming(
      { endDate: "2026-08-15" },
      referenceTime,
    ),
    true,
  );
  assertEquals(
    isAutomaticCampaignCurrentOrUpcoming(
      { startDate: "2026-08-10" },
      referenceTime,
    ),
    true,
  );
  assertEquals(
    isAutomaticCampaignCurrentOrUpcoming(
      { startDate: "2026-08-11" },
      referenceTime,
    ),
    true,
  );
});

Deno.test(
  "rejects automatic campaigns whose current state cannot be proven",
  () => {
    const referenceTime = "2026-08-10T00:00:00.000Z";

    assertFalse(isAutomaticCampaignCurrentOrUpcoming({}, referenceTime));
    assertFalse(
      isAutomaticCampaignCurrentOrUpcoming(
        { startDate: "2026-08-01" },
        referenceTime,
      ),
    );
    assertFalse(
      isAutomaticCampaignCurrentOrUpcoming(
        { startDate: "invalid", endDate: "not-a-date" },
        referenceTime,
      ),
    );
  },
);

Deno.test("builds the same campaign key despite tracking parameters", () => {
  const first = buildCampaignDedupeKey({
    productName: "로슬러실링팬",
    brandName: "로슬러",
    purchaseUrl: "https://shop.example/items/1?utm_source=instagram",
    startDate: "2026-08-08",
    endDate: "2026-08-15",
  });
  const second = buildCampaignDedupeKey({
    productName: "로슬러 실링팬",
    brandName: "로슬러",
    purchaseUrl: "https://shop.example/items/1?fbclid=tracking",
    startDate: "2026-08-08",
    endDate: "2026-08-15",
  });

  assertEquals(first, second);
});

Deno.test("treats a changed campaign period as a new review candidate", () => {
  const first = buildCampaignDedupeKey({
    productName: "로슬러실링팬",
    brandName: "로슬러",
    purchaseUrl: "https://shop.example/items/1",
    startDate: "2026-08-08",
    endDate: "2026-08-15",
  });
  const second = buildCampaignDedupeKey({
    productName: "로슬러실링팬",
    brandName: "로슬러",
    purchaseUrl: "https://shop.example/items/1",
    startDate: "2026-08-16",
    endDate: "2026-08-22",
  });

  assertFalse(first === second);
});

Deno.test(
  "captures the automatic proposal used for later review learning",
  () => {
    const snapshot = buildAutomaticProposalSnapshot(
      {
        instagramPostId: "post-1",
        influencerUsername: "milkable",
        caption: "국내 배송 실링팬 공구",
        postUrl: "https://www.instagram.com/p/post-1/",
        imageUrl: "https://scontent.cdninstagram.com/post.jpg",
        takenAt: "2026-08-09T00:00:00.000Z",
        collectedAt: "2026-08-09T00:01:00.000Z",
        collectionSource: "PLAYWRIGHT_PUBLIC",
        profileLinkCandidates: [
          {
            url: "https://shop.example/items/1",
            label: "실링팬 구매",
            source: "PLAYWRIGHT_PROFILE",
          },
        ],
      },
      "raw-1",
      {
        productName: "실링팬",
        brandName: "로슬러",
        purchaseUrl: "https://shop.example/items/1",
      },
    );

    assertEquals(snapshot.rawPostId, "raw-1");
    assertEquals(
      snapshot.originalPostUrl,
      "https://www.instagram.com/p/post-1/",
    );
    assertEquals(snapshot.productName, "실링팬");
    assertEquals(snapshot.category, null);
    assertEquals(snapshot.mediaType, "IMAGE");
    assertEquals(snapshot.profileLinkCandidates, [
      {
        url: "https://shop.example/items/1",
        label: "실링팬 구매",
        source: "PLAYWRIGHT_PROFILE",
      },
    ]);
    assertEquals(snapshot.schemaVersion, 1);
  },
);

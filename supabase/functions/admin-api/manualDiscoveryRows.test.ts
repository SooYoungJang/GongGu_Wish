import { normalizeManualDiscoveryInput } from "./manualDiscoveryContract.ts";
import {
  buildManualDiscoveryInfluencerRow,
  buildManualDiscoveryRows,
} from "./manualDiscoveryRows.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`,
    );
  }
}

Deno.test(
  "new manual accounts are inactive with the required timestamp",
  () => {
    assertEquals(
      buildManualDiscoveryInfluencerRow({
        id: "influencer-id",
        instagramUsername: "shop_name",
        updatedAt: "2026-09-20T02:30:00.000Z",
      }),
      {
        id: "influencer-id",
        instagram_username: "shop_name",
        is_active: false,
        playwright_collection_enabled: false,
        updated_at: "2026-09-20T02:30:00.000Z",
      },
    );
  },
);

Deno.test("manual discovery rows are source-stamped and review-pending", () => {
  const discovery = normalizeManualDiscoveryInput({
    postUrl: "https://www.instagram.com/p/Manual123/",
    instagramUsername: "@shop_name",
    caption: "공동구매 상품 오픈",
    takenAt: "2026-09-20T11:30:00+09:00",
    imageUrl: "https://cdn.example.com/post.jpg",
    sourceType: "PLAYWRIGHT_PUBLIC",
    status: "APPROVED",
    collectionReviewStatus: "APPROVED",
  });
  const rows = buildManualDiscoveryRows({
    discovery,
    parsed: {
      productName: "테스트 상품",
      brandName: "테스트 브랜드",
      startDate: "2026-09-20",
      purchaseUrl: "https://shop.example/buy",
      priceKrw: 19_900,
    },
    parseError: null,
    contentHash: "hash",
    rawPostId: "raw-post-id",
    groupBuyId: "group-buy-id",
    influencerId: "influencer-id",
    now: "2026-09-20T02:30:00.000Z",
  });

  assertEquals(rows.rawPost.collection_source, "MANUAL_DISCOVERY");
  assertEquals(rows.rawPost.is_candidate, true);
  assertEquals(rows.rawPost.is_korea_candidate, true);
  assertEquals(rows.groupBuy.source_type, "MANUAL_DISCOVERY");
  assertEquals(rows.groupBuy.status, "REVIEW_REQUIRED");
  assertEquals(rows.groupBuy.collection_review_status, "PENDING");
  assertEquals(rows.groupBuy.product_name, "테스트 상품");
  assertEquals(rows.groupBuy.collection_ruleset_version, "manual-discovery-v1");
});

Deno.test(
  "caption parsing failures still create a pending review candidate",
  () => {
    const discovery = normalizeManualDiscoveryInput({
      postUrl: "https://www.instagram.com/p/Manual123/",
      instagramUsername: "shop_name",
      caption: "공동구매 상품 오픈",
      takenAt: "2026-09-20T02:30:00.000Z",
    });
    const rows = buildManualDiscoveryRows({
      discovery,
      parsed: {},
      parseError: "caption parse failed",
      contentHash: "hash",
      rawPostId: "raw-post-id",
      groupBuyId: "group-buy-id",
      influencerId: "influencer-id",
      now: "2026-09-20T02:30:00.000Z",
    });

    assertEquals(rows.rawPost.parsing_status, "FAILED");
    assertEquals(rows.rawPost.parse_error, "caption parse failed");
    assertEquals(rows.groupBuy.status, "REVIEW_REQUIRED");
    assertEquals(rows.groupBuy.collection_review_status, "PENDING");
    assertEquals(rows.groupBuy.product_name, null);
  },
);

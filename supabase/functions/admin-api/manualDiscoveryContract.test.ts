import {
  isAutomaticCollectionSource,
  protectPendingAutomaticCatalogPatch,
} from "./automaticCollectionReviewContract.ts";
import {
  manualDiscoveryExistingOutcome,
  manualDiscoveryPostUrlCandidates,
  normalizeManualDiscoveryInput,
} from "./manualDiscoveryContract.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`,
    );
  }
}

function assertThrows(callback: () => unknown, message: string) {
  try {
    callback();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes(message)) {
      throw new Error(`Expected error containing ${JSON.stringify(message)}.`);
    }
    return;
  }
  throw new Error("Expected callback to throw.");
}

Deno.test("matches legacy raw-post URL forms by Instagram shortcode", () => {
  const candidates = manualDiscoveryPostUrlCandidates(
    "https://www.instagram.com/reel/AbC_123/",
  );

  assertEquals(
    candidates.includes("https://www.instagram.com/p/AbC_123/"),
    true,
  );
  assertEquals(candidates.includes("https://instagram.com/reel/AbC_123"), true);
});

Deno.test("recognizes both automatic and manual review sources", () => {
  assertEquals(isAutomaticCollectionSource("PLAYWRIGHT_PUBLIC"), true);
  assertEquals(isAutomaticCollectionSource("MANUAL_DISCOVERY"), true);
  assertEquals(isAutomaticCollectionSource("SUBMISSION"), false);
  assertEquals(isAutomaticCollectionSource(null), false);
});

Deno.test("protects pending manual candidates from status edits", () => {
  assertEquals(
    protectPendingAutomaticCatalogPatch("MANUAL_DISCOVERY", "PENDING", {
      status: "APPROVED",
      product_name: "수동 검수 상품",
    }),
    { product_name: "수동 검수 상품" },
  );
});

Deno.test(
  "makes same-source duplicates idempotent and blocks source relabeling",
  () => {
    assertEquals(
      manualDiscoveryExistingOutcome("MANUAL_DISCOVERY", "raw-1", "group-1"),
      { kind: "duplicate", rawPostId: "raw-1", groupBuyId: "group-1" },
    );
    assertEquals(
      manualDiscoveryExistingOutcome("MANUAL_DISCOVERY", "raw-1", null),
      { kind: "resume", rawPostId: "raw-1" },
    );
    assertEquals(
      manualDiscoveryExistingOutcome("PLAYWRIGHT_PUBLIC", "raw-1", null),
      { kind: "conflict" },
    );
  },
);

Deno.test(
  "normalizes a manual discovery payload and stamps no client metadata",
  () => {
    const result = normalizeManualDiscoveryInput({
      postUrl: "https://www.instagram.com/reel/AbC_123/",
      instagramUsername: "@sample.shop",
      caption: "공동구매 진행합니다",
      takenAt: "2026-09-20T11:30:00+09:00",
      imageUrl: "https://cdn.example.com/post.jpg",
      sourceType: "PLAYWRIGHT_PUBLIC",
      status: "APPROVED",
      collectionReviewStatus: "APPROVED",
    });

    assertEquals(result, {
      instagramPostId: "AbC_123",
      postUrl: "https://www.instagram.com/reel/AbC_123/",
      instagramUsername: "sample.shop",
      caption: "공동구매 진행합니다",
      takenAt: "2026-09-20T02:30:00.000Z",
      imageUrl: "https://cdn.example.com/post.jpg",
    });
  },
);

Deno.test("canonicalizes supported Instagram post URL hosts", () => {
  const result = normalizeManualDiscoveryInput({
    postUrl: "https://instagr.am/p/short-code",
    instagramUsername: "shop_1",
    caption: "공구",
    takenAt: "2026-09-20T02:30:00.000Z",
  });

  assertEquals(result.postUrl, "https://www.instagram.com/p/short-code/");
});

Deno.test("rejects unsafe URLs and incomplete or invalid post metadata", () => {
  const base = {
    postUrl: "https://www.instagram.com/p/short-code/",
    instagramUsername: "shop_1",
    caption: "공구",
    takenAt: "2026-09-20T02:30:00.000Z",
  };

  assertThrows(
    () =>
      normalizeManualDiscoveryInput({
        ...base,
        postUrl: "https://example.com/p/1",
      }),
    "Instagram 게시물 URL",
  );
  assertThrows(
    () =>
      normalizeManualDiscoveryInput({ ...base, instagramUsername: "bad name" }),
    "Instagram 계정명",
  );
  assertThrows(
    () => normalizeManualDiscoveryInput({ ...base, caption: " " }),
    "캡션",
  );
  assertThrows(
    () => normalizeManualDiscoveryInput({ ...base, takenAt: "yesterday" }),
    "게시 시각",
  );
  assertThrows(
    () =>
      normalizeManualDiscoveryInput({
        ...base,
        imageUrl: "http://cdn.example.com/post.jpg",
      }),
    "이미지 URL",
  );
});

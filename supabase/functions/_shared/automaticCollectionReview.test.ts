import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  buildReviewedCollectionSnapshot,
  profileLinkCandidatesFromReviewSnapshot,
} from "./automaticCollectionReview.ts";

Deno.test(
  "keeps normalized Playwright profile links from a proposal snapshot",
  () => {
    assertEquals(
      profileLinkCandidatesFromReviewSnapshot({
        profileLinkCandidates: [
          {
            url: "https://shop.example/item?utm_source=instagram&color=red",
            label: "오늘 공구 구매",
            source: "PLAYWRIGHT_PROFILE",
          },
          {
            url: "https://shop.example/item?color=red",
            label: "중복 링크",
          },
          {
            url: "http://127.0.0.1/admin",
            label: "위험한 링크",
          },
          {
            url: "https://instagr.am/p/SHORT/",
            label: "Instagram 단축 링크",
          },
          {
            url: "https://www.instagr.am/p/SHORT/",
            label: "Instagram 단축 하위 도메인",
          },
        ],
      }),
      [
        {
          url: "https://shop.example/item?color=red",
          label: "오늘 공구 구매",
          source: "PLAYWRIGHT_PROFILE",
        },
      ],
    );
  },
);

Deno.test("returns no profile links for a malformed proposal snapshot", () => {
  assertEquals(profileLinkCandidatesFromReviewSnapshot(null), []);
  assertEquals(profileLinkCandidatesFromReviewSnapshot([]), []);
  assertEquals(profileLinkCandidatesFromReviewSnapshot("invalid"), []);
});

Deno.test("approval snapshot preserves one proposal profile link", () => {
  const snapshot = buildReviewedCollectionSnapshot(
    { productName: "승인할 공구" },
    {
      profileLinkCandidates: [
        { url: "https://shop.example/item", label: "구매" },
      ],
    },
  );

  assertEquals(snapshot.profileLinkCandidates, [
    {
      url: "https://shop.example/item",
      label: "구매",
      source: "PLAYWRIGHT_PROFILE",
    },
  ]);
});

Deno.test(
  "rejection snapshot preserves multiple proposal profile links",
  () => {
    const snapshot = buildReviewedCollectionSnapshot(
      { productName: "반려할 공구" },
      {
        profileLinkCandidates: [
          { url: "https://shop.example/one", label: "첫 링크" },
          { url: "https://link.example/two", label: "둘째 링크" },
        ],
      },
    );

    assertEquals(snapshot.profileLinkCandidates, [
      {
        url: "https://shop.example/one",
        label: "첫 링크",
        source: "PLAYWRIGHT_PROFILE",
      },
      {
        url: "https://link.example/two",
        label: "둘째 링크",
        source: "PLAYWRIGHT_PROFILE",
      },
    ]);
  },
);

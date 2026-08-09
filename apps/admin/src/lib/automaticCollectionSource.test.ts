import { describe, expect, it } from "vitest";

import {
  automaticCollectionProfileLinkCandidates,
  automaticCollectionProfilePurchaseFallback,
} from "./automaticCollectionSource";

describe("automatic collection profile links", () => {
  it("returns only safe, normalized profile link candidates", () => {
    const item = {
      collectionProposalSnapshot: {
        profileLinkCandidates: [
          {
            url: "https://shop.example/item?utm_source=instagram&color=red#buy",
            label: "오늘 공구 구매",
          },
          {
            url: "https://shop.example/item?color=red",
            label: "중복",
          },
          { url: "http://127.0.0.1/admin", label: "내부 주소" },
          { url: "javascript:alert(1)", label: "위험한 주소" },
        ],
      },
    };

    expect(automaticCollectionProfileLinkCandidates(item)).toEqual([
      {
        url: "https://shop.example/item?color=red",
        label: "오늘 공구 구매",
        source: "PLAYWRIGHT_PROFILE",
      },
    ]);
  });

  it("uses a fallback only when exactly one safe candidate exists", () => {
    expect(
      automaticCollectionProfilePurchaseFallback({
        collectionProposalSnapshot: {
          profileLinkCandidates: [
            { url: "https://shop.example/item", label: "구매" },
          ],
        },
      }),
    ).toBe("https://shop.example/item");

    expect(
      automaticCollectionProfilePurchaseFallback({
        collectionProposalSnapshot: {
          profileLinkCandidates: [
            { url: "https://shop.example/item", label: "구매" },
            { url: "https://link.example/profile", label: "링크 모음" },
          ],
        },
      }),
    ).toBeNull();
  });

  it("falls back to the reviewed snapshot for completed history rows", () => {
    expect(
      automaticCollectionProfileLinkCandidates({
        collectionProposalSnapshot: null,
        collectionReviewedSnapshot: {
          profileLinkCandidates: [
            { url: "https://shop.example/history", label: "검수 당시 링크" },
          ],
        },
      }),
    ).toHaveLength(1);
  });
});

import {
  normalizeProfileLinkCandidates,
  profileLinkCandidatesFromSnapshot,
  singleProfilePurchaseUrl,
} from "./profile-link-candidates";

describe("profile link candidates", () => {
  it("normalizes public links, removes tracking, and rejects unsafe hosts", () => {
    expect(
      normalizeProfileLinkCandidates([
        {
          url: "https://shop.example/item?utm_source=instagram&color=red#buy",
          label: "오늘 공구 구매",
        },
        {
          url: "https://shop.example/item?color=red",
          label: "중복",
        },
        { url: "http://127.0.0.1/admin", label: "내부 주소" },
        { url: "https://instagram.com/milkable", label: "인스타그램" },
        { url: "https://instagr.am/p/SHORT/", label: "인스타그램 단축" },
        {
          url: "https://www.instagr.am/p/SHORT/",
          label: "인스타그램 단축 하위 도메인",
        },
      ]),
    ).toEqual([
      {
        url: "https://shop.example/item?color=red",
        label: "오늘 공구 구매",
        source: "PLAYWRIGHT_PROFILE",
      },
    ]);
  });

  it("uses a profile purchase URL only when exactly one safe candidate exists", () => {
    expect(
      singleProfilePurchaseUrl([
        { url: "https://shop.example/item", label: "구매" },
      ]),
    ).toBe("https://shop.example/item");
    expect(
      singleProfilePurchaseUrl([
        { url: "https://shop.example/item", label: "구매" },
        { url: "https://link.example/profile", label: "링크 모음" },
      ]),
    ).toBeUndefined();
  });

  it("reads candidates from a stored proposal snapshot", () => {
    expect(
      profileLinkCandidatesFromSnapshot({
        profileLinkCandidates: [
          { url: "https://shop.example/item", label: "구매" },
        ],
      }),
    ).toEqual([
      {
        url: "https://shop.example/item",
        label: "구매",
        source: "PLAYWRIGHT_PROFILE",
      },
    ]);
    expect(profileLinkCandidatesFromSnapshot(null)).toEqual([]);
  });
});

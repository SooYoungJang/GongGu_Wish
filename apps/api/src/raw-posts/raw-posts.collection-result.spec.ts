import { collectionResult } from "./collection-result";

describe("collectionResult", () => {
  it("marks a newly created group-buy review candidate", () => {
    expect(
      collectionResult(
        { id: "raw-1", caption: "공구", groupBuy: { id: "group-buy-1" } },
        true,
      ),
    ).toEqual({
      rawPost: { id: "raw-1", caption: "공구" },
      created: true,
      duplicate: false,
      groupBuyId: "group-buy-1",
      reviewCandidateCreated: true,
    });
  });

  it("does not count an existing campaign as a new review candidate", () => {
    expect(
      collectionResult(
        { id: "raw-1", caption: "공구", groupBuy: { id: "group-buy-1" } },
        false,
      ),
    ).toMatchObject({
      created: false,
      duplicate: true,
      groupBuyId: "group-buy-1",
      reviewCandidateCreated: false,
    });
  });

  it("returns no candidate for a non-group-buy post", () => {
    expect(
      collectionResult({ id: "raw-2", caption: "일상", groupBuy: null }, true),
    ).toMatchObject({
      groupBuyId: null,
      reviewCandidateCreated: false,
    });
  });
});

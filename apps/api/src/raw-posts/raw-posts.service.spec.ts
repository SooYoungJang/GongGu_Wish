import {
  GroupBuyStatus,
  ParsingStatus,
  RawPostCollectionSource,
} from "@prisma/client";

import { RawPostsService } from "./raw-posts.service";

jest.mock("@gonggu/shared", () => ({
  parseSubmissionCaption: jest.fn(() => ({
    productName: "국내 배송 공구",
    purchaseUrl: "https://shop.example/item",
    endDate: "2026-08-20",
    priceKrw: 10000,
  })),
}));

describe("RawPostsService", () => {
  const baseDto = {
    instagramPostId: "p:test-1",
    influencerUsername: "seller_one",
    caption: "국내 배송 공구 10,000원\n마감 8/20\nhttps://shop.example/item",
    postUrl: "https://www.instagram.com/p/test-1/",
    imageUrl: "https://cdn.example/item.jpg",
    takenAt: "2026-08-08T00:00:00.000Z",
    collectedAt: "2026-08-08T00:05:00.000Z",
    collectionSource: RawPostCollectionSource.PLAYWRIGHT_PUBLIC,
  };

  function createService() {
    const tx = {
      influencer: {
        upsert: jest
          .fn()
          .mockResolvedValue({ id: "inf-1", instagramUsername: "seller_one" }),
      },
      rawPost: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => {
          const { groupBuy, ...rawPost } = data;
          return {
            id: "raw-1",
            ...rawPost,
            groupBuy: groupBuy ? { id: "group-buy-1" } : null,
          };
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
      rawPost: { findMany: jest.fn() },
    };
    return { service: new RawPostsService(prisma as never), prisma, tx };
  }

  it("creates a parsed review candidate for a Korean Playwright post", async () => {
    const { service, tx } = createService();

    const result = await service.collect(baseDto);

    expect(tx.rawPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        collectionSource: RawPostCollectionSource.PLAYWRIGHT_PUBLIC,
        isCandidate: true,
        isKoreaCandidate: true,
        parsingStatus: ParsingStatus.PARSED,
        groupBuy: {
          create: expect.objectContaining({
            status: GroupBuyStatus.REVIEW_REQUIRED,
            sourceType: "PLAYWRIGHT_PUBLIC",
            productName: expect.stringContaining("공구"),
            purchaseUrl: "https://shop.example/item",
            priceKrw: 10000,
          }),
        },
      }),
      include: { groupBuy: { select: { id: true } } },
    });
    expect(result).toMatchObject({
      created: true,
      duplicate: false,
      groupBuyId: "group-buy-1",
      reviewCandidateCreated: true,
    });
  });

  it("stores non-Korean candidates without publishing a review record", async () => {
    const { service, tx } = createService();

    const result = await service.collect({
      ...baseDto,
      instagramPostId: "p:test-2",
      caption: "공구 now 10 USD",
    });

    expect(tx.rawPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isCandidate: true,
        isKoreaCandidate: false,
        parsingStatus: ParsingStatus.NOT_KOREA,
        groupBuy: undefined,
      }),
      include: { groupBuy: { select: { id: true } } },
    });
    expect(result).toMatchObject({
      groupBuyId: null,
      reviewCandidateCreated: false,
    });
  });

  it("keeps legacy collection status behavior", async () => {
    const { service, tx } = createService();

    const result = await service.collect({
      ...baseDto,
      instagramPostId: "legacy-1",
      collectionSource: undefined,
      caption: "공구 상품입니다",
    });

    expect(tx.rawPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        collectionSource: RawPostCollectionSource.LEGACY_INSTAGRAPI,
        parsingStatus: ParsingStatus.PENDING,
      }),
      include: { groupBuy: { select: { id: true } } },
    });
    expect(result).toMatchObject({
      groupBuyId: null,
      reviewCandidateCreated: false,
    });
  });

  it("returns duplicates without creating another raw post", async () => {
    const { service, tx } = createService();
    tx.rawPost.findFirst.mockResolvedValue({
      id: "existing",
      instagramPostId: baseDto.instagramPostId,
    });

    const result = await service.collect(baseDto);

    expect(result).toMatchObject({
      created: false,
      duplicate: true,
      groupBuyId: null,
      reviewCandidateCreated: false,
    });
    expect(tx.rawPost.create).not.toHaveBeenCalled();
  });
});

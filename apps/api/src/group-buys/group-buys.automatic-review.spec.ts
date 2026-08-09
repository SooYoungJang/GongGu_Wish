import {
  ConflictException,
} from "@nestjs/common";
import {
  CollectionReviewStatus,
  GroupBuyStatus,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { GroupBuysService } from "./group-buys.service";

const automaticCandidate = {
  id: "group-buy-1",
  rawPostId: "raw-post-1",
  dedupeKey: "milkable:post-1",
  influencerId: "influencer-1",
  productName: "밀크에이블 공구",
  brandName: "밀크에이블",
  category: "주방",
  startDate: new Date("2026-08-09T00:00:00.000Z"),
  endDate: null,
  purchaseUrl: "https://example.com/buy",
  discountInfo: "10% 할인",
  priceKrw: 19_900,
  summary: "자동 수집 후보",
  confidence: 0.91,
  status: GroupBuyStatus.REVIEW_REQUIRED,
  rejectionReason: null,
  reviewedAt: null,
  reviewedBy: null,
  collectionReviewStatus: CollectionReviewStatus.PENDING,
  collectionProposalSnapshot: null,
  collectionReviewedSnapshot: null,
  collectionRulesetVersion: "test-v1",
  collectionHikerUsed: true,
  collectionHikerLookupAt: new Date("2026-08-09T01:00:00.000Z"),
  sourceType: "PLAYWRIGHT_PUBLIC",
  submissionId: null,
  isAllDay: false,
  isMonthlyFeatured: false,
  monthlyFeaturedRank: null,
  isHomeBanner: false,
  homeBannerStartDate: null,
  homeBannerEndDate: null,
  mediaItems: [],
  createdAt: new Date("2026-08-09T00:00:00.000Z"),
  updatedAt: new Date("2026-08-09T00:00:00.000Z"),
  rawPost: {
    id: "raw-post-1",
    instagramPostId: "post-1",
    influencerId: "influencer-1",
    caption: "공구 오픈",
    postUrl: "https://www.instagram.com/p/post-1/",
    imageUrl: "https://cdn.example.com/post-1.jpg",
    takenAt: new Date("2026-08-08T23:00:00.000Z"),
    contentHash: "hash",
    isCandidate: true,
    isKoreaCandidate: true,
    collectionSource: "PLAYWRIGHT_PUBLIC" as const,
    parsingStatus: "PARSED" as const,
    exportedAt: null,
    parsedAt: null,
    parseError: null,
    collectedAt: new Date("2026-08-09T00:00:00.000Z"),
    createdAt: new Date("2026-08-09T00:00:00.000Z"),
    updatedAt: new Date("2026-08-09T00:00:00.000Z"),
    influencer: {
      id: "influencer-1",
      instagramUsername: "milkable",
      displayName: "Milkable",
      profileImageUrl: "https://cdn.example.com/profile.jpg",
      isActive: true,
      playwrightCollectionEnabled: true,
      playwrightLastAttemptAt: null,
      playwrightLastSuccessAt: null,
      playwrightLastError: null,
      playwrightFailureCount: 0,
      playwrightNextRunAt: null,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    },
  },
  influencer: null,
};

describe("GroupBuysService automatic collection decisions", () => {
  const findUnique = jest.fn();
  const updateMany = jest.fn();
  const prisma = {
    groupBuy: {
      findUnique,
      updateMany,
    },
  } as unknown as PrismaService;
  const service = new GroupBuysService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("persists an approved decision and the reviewed snapshot", async () => {
    const approved = {
      ...automaticCandidate,
      status: GroupBuyStatus.APPROVED,
      collectionReviewStatus: CollectionReviewStatus.APPROVED,
    };
    findUnique.mockResolvedValueOnce(automaticCandidate).mockResolvedValueOnce(approved);
    updateMany.mockResolvedValue({ count: 1 });

    await service.approve(automaticCandidate.id, "admin-1");

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: automaticCandidate.id,
        updatedAt: automaticCandidate.updatedAt,
        OR: [
          { collectionReviewStatus: CollectionReviewStatus.PENDING },
          { collectionReviewStatus: null },
        ],
      },
      data: expect.objectContaining({
        status: GroupBuyStatus.APPROVED,
        collectionReviewStatus: CollectionReviewStatus.APPROVED,
        reviewedBy: "admin-1",
        collectionReviewedSnapshot: expect.objectContaining({
          schemaVersion: 1,
          productName: automaticCandidate.productName,
          instagramUsername: "milkable",
          originalPostUrl: automaticCandidate.rawPost.postUrl,
        }),
      }),
    });
  });

  it("persists a rejected decision and the rejection reason", async () => {
    const rejected = {
      ...automaticCandidate,
      status: GroupBuyStatus.REJECTED,
      collectionReviewStatus: CollectionReviewStatus.REJECTED,
      rejectionReason: "공구 상품 아님",
    };
    findUnique.mockResolvedValueOnce(automaticCandidate).mockResolvedValueOnce(rejected);
    updateMany.mockResolvedValue({ count: 1 });

    await service.reject(
      automaticCandidate.id,
      " 공구 상품 아님 ",
      "admin-1",
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: automaticCandidate.id,
        updatedAt: automaticCandidate.updatedAt,
        OR: [
          { collectionReviewStatus: CollectionReviewStatus.PENDING },
          { collectionReviewStatus: null },
        ],
      },
      data: expect.objectContaining({
        status: GroupBuyStatus.REJECTED,
        collectionReviewStatus: CollectionReviewStatus.REJECTED,
        reviewedBy: "admin-1",
        rejectionReason: "공구 상품 아님",
        collectionReviewedSnapshot: expect.objectContaining({
          schemaVersion: 1,
          productName: automaticCandidate.productName,
        }),
      }),
    });
  });

  it("returns an already approved decision without writing it twice", async () => {
    findUnique.mockResolvedValue({
      ...automaticCandidate,
      status: GroupBuyStatus.APPROVED,
      collectionReviewStatus: CollectionReviewStatus.APPROVED,
    });

    const result = await service.approve(automaticCandidate.id, "admin-1");

    expect(result.collectionReviewStatus).toBe(CollectionReviewStatus.APPROVED);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("does not overwrite an opposite completed decision", async () => {
    findUnique.mockResolvedValue({
      ...automaticCandidate,
      status: GroupBuyStatus.REJECTED,
      collectionReviewStatus: CollectionReviewStatus.REJECTED,
    });

    await expect(
      service.approve(automaticCandidate.id, "admin-1"),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("rejects a decision based on a stale edited candidate", async () => {
    findUnique
      .mockResolvedValueOnce(automaticCandidate)
      .mockResolvedValueOnce({
        ...automaticCandidate,
        updatedAt: new Date("2026-08-09T00:05:00.000Z"),
      });
    updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.approve(automaticCandidate.id, "admin-1"),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

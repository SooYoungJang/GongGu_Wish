import { describe, it, expect } from "vitest";
import {
  groupBuySchema,
  groupBuyCategorySchema,
  groupBuyStatusSchema,
  groupBuysResponseSchema,
  publicGroupBuySchema,
  groupBuyAdminSchema,
  calendarGroupBuyItemSchema,
  calendarGroupBuyResponseSchema,
  type GroupBuy,
  type GroupBuyAdmin,
  type GroupBuyStatus,
} from "./group-buy";

describe("group-buy schemas", () => {
  describe("groupBuyCategorySchema", () => {
    it("keeps legacy categories compatible while accepting inferred categories", () => {
      for (const category of ["lifestyle", "digital", "living", "electronics"]) {
        expect(groupBuyCategorySchema.safeParse(category).success).toBe(true);
      }
    });
  });

  describe("publicGroupBuySchema", () => {
    const publicGroupBuy = {
      id: "public-group-buy-1",
      productName: "공개 공구",
      brandName: "공개 브랜드",
      category: "beauty",
      startDate: "2026-07-01T00:00:00",
      endDate: "2026-07-07T23:59:59",
      purchaseUrl: "https://example.com/buy",
      discountInfo: "20% 할인",
      priceKrw: 200000,
      summary: "공개 공구 요약",
      confidence: 0.9,
      thumbnailUrl: null,
      videoUrl: null,
      mediaUrls: [],
      mediaItems: [],
      mediaType: null,
      rawPost: {
        postUrl: "https://instagram.com/p/public-group-buy-1",
        influencer: { instagramUsername: "public_seller" },
      },
    };

    it("validates the mobile public contract and defaults banner opt-in to false", () => {
      const result = publicGroupBuySchema.safeParse(publicGroupBuy);

      expect(result.success).toBe(true);
      if (result.success) expect(result.data.isHomeBanner).toBe(false);
    });

    it("rejects an invalid persisted price", () => {
      expect(
        publicGroupBuySchema.safeParse({ ...publicGroupBuy, priceKrw: "200000" })
          .success,
      ).toBe(false);
    });
  });

  describe("groupBuyStatusSchema", () => {
    it("validates all allowed status values", () => {
      const validStatuses = ["APPROVED", "REVIEW_REQUIRED", "REJECTED", "EXPIRED"] as const;
      validStatuses.forEach((status) => {
        const result = groupBuyStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBe(status);
      });
    });

    it("rejects invalid status", () => {
      const result = groupBuyStatusSchema.safeParse("INVALID");
      expect(result.success).toBe(false);
    });
  });

  describe("groupBuySchema", () => {
    const createValidGroupBuy = (overrides: Partial<GroupBuy> = {}): GroupBuy => ({
      id: "550e8400-e29b-41d4-a716-446655440000",
      rawPostId: null,
      productName: "테스트 공구",
      brandName: "테스트 브랜드",
      startDate: "2026-06-20T00:00:00.000Z",
      endDate: "2026-06-27T23:59:59.000Z",
      purchaseUrl: "https://example.com/buy",
      discountInfo: "20% 할인",
      priceKrw: null,
      summary: "공구 요약",
      confidence: 0.85,
      status: "APPROVED",
      rejectionReason: null,
      reviewedAt: "2026-06-15T10:00:00.000Z",
      favorites: [],
      sourceType: "CRAWLED",
      submissionId: null,
      submission: null,
      isAllDay: false,
      isMonthlyFeatured: false,
      monthlyFeaturedRank: null,
      isHomeBanner: false,
      homeBannerStartDate: null,
      homeBannerEndDate: null,
      createdAt: "2026-06-15T09:00:00.000Z",
      updatedAt: "2026-06-15T10:00:00.000Z",
      ...overrides,
    });

    it("validates complete group buy", () => {
      const gb = createValidGroupBuy();
      const result = groupBuySchema.safeParse(gb);
      expect(result.success).toBe(true);
    });

    it("validates explicit price and home banner schedule fields", () => {
      const result = groupBuySchema.safeParse({
        ...createValidGroupBuy(),
        priceKrw: 39000,
        isHomeBanner: true,
        homeBannerStartDate: "2026-07-12",
        homeBannerEndDate: "2026-07-19",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priceKrw).toBe(39000);
        expect(result.data.isHomeBanner).toBe(true);
        expect(result.data.homeBannerEndDate).toBe("2026-07-19");
      }
    });

    it("rejects negative or fractional KRW prices", () => {
      for (const priceKrw of [-1, 1.5, 2_147_483_648]) {
        expect(groupBuySchema.safeParse({ ...createValidGroupBuy(), priceKrw }).success).toBe(false);
      }
    });

    it("accepts the largest PostgreSQL INTEGER price", () => {
      expect(groupBuySchema.safeParse({
        ...createValidGroupBuy(),
        priceKrw: 2_147_483_647,
      }).success).toBe(true);
    });

    it("rejects impossible home banner calendar dates", () => {
      expect(groupBuySchema.safeParse({
        ...createValidGroupBuy(),
        homeBannerStartDate: "2026-02-30",
      }).success).toBe(false);
    });

    it("validates with submission source type", () => {
      const gb = createValidGroupBuy({
        sourceType: "SUBMISSION",
        submissionId: "550e8400-e29b-41d4-a716-446655440001",
        submission: {
          id: "550e8400-e29b-41d4-a716-446655440001",
          productName: "제보 제품",
          brandName: "브랜드",
          startDate: "2026-06-20T00:00:00.000Z",
          endDate: "2026-06-27T23:59:59.000Z",
          purchaseUrl: "https://example.com",
          discountInfo: "20%",
          summary: "제보 요약",
          instagramUrl: "https://instagram.com/p/XYZ",
          imageUrls: [],
          reporterName: "제보자",
          reporterContact: "reporter@example.com",
          isAnonymous: true,
          contentHash: "hash123",
          status: "APPROVED",
          adminMemo: "자동 승인",
          reviewedAt: "2026-06-15T10:00:00.000Z",
          reviewedBy: "admin",
          groupBuyId: "550e8400-e29b-41d4-a716-446655440000",
          groupBuy: null,
          createdAt: "2026-06-15T09:00:00.000Z",
          updatedAt: "2026-06-15T10:00:00.000Z",
        },
      });
      const result = groupBuySchema.safeParse(gb);
      expect(result.success).toBe(true);
    });

    it("validates with allDay true", () => {
      const gb = createValidGroupBuy({ isAllDay: true });
      const result = groupBuySchema.safeParse(gb);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.isAllDay).toBe(true);
    });

    it("rejects invalid UUID", () => {
      const gb = createValidGroupBuy({ id: "not-uuid" });
      const result = groupBuySchema.safeParse(gb);
      expect(result.success).toBe(false);
    });

    it("rejects invalid URL in purchaseUrl", () => {
      const gb = createValidGroupBuy({ purchaseUrl: "bad-url" });
      const result = groupBuySchema.safeParse(gb);
      expect(result.success).toBe(false);
    });

    it("rejects invalid datetime", () => {
      const gb = createValidGroupBuy({ startDate: "bad-date" });
      const result = groupBuySchema.safeParse(gb);
      expect(result.success).toBe(false);
    });

    it("rejects confidence out of range", () => {
      const gb = createValidGroupBuy({ confidence: 1.5 });
      const result = groupBuySchema.safeParse(gb);
      expect(result.success).toBe(false);
    });

    it("rejects negative confidence", () => {
      const gb = createValidGroupBuy({ confidence: -0.1 });
      const result = groupBuySchema.safeParse(gb);
      expect(result.success).toBe(false);
    });
  });

  describe("groupBuysResponseSchema", () => {
    it("validates array of group buys", () => {
      const response = [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          rawPostId: null,
          productName: "공구 1",
          brandName: "브랜드 1",
          startDate: "2026-06-20T00:00:00.000Z",
          endDate: "2026-06-27T23:59:59.000Z",
          purchaseUrl: "https://example.com/1",
          discountInfo: "10%",
          summary: "요약 1",
          confidence: 0.8,
          status: "APPROVED",
          rejectionReason: null,
          reviewedAt: "2026-06-15T10:00:00.000Z",
          sourceType: "CRAWLED",
          submissionId: null,
          isAllDay: false,
          createdAt: "2026-06-15T09:00:00.000Z",
          updatedAt: "2026-06-15T10:00:00.000Z",
        },
      ];
      const result = groupBuysResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("rejects invalid items", () => {
      const response = [{ id: "not-uuid" }];
      const result = groupBuysResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });
  });

  describe("groupBuyAdminSchema", () => {
    it("validates admin view with extra fields", () => {
      const admin = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        rawPostId: "550e8400-e29b-41d4-a716-446655440001",
        productName: "어드민 공구",
        brandName: "브랜드",
        startDate: "2026-06-20T00:00:00.000Z",
        endDate: "2026-06-27T23:59:59.000Z",
        purchaseUrl: "https://example.com",
        discountInfo: "15%",
        summary: "어드민 요약",
        confidence: 0.9,
        status: "REVIEW_REQUIRED",
        rejectionReason: null,
        reviewedAt: null,
        sourceType: "CRAWLED",
        submissionId: null,
        isAllDay: false,
        createdAt: "2026-06-15T09:00:00.000Z",
        updatedAt: "2026-06-15T09:00:00.000Z",
        rawPost: {
          id: "550e8400-e29b-41d4-a716-446655440001",
          instagramPostId: "ig-123",
          caption: "원본 캡션",
          postUrl: "https://instagram.com/p/ig-123",
          imageUrl: "https://example.com/img.jpg",
          takenAt: "2026-06-15T08:00:00.000Z",
          influencer: {
            id: "550e8400-e29b-41d4-a716-446655440002",
            instagramUsername: "test_influencer",
            displayName: "테스트 인플루언서",
          },
        },
      };
      const result = groupBuyAdminSchema.safeParse(admin);
      expect(result.success).toBe(true);
    });
  });

  describe("calendarGroupBuyItemSchema", () => {
    it("validates a calendar item with date and group buys", () => {
      const item = {
        date: "2026-06-20",
        groupBuys: [
          {
            id: "550e8400-e29b-41d4-a716-446655440000",
            rawPostId: null,
            productName: "공구 1",
            brandName: "브랜드 1",
            startDate: "2026-06-20T00:00:00.000Z",
            endDate: "2026-06-27T23:59:59.000Z",
            purchaseUrl: "https://example.com/1",
            discountInfo: "10%",
            summary: "요약 1",
            confidence: 0.8,
            status: "APPROVED",
            rejectionReason: null,
            reviewedAt: "2026-06-15T10:00:00.000Z",
            sourceType: "CRAWLED",
            submissionId: null,
            isAllDay: false,
            createdAt: "2026-06-15T09:00:00.000Z",
            updatedAt: "2026-06-15T10:00:00.000Z",
          },
        ],
      };
      const result = calendarGroupBuyItemSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date).toBe("2026-06-20");
        expect(result.data.groupBuys).toHaveLength(1);
      }
    });
  });

  describe("calendarGroupBuyResponseSchema", () => {
    it("validates full calendar response", () => {
      const response = {
        items: [
          {
            date: "2026-06-20",
            groupBuys: [
              {
                id: "550e8400-e29b-41d4-a716-446655440000",
                rawPostId: null,
                productName: "공구 1",
                brandName: "브랜드 1",
                startDate: "2026-06-20T00:00:00.000Z",
                endDate: "2026-06-27T23:59:59.000Z",
                purchaseUrl: "https://example.com/1",
                discountInfo: "10%",
                summary: "요약 1",
                confidence: 0.8,
                status: "APPROVED",
                rejectionReason: null,
                reviewedAt: "2026-06-15T10:00:00.000Z",
                sourceType: "CRAWLED",
                submissionId: null,
                isAllDay: false,
                createdAt: "2026-06-15T09:00:00.000Z",
                updatedAt: "2026-06-15T10:00:00.000Z",
              },
            ],
          },
        ],
        meta: { total: 1, month: "2026-06" },
      };
      const result = calendarGroupBuyResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(1);
        expect(result.data.meta.total).toBe(1);
        expect(result.data.meta.month).toBe("2026-06");
      }
    });

    it("rejects response missing meta", () => {
      const response = {
        items: [],
      };
      const result = calendarGroupBuyResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });
  });
});

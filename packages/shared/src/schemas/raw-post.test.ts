import { describe, it, expect } from "vitest";
import {
  rawPostSchema,
  parsingStatusSchema,
  type RawPost,
  type ParsingStatus,
} from "./raw-post";

describe("raw-post schemas", () => {
  describe("parsingStatusSchema", () => {
    it("validates all parsing status values", () => {
      const validStatuses = [
        "NEW",
        "PENDING",
        "EXPORTED",
        "PARSED",
        "NOT_GROUP_BUY",
        "FAILED",
      ] as const;
      validStatuses.forEach((status) => {
        const result = parsingStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBe(status);
      });
    });

    it("rejects invalid status", () => {
      const result = parsingStatusSchema.safeParse("UNKNOWN");
      expect(result.success).toBe(false);
    });
  });

  describe("rawPostSchema", () => {
    const createValidRawPost = (overrides: Partial<RawPost> = {}): RawPost => ({
      id: "550e8400-e29b-41d4-a716-446655440000",
      instagramPostId: "ig_post_123",
      influencerId: "550e8400-e29b-41d4-a716-446655440001",
      influencer: {
        id: "550e8400-e29b-41d4-a716-446655440001",
        instagramUsername: "test_influencer",
        displayName: "테스트",
        profileImageUrl: null,
        isActive: true,
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
      caption: "공구 캡션입니다.",
      postUrl: "https://instagram.com/p/abc123",
      imageUrl: "https://example.com/image.jpg",
      takenAt: "2026-06-15T10:00:00.000Z",
      contentHash: "hash123",
      isCandidate: true,
      parsingStatus: "PARSED",
      exportedAt: "2026-06-15T11:00:00.000Z",
      parsedAt: "2026-06-15T11:30:00.000Z",
      parseError: null,
      collectedAt: "2026-06-15T09:00:00.000Z",
      groupBuy: null,
      createdAt: "2026-06-15T09:00:00.000Z",
      updatedAt: "2026-06-15T11:30:00.000Z",
      ...overrides,
    });

    it("validates complete raw post", () => {
      const rp = createValidRawPost();
      const result = rawPostSchema.safeParse(rp);
      expect(result.success).toBe(true);
    });

    it("accepts manual discovery as a collection source", () => {
      const result = rawPostSchema.safeParse(
        createValidRawPost({ collectionSource: "MANUAL_DISCOVERY" }),
      );
      expect(result.success).toBe(true);
    });

    it("validates with nullable fields as null", () => {
      const rp = createValidRawPost({
        imageUrl: null,
        exportedAt: null,
        parsedAt: null,
        parseError: null,
        groupBuy: null,
      });
      const result = rawPostSchema.safeParse(rp);
      expect(result.success).toBe(true);
    });

    it("rejects invalid UUID", () => {
      const rp = createValidRawPost({ id: "not-uuid" });
      const result = rawPostSchema.safeParse(rp);
      expect(result.success).toBe(false);
    });

    it("rejects invalid URL in postUrl", () => {
      const rp = createValidRawPost({ postUrl: "bad-url" });
      const result = rawPostSchema.safeParse(rp);
      expect(result.success).toBe(false);
    });

    it("rejects invalid URL in imageUrl", () => {
      const rp = createValidRawPost({ imageUrl: "bad-url" });
      const result = rawPostSchema.safeParse(rp);
      expect(result.success).toBe(false);
    });

    it("rejects invalid datetime", () => {
      const rp = createValidRawPost({ takenAt: "bad-date" });
      const result = rawPostSchema.safeParse(rp);
      expect(result.success).toBe(false);
    });

    it("validates each parsing status", () => {
      const statuses: ParsingStatus[] = [
        "NEW",
        "PENDING",
        "EXPORTED",
        "PARSED",
        "NOT_GROUP_BUY",
        "FAILED",
      ];
      statuses.forEach((status) => {
        const rp = createValidRawPost({ parsingStatus: status });
        const result = rawPostSchema.safeParse(rp);
        expect(result.success).toBe(true);
      });
    });
  });
});

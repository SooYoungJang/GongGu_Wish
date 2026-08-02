import { describe, it, expect } from "vitest";
import {
  influencerSchema,
  influencerFormSchema,
  influencersResponseSchema,
  type Influencer,
  type InfluencerForm,
} from "./influencer";

describe("influencer schemas", () => {
  describe("influencerSchema", () => {
    const createValidInfluencer = (overrides: Partial<Influencer> = {}): Influencer => ({
      id: "550e8400-e29b-41d4-a716-446655440000",
      instagramUsername: "test_influencer",
      displayName: "테스트 인플루언서",
      profileImageUrl: "https://example.com/profile.jpg",
      isActive: true,
      rawPosts: [],
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
      ...overrides,
    });

    it("validates complete influencer", () => {
      const inf = createValidInfluencer();
      const result = influencerSchema.safeParse(inf);
      expect(result.success).toBe(true);
    });

    it("validates with nullable fields as null", () => {
      const inf = createValidInfluencer({
        displayName: null,
        profileImageUrl: null,
        rawPosts: [],
      });
      const result = influencerSchema.safeParse(inf);
      expect(result.success).toBe(true);
    });

    it("rejects invalid UUID", () => {
      const inf = createValidInfluencer({ id: "not-uuid" });
      const result = influencerSchema.safeParse(inf);
      expect(result.success).toBe(false);
    });

    it("rejects invalid URL in profileImageUrl", () => {
      const inf = createValidInfluencer({ profileImageUrl: "bad-url" });
      const result = influencerSchema.safeParse(inf);
      expect(result.success).toBe(false);
    });

    it("rejects invalid datetime", () => {
      const inf = createValidInfluencer({ createdAt: "bad-date" });
      const result = influencerSchema.safeParse(inf);
      expect(result.success).toBe(false);
    });
  });

  describe("influencerFormSchema", () => {
    it("validates valid form", () => {
      const form: InfluencerForm = {
        instagramUsername: "new_influencer",
        displayName: "새 인플루언서",
        profileImageUrl: "https://example.com/new-influencer.jpg",
      };
      const result = influencerFormSchema.safeParse(form);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.profileImageUrl).toBe(
          "https://example.com/new-influencer.jpg",
        );
      }
    });

    it("accepts a nullable or omitted profile image for backward compatibility", () => {
      expect(
        influencerFormSchema.safeParse({
          instagramUsername: "without_image",
          displayName: "이미지 없음",
        }).success,
      ).toBe(true);
      expect(
        influencerFormSchema.safeParse({
          instagramUsername: "null_image",
          displayName: "이미지 없음",
          profileImageUrl: null,
        }).success,
      ).toBe(true);
    });

    it("rejects empty instagramUsername", () => {
      const form: InfluencerForm = {
        instagramUsername: "",
        displayName: "표시명",
      };
      const result = influencerFormSchema.safeParse(form);
      expect(result.success).toBe(false);
    });

    it("rejects empty displayName", () => {
      const form: InfluencerForm = {
        instagramUsername: "username",
        displayName: "",
      };
      const result = influencerFormSchema.safeParse(form);
      expect(result.success).toBe(false);
    });

    it("accepts @ prefix (schema doesn't trim)", () => {
      const form: InfluencerForm = {
        instagramUsername: "@with_at",
        displayName: "표시명",
      };
      const result = influencerFormSchema.safeParse(form);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.instagramUsername).toBe("@with_at");
    });
  });

  describe("influencersResponseSchema", () => {
    it("validates array response", () => {
      const response = [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          instagramUsername: "inf1",
          displayName: "인플루언서 1",
          profileImageUrl: null,
          isActive: true,
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z",
        },
      ];
      const result = influencersResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("rejects invalid items", () => {
      const response = [{ id: "not-uuid" }];
      const result = influencersResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });
  });
});

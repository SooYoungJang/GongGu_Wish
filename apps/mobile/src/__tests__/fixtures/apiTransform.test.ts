/**
 * API 변환 로직 테스트 — 실제 PostgREST 응답 → GroupBuy/Influencer 매핑 검증.
 *
 * postgrestGet은 mapPostgrestToApp를 거쳐 snake_case → camelCase 변환을 수행한 뒤
 * 데이터를 반환하므로, 테스트에서도 변환 후의 데이터로 fetchGroupBuys 매핑 로직을 검증한다.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { rawGroupBuysResponse, expectedGroupBuys } from "./realApiData";
import { mapPostgrestToApp } from "../../utils/postgrest-mapper";

vi.mock("../../lib/postgrest-client", () => ({
  postgrestGet: vi.fn(),
  configurePostgrest: vi.fn(),
}));

import { postgrestGet } from "../../lib/postgrest-client";
import { fetchGroupBuys, fetchInfluencers, fallbackGroupBuys } from "../../api";
import { rawInfluencersResponse, expectedInfluencers } from "./realApiData";

// mapPostgrestToApp를 거친 변환 후 데이터 (실제 postgrestGet 반환값 시뮬레이션)
const mappedGroupBuys = mapPostgrestToApp(rawGroupBuysResponse) as any[];
const mappedInfluencers = mapPostgrestToApp(rawInfluencersResponse) as any[];

describe("API 변환 로직 — 실제 PostgREST 응답 기반", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchGroupBuys 매핑", () => {
    it("PostgREST 원본 응답을 GroupBuy[]로 정확히 변환한다", async () => {
      vi.mocked(postgrestGet).mockResolvedValue({
        data: mappedGroupBuys,
        meta: undefined,
      });

      const result = await fetchGroupBuys();

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(expectedGroupBuys[0]);
      expect(result[1]).toEqual(expectedGroupBuys[1]);
      expect(result[2]).toEqual(expectedGroupBuys[2]);
    });

    it("mapPostgrestToApp가 camelCase로 변환한 필드를 정확히 매핑한다", async () => {
      vi.mocked(postgrestGet).mockResolvedValue({
        data: [mappedGroupBuys[0]],
        meta: undefined,
      });

      const result = await fetchGroupBuys();
      const item = result[0];

      expect(item).toHaveProperty("productName", "테스트 제품");
      expect(item).toHaveProperty("brandName", "테스트 브랜드");
      expect(item).toHaveProperty("endDate", "2026-06-15T14:59:59");
      expect(item).toHaveProperty("purchaseUrl", "https://example.com/buy");
      expect(item).toHaveProperty("discountInfo", "20% 할인");
      expect(item).toHaveProperty("confidence", 0.82);
    });

    it("정수 가격이 문자열로 내려와도 숫자로 정규화한다", async () => {
      vi.mocked(postgrestGet).mockResolvedValue({
        data: [
          {
            ...mappedGroupBuys[0],
            priceKrw: "25900",
          },
        ],
        meta: undefined,
      });

      const result = await fetchGroupBuys();

      expect(result[0].priceKrw).toBe(25900);
    });

    it("중첩된 rawPostId.influencerId에서 username을 추출한다", async () => {
      vi.mocked(postgrestGet).mockResolvedValue({
        data: [mappedGroupBuys[0]],
        meta: undefined,
      });

      const result = await fetchGroupBuys();

      expect(result[0].rawPost.influencer.instagramUsername).toBe(
        "some_influencer",
      );
      expect(result[0].rawPost.postUrl).toBe(
        "https://instagram.com/p/TESTPOST001",
      );
    });

    it("rawPostId가 null이어도 크래시하지 않는다", async () => {
      const brokenItem = { ...mappedGroupBuys[0], rawPostId: null };
      vi.mocked(postgrestGet).mockResolvedValue({
        data: [brokenItem],
        meta: undefined,
      });

      const result = await fetchGroupBuys();

      expect(result).toHaveLength(1);
      expect(result[0].rawPost.postUrl).toBe("");
      expect(result[0].rawPost.influencer.instagramUsername).toBe("");
    });

    it("influencerId가 null이면 빈 username을 반환한다", async () => {
      const brokenItem = {
        ...mappedGroupBuys[0],
        rawPostId: { ...mappedGroupBuys[0].rawPostId, influencerId: null },
      };
      vi.mocked(postgrestGet).mockResolvedValue({
        data: [brokenItem],
        meta: undefined,
      });

      const result = await fetchGroupBuys();

      expect(result[0].rawPost.influencer.instagramUsername).toBe("");
    });

    it("null 필드는 null 그대로 유지한다", async () => {
      const nullItem = {
        ...mappedGroupBuys[0],
        productName: null,
        brandName: null,
        endDate: null,
        purchaseUrl: null,
        discountInfo: null,
        summary: null,
      };
      vi.mocked(postgrestGet).mockResolvedValue({
        data: [nullItem],
        meta: undefined,
      });

      const result = await fetchGroupBuys();

      expect(result[0].productName).toBeNull();
      expect(result[0].brandName).toBeNull();
      expect(result[0].endDate).toBeNull();
      expect(result[0].purchaseUrl).toBeNull();
      expect(result[0].discountInfo).toBeNull();
      expect(result[0].summary).toBeNull();
    });

    it("API 에러 시 throw한다", async () => {
      vi.mocked(postgrestGet).mockRejectedValue(new Error("Network error"));

      await expect(fetchGroupBuys()).rejects.toThrow("Network error");
    });
  });

  describe("fetchInfluencers 매핑", () => {
    it("mapPostgrestToApp 변환 후 Influencer[]를 그대로 반환한다", async () => {
      vi.mocked(postgrestGet).mockResolvedValue({
        data: mappedInfluencers,
        meta: undefined,
      });

      const result = await fetchInfluencers();

      expect(result).toMatchObject(expectedInfluencers);
    });

    it("instagram_username → instagramUsername 매핑을 확인한다", async () => {
      vi.mocked(postgrestGet).mockResolvedValue({
        data: mappedInfluencers,
        meta: undefined,
      });

      const result = await fetchInfluencers();

      expect(result[0].instagramUsername).toBe("some_influencer");
      expect(result[0].displayName).toBeNull();
      expect(result[0].isActive).toBe(true);
    });
  });

  describe("mapPostgrestToApp 변환 검증", () => {
    it("snake_case 키를 camelCase로 재귀 변환한다", () => {
      const mapped = mapPostgrestToApp(rawGroupBuysResponse[0]) as Record<
        string,
        unknown
      >;

      expect(mapped).toHaveProperty("productName");
      expect(mapped).toHaveProperty("brandName");
      expect(mapped).toHaveProperty("endDate");
      expect(mapped).toHaveProperty("rawPostId");
      expect((mapped as any).rawPostId).toHaveProperty("influencerId");
      expect((mapped as any).rawPostId.influencerId).toHaveProperty(
        "instagramUsername",
      );
      // 원본 snake_case 키는 존재하지 않아야 함
      expect(mapped).not.toHaveProperty("product_name");
      expect(mapped).not.toHaveProperty("raw_post_id");
    });

    it("influencers 응답도 camelCase로 변환된다", () => {
      const mapped = mapPostgrestToApp(rawInfluencersResponse[0]) as Record<
        string,
        unknown
      >;

      expect(mapped).toHaveProperty("instagramUsername", "some_influencer");
      expect(mapped).toHaveProperty("isActive", true);
      expect(mapped).not.toHaveProperty("instagram_username");
    });
  });

  describe("fallbackGroupBuys", () => {
    it("API 실패 시 사용할 수 있는 비어있지 않은 fallback 데이터가 있다", () => {
      expect(fallbackGroupBuys.length).toBeGreaterThan(0);
      expect(fallbackGroupBuys[0].productName).toBeTruthy();
      expect(
        fallbackGroupBuys[0].rawPost.influencer.instagramUsername,
      ).toBeTruthy();
    });

    it("fallback 데이터도 GroupBuy 타입 구조를 만족한다", () => {
      for (const gb of fallbackGroupBuys) {
        expect(gb).toHaveProperty("id");
        expect(gb).toHaveProperty("productName");
        expect(gb).toHaveProperty("rawPost.influencer.instagramUsername");
      }
    });
  });
});

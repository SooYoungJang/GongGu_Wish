import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteAccount,
  fetchOwnSubmissionIds,
  fetchHomeBannerGroupBuys,
  fetchGroupBuyRankings,
  fetchPreviousProductGroupBuys,
  fetchGroupBuys,
  fetchGroupBuysByInfluencer,
  fetchNotificationReminders,
  lookupInstagramUrl,
  logDeepView,
  logSearchTerm,
  mapGroupBuyRows,
  postPublicJson,
  refreshGroupBuyMedia,
  syncBookmark,
  syncNotification,
} from "./api";
import { configurePostgrest } from "./lib/postgrest-client";
import { resolveAudiencePolicy } from "./audience/audiencePolicy";
import { setAudiencePolicySnapshot } from "./audience/behaviorSignalsPolicy";

const sessionMocks = vi.hoisted(() => ({
  getSessionId: vi.fn(),
}));
const authTokenMocks = vi.hoisted(() => ({
  getAuthToken: vi.fn<() => Promise<string | null>>(),
}));

vi.mock("./utils/session", () => sessionMocks);
vi.mock("./utils/auth", () => authTokenMocks);

const originalFetch = global.fetch;

describe("public data fetch diagnostics", () => {
  beforeEach(() => {
    configurePostgrest("sb_publishable_1234567890");
    sessionMocks.getSessionId.mockReset();
    authTokenMocks.getAuthToken.mockReset().mockResolvedValue(null);
    setAudiencePolicySnapshot(resolveAudiencePolicy("age14Plus"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("does not emit search, deep-view, bookmark, or session signals in age-13 mode", async () => {
    setAudiencePolicySnapshot(resolveAudiencePolicy("age13"));
    global.fetch = vi.fn() as unknown as typeof fetch;

    await logSearchTerm("공구");
    await logDeepView("group-buy-1");
    await syncBookmark("group-buy-1", true);

    expect(sessionMocks.getSessionId).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("logs group buy failures separately from feed failures", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(
        new TypeError("Network request failed"),
      ) as unknown as typeof fetch;

    await expect(fetchGroupBuys()).rejects.toThrow("Network request failed");

    expect(console.log).toHaveBeenCalledWith(
      "[GroupBuys] fetch failed:",
      "Network request failed",
    );
  });

  it("sends ranking filters and cursor to the server-side group-buy contract", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [],
        pageInfo: { limit: 2, hasMore: false, nextCursor: null },
        meta: {
          category: "food",
          period: "weekly",
          sort: "rising",
          scoreVersion: "v2",
          generatedAt: "2026-07-16T00:00:00.000Z",
        },
      }),
    }) as unknown as typeof fetch;

    await expect(
      fetchGroupBuyRankings({
        category: "food",
        period: "weekly",
        sort: "rising",
        limit: 2,
        cursor: "opaque-cursor",
      }),
    ).resolves.toMatchObject({ pageInfo: { hasMore: false } });

    const [requestUrl, requestInit] =
      vi.mocked(global.fetch).mock.calls[0] ?? [];
    expect(String(requestUrl)).toContain("/functions/v1/seller-rankings");
    expect(JSON.parse(String((requestInit as RequestInit).body))).toEqual({
      category: "food",
      period: "weekly",
      sort: "rising",
      limit: 2,
      cursor: "opaque-cursor",
    });
  });

  it("rejects a malformed ranking response instead of exposing partial rows", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [], meta: {} }),
    }) as unknown as typeof fetch;

    await expect(
      fetchGroupBuyRankings({
        category: "all",
        period: "weekly",
        sort: "popular",
        limit: 20,
      }),
    ).rejects.toThrow("Invalid group-buy ranking response");
  });

  it("does not enable a home banner when the backend omits the flag", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [
        {
          id: "legacy-group-buy",
          product_name: "레거시 공구",
          raw_post_id: null,
        },
      ],
    }) as unknown as typeof fetch;

    const [item] = await fetchGroupBuys();

    expect(item.isHomeBanner).toBe(false);
  });

  it("fetches the current user's submitted group-buy ids", async () => {
    authTokenMocks.getAuthToken.mockResolvedValue("user-token");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [
        { submission_id: "submission-owned" },
        { submission_id: null },
      ],
    }) as unknown as typeof fetch;

    await expect(fetchOwnSubmissionIds()).resolves.toEqual([
      "submission-owned",
    ]);

    const [requestUrl, requestInit] = vi.mocked(global.fetch).mock.calls[0];
    expect(String(requestUrl)).toContain(
      "/gonggu_submission_submitters?select=submission_id",
    );
    expect(requestInit?.headers).toMatchObject({
      Authorization: "Bearer user-token",
    });
  });

  it("preserves the submission id needed for owner-aware detail actions", () => {
    const [item] = mapGroupBuyRows([
      {
        id: "group-buy-with-submission",
        product_name: "소유자 확인 공구",
        confidence: 0,
        media_urls: [],
        media_items: [],
        media_type: null,
        submission_id: "submission-owned",
      },
    ]);

    expect(item.submissionId).toBe("submission-owned");
  });

  it("prefers the Instagram account saved on the group buy", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [
        {
          id: "group-buy-with-account",
          product_name: "계정 우선순위 공구",
          instagram_username: "saved_shop",
          confidence: 0,
          media_urls: [],
          media_items: [],
          media_type: null,
          raw_post_id: {
            post_url: "https://instagram.com/p/legacy",
            influencer_id: { instagram_username: "legacy_shop" },
          },
        },
      ],
    }) as unknown as typeof fetch;

    const [item] = await fetchGroupBuys();

    expect(item.rawPost.influencer.instagramUsername).toBe("saved_shop");
  });

  it("maps the direct influencer profile image before the legacy raw-post relation", () => {
    const [item] = mapGroupBuyRows([
      {
        id: "group-buy-with-profile",
        product_name: "프로필 이미지 공구",
        instagram_username: "saved_shop",
        confidence: 0,
        media_urls: [],
        media_items: [],
        media_type: null,
        influencer_id: {
          instagram_username: "direct_shop",
          profile_image_url:
            "https://scontent-test.cdninstagram.com/direct.jpg",
        },
        raw_post_id: {
          post_url: "https://instagram.com/p/legacy",
          influencer_id: {
            instagram_username: "legacy_shop",
            profile_image_url:
              "https://scontent-test.cdninstagram.com/legacy.jpg",
          },
        },
      },
    ]);

    expect(item.rawPost.influencer).toEqual({
      instagramUsername: "saved_shop",
      profileImageUrl: "https://scontent-test.cdninstagram.com/direct.jpg",
    });
  });

  it("falls back to the legacy influencer profile image", () => {
    const [item] = mapGroupBuyRows([
      {
        id: "legacy-profile-group-buy",
        product_name: "레거시 프로필 이미지 공구",
        confidence: 0,
        media_urls: [],
        media_items: [],
        media_type: null,
        rawPostId: {
          postUrl: "https://instagram.com/p/legacy",
          influencerId: {
            instagramUsername: "legacy_shop",
            profileImageUrl:
              "https://scontent-test.cdninstagram.com/legacy.jpg",
          },
        },
      },
    ]);

    expect(item.rawPost.influencer.profileImageUrl).toBe(
      "https://scontent-test.cdninstagram.com/legacy.jpg",
    );
  });

  it("drops unsafe persisted profile image URLs without dropping their group buys", () => {
    const unsafeUrls = [
      "http://scontent-test.cdninstagram.com/profile.jpg",
      "https://user:password@scontent-test.cdninstagram.com/profile.jpg",
      "https://cdninstagram.com:444/profile.jpg",
      "https://cdninstagram.com:443/profile.jpg",
      "https://cdninstagram.com.attacker.example/profile.jpg",
      "javascript:alert(1)",
      `https://scontent-test.cdninstagram.com/${"a".repeat(8_193)}`,
    ];

    const items = mapGroupBuyRows(
      unsafeUrls.map((profileImageUrl, index) => ({
        id: `unsafe-profile-${index}`,
        product_name: `안전하지 않은 프로필 ${index}`,
        confidence: 0,
        media_urls: [],
        media_items: [],
        media_type: null,
        influencer_id: {
          instagram_username: `unsafe_shop_${index}`,
          profile_image_url: profileImageUrl,
        },
        raw_post_id: null,
      })),
    );

    expect(items).toHaveLength(unsafeUrls.length);
    for (const item of items) {
      expect(item.rawPost.influencer).not.toHaveProperty("profileImageUrl");
    }
  });

  it("maps post-level audio fields without replacing embedded video media", () => {
    const [item] = mapGroupBuyRows([
      {
        id: "group-buy-with-post-audio",
        product_name: "오디오가 있는 캐러셀 공구",
        confidence: 0,
        video_url: "https://media.example.invalid/carousel-video.mp4",
        media_urls: ["https://media.example.invalid/carousel-video.mp4"],
        media_items: [
          {
            url: "https://media.example.invalid/carousel-video.mp4",
            mediaType: "VIDEO",
          },
        ],
        media_type: "VIDEO",
        post_audio_url: "https://cdn.example.invalid/audio/carousel-track.m4a",
        post_audio_start_time_ms: 12_000,
        post_audio_duration_ms: 30_000,
        raw_post_id: null,
      },
    ]);

    expect({
      videoUrl: item.videoUrl,
      postAudioUrl: item.postAudioUrl,
      postAudioStartTimeMs: item.postAudioStartTimeMs,
      postAudioDurationMs: item.postAudioDurationMs,
    }).toEqual({
      videoUrl: "https://media.example.invalid/carousel-video.mp4",
      postAudioUrl: "https://cdn.example.invalid/audio/carousel-track.m4a",
      postAudioStartTimeMs: 12_000,
      postAudioDurationMs: 30_000,
    });
  });

  it("finds both current and legacy group buys for an Instagram account", async () => {
    const row = (id: string) => ({
      id,
      product_name: `${id} 공구`,
      instagram_username: "saved_shop",
      confidence: 0,
      media_urls: [],
      media_items: [],
      media_type: null,
      raw_post_id: null,
    });
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => [row("current")],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => [row("current"), row("legacy")],
      }) as unknown as typeof fetch;

    const result = await fetchGroupBuysByInfluencer("@Saved_Shop");

    expect(result.map((item) => item.id)).toEqual(["current", "legacy"]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(global.fetch).mock.calls[0]?.[0])).toContain(
      "instagram_username.ilike.Saved_Shop",
    );
    expect(String(vi.mocked(global.fetch).mock.calls[1]?.[0])).toContain(
      "raw_post_id!inner(*,influencer_id!inner(*))",
    );
    expect(String(vi.mocked(global.fetch).mock.calls[1]?.[0])).toContain(
      "instagram_username=ilike.Saved_Shop",
    );
  });

  it("returns only closed records for the same product", async () => {
    const row = (overrides: Record<string, unknown>) => ({
      id: "row-id",
      product_name: "진정 크림 50ml",
      brand_name: "브랜드 A",
      start_date: "2026-07-01T00:00:00",
      end_date: "2026-07-10T23:59:59",
      summary: "이전 공구 안내",
      thumbnail_url: "https://cdn.example.invalid/cream.jpg",
      status: "EXPIRED",
      created_at: "2026-07-01T00:00:00.000Z",
      ...overrides,
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [
        row({ id: "current" }),
        row({ id: "previous" }),
        row({ id: "different-brand", brand_name: "브랜드 B" }),
        row({
          id: "ended-approved",
          status: "APPROVED",
          end_date: "2020-07-10T23:59:59",
        }),
        row({
          id: "still-open",
          status: "APPROVED",
          end_date: "2099-07-10T23:59:59",
        }),
      ],
    }) as unknown as typeof fetch;

    const result = await fetchPreviousProductGroupBuys({
      id: "current",
      brandName: "브랜드A",
      productName: "진정크림 50ML",
    });

    expect(result.map((item) => item.id)).toEqual([
      "previous",
      "ended-approved",
    ]);
    expect(String(vi.mocked(global.fetch).mock.calls[0]?.[0])).toContain(
      "status=in.(APPROVED,EXPIRED)",
    );
  });

  it("asks PostgREST for only approved, active home banners", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [],
    }) as unknown as typeof fetch;

    await expect(
      fetchHomeBannerGroupBuys(new Date(2026, 6, 13, 12)),
    ).resolves.toEqual([]);

    const requestUrl = String(vi.mocked(global.fetch).mock.calls[0]?.[0]);
    expect(requestUrl).toContain("status=eq.APPROVED");
    expect(requestUrl).toContain("is_home_banner=eq.true");
    expect(requestUrl).toContain("home_banner_start_date=lte.2026-07-13");
    expect(requestUrl).toContain("home_banner_end_date=gte.2026-07-13");
  });

  it("does not expose approved group buys that ended before today", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 18, 12));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [
        {
          id: "expired-group-buy",
          product_name: "지난 공구",
          end_date: "2026-07-16T23:59:59",
          confidence: 0,
          media_urls: [],
          media_items: [],
          media_type: null,
          raw_post_id: null,
        },
        {
          id: "active-group-buy",
          product_name: "오늘 마감 공구",
          end_date: "2026-07-18T00:00:00",
          confidence: 0,
          media_urls: [],
          media_items: [],
          media_type: null,
          raw_post_id: null,
        },
      ],
    }) as unknown as typeof fetch;

    try {
      await expect(fetchGroupBuys()).resolves.toEqual([
        expect.objectContaining({ id: "active-group-buy" }),
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries public group buys without the optional influencer relation", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers(),
        json: async () => ({
          code: "PGRST200",
          message:
            "Could not find a relationship between 'group_buys' and 'influencers' in the schema cache",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => [
          {
            id: "active-group-buy-after-fallback",
            product_name: "관계 fallback 공구",
            end_date: "2099-01-01",
            confidence: 0,
            media_urls: [],
            media_items: [],
            media_type: null,
            raw_post_id: null,
          },
        ],
      }) as unknown as typeof fetch;

    await expect(fetchGroupBuys()).resolves.toEqual([
      expect.objectContaining({ id: "active-group-buy-after-fallback" }),
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const fallbackUrl = String(vi.mocked(global.fetch).mock.calls[1]?.[0]);
    expect(fallbackUrl).toContain("raw_post_id(*,influencer_id(*))");
    expect(fallbackUrl).not.toContain("influencer_id(*),raw_post_id");
  });

  it("logs updatedAt revisions so stale or legacy banner responses are diagnosable", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [
        {
          id: "banner-with-revision",
          product_name: "버전이 있는 홈 배너",
          category: "food",
          confidence: 0,
          media_urls: [],
          media_items: [],
          media_type: null,
          is_home_banner: true,
          home_banner_start_date: "2026-07-13",
          home_banner_end_date: "2026-07-13",
          updated_at: "2026-07-12T10:00:00.000Z",
          raw_post_id: null,
        },
      ],
    }) as unknown as typeof fetch;

    const result = await fetchHomeBannerGroupBuys(new Date(2026, 6, 13, 12));

    expect(result[0].updatedAt).toBe("2026-07-12T10:00:00.000Z");
    expect(console.log).toHaveBeenCalledWith(
      "[HomeBanner] eligibility response",
      {
        asOf: "2026-07-13",
        count: 1,
        revisions: [
          {
            id: "banner-with-revision",
            updatedAt: "2026-07-12T10:00:00.000Z",
          },
        ],
        legacyMissingUpdatedAt: [],
      },
    );
  });

  it("rejects a malformed public group-buy response instead of exposing it to screens", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [
        {
          id: "malformed-group-buy",
          product_name: "잘못된 공구",
          confidence: 2,
          raw_post_id: null,
        },
      ],
    }) as unknown as typeof fetch;

    await expect(fetchGroupBuys()).rejects.toThrow(
      "Invalid public group buy response",
    );
  });

  it("looks up Instagram metadata through the Supabase hiker function", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        imageUrl: "https://example.com/post.jpg",
        caption: "테스트 게시물",
        likeCount: 42,
        username: "gonggu_test",
        takenAt: "2026-07-04T07:00:00.000Z",
      }),
    }) as unknown as typeof fetch;

    await expect(
      lookupInstagramUrl("https://www.instagram.com/p/ABC123/"),
    ).resolves.toEqual({
      imageUrl: "https://example.com/post.jpg",
      caption: "테스트 게시물",
      likeCount: 42,
      username: "gonggu_test",
      takenAt: "2026-07-04T07:00:00.000Z",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/functions/v1/hiker-lookup"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ url: "https://www.instagram.com/p/ABC123/" }),
      }),
    );
  });

  it("surfaces hiker lookup backend messages", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => JSON.stringify({ error: "HikerAPI returned 502" }),
    }) as unknown as typeof fetch;

    await expect(
      lookupInstagramUrl("https://www.instagram.com/p/ABC123/"),
    ).rejects.toThrow("HikerAPI returned 502");
  });

  it("refreshes group buy media through the cached media refresh function", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        groupBuyId: "group-buy-1",
        refreshed: true,
        source: "hiker",
        instagramUrl: "https://www.instagram.com/reel/ABC123/",
        media: {
          imageUrl: "https://example.com/thumb.jpg",
          thumbnailUrl: "https://example.com/thumb.jpg",
          videoUrl: "https://example.com/video.mp4",
          mediaUrls: ["https://example.com/video.mp4"],
          mediaType: "VIDEO",
        },
      }),
    }) as unknown as typeof fetch;

    await expect(refreshGroupBuyMedia("group-buy-1")).resolves.toMatchObject({
      groupBuyId: "group-buy-1",
      refreshed: true,
      media: {
        videoUrl: "https://example.com/video.mp4",
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/functions/v1/refresh-instagram-media"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ groupBuyId: "group-buy-1" }),
      }),
    );

    await refreshGroupBuyMedia("group-buy-1", {
      force: true,
      failedPostAudioUrl: "https://example.com/failed-audio.m4a",
    });
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining("/functions/v1/refresh-instagram-media"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          groupBuyId: "group-buy-1",
          force: true,
          failedPostAudioUrl: "https://example.com/failed-audio.m4a",
        }),
      }),
    );
  });

  it("sends the current session token when deleting an account", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ deleted: true }),
    }) as unknown as typeof fetch;

    await expect(deleteAccount("current-access-token")).resolves.toBeUndefined();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/functions/v1/delete-account"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer current-access-token",
        }),
        body: JSON.stringify({}),
      }),
    );
    expect(authTokenMocks.getAuthToken).not.toHaveBeenCalled();
  });

  it("rejects account deletion before the request when the session token is blank", async () => {
    await expect(deleteAccount("   ")).rejects.toMatchObject({ status: 401 });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(authTokenMocks.getAuthToken).not.toHaveBeenCalled();
  });

  it("posts public submissions through the Supabase public-submission function", async () => {
    authTokenMocks.getAuthToken.mockResolvedValue("signed-in-user-token");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "submission-123", status: "PENDING" }),
    }) as unknown as typeof fetch;

    await expect(
      postPublicJson("/submissions", {
        productName: "테스트 공구",
        instagramUrl: "https://www.instagram.com/p/ABC123/",
        imageUrls: [],
        isAnonymous: true,
      }),
    ).resolves.toEqual({ id: "submission-123", status: "PENDING" });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/functions/v1/public-submission"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer signed-in-user-token",
        }),
        body: JSON.stringify({
          productName: "테스트 공구",
          instagramUrl: "https://www.instagram.com/p/ABC123/",
          imageUrls: [],
          isAnonymous: true,
        }),
      }),
    );
  });

  it("surfaces public submission edge function errors", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({ error: "제품명은 2자 이상 필수입니다." }),
    }) as unknown as typeof fetch;

    await expect(
      postPublicJson("/submissions", { productName: "" }),
    ).rejects.toThrow("제품명은 2자 이상 필수입니다.");
  });

  it("replaces authenticated opening reminders through the owner-only v2 RPC", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [
        {
          group_buy_id: "group-buy-1",
          reminder_type: "OPENING",
          reminder_days: [0, 2, 6],
          reminder_time_minutes: 15 * 60 + 30,
          updated_at: "2026-07-26T01:00:00.000Z",
        },
      ],
    }) as unknown as typeof fetch;

    await expect(
      syncNotification("group-buy-1", {
        type: "opening",
        reminderDays: [6, 0, 2, 6],
        reminderTimeMinutes: 15 * 60 + 30,
      }),
    ).resolves.toEqual({
      status: "synced",
      preference: {
        groupBuyId: "group-buy-1",
        type: "opening",
        reminderDays: [0, 2, 6],
        reminderTimeMinutes: 15 * 60 + 30,
        updatedAt: "2026-07-26T01:00:00.000Z",
      },
    });

    const [requestUrl, requestInit] =
      vi.mocked(global.fetch).mock.calls[0] ?? [];
    expect(String(requestUrl)).toContain(
      "/rest/v1/rpc/set_my_group_buy_reminder_v2",
    );
    expect(JSON.parse(String((requestInit as RequestInit).body))).toEqual({
      p_group_buy_id: "group-buy-1",
      p_reminder_type: "OPENING",
      p_reminder_days: [0, 2, 6],
      p_reminder_time_minutes: 15 * 60 + 30,
    });
  });

  it("loads and maps authenticated opening and deadline reminder intents", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [
        {
          group_buy_id: "group-buy-1",
          reminder_type: "OPENING",
          reminder_days: [0, 3],
          reminder_time_minutes: 9 * 60 + 15,
          updated_at: "2026-07-26T01:00:00.000Z",
        },
        {
          group_buy_id: "group-buy-2",
          reminder_type: "DEADLINE",
          reminder_days: [3],
          reminder_time_minutes: null,
          updated_at: "2026-07-26T02:00:00.000Z",
        },
        {
          group_buy_id: "group-buy-invalid",
          reminder_type: "UNKNOWN",
          reminder_days: [1],
          reminder_time_minutes: null,
          updated_at: "2026-07-26T03:00:00.000Z",
        },
      ],
    }) as unknown as typeof fetch;

    await expect(fetchNotificationReminders()).resolves.toEqual([
      {
        groupBuyId: "group-buy-1",
        type: "opening",
        reminderDays: [0, 3],
        reminderTimeMinutes: 9 * 60 + 15,
        updatedAt: "2026-07-26T01:00:00.000Z",
      },
      {
        groupBuyId: "group-buy-2",
        type: "deadline",
        reminderDays: [3],
        reminderTimeMinutes: null,
        updatedAt: "2026-07-26T02:00:00.000Z",
      },
    ]);

    expect(String(vi.mocked(global.fetch).mock.calls[0]?.[0])).toContain(
      "/rest/v1/rpc/get_my_group_buy_reminders_v2",
    );
  });

  it("reports a retryable failure when a reminder mirror cannot sync", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("offline"));

    await expect(syncNotification("group-buy-1", [1])).resolves.toEqual({
      status: "failed",
    });
  });
});

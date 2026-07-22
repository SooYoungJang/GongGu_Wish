import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mapCdnRefreshStatusRow } from "./cdnRefreshStatus.ts";

const validRow: Record<string, unknown> = {
  id: "group-buy-1",
  product_name: "상품",
  brand_name: null,
  category: "living",
  video_url: "https://example.com/video.mp4",
  thumbnail_url: null,
  end_date: "2026-07-31",
  updated_at: "2026-07-22T00:00:00.000Z",
  media_refreshed_at: null,
  cdn_expires_at: "2026-07-23T00:00:00.000Z",
  refresh_status: "healthy",
  instagram_url: "https://www.instagram.com/p/example/",
};

Deno.test("maps a validated CDN refresh database row", () => {
  assertEquals(mapCdnRefreshStatusRow(validRow), {
    id: "group-buy-1",
    productName: "상품",
    brandName: null,
    category: "living",
    videoUrl: "https://example.com/video.mp4",
    thumbnailUrl: null,
    endDate: "2026-07-31",
    updatedAt: "2026-07-22T00:00:00.000Z",
    mediaRefreshedAt: null,
    cdnExpiresAt: "2026-07-23T00:00:00.000Z",
    refreshStatus: "healthy",
    instagramUrl: "https://www.instagram.com/p/example/",
  });
});

Deno.test("rejects malformed CDN refresh database rows", () => {
  assertThrows(
    () => mapCdnRefreshStatusRow({ ...validRow, id: 42 }),
    Error,
    "id must be a string",
  );
  assertThrows(
    () =>
      mapCdnRefreshStatusRow({ ...validRow, refresh_status: "unsupported" }),
    Error,
    "refresh_status is invalid",
  );
});

import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const HOST = process.env.E2E_API_HOST ?? "127.0.0.1";
const PORT = Number(process.env.E2E_API_PORT ?? 54321);
const ORIGIN = `http://${HOST}:${PORT}`;
const GENERATED_AT = "2026-07-16T00:00:00.000Z";
const today = new Date().toISOString().slice(0, 10);
const day = (offset) => {
  const value = new Date(`${today}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString();
};

const rawPost = (username, index) => ({
  id: `gon263-post-${index}`,
  post_url: `https://instagram.com/p/gon263-${index}`,
  influencer_id: {
    id: `gon263-influencer-${index}`,
    instagram_username: username,
  },
});

const fixture = ({
  id,
  productName,
  username,
  category,
  priceKrw,
  score,
  scoreDelta,
  endOffset,
  createdOffset,
  homeBanner = false,
  index,
}) => ({
  id,
  product_name: productName,
  brand_name: "GON-263 Brand",
  category,
  start_date: day(0),
  end_date: day(endOffset),
  purchase_url: `https://example.test/gon263/${index}`,
  discount_info: `${20 + index}% 할인`,
  price_krw: priceKrw,
  summary: `${productName} canonical summary`,
  confidence: 0.99,
  thumbnail_url: `${ORIGIN}/media/fixture.png`,
  video_url: `${ORIGIN}/media/fixture.mp4`,
  media_urls: [`${ORIGIN}/media/fixture.mp4`],
  media_items: [
    {
      url: `${ORIGIN}/media/fixture.mp4`,
      media_type: "VIDEO",
      thumbnail_url: `${ORIGIN}/media/fixture.png`,
    },
  ],
  media_type: "VIDEO",
  is_monthly_featured: index === 0,
  monthly_featured_rank: index === 0 ? 1 : null,
  is_home_banner: homeBanner,
  home_banner_start_date: homeBanner ? day(-1).slice(0, 10) : null,
  home_banner_end_date: homeBanner ? day(7).slice(0, 10) : null,
  status: "APPROVED",
  created_at: day(createdOffset),
  updated_at: GENERATED_AT,
  raw_post_id: rawPost(username, index),
  _ranking: {
    deepViews: Math.max(1, Math.floor(score / 3)),
    bookmarks: index + 1,
    notifications: index,
    searchClicks: index * 2,
    score,
    scoreDelta,
  },
});

const GROUP_BUYS = [
  fixture({
    id: "gon263-price-200000",
    productName: "GON-263 기준 공구",
    username: "gon263_price",
    category: "food",
    priceKrw: 200000,
    score: 90,
    scoreDelta: 12,
    endOffset: 2,
    createdOffset: -1,
    index: 0,
  }),
  fixture({
    id: "gon263-banner-visible",
    productName: "GON-263 공개 배너 공구",
    username: "gon263_banner",
    category: "food",
    priceKrw: 35000,
    score: 75,
    scoreDelta: 20,
    endOffset: 3,
    createdOffset: 0,
    homeBanner: true,
    index: 1,
  }),
  fixture({
    id: "gon263-canonical-recent",
    productName: "GON-263 canonical 상세",
    username: "gon263_recent",
    category: "food",
    priceKrw: 48000,
    score: 60,
    scoreDelta: 12,
    endOffset: 2,
    createdOffset: -1,
    index: 2,
  }),
  fixture({
    id: "gon263-beauty",
    productName: "GON-263 뷰티 공구",
    username: "gon263_beauty",
    category: "beauty",
    priceKrw: 29000,
    score: 84,
    scoreDelta: 30,
    endOffset: 4,
    createdOffset: 0,
    index: 3,
  }),
];

function publicRow(row) {
  const { _ranking, ...result } = row;
  return result;
}

export function selectGroupBuyRows(url) {
  let rows = GROUP_BUYS;
  if (url.searchParams.get("is_home_banner") === "eq.true") {
    rows = rows.filter((row) => row.is_home_banner);
  }
  const idFilter = url.searchParams.get("id");
  if (idFilter?.startsWith("eq.")) {
    rows = rows.filter((row) => row.id === idFilter.slice(3));
  } else if (idFilter?.startsWith("in.(") && idFilter.endsWith(")")) {
    const ids = new Set(idFilter.slice(4, -1).split(","));
    rows = rows.filter((row) => ids.has(row.id));
  }
  return rows.map(publicRow);
}

function cursorOffset(cursor) {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString());
    return Number.isSafeInteger(parsed.offset) && parsed.offset >= 0
      ? parsed.offset
      : 0;
  } catch {
    return 0;
  }
}

const compareById = (left, right) => left.id.localeCompare(right.id);

export function buildRankingResponse(input = {}) {
  const category = typeof input.category === "string" ? input.category : "all";
  const period = ["today", "weekly", "monthly"].includes(input.period)
    ? input.period
    : "weekly";
  const sort = ["popular", "rising", "deadlineSoon", "newDeal"].includes(
    input.sort,
  )
    ? input.sort
    : "popular";
  const limit = Math.max(1, Math.min(100, Number(input.limit) || 20));
  const offset = cursorOffset(input.cursor);
  const filtered = GROUP_BUYS.filter(
    (row) => category === "all" || row.category === category,
  );
  filtered.sort((left, right) => {
    if (sort === "rising") {
      return (
        right._ranking.scoreDelta - left._ranking.scoreDelta ||
        right._ranking.score - left._ranking.score ||
        compareById(left, right)
      );
    }
    if (sort === "deadlineSoon") {
      return (
        left.end_date.localeCompare(right.end_date) ||
        right._ranking.score - left._ranking.score ||
        compareById(left, right)
      );
    }
    if (sort === "newDeal") {
      return (
        right.created_at.localeCompare(left.created_at) ||
        right._ranking.score - left._ranking.score ||
        compareById(left, right)
      );
    }
    return (
      right._ranking.score - left._ranking.score || compareById(left, right)
    );
  });

  const page = filtered.slice(offset, offset + limit);
  const hasMore = offset + limit < filtered.length;
  return {
    data: page.map((row) => ({
      groupBuyId: row.id,
      rank: filtered.indexOf(row) + 1,
      previousRank: null,
      trend:
        row._ranking.scoreDelta > 0
          ? { kind: "up", delta: row._ranking.scoreDelta }
          : { kind: "same" },
      productName: row.product_name,
      brandName: row.brand_name,
      username: row.raw_post_id.influencer_id.instagram_username,
      category: row.category,
      thumbnailUrl: row.thumbnail_url,
      mediaUrls: row.media_urls,
      startDate: row.start_date,
      endDate: row.end_date,
      priceKrw: row.price_krw,
      metrics: row._ranking,
      scoreVersion: "v2-e2e",
    })),
    pageInfo: {
      limit,
      hasMore,
      nextCursor: hasMore
        ? Buffer.from(JSON.stringify({ offset: offset + limit })).toString(
            "base64url",
          )
        : null,
    },
    meta: {
      category,
      period,
      sort,
      scoreVersion: "v2-e2e",
      generatedAt: GENERATED_AT,
    },
  };
}

const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=",
  "base64",
);
const FIXTURE_MP4 = Buffer.from(
  "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",
  "base64",
);

function sendBuffer(request, response, contentType, buffer) {
  const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range ?? "");
  if (match) {
    const start = Number(match[1]);
    const requestedEnd = match[2] ? Number(match[2]) : buffer.length - 1;
    const end = Math.min(buffer.length - 1, requestedEnd);
    if (start <= end) {
      const chunk = buffer.subarray(start, end + 1);
      response.writeHead(206, {
        "Accept-Ranges": "bytes",
        "Content-Length": chunk.length,
        "Content-Range": `bytes ${start}-${end}/${buffer.length}`,
        "Content-Type": contentType,
      });
      response.end(chunk);
      return;
    }
  }
  if (request.headers.range) {
    response.writeHead(416, { "Content-Range": `bytes */${buffer.length}` });
    response.end();
    return;
  }
  response.writeHead(200, {
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
    "Content-Length": buffer.length,
    "Content-Type": contentType,
  });
  response.end(buffer);
}

function sendJson(response, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Length": Buffer.byteLength(payload),
    "Content-Type": "application/json",
    ...extraHeaders,
  });
  response.end(payload);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
}

function logRequest(layer, request, status) {
  console.log(
    JSON.stringify({
      layer,
      method: request.method,
      path: request.url,
      status,
      timestamp: new Date().toISOString(),
    }),
  );
}

export function createMobileE2EServer() {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", ORIGIN);
    if (request.method === "OPTIONS") {
      logRequest("cors", request, 204);
      response.writeHead(204, {
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Origin": "*",
      });
      response.end();
      return;
    }
    if (url.pathname === "/health") {
      logRequest("health", request, 200);
      sendJson(response, 200, { status: "ok" });
      return;
    }
    if (url.pathname === "/media/fixture.png") {
      logRequest("media", request, 200);
      sendBuffer(request, response, "image/png", PIXEL_PNG);
      return;
    }
    if (url.pathname === "/media/fixture.mp4") {
      logRequest("media", request, request.headers.range ? 206 : 200);
      sendBuffer(request, response, "video/mp4", FIXTURE_MP4);
      return;
    }
    if (url.pathname === "/rest/v1/group_buys" && request.method === "GET") {
      const rows = selectGroupBuyRows(url);
      logRequest("postgrest:group_buys", request, 200);
      sendJson(response, 200, rows, {
        "Content-Range": `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
      });
      return;
    }
    if (
      url.pathname === "/functions/v1/seller-rankings" &&
      request.method === "POST"
    ) {
      try {
        const body = await readJson(request);
        logRequest("edge:seller-rankings", request, 200);
        sendJson(response, 200, buildRankingResponse(body));
      } catch (error) {
        logRequest("edge:seller-rankings", request, 400);
        sendJson(response, 400, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }
    if (url.pathname.startsWith("/rest/v1/") && request.method === "GET") {
      logRequest("postgrest:empty", request, 200);
      sendJson(response, 200, []);
      return;
    }
    if (request.method !== "GET") {
      logRequest("unexpected-mutation", request, 405);
      sendJson(response, 405, {
        error: "Automated mobile E2E fixture is read-only",
      });
      return;
    }
    logRequest("not-found", request, 404);
    sendJson(response, 404, { error: "Not found" });
  });
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const server = createMobileE2EServer();
  server.listen(PORT, HOST, () => {
    console.log(
      JSON.stringify({ layer: "startup", origin: ORIGIN, status: "ready" }),
    );
  });
}

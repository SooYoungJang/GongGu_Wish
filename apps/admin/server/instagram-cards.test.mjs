import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  cardConfiguration,
  handleInstagramCard,
  selectOngoing,
  postingCycle,
  cycleExpiry,
  renderOngoing,
  validThumbnailUrl,
  fetchThumbnail,
} from "./instagram-cards.mjs";
const now = Date.parse("2026-10-15T12:00:00Z");
const env = {
  VERCEL_ENV: "preview",
  VITE_SUPABASE_URL: "https://xwblovggtvbpiusjfokq.supabase.co",
  VITE_SUPABASE_ANON_KEY: "sb_publishable_test",
  INSTAGRAM_CARDS_ENABLED: "true",
};
const row = {
  product_name: "테스트 & <공구>",
  instagram_username: "test_seller",
  start_date: "2026-10-14T15:00:00",
  end_date: "2026-10-16T15:00:00",
  status: "APPROVED",
  source_type: "MANUAL_DISCOVERY",
  collection_review_status: "APPROVED",
  thumbnail_url: "https://a.fbcdn.net/v/photo.jpg",
};
const testJpeg = await sharp({
  create: { width: 32, height: 32, channels: 3, background: "blue" },
})
  .jpeg()
  .toBuffer();
const okThumb = async () =>
  new Response(testJpeg, { headers: { "content-type": "image/jpeg" } });
const req = (path = "ongoing/2026-10-15", init) =>
  new Request(`https://example.test/public/v1/instagram/${path}.jpg`, init);
const deps = (rows = [row, row]) => ({
  now: () => now,
  thumbnailFetch: okThumb,
  cache: new Map(),
  pending: new Map(),
  fetch: async () => Response.json(rows),
  render: async () => Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
});
test("environment allowlist and separate default-off gate reject secrets/dev/wrong project", () => {
  assert.ok(cardConfiguration(env));
  for (const change of [
    { INSTAGRAM_CARDS_ENABLED: "" },
    { TODAY_CALENDAR_ENABLED: "true", INSTAGRAM_CARDS_ENABLED: "" },
    { VERCEL_ENV: "development" },
    { VITE_SUPABASE_URL: "https://iosdoheblabfimkjnvfj.supabase.co" },
    { VITE_SUPABASE_ANON_KEY: "sb_secret_dontuse" },
    {
      VITE_SUPABASE_ANON_KEY: `a.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.b`,
    },
  ])
    assert.equal(cardConfiguration({ ...env, ...change }), null);
});
test("only approved real ongoing records and future KST endings", () => {
  assert.equal(selectOngoing([row], now).items[0].startDate, "2026-10-15");
  for (const change of [
    { status: "PENDING" },
    { collection_review_status: "PENDING" },
    { start_date: "bad" },
    { end_date: null },
    { end_date: "2026-10-15T14:59:59" },
    { start_date: "2026-10-16T15:00:00" },
    { instagram_username: "bad/handle" },
    { product_name: "bad\nname" },
  ])
    assert.equal(selectOngoing([{ ...row, ...change }], now), null);
  assert.equal(selectOngoing(Array(13).fill(row), now), null);
});
test("disabled/errors never render placeholders; parameter and credential rejection", async () => {
  assert.equal((await handleInstagramCard(req(), {}, deps())).status, 503);
  assert.equal(
    (
      await handleInstagramCard(
        new Request("https://example.test/api/instagram-ongoing?unexpected=x"),
        env,
        deps(),
      )
    ).status,
    400,
  );
  assert.equal(
    (await handleInstagramCard(req("ongoing", { method: "POST" }), env, deps()))
      .status,
    405,
  );
  assert.equal(
    (
      await handleInstagramCard(
        req("ongoing", { headers: { authorization: "Bearer nope" } }),
        env,
        deps(),
      )
    ).status,
    400,
  );
  assert.equal((await handleInstagramCard(req(), env, deps([]))).status, 404);
  assert.equal(
    (
      await handleInstagramCard(
        req(),
        env,
        deps([{ ...row, status: "PENDING" }]),
      )
    ).status,
    502,
  );
  assert.equal(
    (
      await handleInstagramCard(req(), env, {
        ...deps(),
        fetch: async () => new Response("", { status: 500 }),
      })
    ).status,
    502,
  );
  assert.equal(
    (
      await handleInstagramCard(req(), env, {
        ...deps(),
        fetch: async () => {
          throw Error("private details");
        },
      })
    ).status,
    502,
  );
});
test("fixed field projection/filter/limit, timeout and no privileged authorization", async () => {
  let called;
  const r = await handleInstagramCard(req(), env, {
    ...deps(),
    fetch: async (u, o) => {
      called = { u: new URL(u), o };
      return Response.json([row, row]);
    },
  });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Content-Type"), "image/jpeg");
  assert.equal(
    r.headers.get("Cache-Control"),
    "public, max-age=0, must-revalidate",
  );
  assert.equal(called.u.searchParams.get("limit"), "12");
  assert.equal(called.u.searchParams.get("status"), "eq.APPROVED");
  assert.equal(
    called.u.searchParams.get("end_date"),
    "gte.2026-10-15T15:00:00.000",
  );
  assert.equal(
    called.u.searchParams.get("select"),
    "product_name,instagram_username,start_date,end_date,status,source_type,collection_review_status,thumbnail_url",
  );
  assert.ok(called.o.signal);
  assert.equal(called.o.redirect, "error");
  assert.equal(called.o.headers.Authorization, undefined);
});
test("21:00-cycle per-instance cache coalesces sequential reads and refuses date rollover", async () => {
  let calls = 0;
  const d = {
    ...deps(),
    fetch: async () => {
      calls++;
      return Response.json([row, row]);
    },
  };
  await handleInstagramCard(req(), env, d);
  await handleInstagramCard(req(), env, d);
  assert.equal(calls, 1);
  let n = 0;
  const r = await handleInstagramCard(req(), env, {
    ...deps(),
    now: () => (n++ === 0 ? now : now + 86400000),
  });
  assert.equal(r.status, 502);
});
test("native bundled-font render emits Meta-compatible JPEG and escapes source text", async () => {
  const b = await renderOngoing(
    selectOngoing(
      [
        {
          ...row,
          product_name: "가".repeat(180),
          instagram_username: "x".repeat(30),
        },
      ],
      now,
    ),
  );
  const meta = await sharp(b).metadata();
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.width, 1080);
  assert.equal(meta.height, 1350);
  assert.equal(meta.space, "srgb");
  assert.ok(b.length < 8000000);
});
test("date-keyed cache, redirect, no yesterday, no extra TTL, disabled gate on warm cache", async () => {
  const d = deps();
  const redirect = await handleInstagramCard(req("ongoing"), env, d);
  assert.equal(redirect.status, 307);
  assert.equal(
    redirect.headers.get("Location"),
    "/public/v1/instagram/ongoing/2026-10-15.jpg",
  );
  assert.equal(
    (await handleInstagramCard(req("ongoing/2026-10-14"), env, d)).status,
    404,
  );
  const r = await handleInstagramCard(req(), env, d);
  assert.match(r.headers.get("Vercel-CDN-Cache-Control"), /s-maxage=86400,/);
  const older = await handleInstagramCard(req(), env, {
    ...d,
    now: () => now + 59000,
  });
  assert.match(
    older.headers.get("Vercel-CDN-Cache-Control"),
    /s-maxage=86341,/,
  );
  assert.equal((await handleInstagramCard(req(), {}, d)).status, 503);
});
test("parallel requests share one DB fetch and render within an instance", async () => {
  let calls = 0,
    renders = 0;
  const d = {
    ...deps(),
    fetch: async () => {
      calls++;
      return Response.json([row, row]);
    },
    render: async () => {
      renders++;
      return Buffer.from([255, 216, 255, 217]);
    },
  };
  const results = await Promise.all(
    Array.from({ length: 8 }, () => handleInstagramCard(req(), env, d)),
  );
  assert.equal(calls, 1);
  assert.equal(renders, 1);
  assert.ok(results.every((r) => r.status === 200));
});
test("subset font unsupported glyphs are omitted instead of published as tofu", () => {
  assert.deepEqual(
    selectOngoing([{ ...row, product_name: "공구🧸" }], now).items,
    [],
  );
});
test("static intro has no function and immutable versioned JPEG is Meta-compatible", async () => {
  const { readFile } = await import("node:fs/promises");
  const b = await readFile(
    new URL("../public/instagram/intro-v1.jpg", import.meta.url),
  );
  const m = await sharp(b).metadata();
  assert.equal(m.format, "jpeg");
  assert.equal(m.width, 1080);
  assert.equal(m.height, 1350);
  assert.equal(m.space, "srgb");
  assert.ok(b.length < 8000000);
  const config = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  );
  assert.equal(config.rewrites[0].destination, "/instagram/intro-v1.jpg");
  assert.ok(
    config.headers.some((r) =>
      r.headers.some((h) => h.value.includes("immutable")),
    ),
  );
});
test("empty/error not cached; daily success expires exactly at next21:00 KST", async () => {
  const d = deps([]);
  let calls = 0;
  d.fetch = async () => {
    calls++;
    return Response.json([]);
  };
  await handleInstagramCard(req(), env, d);
  await handleInstagramCard(req(), env, d);
  assert.equal(calls, 2);
  assert.equal(d.cache.size, 0);
  const ok = deps();
  await handleInstagramCard(req(), env, ok);
  assert.equal(
    [...ok.cache.values()][0].expires,
    Date.parse("2026-10-16T12:00:00Z"),
  );
  const near = deps();
  near.now = () => Date.parse("2026-10-16T11:59:59Z");
  const r = await handleInstagramCard(req(), env, near);
  assert.match(r.headers.get("Vercel-CDN-Cache-Control"), /s-maxage=1,/);
});
test("posting cycle rolls at21:00 KST, not midnight; successful snapshot survives midnight", async () => {
  assert.equal(postingCycle(Date.parse("2026-10-16T11:59:59Z")), "2026-10-15");
  assert.equal(postingCycle(Date.parse("2026-10-16T12:00:00Z")), "2026-10-16");
  assert.equal(postingCycle(Date.parse("2026-10-15T15:00:00Z")), "2026-10-15");
  assert.equal(cycleExpiry("2026-10-15"), Date.parse("2026-10-16T12:00:00Z"));
  let calls = 0;
  const d = {
    ...deps(),
    fetch: async () => {
      calls++;
      return Response.json([row, row]);
    },
  };
  await handleInstagramCard(req(), env, d);
  const r = await handleInstagramCard(req(), env, {
    ...d,
    now: () => Date.parse("2026-10-16T00:00:00+09:00"),
  });
  assert.equal(r.status, 200);
  assert.equal(calls, 1);
  assert.match(r.headers.get("Vercel-CDN-Cache-Control"), /s-maxage=75600,/);
});

test("photo URL allowlist rejects credentials, ports, redirects and non-raster bodies", async () => {
  for (const u of [
    "http://scontent.cdninstagram.com/v/a.jpg",
    "https://cdninstagram.com.evil.test/v/x",
    "https://localhost/v/x",
    "https://127.0.0.1/v/x",
    "https://a.fbcdn.net:444/v/a",
    "https://user:pass@a.fbcdn.net/v/a",
    "https://a.fbcdn.net/nope",
  ])
    assert.equal(validThumbnailUrl(u), false);
  assert.equal(
    validThumbnailUrl("https://scontent.cdninstagram.com/v/a.jpg"),
    true,
  );
  let called = 0;
  assert.equal(
    await fetchThumbnail("https://evil.test/v/x", async () => {
      called++;
    }),
    null,
  );
  assert.equal(called, 0);
  const url = "https://a.fbcdn.net/v/a";
  assert.equal(
    await fetchThumbnail(url, async (_, o) => {
      assert.equal(o.redirect, "error");
      return new Response("x", {
        headers: { "content-type": "image/svg+xml" },
      });
    }),
    null,
  );
  assert.equal(
    await fetchThumbnail(
      url,
      async () =>
        new Response("x", {
          headers: {
            "content-type": "image/jpeg",
            "content-length": "2000001",
          },
        }),
    ),
    null,
  );
  assert.equal(
    await fetchThumbnail(
      url,
      async () =>
        new Response(new Uint8Array(2000001), {
          headers: { "content-type": "image/jpeg" },
        }),
    ),
    null,
  );
  assert.equal(
    await fetchThumbnail(url, async () => {
      throw Error("failure");
    }),
    null,
  );
  assert.equal(
    await fetchThumbnail(
      url,
      async () =>
        new Response("invalid", { headers: { "content-type": "image/jpeg" } }),
    ),
    null,
  );
});
test("photo fetch decodes safe raster to embedded normalized JPEG", async () => {
  const png = await sharp({
    create: { width: 20, height: 40, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  const result = await fetchThumbnail(
    "https://a.fbcdn.net/v/x",
    async () => new Response(png, { headers: { "content-type": "image/png" } }),
  );
  const meta = await sharp(result).metadata();
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.width, 224);
  assert.equal(meta.height, 224);
});

test("photo-less listings are skipped; fewer than 2 photo listings fail closed", async () => {
  const mk = (n, thumb = true) => ({
    ...row,
    product_name: "공구" + n,
    thumbnail_url: thumb ? `https://a.fbcdn.net/v/p${n}.jpg` : null,
  });
  let rendered;
  const render = async (data) => {
    rendered = data;
    return testJpeg;
  };
  const ok = await handleInstagramCard(req(), env, {
    ...deps([mk(1), mk(2, false), mk(3), mk(4)]),
    render,
  });
  assert.equal(ok.status, 200);
  assert.deepEqual(
    rendered.items.map((v) => v.productName),
    ["공구1", "공구3", "공구4"],
  );
  assert.ok(rendered.items.every((v) => Buffer.isBuffer(v.photoPixels)));
  assert.equal(ok.headers.get("X-Instagram-Photo-Count"), "3");
  assert.equal(ok.headers.get("X-Instagram-Item-Count"), "3");
  const two = await handleInstagramCard(req(), env, {
    ...deps([mk(1), mk(2, false), mk(3)]),
    render,
  });
  assert.equal(two.status, 200);
  assert.equal(two.headers.get("X-Instagram-Item-Count"), "2");
  assert.equal(rendered.items.length, 2);
  for (const rows of [[mk(1)], [mk(1), mk(2, false)], [mk(1, false)]]) {
    const r = await handleInstagramCard(req(), env, { ...deps(rows), render });
    assert.equal(r.status, 404);
  }
  const failed = await handleInstagramCard(req(), env, {
    ...deps([mk(1), mk(2)]),
    thumbnailFetch: async () => {
      throw Error("unavailable");
    },
  });
  assert.equal(failed.status, 404);
});

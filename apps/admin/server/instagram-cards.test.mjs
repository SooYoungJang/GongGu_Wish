import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  cardConfiguration,
  handleInstagramCard,
  selectOngoing,
  renderOngoing,
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
};
const req = (path = "ongoing/2026-10-15", init) =>
  new Request(`https://example.test/public/v1/instagram/${path}.jpg`, init);
const deps = (rows = [row]) => ({
  now: () => now,
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
  assert.equal(selectOngoing([row, row, row, row], now), null);
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
      return Response.json([row]);
    },
  });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Content-Type"), "image/jpeg");
  assert.equal(
    r.headers.get("Cache-Control"),
    "public, max-age=0, must-revalidate",
  );
  assert.equal(called.u.searchParams.get("limit"), "3");
  assert.equal(called.u.searchParams.get("status"), "eq.APPROVED");
  assert.equal(
    called.u.searchParams.get("end_date"),
    "gte.2026-10-15T15:00:00.000",
  );
  assert.equal(
    called.u.searchParams.get("select"),
    "product_name,instagram_username,start_date,end_date,status,source_type,collection_review_status",
  );
  assert.ok(called.o.signal);
  assert.equal(called.o.redirect, "error");
  assert.equal(called.o.headers.Authorization, undefined);
});
test("until-midnight per-instance cache coalesces sequential reads and refuses date rollover", async () => {
  let calls = 0;
  const d = {
    ...deps(),
    fetch: async () => {
      calls++;
      return Response.json([row]);
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
  assert.match(r.headers.get("Vercel-CDN-Cache-Control"), /s-maxage=10800,/);
  const older = await handleInstagramCard(req(), env, {
    ...d,
    now: () => now + 59000,
  });
  assert.match(
    older.headers.get("Vercel-CDN-Cache-Control"),
    /s-maxage=10741,/,
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
      return Response.json([row]);
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
test("empty/error not cached; daily success expires exactly at KST midnight", async () => {
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
    Date.parse("2026-10-15T15:00:00Z"),
  );
  const near = deps();
  near.now = () => Date.parse("2026-10-15T14:59:59Z");
  const r = await handleInstagramCard(req(), env, near);
  assert.match(r.headers.get("Vercel-CDN-Cache-Control"), /s-maxage=1,/);
});

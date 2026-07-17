import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRankingResponse,
  createMobileE2EServer,
  selectGroupBuyRows,
} from "./mobile-e2e-api-server.mjs";

test("home-banner requests never return the disabled 200,000 KRW fixture", () => {
  const rows = selectGroupBuyRows(
    new URL("http://127.0.0.1:54321/rest/v1/group_buys?is_home_banner=eq.true"),
  );

  assert.ok(rows.length > 0);
  assert.equal(
    rows.some((row) => row.price_krw === 200000),
    false,
  );
  assert.equal(
    rows.every((row) => row.is_home_banner),
    true,
  );
});

test("single group-buy requests return only the exact deep-link target", () => {
  const rows = selectGroupBuyRows(
    new URL(
      "http://127.0.0.1:54321/rest/v1/group_buys?id=eq.gon263-e2e-price-200000",
    ),
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "gon263-e2e-price-200000");
});

test("ranking responses preserve filters and canonical fixture identity", () => {
  const response = buildRankingResponse({
    category: "food",
    period: "monthly",
    sort: "rising",
    limit: 20,
  });

  assert.deepEqual(response.meta, {
    category: "food",
    period: "monthly",
    sort: "rising",
    scoreVersion: "v2-e2e",
    generatedAt: "2026-07-16T00:00:00.000Z",
  });
  assert.ok(response.data.length > 0);
  assert.equal(
    response.data.every((item) => item.category === "food"),
    true,
  );
  assert.ok(
    response.data.some(
      (item) =>
        item.groupBuyId === "gon263-e2e-price-200000" &&
        item.priceKrw === 200000,
    ),
  );
});

test("the local video fixture supports native byte-range playback", async () => {
  const server = createMobileE2EServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.equal(typeof address, "object");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/media/fixture.mp4`,
      { headers: { Range: "bytes=0-127" } },
    );

    assert.equal(response.status, 206);
    assert.match(response.headers.get("content-range"), /^bytes 0-127\//);
    assert.equal((await response.arrayBuffer()).byteLength, 128);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

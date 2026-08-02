import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { handler, validate } from "./index.ts";

Deno.test("public submission preserves a 1000-character summary", () => {
  const sentinel = "END-SENTINEL";
  const summary = `${"가".repeat(1000 - sentinel.length)}${sentinel}`;
  const result = validate({
    productName: "테스트 상품",
    instagramUrl: "https://www.instagram.com/p/example/",
    summary,
  });

  if (!("data" in result)) throw new Error("expected valid submission");
  assertEquals(summary.length, 1000);
  assertEquals(result.data.summary, summary);
  assertEquals(result.data.summary?.endsWith(sentinel), true);
});

Deno.test(
  "public submission cancels oversized streaming request bodies",
  async () => {
    let pullCount = 0;
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pullCount += 1;
          controller.enqueue(new Uint8Array(256 * 1024));
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 },
    );
    const request = new Request(
      "https://example.test/functions/v1/public-submission",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: stream,
      },
    );

    const response = await handler(request);

    assertEquals(response.status, 413);
    assertEquals(await response.json(), { error: "payload_too_large" });
    assertEquals(cancelled, true);
    assertEquals(pullCount, 5);
  },
);

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { handleSubmission, handler, validate } from "./index.ts";

Deno.test(
  "detailed public submissions stay pending until an admin approves them",
  async () => {
    const calls: string[] = [];
    const submission = {
      id: "submission-1",
      product_name: "테스트 상품",
      status: "PENDING",
    };
    const supabase = {
      from(table: string) {
        calls.push(`from:${table}`);
        if (table !== "gonggu_submissions") {
          throw new Error(`unexpected table access: ${table}`);
        }

        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: null, error: null }),
                };
              },
            };
          },
          insert() {
            return {
              select() {
                return {
                  single: async () => ({ data: submission, error: null }),
                };
              },
            };
          },
        };
      },
    } as never;

    const response = await handleSubmission(
      {
        productName: "테스트 상품",
        purchaseUrl: "https://example.com/product",
      },
      null,
      supabase,
    );

    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      submission,
      submissionId: "submission-1",
      status: "PENDING",
    });
    assertEquals(calls, [
      "from:gonggu_submissions",
      "from:gonggu_submissions",
    ]);
  },
);

Deno.test(
  "resubmitting a non-approved submission does not publish a group buy",
  async () => {
    const calls: string[] = [];
    const existing = {
      id: "submission-2",
      status: "REJECTED",
      group_buy_id: null,
      image_urls: [],
    };
    const updatedSubmission = {
      ...existing,
      status: "PENDING",
    };
    const supabase = {
      from(table: string) {
        calls.push(`from:${table}`);
        if (table !== "gonggu_submissions") {
          throw new Error(`unexpected table access: ${table}`);
        }

        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: existing, error: null }),
                };
              },
            };
          },
          update() {
            return {
              eq() {
                return {
                  select() {
                    return {
                      single: async () => ({
                        data: updatedSubmission,
                        error: null,
                      }),
                    };
                  },
                };
              },
            };
          },
        };
      },
    } as never;

    const response = await handleSubmission(
      {
        productName: "테스트 상품",
        purchaseUrl: "https://example.com/product",
      },
      null,
      supabase,
    );

    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      submission: updatedSubmission,
      submissionId: "submission-2",
      status: "PENDING",
    });
    assertEquals(calls, [
      "from:gonggu_submissions",
      "from:gonggu_submissions",
    ]);
  },
);

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

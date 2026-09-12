import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseTelemetryBatch } from "./contract.ts";
const event = { id: "00000000-0000-4000-8000-000000000001", eventName: "js_error", screen: "Detail", appVersion: "1.0.0", releaseId: "native", platform: "android", errorKind: "TypeError", httpStatus: null, value: null };
const batch = { sessionId: "00000000-0000-4000-8000-000000000002", events: [event] };
Deno.test("accepts only bounded, explicitly allowed diagnostic fields", () => {
  assertEquals(parseTelemetryBatch(batch), batch);
  for (const extra of [{ message: "private text" }, { email: "private@example.test" }, { url: "https://private.test" }, { query: "private query" }]) assertThrows(() => parseTelemetryBatch({ ...batch, events: [{ ...event, ...extra }] }));
  assertThrows(() => parseTelemetryBatch({ ...batch, events: [{ ...event, screen: "private text" }] }));
  assertThrows(() => parseTelemetryBatch({ ...batch, events: Array(21).fill(event) }));
  assertThrows(() => parseTelemetryBatch({ ...batch, userId: "private" }));
  for (const invalid of [{ eventName: ["js_error"] }, { screen: ["Detail"] }, { platform: ["android"] }, { errorKind: ["TypeError"] }, { value: ["success"] }, { httpStatus: "503" }, { httpStatus: 600 }]) {
    assertThrows(() => parseTelemetryBatch({ ...batch, events: [{ ...event, ...invalid }] }));
  }
});

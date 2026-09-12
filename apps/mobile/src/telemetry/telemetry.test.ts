import { afterEach, describe, expect, it, vi } from "vitest";
import { createTelemetry } from "./telemetry";

afterEach(() => { vi.useRealTimers(); });
function setup() {
  vi.useFakeTimers();
  let allowed = true;
  const collector = createTelemetry(() => allowed);
  const send = vi.fn().mockResolvedValue(undefined);
  collector.configure({ appVersion: "1.2.3", releaseId: "native", platform: "android" }, send);
  return { collector, send, deny: () => { allowed = false; collector.clear(); } };
}
describe("private bounded telemetry", () => {
  it("sends only allowlisted metadata, never query, message, stack, or arbitrary screen", async () => {
    const { collector, send } = setup();
    collector.setScreen("email@example.com");
    collector.record("query_error", null, Object.assign(new TypeError("secret search token"), { status: 503 }));
    await collector.flush();
    const payload = send.mock.calls[0][0];
    expect(payload.events[0]).toMatchObject({ eventName: "query_error", screen: "Unknown", errorKind: "TypeError", httpStatus: 503 });
    expect(JSON.stringify(payload)).not.toMatch(/secret|email|stack|message|queryKey/);
  });
  it("drops denied events and clears queued events and correlation on policy revocation", async () => {
    const { collector, send, deny } = setup();
    collector.record("bookmark_set", "on");
    deny();
    collector.record("detail_open");
    await collector.flush();
    await vi.advanceTimersByTimeAsync(60000);
    expect(send).not.toHaveBeenCalled();
  });
  it("caps memory at 50 and sends batches of at most 20", async () => {
    const { collector, send } = setup();
    for (let i = 0; i < 200; i++) collector.record("detail_open");
    await collector.flush(); await collector.flush(); await collector.flush(); await collector.flush();
    expect(send.mock.calls.map(call => call[0].events.length)).toEqual([20, 20, 10]);
  });
  it("retries identical event IDs three times then drops without recursive errors", async () => {
    const { collector, send } = setup();
    send.mockRejectedValue(new Error("offline"));
    collector.record("js_error", null, new Error("private"));
    await collector.flush();
    await vi.advanceTimersByTimeAsync(90000);
    expect(send).toHaveBeenCalledTimes(3);
    expect(new Set(send.mock.calls.map(call => call[0].events[0].id)).size).toBe(1);
  });
  it("does not duplicate a batch while sending, or revive it after policy revocation", async () => {
    const { collector, send, deny } = setup();
    let resolve!: () => void;
    send.mockReturnValue(new Promise<void>(done => { resolve = done; }));
    collector.record("detail_open");
    const first = collector.flush();
    await collector.flush();
    deny(); resolve(); await first;
    await vi.advanceTimersByTimeAsync(60000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1].aborted).toBe(true);
  });
});

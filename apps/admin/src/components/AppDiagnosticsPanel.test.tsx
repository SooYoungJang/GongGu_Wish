import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppDiagnosticsPanel } from "./AppDiagnosticsPanel";
const getAppDiagnostics = vi.hoisted(() => vi.fn());
vi.mock("@/lib/adminApi", () => ({ adminApi: { getAppDiagnostics } }));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
it("retries a failed load and explains bounded aggregate counts", async () => {
  getAppDiagnostics.mockRejectedValueOnce(new Error("private server error"))
    .mockResolvedValue({ items: [{ eventName: "query_error", screen: "Search", platform: "android", appVersion: "1.2.3", releaseId: "native", errorKind: "ApiError", httpStatus: 503, value: null, count: 4, sessions: 2 }] });
  render(<AppDiagnosticsPanel />);
  expect((await screen.findByRole("alert")).textContent).not.toContain("private server error");
  fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  expect(await screen.findByText("4건 · 2세션")).not.toBeNull();
  expect(screen.getByText("ApiError · HTTP 503")).not.toBeNull();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "1" } });
  await waitFor(() => expect(getAppDiagnostics).toHaveBeenLastCalledWith(1));
});
it("ignores a stale response when the period changes", async () => {
  let resolve!: (value: { items: unknown[] }) => void;
  getAppDiagnostics.mockReturnValueOnce(new Promise(done => { resolve = done; }))
    .mockResolvedValue({ items: [] });
  render(<AppDiagnosticsPanel />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "14" } });
  await screen.findByText("이 기간에 수집된 진단이 없습니다.");
  resolve({ items: [{ eventName: "stale" }] });
  await waitFor(() => expect(screen.queryByText("stale")).toBeNull());
});

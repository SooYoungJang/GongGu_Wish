import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RequestFulfillmentDialog } from "./RequestFulfillmentDialog";
import type { GroupBuyRequest } from "@/types";
const api = vi.hoisted(() => ({ listGroupBuys: vi.fn(), fulfillGroupBuyRequest: vi.fn() }));
vi.mock("@/lib/adminApi", () => ({ adminApi: api }));
const request = { id: "request", productName: "내 상품", status: "OPEN" } as GroupBuyRequest;
beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
  api.listGroupBuys.mockResolvedValue({ items: [{ id: "deal", productName: "공개 상품", startDate: "2026-09-11" }] });
});
afterEach(cleanup);
describe("request fulfillment dialog", () => {
  it("selects an approved product and preserves selection on a failed fulfillment", async () => {
    api.fulfillGroupBuyRequest.mockRejectedValueOnce(new Error("연결 실패")).mockResolvedValueOnce({ queued: 1 });
    const complete = vi.fn();
    render(<RequestFulfillmentDialog request={request} onClose={vi.fn()} onComplete={complete} />);
    fireEvent.click(await screen.findByRole("radio"));
    fireEvent.click(screen.getByRole("button", { name: "공구 연결하고 요청 완료" }));
    expect((await screen.findByRole("alert")).textContent).toContain("연결 실패");
    expect((screen.getByRole("radio") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "공구 연결하고 요청 완료" }));
    await waitFor(() => expect(complete).toHaveBeenCalledOnce());
    expect(api.fulfillGroupBuyRequest).toHaveBeenLastCalledWith("request", "deal");
    expect(api.listGroupBuys).toHaveBeenCalledWith(expect.objectContaining({ status: "APPROVED" }));
  });
  it("keeps a failed lookup retryable", async () => {
    api.listGroupBuys.mockRejectedValueOnce(new Error("offline"));
    render(<RequestFulfillmentDialog request={request} onClose={vi.fn()} onComplete={vi.fn()} />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "검색", exact: true }));
    expect(await screen.findByRole("radio")).not.toBeNull();
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductReportsPanel } from "./ProductReportsPanel";

const mocks = vi.hoisted(() => ({ list: vi.fn(), review: vi.fn() }));
vi.mock("@/lib/adminApi", () => ({ adminApi: { listProductReports: mocks.list, reviewProductReport: mocks.review } }));
const report = { id: "report", groupBuyId: "deal", productName: "테스트 공구", reason: "PRICE", status: "OPEN", createdAt: "2026-09-09T00:00:00Z", reviewedAt: null, reviewNote: null };
describe("product report moderation", () => {
  afterEach(cleanup);
  beforeEach(() => {
    mocks.list.mockReset().mockResolvedValue({ items: [report], total: 1 });
    mocks.review.mockReset();
  });
  it("records the selected decision and memo, then reloads the queue", async () => {
    mocks.review.mockResolvedValue({ ...report, status: "RESOLVED" });
    render(<ProductReportsPanel />);
    await screen.findByText("테스트 공구");
    fireEvent.change(screen.getByLabelText("검수 메모"), { target: { value: "판매 페이지 가격 확인 후 수정" } });
    fireEvent.click(screen.getByRole("button", { name: "수정 완료" }));
    await screen.findByText("신고 처리 상태를 저장했습니다.");
    expect(mocks.review).toHaveBeenCalledWith("report", { status: "RESOLVED", reviewNote: "판매 페이지 가격 확인 후 수정" });
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
  });
  it("preserves the memo after a failed decision and permits a retry", async () => {
    mocks.review.mockRejectedValueOnce(new Error("저장 실패"));
    render(<ProductReportsPanel />);
    await screen.findByText("테스트 공구");
    fireEvent.change(screen.getByLabelText("검수 메모"), { target: { value: "확인 메모" } });
    fireEvent.click(screen.getByRole("button", { name: "수정 불필요" }));
    await screen.findByRole("alert");
    expect((screen.getByLabelText("검수 메모") as HTMLTextAreaElement).value).toBe("확인 메모");
    await waitFor(() => expect((screen.getByRole("button", { name: "수정 불필요" }) as HTMLButtonElement).disabled).toBe(false));
  });
  it("offers a reload after the list request fails instead of showing an empty success", async () => {
    mocks.list.mockRejectedValueOnce(new Error("조회 실패"));
    render(<ProductReportsPanel />);
    await screen.findByRole("alert");
    expect(screen.queryByText("조건에 맞는 신고가 없습니다.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    await screen.findByText("테스트 공구");
  });
});

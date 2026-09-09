import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductReportButton } from "./ProductReportButton";
import { commerceLightColors, commerceRadius, commerceSpacing } from "../../design/commerce";

const mocks = vi.hoisted(() => ({ allowed: true, submit: vi.fn(), gate: vi.fn() }));
vi.mock("./api", async original => ({ ...await original<typeof import("./api")>(), submitProductReport: mocks.submit }));
vi.mock("../../hooks/useAuthGate", () => ({ useAuthGate: () => ({ requireAuth: () => { mocks.gate(); return mocks.allowed; } }) }));
vi.mock("../../context/AuthContext", () => ({ useOptionalAuth: () => ({ user: { id: "owner" } }) }));
vi.mock("../../design/useCommerceTheme", () => ({ useCommerceTheme: () => ({ colors: commerceLightColors, radius: commerceRadius, spacing: commerceSpacing }) }));
vi.mock("../../components/ui/SText", () => ({ SText: ({ children }: any) => <span>{children}</span> }));
vi.mock("react-native", () => ({
  StyleSheet: { create: (value: unknown) => value },
  View: ({ children }: any) => <div>{children}</div>,
  ScrollView: ({ children }: any) => <div>{children}</div>,
  Modal: ({ visible, children }: any) => visible ? <div role="dialog">{children}</div> : null,
  Pressable: ({ children, onPress, disabled, accessibilityLabel }: any) => <button aria-label={accessibilityLabel} disabled={disabled} onClick={onPress}>{children}</button>,
}));

describe("product report dialog", () => {
  afterEach(cleanup);
  beforeEach(() => { mocks.allowed = true; mocks.submit.mockReset(); mocks.gate.mockClear(); });
  it("routes unauthenticated users through the login gate", () => {
    mocks.allowed = false;
    render(<ProductReportButton groupBuyId="product" productName="공구 상품" />);
    fireEvent.click(screen.getByText("정보가 달라요"));
    expect(mocks.gate).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("retains the selected reason after failure and lets the user retry", async () => {
    mocks.submit.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ id: "report", status: "OPEN" });
    render(<ProductReportButton groupBuyId="product" productName="공구 상품" />);
    fireEvent.click(screen.getByText("정보가 달라요"));
    fireEvent.click(screen.getByText("가격이 달라요"));
    fireEvent.click(screen.getByText("신고 보내기"));
    await screen.findByText("신고를 보내지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
    fireEvent.click(screen.getByText("신고 보내기"));
    await screen.findByText("신고를 접수했어요");
    expect(mocks.submit).toHaveBeenLastCalledWith("owner", "product", "PRICE");
  });
  it("prevents duplicate submissions while the request is pending", async () => {
    mocks.submit.mockReturnValue(new Promise(() => {}));
    render(<ProductReportButton groupBuyId="product" productName="공구 상품" />);
    fireEvent.click(screen.getByText("정보가 달라요"));
    fireEvent.click(screen.getByText("품절됐어요"));
    fireEvent.click(screen.getByText("신고 보내기"));
    fireEvent.click(screen.getByText("보내는 중…"));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(1));
  });
});

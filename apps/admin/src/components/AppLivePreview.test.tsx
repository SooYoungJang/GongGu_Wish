import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppLivePreview, type AppLivePreviewDeal } from "./AppLivePreview";

const activeDeal: AppLivePreviewDeal = {
  productName: "제주 감귤 3kg",
  brandName: "귤밭상회",
  category: "과일",
  startDate: "2026-07-01",
  endDate: "2026-07-31",
  discountInfo: "첫 구매 20% 할인",
  priceKrw: 25900,
  summary: "산지에서 바로 보내는 당도 높은 제철 감귤입니다.",
  imageUrl: "https://example.com/tangerine.jpg",
  mediaCount: 4,
  isHomeBanner: true,
  homeBannerStartDate: "2026-01-01",
  homeBannerEndDate: "2099-12-31",
};

afterEach(() => {
  cleanup();
});

describe("AppLivePreview", () => {
  it("renders three accessible preview tabs with the home banner selected by default", () => {
    render(<AppLivePreview deal={activeDeal} />);

    expect(screen.getByRole("tablist", { name: "앱 라이브 프리뷰" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "홈 배너", selected: true })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "공구 카드", selected: false })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "상세 화면", selected: false })).toBeTruthy();
    expect(screen.getByRole("tabpanel", { name: "홈 배너" })).toBeTruthy();
  });

  it("switches between home, card, and detail previews", async () => {
    const user = userEvent.setup();
    render(<AppLivePreview deal={activeDeal} />);

    await user.click(screen.getByRole("tab", { name: "공구 카드" }));
    expect(screen.getByRole("tabpanel", { name: "공구 카드" })).toBeTruthy();
    expect(screen.getByText("마감 2026-07-31")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "상세 화면" }));
    expect(screen.getByRole("tabpanel", { name: "상세 화면" })).toBeTruthy();
    expect(screen.getByText("구매하러 가기")).toBeTruthy();
    expect(screen.getByText(activeDeal.summary)).toBeTruthy();
  });

  it("supports keyboard arrow navigation across preview tabs", async () => {
    const user = userEvent.setup();
    render(<AppLivePreview deal={activeDeal} />);

    await user.tab();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "공구 카드", selected: true })).toBeTruthy();
    expect(screen.getByRole("tabpanel", { name: "공구 카드" })).toBeTruthy();
  });

  it("updates displayed product and price immediately when deal props change", () => {
    const { rerender } = render(<AppLivePreview deal={activeDeal} />);

    expect(screen.getByText("제주 감귤 3kg")).toBeTruthy();
    expect(screen.getByText("25,900원")).toBeTruthy();

    rerender(
      <AppLivePreview
        deal={{
          ...activeDeal,
          productName: "강릉 초당두부 세트",
          priceKrw: 13800,
        }}
      />
    );

    expect(screen.getByText("강릉 초당두부 세트")).toBeTruthy();
    expect(screen.getByText("13,800원")).toBeTruthy();
  });

  it("mirrors the app home banner promotion copy", () => {
    render(<AppLivePreview deal={activeDeal} />);

    expect(screen.getByText("1 / 1")).toBeTruthy();
    expect(screen.getByText("20%")).toBeTruthy();
    expect(screen.getByText("25,900원")).toBeTruthy();
  });

  it("clearly marks home banner disabled and out-of-period states", () => {
    render(
      <AppLivePreview
        deal={{
          ...activeDeal,
          isHomeBanner: false,
          homeBannerStartDate: "2020-01-01",
          homeBannerEndDate: "2020-01-31",
        }}
      />
    );

    expect(screen.getAllByText("홈 배너 미노출").length).toBeGreaterThan(0);
    expect(screen.getAllByText("배너 기간 종료").length).toBeGreaterThan(0);
  });
});

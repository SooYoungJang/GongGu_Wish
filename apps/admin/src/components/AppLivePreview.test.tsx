import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppLivePreview, type AppLivePreviewDeal } from "./AppLivePreview";

const activeDeal: AppLivePreviewDeal = {
  productName: "제주 감귤 3kg",
  brandName: "귤밭상회",
  category: "과일",
  startDate: "2000-01-01",
  endDate: "2099-12-31",
  discountInfo: "첫 구매 20% 할인",
  priceKrw: 25900,
  summary: "산지에서 바로 보내는 당도 높은 제철 감귤입니다.",
  imageUrl: "https://example.com/tangerine.jpg",
  mediaCount: 4,
  isHomeBanner: true,
  homeBannerStartDate: "2000-01-01",
  homeBannerEndDate: "2099-12-31",
};

afterEach(() => {
  cleanup();
});

describe("AppLivePreview", () => {
  it("renders three accessible preview tabs with the home banner selected by default", () => {
    render(<AppLivePreview deal={activeDeal} />);

    expect(
      screen.getByRole("tablist", { name: "앱 라이브 프리뷰" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "홈 배너", selected: true }),
    ).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "공구 카드", selected: false }),
    ).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "상세 화면", selected: false }),
    ).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "홈 주간 공구" })).toBeNull();
    expect(screen.getByRole("tabpanel", { name: "홈 배너" })).toBeTruthy();
  });

  it("uses the RN home weekly card surface for the unified deal card", async () => {
    const user = userEvent.setup();
    render(<AppLivePreview deal={activeDeal} />);

    await user.click(screen.getByRole("tab", { name: "공구 카드" }));
    expect(screen.getByRole("tabpanel", { name: "공구 카드" })).toBeTruthy();
    expect(screen.getByText("첫 구매 20% 할인")).toBeTruthy();
    const dealCard = screen.getByRole("article", {
      name: "공구 카드 미리보기",
    });
    expect(
      dealCard.querySelector(".app-live-preview__deal-card-brand")?.textContent,
    ).toBe("귤밭상회");
    expect(
      dealCard.querySelector(".app-live-preview__deal-card-deadline-badge")
        ?.textContent,
    ).toContain("일 남음");
    expect(
      dealCard.querySelector(".app-live-preview__deal-card-title")?.textContent,
    ).toBe("제주 감귤 3kg");
    expect(
      dealCard.querySelector(".app-live-preview__deal-card-price")?.textContent,
    ).toBe("가격 25,900원");
    expect(
      dealCard.querySelector(".app-live-preview__deal-card-price-value")
        ?.textContent,
    ).toBe("25,900원");

    await user.click(screen.getByRole("tab", { name: "상세 화면" }));
    expect(screen.getByRole("tabpanel", { name: "상세 화면" })).toBeTruthy();
    expect(screen.getByText("구매하러 가기")).toBeTruthy();
    expect(screen.getByText(activeDeal.summary)).toBeTruthy();
  });

  it("shows 마감 instead of a negative countdown for expired deals", async () => {
    const user = userEvent.setup();
    render(
      <AppLivePreview
        deal={{
          ...activeDeal,
          endDate: "2000-01-01",
        }}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "공구 카드" }));

    const dealCard = screen.getByRole("article", {
      name: "공구 카드 미리보기",
    });
    expect(
      dealCard.querySelector(".app-live-preview__deal-card-deadline-badge")
        ?.textContent,
    ).toBe("마감");
  });

  it("supports keyboard arrow navigation across preview tabs", async () => {
    const user = userEvent.setup();
    render(<AppLivePreview deal={activeDeal} />);

    await user.tab();
    await user.keyboard("{ArrowRight}");

    expect(
      screen.getByRole("tab", { name: "공구 카드", selected: true }),
    ).toBeTruthy();
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
      />,
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

  it("uses the RN discount rule instead of treating product composition as a sale", () => {
    render(
      <AppLivePreview
        deal={{
          ...activeDeal,
          discountInfo: "100% 천연 원료 · 공구가 39,000원",
        }}
      />,
    );

    const homeBanner = screen.getByRole("article", {
      name: "홈 배너 미리보기",
    });
    expect(homeBanner.textContent).not.toContain("100%");
    expect(homeBanner.textContent).toContain("공구 진행 중");
    expect(homeBanner.textContent).toContain("25,900원");
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
      />,
    );

    expect(screen.getAllByText("홈 배너 미노출").length).toBeGreaterThan(0);
    expect(screen.getAllByText("배너 기간 종료").length).toBeGreaterThan(0);
    expect(screen.getByText("홈에 노출되지 않음")).toBeTruthy();
    expect(screen.queryByRole("article", { name: "홈 배너 미리보기" })).toBeNull();
  });

  it("hides a future banner from the home preview until it becomes eligible", () => {
    render(
      <AppLivePreview
        deal={{
          ...activeDeal,
          homeBannerStartDate: "2099-01-01",
          homeBannerEndDate: "2099-01-31",
        }}
      />,
    );

    expect(screen.getByText("홈에 노출되지 않음")).toBeTruthy();
    expect(screen.getByText("배너 예약")).toBeTruthy();
  });
});

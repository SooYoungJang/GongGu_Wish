import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HomePage, { metadata } from "./page";

afterEach(cleanup);

describe("home acquisition", () => {
  it("offers verified Android installation links at the hero and final CTA", () => {
    render(<HomePage />);
    const links = screen.getAllByRole("link", { name: "Google Play에서 앱 설치" });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link.getAttribute("href")).toBe("https://play.google.com/store/apps/details?id=com.gonggu.wish");
    }
    expect(screen.getByText("Android 앱 · Google Play로 이동합니다")).toBeTruthy();
  });

  it("retains a web-first path and explains external purchasing", () => {
    render(<HomePage />);
    expect(screen.getByRole("link", { name: "웹에서 캘린더 먼저 보기" }).getAttribute("href")).toBe("/calendar");
    expect(screen.getByText(/구매는 판매자의 외부 페이지에서 진행/)).toBeTruthy();
    expect(screen.getByRole("list").children).toHaveLength(3);
  });

  it("uses the Korean brand without unverified traction or accuracy claims", () => {
    const { container } = render(<HomePage />);
    expect(screen.getByRole("link", { name: "공구위시" }).getAttribute("href")).toBe("/");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    for (const claim of ["50+", "200+", "99%", "최저가", "실시간", "App Store"]) {
      expect(container.textContent).not.toContain(claim);
    }
  });

  it("sets homepage-only canonical and Korean share metadata", () => {
    expect(metadata.title).toBe("공구위시 - 인스타그램 공동구매 캘린더");
    expect(metadata.alternates?.canonical).toBe("https://gongguwish.com/");
    expect(metadata.openGraph).toMatchObject({
      title: metadata.title,
      description: metadata.description,
      url: "https://gongguwish.com/",
      siteName: "공구위시",
      locale: "ko_KR",
      type: "website",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary", title: metadata.title });
  });
});

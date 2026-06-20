import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HomePage from "./page";
import PublicLayout from "./(public)/layout";

const navLinks = [
  { name: "캘린더", href: "/calendar" },
  { name: "제보하기", href: "/submit" },
  { name: "관리자", href: "/admin" },
];

afterEach(cleanup);

describe("public navigation", () => {
  it("shows the same primary navigation on the home page", () => {
    render(<HomePage />);

    for (const link of navLinks) {
      expect(screen.getByRole("link", { name: link.name }).getAttribute("href")).toBe(link.href);
    }
  });

  it("keeps public layout links readable on light backgrounds", () => {
    render(
      <PublicLayout>
        <div>content</div>
      </PublicLayout>
    );

    expect(screen.getByRole("link", { name: "GongGu Calendar" }).getAttribute("class")).toContain("text-primary-700");
    expect(screen.getByRole("link", { name: "캘린더" }).getAttribute("class")).toContain("text-neutral-800");
    expect(screen.getByRole("link", { name: "제보하기" }).getAttribute("class")).toContain("text-neutral-800");
    expect(screen.getByRole("link", { name: "관리자" }).getAttribute("class")).toContain("bg-primary-700");
  });
});

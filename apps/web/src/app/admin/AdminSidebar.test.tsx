import type { AnchorHTMLAttributes, PropsWithChildren } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminSidebar from "./AdminSidebar";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/group-buys",
}));

afterEach(cleanup);

describe("AdminSidebar", () => {
  it("separates user submissions from automatic collection review", () => {
    render(<AdminSidebar sidebarOpen={false} onSidebarToggle={vi.fn()} />);

    expect(screen.getByRole("link", { name: "제보 검수" }).getAttribute("href")).toBe(
      "/admin/submissions",
    );
    expect(screen.getByRole("link", { name: "자동 수집 검수" }).getAttribute("href")).toBe(
      "/admin/group-buys",
    );
  });
});

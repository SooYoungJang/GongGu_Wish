import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { formatRelativeTime, formatDateTime, getStatusColor, isValidUrl, normalizeInstagramUsername, truncate } from "@gonggu/shared/utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("shared utils in web context", () => {
  describe("formatRelativeTime", () => {
    it("returns 종료됨 for past dates", () => {
      const past = new Date(Date.now() - 86400000).toISOString();
      expect(formatRelativeTime(past)).toBe("종료됨");
    });

    it("returns 오늘 마감 for today", () => {
      expect(formatRelativeTime(new Date().toISOString())).toBe("오늘 마감");
    });

    it("returns 내일 마감 for tomorrow", () => {
      expect(formatRelativeTime(new Date(Date.now() + 86400000).toISOString())).toBe("내일 마감");
    });

    it("returns N일 남음 for within a week", () => {
      expect(formatRelativeTime(new Date(Date.now() + 3 * 86400000).toISOString())).toBe("3일 남음");
    });

    it("returns formatted date for beyond a week", () => {
      const result = formatRelativeTime(new Date(Date.now() + 10 * 86400000).toISOString());
      expect(result).toContain("월");
      expect(result).toContain("일");
    });

    it("returns 미정 for null/undefined", () => {
      expect(formatRelativeTime(null)).toBe("미정");
      expect(formatRelativeTime(undefined)).toBe("미정");
    });

    it("returns 날짜 오류 for invalid date", () => {
      expect(formatRelativeTime("invalid")).toBe("날짜 오류");
    });
  });

  describe("formatDateTime", () => {
    it("formats date with time", () => {
      const result = formatDateTime("2026-06-20T10:30:00.000Z");
      expect(result).toContain("2026");
      expect(result).toContain("6월");
      expect(result).toContain("20");
      expect(result).toContain(":");
    });

    it("returns 미정 for null", () => {
      expect(formatDateTime(null)).toBe("미정");
    });
  });

  describe("isValidUrl", () => {
    it("returns true for valid http/https URLs", () => {
      expect(isValidUrl("http://example.com")).toBe(true);
      expect(isValidUrl("https://example.com/path")).toBe(true);
    });

    it("returns false for invalid URLs", () => {
      expect(isValidUrl("not-a-url")).toBe(false);
      expect(isValidUrl("")).toBe(false);
    });
  });

  describe("normalizeInstagramUsername", () => {
    it("removes @ prefix", () => {
      expect(normalizeInstagramUsername("@testuser")).toBe("testuser");
    });

    it("trims whitespace", () => {
      expect(normalizeInstagramUsername("  @testuser  ")).toBe("testuser");
    });

    it("handles username without @", () => {
      expect(normalizeInstagramUsername("testuser")).toBe("testuser");
    });
  });

  describe("truncate", () => {
    it("returns original if shorter than maxLength", () => {
      expect(truncate("short", 10)).toBe("short");
    });

    it("truncates and adds ellipsis if longer", () => {
      expect(truncate("this is a very long text", 10)).toBe("this is...");
    });

    it("handles exact length", () => {
      expect(truncate("exact", 5)).toBe("exact");
    });
  });

  describe("getStatusColor", () => {
    it("returns correct color for each status", () => {
      expect(getStatusColor("PENDING")).toBe("bg-status-pending-bg text-status-pending-text border-status-pending-border");
      expect(getStatusColor("REVIEW_REQUIRED")).toBe("bg-status-review-bg text-status-review-text border-status-review-border");
      expect(getStatusColor("APPROVED")).toBe("bg-status-approved-bg text-status-approved-text border-status-approved-border");
      expect(getStatusColor("REJECTED")).toBe("bg-status-rejected-bg text-status-rejected-text border-status-rejected-border");
      expect(getStatusColor("EXPIRED")).toBe("bg-status-duplicate-bg text-status-duplicate-text border-status-duplicate-border");
    });

    it("returns default for unknown status", () => {
      expect(getStatusColor("UNKNOWN")).toBe("bg-status-duplicate-bg text-status-duplicate-text border-status-duplicate-border");
    });
  });
});

describe("CalendarPage component", () => {
  const mockUseGroupBuys = vi.hoisted(() => vi.fn());
  const mockUseCalendarGroupBuys = vi.hoisted(() => vi.fn());
  const mockState = {
    data: undefined,
    isLoading: false,
    isError: false,
  };

  vi.mock("@gonggu/shared/hooks", () => ({
    useGroupBuys: (...args: unknown[]) => mockUseGroupBuys(...args),
    useCalendarGroupBuys: (...args: unknown[]) => mockUseCalendarGroupBuys(...args),
  }));

  beforeEach(() => {
    mockState.data = undefined;
    mockState.isLoading = false;
    mockState.isError = false;
    mockUseGroupBuys.mockReturnValue(mockState);
    mockUseCalendarGroupBuys.mockReturnValue(mockState);
  });

  afterEach(cleanup);

  it("renders loading spinner when loading", async () => {
    mockState.isLoading = true;
    mockState.isError = false;

    const { default: CalendarPage } = await import("./app/(public)/calendar/page");
    const { container } = render(<CalendarPage />);

    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("renders error message when error", async () => {
    mockState.isLoading = false;
    mockState.isError = true;

    const { default: CalendarPage } = await import("./app/(public)/calendar/page");
    render(<CalendarPage />);

    expect(screen.getByText(/데이터 로드에 실패했습니다/)).not.toBeNull();
  });

  it("renders empty state with submit link when no data", async () => {
    const { default: CalendarPage } = await import("./app/(public)/calendar/page");
    render(<CalendarPage />);

    expect(screen.getByText("표시할 공구가 없습니다.")).not.toBeNull();
    const link = screen.getByRole("link", { name: "제보 페이지에서 공구 제보하기" });
    expect(link.getAttribute("href")).toBe("/submit");
  });
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};
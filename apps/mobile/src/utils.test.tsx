import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGroupBuys } from "@gonggu/shared/hooks";
import { formatRelativeTime, formatDateTime, getStatusColor, isValidUrl, normalizeInstagramUsername, truncate } from "@gonggu/shared/utils";
import { describe, it, expect, beforeEach, vi } from "vitest";

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

describe("shared utils in mobile context", () => {
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

describe("useGroupBuys hook", () => {
  const wrapper = createWrapper();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns query key and query function", () => {
    const { result } = renderHook(() => useGroupBuys(), { wrapper });

    expect(result.current).toBeDefined();
    expect(typeof result.current.refetch).toBe("function");
  });
});
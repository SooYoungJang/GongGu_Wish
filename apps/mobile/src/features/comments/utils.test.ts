import { describe, expect, it } from "vitest";

import {
  commentPlaceholder,
  formatCommentAge,
  validateCommentBody,
  visualCommentIndent,
} from "./utils";

describe("comment utilities", () => {
  it("validates trimmed plain text and the 500-character limit", () => {
    expect(validateCommentBody("  좋은 상품이에요  ")).toBeNull();
    expect(validateCommentBody("   ")).toBe("댓글 내용을 입력해 주세요.");
    expect(validateCommentBody("<script>alert(1)</script>")).toContain("HTML");
    expect(validateCommentBody("https://example.com")).toContain("외부 링크");
    expect(validateCommentBody("a".repeat(501))).toContain("500");
  });

  it("caps visual indentation while retaining unlimited logical depth", () => {
    expect(visualCommentIndent(0)).toBe(0);
    expect(visualCommentIndent(3)).toBe(48);
    expect(visualCommentIndent(99)).toBe(48);
  });

  it("uses moderation-aware placeholders", () => {
    expect(commentPlaceholder("hidden")).toContain("숨겨진");
    expect(commentPlaceholder("deleted")).toContain("삭제된");
  });

  it("formats comment timestamps as relative Korean ages", () => {
    const now = Date.parse("2026-08-20T00:00:00.000Z");
    expect(formatCommentAge("2026-08-19T23:59:45.000Z", now)).toBe("방금 전");
    expect(formatCommentAge("2026-08-19T23:30:00.000Z", now)).toBe("30분 전");
    expect(formatCommentAge("2026-08-19T12:00:00.000Z", now)).toBe("12시간 전");
    expect(formatCommentAge("2026-08-15T00:00:00.000Z", now)).toBe("5일 전");
    expect(formatCommentAge("2026-06-20T00:00:00.000Z", now)).toBe("2개월 전");
  });
});

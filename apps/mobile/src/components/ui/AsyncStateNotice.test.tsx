import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { AsyncStateNotice } from "./AsyncStateNotice";
import { ThemeProvider } from "../../context/ThemeContext";

vi.mock("../../design/useCommerceTheme", () => ({
  useCommerceTheme: () => ({
    colors: {
      accent: "#F0445E",
      bg: "#FFFFFF",
      border: "#E5E7EB",
      error: "#EF4444",
      errorSoft: "#FEF2F2",
      inverse: "#FFFFFF",
      muted: "#6B7280",
      panelBg: "#F8FAFC",
      text: "#111827",
      warning: "#A16207",
      warningSoft: "#FFF7E6",
    },
  }),
}));

describe("AsyncStateNotice", () => {
  it("announces errors assertively and exposes a busy retry action", () => {
    const onRetry = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <AsyncStateNotice
            isRetrying
            message="네트워크 연결을 확인해주세요."
            onRetry={onRetry}
            title="정보를 불러오지 못했어요"
            variant="error"
          />
        </ThemeProvider>,
      );
    });

    const notice = renderer!.root.findByProps({
      testID: "async-state-notice",
    });
    const retry = renderer!.root.findByProps({
      accessibilityLabel: "다시 불러오기",
    });

    expect(notice.props.accessibilityLiveRegion).toBe("assertive");
    expect(notice.props.accessibilityRole).toBe("alert");
    expect(retry.props.accessibilityState).toEqual({
      busy: true,
      disabled: true,
    });
  });

  it("announces stale and empty states politely", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <AsyncStateNotice
            message="저장된 정보를 표시하고 있어요."
            title="최신 정보를 확인하지 못했어요"
            variant="stale"
          />
        </ThemeProvider>,
      );
    });

    expect(
      renderer!.root.findByProps({ testID: "async-state-notice" }).props
        .accessibilityLiveRegion,
    ).toBe("polite");
  });
});

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { RankingBasisBar } from "./RankingBasisBar";
import { ThemeProvider } from "../../context/ThemeContext";

vi.mock("react-native", () => {
  const ReactMock = require("react");
  const passthrough =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  return {
    StyleSheet: { create: (styles: unknown) => styles },
    Text: passthrough("Text"),
    View: passthrough("View"),
    useColorScheme: () => "light",
  };
});

function flattenText(
  node:
    | TestRenderer.ReactTestRendererJSON
    | TestRenderer.ReactTestRendererJSON[]
    | null,
): string {
  if (!node) return "";
  if (Array.isArray(node)) return node.map(flattenText).join(" ");
  return (
    node.children
      ?.map((child) => (typeof child === "string" ? child : flattenText(child)))
      .join(" ") ?? ""
  );
}

describe("RankingBasisBar", () => {
  it("explains the selected period, sort, category, rolling window, and metrics", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ThemeProvider>
          <RankingBasisBar
            category="all"
            period="weekly"
            sort="popular"
            updatedAt={Date.now()}
          />
        </ThemeProvider>,
      );
    });

    const text = flattenText(renderer!.toJSON()).replace(/\s+/g, " ");
    const basis = renderer!.root.findByProps({ testID: "ranking-basis-bar" });

    expect(text).toContain("최근 7일 롤링 집계");
    expect(text).toContain("이번 주");
    expect(text).toContain("인기 공구");
    expect(text).toContain("전체");
    expect(text).toContain("조회·저장·알림·검색 클릭");
    expect(basis.props.accessibilityLabel).toContain("최근 7일 롤링 집계");
  });
});

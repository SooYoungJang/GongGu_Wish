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
  it("explains the ranking inputs without exposing a popularity score", () => {
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

    expect(text).toContain("조회·저장·알림·상세 진입 반응을 반영한 순위");
    expect(text).toContain("최근 7일 기준");
    expect(text).toContain("업데이트");
    expect(text).not.toContain("인기지수");
    expect(text).not.toContain("최고점");
    expect(text).not.toContain("롤링 집계");
    expect(basis.props.accessibilityLabel).toContain("최근 7일 롤링 집계");
    expect(basis.props.accessibilityLabel).toContain(
      "조회, 저장, 알림, 상세 진입 반응 반영",
    );
    expect(basis.props.accessibilityLabel).not.toContain("인기지수");
    expect(basis.props.accessibilityLabel).not.toContain("최고점");
    expect(basis.props.accessibilityLabel).toContain("업데이트");
    expect(basis.props.accessibilityLabel).toContain("전체 카테고리");
  });
});

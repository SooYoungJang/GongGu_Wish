import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { RankingCategoryChips } from "./RankingCategoryChips";
import { ThemeProvider } from "../../context/ThemeContext";
import {
  RANKING_CATEGORIES,
  RANKING_CATEGORY_LABELS,
} from "../../features/ranking/types";

vi.mock("react-native", () => {
  const ReactMock = require("react");
  const passthrough =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  return {
    Pressable: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement("Pressable", props, children),
    ScrollView: passthrough("ScrollView"),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: passthrough("Text"),
    View: passthrough("View"),
    useColorScheme: () => "light",
  };
});

function withTheme(ui: React.ReactElement) {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

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

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style))
    return Object.assign({}, ...style.map(flattenStyle));
  return style && typeof style === "object"
    ? (style as Record<string, unknown>)
    : {};
}

describe("RankingCategoryChips", () => {
  it("renders every category in one horizontal rail and selects without a dialog", () => {
    const onChange = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <RankingCategoryChips
            mode="category"
            value="all"
            categories={RANKING_CATEGORIES}
            sort="popular"
            onChange={onChange}
            onChangeSort={vi.fn()}
          />,
        ),
      );
    });

    const initialText = flattenText(renderer!.toJSON()).replace(/\s+/g, " ");
    expect(initialText).toContain("전체");
    expect(initialText).toContain("뷰티");
    expect(initialText).toContain("여행");
    expect(
      renderer!.root.findAllByProps({ testID: "ranking-category-dialog" }),
    ).toHaveLength(0);

    const rail = renderer!.root.findByProps({
      testID: "ranking-category-scroll",
    });
    expect(rail.props.horizontal).toBe(true);
    expect(rail.props.showsHorizontalScrollIndicator).toBe(false);

    const beautyOption = renderer!.root.findByProps({
      accessibilityLabel: "뷰티 카테고리",
    });
    act(() => beautyOption.props.onPress());

    expect(onChange).toHaveBeenCalledWith("beauty");
    expect(
      renderer!.root.findAllByProps({ testID: "ranking-category-dialog" }),
    ).toHaveLength(0);
  });

  it("keeps every category visible and gives each chip a scalable touch target", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <RankingCategoryChips
            value="sports"
            categories={RANKING_CATEGORIES}
            sort="popular"
            onChange={vi.fn()}
            onChangeSort={vi.fn()}
          />,
        ),
      );
    });

    const text = flattenText(renderer!.toJSON()).replace(/\s+/g, " ");
    const sports = renderer!.root.findByProps({
      accessibilityLabel: "스포츠 카테고리",
    });
    const sportsStyle = flattenStyle(sports.props.style);

    expect(text).toContain("전체");
    expect(text).toContain("스포츠");
    expect(text).toContain("여행");
    expect(RANKING_CATEGORY_LABELS.baby).toBe("육아");
    expect(sports.props.accessibilityState).toEqual({ selected: true });
    expect(sportsStyle.height).toBeUndefined();
    expect(sportsStyle.minHeight).toBeGreaterThanOrEqual(44);
  });

  it("uses scalable sort controls instead of a fixed chip height", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        withTheme(
          <RankingCategoryChips
            mode="sort"
            value="all"
            categories={RANKING_CATEGORIES}
            sort="popular"
            onChange={vi.fn()}
            onChangeSort={vi.fn()}
          />,
        ),
      );
    });

    const popular = renderer!.root.findByProps({
      accessibilityLabel: "인기 공구 정렬",
    });
    const style = flattenStyle(popular.props.style);

    expect(style.height).toBeUndefined();
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });

  it("renders sort and category controls as independent filter layers", () => {
    let sortRenderer: TestRenderer.ReactTestRenderer;
    let categoryRenderer: TestRenderer.ReactTestRenderer;

    act(() => {
      sortRenderer = TestRenderer.create(
        withTheme(
          <RankingCategoryChips
            mode="sort"
            value="all"
            categories={RANKING_CATEGORIES}
            sort="popular"
            onChange={vi.fn()}
            onChangeSort={vi.fn()}
          />,
        ),
      );
      categoryRenderer = TestRenderer.create(
        withTheme(
          <RankingCategoryChips
            mode="category"
            value="all"
            categories={RANKING_CATEGORIES}
            sort="popular"
            onChange={vi.fn()}
            onChangeSort={vi.fn()}
          />,
        ),
      );
    });

    const sortText = flattenText(sortRenderer!.toJSON()).replace(/\s+/g, " ");
    const categoryText = flattenText(categoryRenderer!.toJSON()).replace(
      /\s+/g,
      " ",
    );

    expect(sortText).toContain("급상승");
    expect(sortText).not.toContain("여행");
    expect(categoryText).toContain("전체");
    expect(categoryText).toContain("여행");
    expect(categoryText).not.toContain("급상승");
  });
});

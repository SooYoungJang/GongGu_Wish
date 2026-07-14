import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { PriceText } from "./PriceText";

vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: unknown) => styles },
}));

vi.mock("./SText", () => ({
  SText: ({ children, ...props }: { children?: React.ReactNode }) => {
    const ReactMock = require("react");
    return ReactMock.createElement("SText", props, children);
  },
}));

vi.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({ colors: { textPrimary: "#111827" } }),
}));

function flattenText(
  node:
    | TestRenderer.ReactTestRendererJSON
    | TestRenderer.ReactTestRendererJSON[]
    | null,
): string {
  if (!node) return "";
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return (
    node.children
      ?.map((child) => (typeof child === "string" ? child : flattenText(child)))
      .join("") ?? ""
  );
}

describe("PriceText", () => {
  it("keeps the price label regular and makes only the numeric value bold", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<PriceText priceKrw={25900} />);
    });

    expect(flattenText(renderer!.toJSON())).toBe("가격 25,900원");
    const value = renderer!.root
      .findAllByType("SText" as unknown as React.ElementType)
      .at(-1);
    expect(value?.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontWeight: "900" })]),
    );
  });

  it("renders an explicit unavailable state for invalid or missing values", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<PriceText priceKrw="25900" />);
    });

    expect(flattenText(renderer!.toJSON())).toBe("가격 미정");
  });
});

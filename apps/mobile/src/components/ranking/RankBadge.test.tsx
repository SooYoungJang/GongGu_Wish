import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "../../context/ThemeContext";
import {
  commerceDarkColors,
  commerceLightColors,
} from "../../design/commerce";
import { RankBadge } from "./RankBadge";

const colorSchemeMock = vi.hoisted(() => ({
  value: "light" as "light" | "dark",
}));

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
    useColorScheme: () => colorSchemeMock.value,
  };
});

function renderRankBadge(rank: number, colorScheme: "light" | "dark") {
  colorSchemeMock.value = colorScheme;
  let renderer: TestRenderer.ReactTestRenderer;

  act(() => {
    renderer = TestRenderer.create(
      <ThemeProvider>
        <RankBadge rank={rank} />
      </ThemeProvider>,
    );
  });

  return renderer!.root.findByProps({ accessibilityLabel: `${rank}위` });
}

describe("RankBadge", () => {
  it.each([
    ["light", commerceLightColors],
    ["dark", commerceDarkColors],
  ] as const)(
    "keeps first place yellow and gives third place a distinct accent color in %s mode",
    (colorScheme, colors) => {
      const firstPlace = renderRankBadge(1, colorScheme);
      const thirdPlace = renderRankBadge(3, colorScheme);

      expect(firstPlace.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            backgroundColor: colors.yellow,
          }),
        ]),
      );
      expect(thirdPlace.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            backgroundColor: colors.accent,
          }),
        ]),
      );
    },
  );
});

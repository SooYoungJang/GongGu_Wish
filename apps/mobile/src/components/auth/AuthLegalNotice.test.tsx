import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nativeMocks = vi.hoisted(() => ({
  alert: vi.fn(),
  openURL: vi.fn(),
}));

vi.mock("react-native", () => {
  const ReactMock = require("react");
  const passthrough =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  return {
    Alert: { alert: nativeMocks.alert },
    Linking: { openURL: nativeMocks.openURL },
    Pressable: ({ children, onPress, ...props }: any) =>
      ReactMock.createElement("Pressable", { onPress, ...props }, children),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: passthrough("Text"),
    View: passthrough("View"),
  };
});

vi.mock("../../design/useCommerceTheme", () => ({
  useCommerceTheme: () => ({
    colors: {
      accent: "#ff5a5f",
      border: "#dddddd",
      muted: "#777777",
      softBg: "#f7f7f7",
      text: "#111111",
    },
  }),
}));

import { AuthLegalNotice } from "./AuthLegalNotice";

function renderNotice() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<AuthLegalNotice />);
  });
  return renderer;
}

describe("AuthLegalNotice", () => {
  beforeEach(() => {
    nativeMocks.alert.mockReset();
    nativeMocks.openURL.mockReset().mockResolvedValue(true);
  });

  it("explains the 14+ confirmation without a required checkbox", () => {
    const renderer = renderNotice();
    const text = JSON.stringify(renderer.toJSON());

    expect(text).toContain("만 14세 이상");
    expect(text).toContain("계속하면 만 14세 이상이며");
    expect(text).toContain("커뮤니티 이용규칙");
    expect(text).toContain("tturrr10@gmail.com");
    expect(
      renderer.root.findAllByProps({ accessibilityRole: "checkbox" }),
    ).toHaveLength(0);
  });

  it("opens the published terms and privacy documents", async () => {
    const renderer = renderNotice();

    await act(async () => {
      await renderer.root
        .findByProps({ accessibilityLabel: "서비스 이용약관 열기" })
        .props.onPress();
      await renderer.root
        .findByProps({ accessibilityLabel: "개인정보처리방침 열기" })
        .props.onPress();
    });

    expect(nativeMocks.openURL).toHaveBeenNthCalledWith(
      1,
      "https://gongguwish.com/terms",
    );
    expect(nativeMocks.openURL).toHaveBeenNthCalledWith(
      2,
      "https://gongguwish.com/privacy",
    );
  });

  it("gives each policy link a full-size touch target", () => {
    const renderer = renderNotice();
    const links = renderer.root.findAll(
      (node) =>
        typeof node.type === "string" &&
        node.props.accessibilityRole === "link",
    );

    expect(links).toHaveLength(2);
    expect(links[0].props.style.minHeight).toBeGreaterThanOrEqual(44);
    expect(links[1].props.style.minHeight).toBeGreaterThanOrEqual(44);
  });

  it("shows a readable error when a policy document cannot open", async () => {
    nativeMocks.openURL.mockRejectedValueOnce(new Error("blocked"));
    const renderer = renderNotice();

    await act(async () => {
      await renderer.root
        .findByProps({ accessibilityLabel: "서비스 이용약관 열기" })
        .props.onPress();
    });

    expect(nativeMocks.alert).toHaveBeenCalledWith(
      "문서를 열 수 없어요",
      "잠시 후 다시 시도해주세요.",
    );
  });
});

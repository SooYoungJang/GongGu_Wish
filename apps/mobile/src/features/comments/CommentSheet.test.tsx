import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  listCommentRoots: vi.fn(),
  listCommentChildren: vi.fn(),
  createComment: vi.fn(),
  setCommentLike: vi.fn(),
  reportComment: vi.fn(),
  blockUserFromComment: vi.fn(),
}));

const queryResult = vi.hoisted(() => ({
  data: { items: [], nextCursor: null, liveRanking: false },
  isError: false,
  isLoading: false,
  refetch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("react-native", () => {
  const ReactMock = require("react");
  const passthrough =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  return {
    ActivityIndicator: passthrough("ActivityIndicator"),
    Alert: { alert: vi.fn() },
    FlatList: ({ children, ListEmptyComponent, ListFooterComponent, ...props }: any) =>
      ReactMock.createElement(
        "FlatList",
        props,
        children,
        ListEmptyComponent,
        ListFooterComponent,
      ),
    KeyboardAvoidingView: passthrough("KeyboardAvoidingView"),
    Platform: { OS: "ios" },
    Pressable: ({ children, onPress, ...props }: any) =>
      ReactMock.createElement("Pressable", { onPress, ...props }, children),
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    TextInput: passthrough("TextInput"),
    View: passthrough("View"),
  };
});

vi.mock("@expo/vector-icons", () => ({
  Ionicons: ({ name }: { name: string }) =>
    React.createElement("Ionicons", { name }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => queryResult,
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock("../../hooks/useAuthGate", () => ({
  useAuthGate: () => ({ isAuthenticated: true, requireAuth: vi.fn(() => true) }),
}));

vi.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({
    colors: {
      bg: "#fff",
      border: "#ddd",
      primary: "#f05",
      textInverse: "#fff",
      textPrimary: "#111",
      textSecondary: "#555",
      textTertiary: "#999",
    },
  }),
}));

vi.mock("../../components/ui/SText", () => ({
  SText: ({ children, ...props }: any) =>
    React.createElement("Text", props, children),
}));

vi.mock("./api", () => apiMocks);

import { CommentSheet } from "./CommentSheet";

describe("CommentSheet", () => {
  beforeEach(() => {
    apiMocks.listCommentRoots.mockReset().mockResolvedValue({
      items: [],
      nextCursor: null,
      liveRanking: false,
    });
    apiMocks.listCommentChildren.mockReset().mockResolvedValue({
      items: [],
      nextCursor: null,
      liveRanking: false,
    });
    apiMocks.createComment.mockReset();
    apiMocks.setCommentLike.mockReset();
    apiMocks.reportComment.mockReset();
    apiMocks.blockUserFromComment.mockReset();
  });

  it("does not ask for community rules again in the comment composer", async () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <CommentSheet groupBuyId="deal-1" onClose={vi.fn()} visible />,
      );
      await Promise.resolve();
    });

    expect(
      renderer.root.findAllByProps({ accessibilityRole: "checkbox" }),
    ).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).not.toContain(
      "커뮤니티 이용규칙에 동의합니다",
    );
  });
});

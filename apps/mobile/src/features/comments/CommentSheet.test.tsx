import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CommentView } from "./types";

const apiMocks = vi.hoisted(() => ({
  listCommentRoots: vi.fn(),
  listCommentChildren: vi.fn(),
  createComment: vi.fn(),
  setCommentLike: vi.fn(),
  reportComment: vi.fn(),
  blockUserFromComment: vi.fn(),
}));

const nativeMocks = vi.hoisted(() => ({
  alert: vi.fn(),
  platform: { OS: "ios" as "ios" | "android" },
}));

const queryResult = vi.hoisted(() => ({
  data: { items: [] as CommentView[], nextCursor: null, liveRanking: false },
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
    Alert: nativeMocks,
    FlatList: ({ data = [], renderItem, children, ListEmptyComponent, ListFooterComponent, ...props }: any) =>
      ReactMock.createElement(
        "FlatList",
        props,
        ...data.map((item: unknown, index: number) => renderItem({ item, index })),
        children,
        ListEmptyComponent,
        ListFooterComponent,
      ),
    KeyboardAvoidingView: passthrough("KeyboardAvoidingView"),
    Platform: nativeMocks.platform,
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

function makeComment(overrides: Partial<CommentView> = {}): CommentView {
  return {
    id: "root-1",
    groupBuyId: "deal-1",
    parentId: null,
    rootId: "root-1",
    depth: 0,
    state: "visible",
    body: "상품이 정말 좋아요.",
    authorDisplayName: "호크히든",
    replyToDisplayName: null,
    createdAt: "2026-08-19T00:00:00.000Z",
    editedAt: null,
    contentVersion: 1,
    likeCount: 17,
    likedByMe: false,
    directReplyCount: 0,
    canEdit: false,
    canDelete: false,
    canLike: true,
    canReport: true,
    ...overrides,
  };
}

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
    nativeMocks.alert.mockReset();
    nativeMocks.platform.OS = "ios";
    queryResult.data = { items: [], nextCursor: null, liveRanking: false };
  });

  it("uses keyboard-aware sheet behavior on Android", async () => {
    nativeMocks.platform.OS = "android";
    let renderer!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <CommentSheet groupBuyId="deal-1" onClose={vi.fn()} visible />,
      );
      await Promise.resolve();
    });

    const keyboardAvoider = renderer.root.find(
      (node) => String(node.type) === "KeyboardAvoidingView",
    );
    expect(keyboardAvoider.props.behavior).toBe("height");
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

  it("renders root replies as a YouTube-style thread and keeps moderation in the overflow menu", async () => {
    const root = makeComment({ directReplyCount: 2 });
    const reply = makeComment({
      id: "reply-1",
      parentId: root.id,
      rootId: root.id,
      depth: 1,
      body: "저도 같은 생각이에요.",
      authorDisplayName: "이찬",
    });
    queryResult.data = { items: [root], nextCursor: null, liveRanking: false };
    apiMocks.listCommentChildren.mockResolvedValue({
      items: [reply],
      nextCursor: null,
      liveRanking: false,
    });

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <CommentSheet groupBuyId="deal-1" onClose={vi.fn()} visible />,
      );
      await Promise.resolve();
    });

    expect(renderer.root.findAllByProps({ accessibilityLabel: "댓글 신고" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ accessibilityLabel: "사용자 차단" })).toHaveLength(0);
    expect(renderer.root.findByProps({ accessibilityLabel: "댓글 더보기" })).toBeTruthy();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: "답글 2개 보기" }).props.onPress();
      await Promise.resolve();
    });

    expect(JSON.stringify(renderer.toJSON())).toContain("저도 같은 생각이에요.");
    expect(renderer.root.findByProps({ accessibilityLabel: "댓글 스레드 닫기" })).toBeTruthy();
    expect(renderer.root.findAllByProps({ accessibilityRole: "tab" })).toHaveLength(0);
    expect(renderer.root.findByProps({ accessibilityLabel: "댓글 답글 목록" })).toBeTruthy();

    await act(async () => {
      renderer.root.findAllByProps({ accessibilityLabel: "댓글 더보기" })[0].props.onPress();
    });
    expect(nativeMocks.alert).toHaveBeenCalledWith(
      "댓글 더보기",
      "댓글 운영 옵션을 선택해 주세요.",
      expect.arrayContaining([
        expect.objectContaining({ text: "신고" }),
        expect.objectContaining({ text: "사용자 차단" }),
      ]),
    );

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: "댓글 스레드 닫기" }).props.onPress();
    });
    expect(
      renderer.root.findAll(
        (node) => String(node.type) === "Pressable" && node.props.accessibilityRole === "tab",
      ),
    ).toHaveLength(2);
  });

  it("loads every nested reply when a YouTube-style thread opens", async () => {
    const root = makeComment({ directReplyCount: 1 });
    const reply = makeComment({
      id: "reply-1",
      parentId: root.id,
      rootId: root.id,
      depth: 1,
      directReplyCount: 1,
      body: "첫 답글",
      authorDisplayName: "첫 답글러",
    });
    const nestedReply = makeComment({
      id: "reply-2",
      parentId: reply.id,
      rootId: root.id,
      depth: 2,
      body: "답글에 다시 답글",
      authorDisplayName: "두 번째 답글러",
    });
    queryResult.data = { items: [root], nextCursor: null, liveRanking: false };
    apiMocks.listCommentChildren.mockImplementation(async (_groupBuyId: string, parentId: string) => ({
      items: parentId === root.id ? [reply] : [nestedReply],
      nextCursor: null,
      liveRanking: false,
    }));

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <CommentSheet groupBuyId="deal-1" onClose={vi.fn()} visible />,
      );
      await Promise.resolve();
    });
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: "답글 1개 보기" }).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const thread = renderer.root.findByProps({ accessibilityLabel: "댓글 답글 목록" });
    const textNodes = thread.findAll((node) => String(node.type) === "Text");
    expect(textNodes.some((node) => node.children.includes("첫 답글"))).toBe(true);
    expect(textNodes.some((node) => node.children.includes("답글에 다시 답글"))).toBe(true);
    expect(thread.findAllByProps({ accessibilityLabel: "답글 1개 보기" })).toHaveLength(0);
    expect(apiMocks.listCommentChildren).toHaveBeenCalledWith("deal-1", root.id, null);
    expect(apiMocks.listCommentChildren).toHaveBeenCalledWith("deal-1", reply.id, null);
  });

  it("submits a reply with the selected comment as parent", async () => {
    const root = makeComment();
    queryResult.data = { items: [root], nextCursor: null, liveRanking: false };
    apiMocks.createComment.mockResolvedValue(undefined);

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <CommentSheet groupBuyId="deal-1" onClose={vi.fn()} visible />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: "답글 작성" }).props.onPress();
    });
    await act(async () => {
      renderer.root.find((node) => String(node.type) === "TextInput").props.onChangeText("구매했는데 만족해요");
    });
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: "댓글 등록" }).props.onPress();
      await Promise.resolve();
    });

    expect(apiMocks.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        groupBuyId: "deal-1",
        parentId: root.id,
        body: "구매했는데 만족해요",
      }),
    );
  });
});

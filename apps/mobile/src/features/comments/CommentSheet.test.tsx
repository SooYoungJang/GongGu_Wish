import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CommentPage, CommentView } from "./types";

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
  keyboardDismiss: vi.fn(),
  platform: { OS: "ios" as "ios" | "android" },
}));

const queryResult = vi.hoisted(() => ({
  data: { items: [], nextCursor: null, liveRanking: false } as CommentPage,
  isError: false,
  isLoading: false,
  refetch: vi.fn().mockResolvedValue(undefined),
}));

const queryMocks = vi.hoisted(() => ({
  useRealQuery: false,
  keys: [] as (readonly unknown[])[],
}));

const authMocks = vi.hoisted(() => ({
  user: { id: "user-a" } as { id: string } | null,
  requireAuth: vi.fn(() => true),
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
    Keyboard: { dismiss: nativeMocks.keyboardDismiss },
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

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (options: Parameters<typeof actual.useQuery>[0]) => {
      queryMocks.keys = [...queryMocks.keys, options.queryKey];
      return queryMocks.useRealQuery ? actual.useQuery(options) : queryResult;
    },
  };
});

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock("../../hooks/useAuthGate", () => ({
  useAuthGate: () => ({
    isAuthenticated: Boolean(authMocks.user),
    requireAuth: authMocks.requireAuth,
    user: authMocks.user,
  }),
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: authMocks.user }),
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

const emptyPage = (): CommentPage => ({ items: [], nextCursor: null, liveRanking: false });

async function settleQueries() {
  await act(async () => {
    for (let turn = 0; turn < 3; turn += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
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
    nativeMocks.keyboardDismiss.mockReset();
    nativeMocks.platform.OS = "ios";
    queryResult.data = { items: [], nextCursor: null, liveRanking: false };
    queryResult.refetch.mockClear();
    queryMocks.useRealQuery = false;
    queryMocks.keys = [];
    authMocks.user = { id: "user-a" };
    authMocks.requireAuth.mockReset().mockReturnValue(true);
  });

  it("synchronously ignores rapid duplicate submits and disables submit while pending", async () => {
    const request = deferred<CommentView>();
    apiMocks.createComment.mockReturnValue(request.promise);
    let renderer!: TestRenderer.ReactTestRenderer;

    try {
      await act(async () => {
        renderer = TestRenderer.create(<CommentSheet groupBuyId="deal-1" onClose={vi.fn()} visible />);
      });
      act(() => renderer.root.findByProps({ accessibilityLabel: "댓글 입력" }).props.onChangeText("한 번만 등록해 주세요"));
      const submit = renderer.root.findByProps({ accessibilityLabel: "댓글 등록" }).props.onPress;
      act(() => {
        submit();
        submit();
      });

      expect(apiMocks.createComment).toHaveBeenCalledTimes(1);
      expect(renderer.root.findByProps({ accessibilityLabel: "댓글 등록" }).props.disabled).toBe(true);
      await act(async () => request.resolve(makeComment()));
      expect(renderer.root.findByProps({ accessibilityLabel: "댓글 입력" }).props.value).toBe("");
    } finally {
      request.resolve(makeComment());
      if (renderer) act(() => renderer.unmount());
    }
  });

  it("preserves a newer draft when an earlier submit completes", async () => {
    const request = deferred<CommentView>();
    apiMocks.createComment.mockReturnValueOnce(request.promise).mockResolvedValue(makeComment());
    let renderer!: TestRenderer.ReactTestRenderer;

    try {
      await act(async () => {
        renderer = TestRenderer.create(<CommentSheet groupBuyId="deal-1" onClose={vi.fn()} visible />);
      });
      act(() => renderer.root.findByProps({ accessibilityLabel: "댓글 입력" }).props.onChangeText("먼저 등록한 댓글"));
      act(() => renderer.root.findByProps({ accessibilityLabel: "댓글 등록" }).props.onPress());
      act(() => renderer.root.findByProps({ accessibilityLabel: "댓글 입력" }).props.onChangeText("기다리며 작성한 다음 댓글"));
      await act(async () => request.resolve(makeComment()));

      expect(renderer.root.findByProps({ accessibilityLabel: "댓글 입력" }).props.value).toBe("기다리며 작성한 다음 댓글");
      expect(renderer.root.findByProps({ accessibilityLabel: "댓글 등록" }).props.disabled).toBe(false);
      expect(nativeMocks.keyboardDismiss).not.toHaveBeenCalled();
      await act(async () => renderer.root.findByProps({ accessibilityLabel: "댓글 등록" }).props.onPress());
      expect(apiMocks.createComment).toHaveBeenLastCalledWith(expect.objectContaining({ body: "기다리며 작성한 다음 댓글" }));
    } finally {
      request.resolve(makeComment());
      if (renderer) act(() => renderer.unmount());
    }
  });

  it("preserves a newly selected reply recipient while an earlier reply finishes", async () => {
    const firstRoot = makeComment({ authorDisplayName: "먼저 답글 받을 사람" });
    const secondRoot = makeComment({ id: "root-2", rootId: "root-2", authorDisplayName: "다음 답글 받을 사람" });
    queryResult.data = { ...emptyPage(), items: [firstRoot, secondRoot] };
    const request = deferred<CommentView>();
    apiMocks.createComment.mockReturnValueOnce(request.promise).mockResolvedValue(makeComment());
    let renderer!: TestRenderer.ReactTestRenderer;
    const replyActions = () => renderer.root.findAll((node) => String(node.type) === "Pressable" && node.props.accessibilityLabel === "답글 작성");

    try {
      await act(async () => {
        renderer = TestRenderer.create(<CommentSheet groupBuyId="deal-1" onClose={vi.fn()} visible />);
      });
      act(() => replyActions()[0].props.onPress());
      act(() => renderer.root.findByProps({ accessibilityLabel: "댓글 입력" }).props.onChangeText("첫 번째 사람에게 답글"));
      act(() => renderer.root.findByProps({ accessibilityLabel: "댓글 등록" }).props.onPress());
      act(() => replyActions()[1].props.onPress());
      act(() => renderer.root.findByProps({ accessibilityLabel: "댓글 입력" }).props.onChangeText("두 번째 사람에게 답글"));
      await act(async () => request.resolve(makeComment()));

      expect(renderer.root.findByProps({ accessibilityLabel: "댓글 입력" }).props.value).toBe("두 번째 사람에게 답글");
      expect(renderer.root.findAll((node) => String(node.type) === "Pressable" && node.props.accessibilityLabel === "답글 대상 취소")).toHaveLength(1);
      await act(async () => renderer.root.findByProps({ accessibilityLabel: "댓글 등록" }).props.onPress());
      expect(apiMocks.createComment).toHaveBeenLastCalledWith(expect.objectContaining({ parentId: secondRoot.id, body: "두 번째 사람에게 답글" }));
    } finally {
      request.resolve(makeComment());
      if (renderer) act(() => renderer.unmount());
    }
  });

  it("reuses a failed draft's idempotency key but assigns a fresh key to the next submission", async () => {
    apiMocks.createComment
      .mockRejectedValueOnce(new Error("response lost after server accepted the comment"))
      .mockResolvedValue(makeComment());
    let renderer!: TestRenderer.ReactTestRenderer;

    try {
      await act(async () => {
        renderer = TestRenderer.create(<CommentSheet groupBuyId="deal-1" onClose={vi.fn()} visible />);
      });
      act(() => renderer.root.findByProps({ accessibilityLabel: "댓글 입력" }).props.onChangeText("재시도할 댓글"));
      await act(async () => renderer.root.findByProps({ accessibilityLabel: "댓글 등록" }).props.onPress());
      expect(renderer.root.findByProps({ accessibilityLabel: "댓글 입력" }).props.value).toBe("재시도할 댓글");
      expect(renderer.root.findByProps({ accessibilityLabel: "댓글 등록" }).props.disabled).toBe(false);
      await act(async () => renderer.root.findByProps({ accessibilityLabel: "댓글 등록" }).props.onPress());
      act(() => renderer.root.findByProps({ accessibilityLabel: "댓글 입력" }).props.onChangeText("재시도할 댓글"));
      await act(async () => renderer.root.findByProps({ accessibilityLabel: "댓글 등록" }).props.onPress());

      const [first, retry, next] = apiMocks.createComment.mock.calls.map(([input]) => input);
      expect(first.clientRequestId).toEqual(expect.any(String));
      expect(retry.clientRequestId).toBe(first.clientRequestId);
      expect(next.clientRequestId).toEqual(expect.any(String));
      expect(next.clientRequestId).not.toBe(first.clientRequestId);
    } finally {
      if (renderer) act(() => renderer.unmount());
    }
  });

  it.each([
    { source: null, target: "user-a", description: "guest to signed-in user" },
    { source: "user-a", target: "user-b", description: "one account to another" },
  ])("loads personal likes and block filtering afresh when switching $description", async ({ source, target }) => {
    queryMocks.useRealQuery = true;
    authMocks.user = source ? { id: source } : null;
    const sourceRoot = makeComment({ likedByMe: source === "user-a" });
    const targetRoot = makeComment({ likedByMe: target === "user-a" });
    const sourceOnly = makeComment({ id: "old-visible", rootId: "old-visible", body: "새 계정에서는 차단되어 숨겨야 하는 댓글" });
    apiMocks.listCommentRoots.mockImplementation(async () => ({
      items: authMocks.user?.id === target ? [targetRoot] : [sourceRoot, sourceOnly],
      nextCursor: null,
      liveRanking: false,
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const onClose = vi.fn();
    const content = () => <QueryClientProvider client={client}><CommentSheet groupBuyId="deal-1" onClose={onClose} visible /></QueryClientProvider>;
    let renderer!: TestRenderer.ReactTestRenderer;

    try {
      await act(async () => { renderer = TestRenderer.create(content()); });
      await settleQueries();
      expect(JSON.stringify(renderer.toJSON())).toContain(sourceOnly.body);
      const sourceKey = queryMocks.keys[queryMocks.keys.length - 1];

      authMocks.user = { id: target };
      await act(async () => renderer.update(content()));
      await settleQueries();

      expect(apiMocks.listCommentRoots).toHaveBeenCalledTimes(2);
      expect(queryMocks.keys[queryMocks.keys.length - 1]).not.toEqual(sourceKey);
      expect(JSON.stringify(renderer.toJSON())).not.toContain(sourceOnly.body);
      expect(renderer.root.findByProps({ accessibilityLabel: targetRoot.likedByMe ? "좋아요 취소" : "댓글 좋아요" })).toBeTruthy();
    } finally {
      if (renderer) act(() => renderer.unmount());
      client.clear();
    }
  });

  it("clears a loaded reply thread and selected reply author on account change", async () => {
    const root = makeComment({ directReplyCount: 1 });
    const reply = makeComment({ id: "reply-a", rootId: root.id, parentId: root.id, depth: 1, body: "이전 계정의 답글", authorDisplayName: "이전 계정에서 선택한 답글러" });
    queryResult.data = { items: [root], nextCursor: null, liveRanking: false };
    apiMocks.listCommentChildren.mockResolvedValue({ ...emptyPage(), items: [reply] });
    const onClose = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    try {
      await act(async () => { renderer = TestRenderer.create(<CommentSheet groupBuyId="deal-1" onClose={onClose} visible />); });
      await act(async () => renderer.root.findByProps({ accessibilityLabel: "답글 1개 보기" }).props.onPress());
      act(() => renderer.root.findAll((node) => String(node.type) === "Pressable" && node.props.accessibilityLabel === "답글 작성")[1].props.onPress());
      expect(JSON.stringify(renderer.toJSON())).toContain(reply.body);
      expect(renderer.root.findAll((node) => String(node.type) === "Pressable" && node.props.accessibilityLabel === "답글 대상 취소")).toHaveLength(1);

      authMocks.user = { id: "user-b" };
      await act(async () => renderer.update(<CommentSheet groupBuyId="deal-1" onClose={onClose} visible />));

      expect(JSON.stringify(renderer.toJSON())).not.toContain(reply.body);
      expect(renderer.root.findAllByProps({ accessibilityLabel: "댓글 스레드 닫기" })).toHaveLength(0);
      expect(renderer.root.findAllByProps({ accessibilityLabel: "답글 대상 취소" })).toHaveLength(0);
    } finally {
      if (renderer) act(() => renderer.unmount());
    }
  });

  it("discards replies still loading for the previous account after the new account opens the thread", async () => {
    const root = makeComment({ directReplyCount: 1 });
    const oldReply = makeComment({ id: "reply-a", rootId: root.id, parentId: root.id, depth: 1, body: "이전 계정의 지연 답글" });
    const newReply = makeComment({ id: "reply-b", rootId: root.id, parentId: root.id, depth: 1, body: "현재 계정의 답글" });
    const request = deferred<CommentPage>();
    queryResult.data = { items: [root], nextCursor: null, liveRanking: false };
    apiMocks.listCommentChildren.mockReturnValueOnce(request.promise).mockResolvedValue({ ...emptyPage(), items: [newReply] });
    const onClose = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    try {
      await act(async () => { renderer = TestRenderer.create(<CommentSheet groupBuyId="deal-1" onClose={onClose} visible />); });
      act(() => renderer.root.findByProps({ accessibilityLabel: "답글 1개 보기" }).props.onPress());
      authMocks.user = { id: "user-b" };
      await act(async () => renderer.update(<CommentSheet groupBuyId="deal-1" onClose={onClose} visible />));
      // Also close a retained old thread so the late-response guard is tested independently of the reset.
      const retainedThread = renderer.root.findAll((node) => String(node.type) === "Pressable" && node.props.accessibilityLabel === "댓글 스레드 닫기");
      if (retainedThread.length) act(() => retainedThread[0].props.onPress());
      const openForNewAccount = renderer.root.findAll((node) => String(node.type) === "Pressable" && node.props.accessibilityLabel === "답글 1개 보기");
      expect(openForNewAccount).toHaveLength(1);
      await act(async () => openForNewAccount[0].props.onPress());
      expect(JSON.stringify(renderer.toJSON())).toContain(newReply.body);
      await act(async () => request.resolve({ ...emptyPage(), items: [oldReply] }));
      expect(JSON.stringify(renderer.toJSON())).not.toContain(oldReply.body);
      expect(JSON.stringify(renderer.toJSON())).toContain(newReply.body);
    } finally {
      request.resolve(emptyPage());
      if (renderer) act(() => renderer.unmount());
    }
  });

  it("ignores a late latest page after switching to popular comments", async () => {
    const latestRoot = makeComment({ body: "최신 첫 페이지" });
    const popularRoot = makeComment({ id: "popular-1", rootId: "popular-1", body: "인기 첫 페이지" });
    const staleRoot = makeComment({ id: "latest-2", rootId: "latest-2", body: "이전 정렬의 늦은 댓글" });
    queryResult.data = { items: [latestRoot], nextCursor: "latest-page-2", liveRanking: false };
    const finishLatest = vi.fn();
    apiMocks.listCommentRoots.mockImplementationOnce(
      () => new Promise<CommentPage>((resolve) => { finishLatest.mockImplementation(resolve); }),
    );
    let renderer!: TestRenderer.ReactTestRenderer;
    const onClose = vi.fn();
    const loadMoreButton = () => renderer.root.find(
      (node) => String(node.type) === "Pressable" &&
        node.findAll((child) => String(child.type) === "Text" && child.children.includes("댓글 더 보기")).length > 0,
    );
    const visibleBodies = () => renderer.root.findAll(
      (node) => String(node.type) === "Text" && node.props.variant === "body",
    ).flatMap((node) => node.children);

    try {
      await act(async () => {
        renderer = TestRenderer.create(
          <CommentSheet groupBuyId="deal-1" onClose={onClose} visible />,
        );
      });
      act(() => loadMoreButton().props.onPress());
      expect(apiMocks.listCommentRoots).toHaveBeenLastCalledWith("deal-1", "latest", "latest-page-2");

      queryResult.data = { items: [popularRoot], nextCursor: "popular-page-2", liveRanking: true };
      act(() => {
        renderer.root.findAll(
          (node) => String(node.type) === "Pressable" && node.props.accessibilityRole === "tab",
        )[1].props.onPress();
      });
      expect(visibleBodies()).toContain("인기 첫 페이지");

      await act(async () => {
        finishLatest({ items: [staleRoot], nextCursor: "latest-page-3", liveRanking: false });
        await Promise.resolve();
      });
      expect(visibleBodies()).not.toContain("이전 정렬의 늦은 댓글");

      await act(async () => {
        loadMoreButton().props.onPress();
        await Promise.resolve();
      });
      expect(apiMocks.listCommentRoots).toHaveBeenLastCalledWith("deal-1", "popular", "popular-page-2");
    } finally {
      if (renderer) act(() => renderer.unmount());
    }
  });

  it("sticks the Android composer to the keyboard without shrinking the sheet", async () => {
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
    expect(keyboardAvoider.props.behavior).toBeUndefined();

    const stickyComposer = renderer.root.find(
      (node) => String(node.type) === "KeyboardStickyView",
    );
    expect(stickyComposer.props.enabled).toBe(true);

    const composer = renderer.root.findByProps({ testID: "comment-composer" });
    expect(composer.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: expect.stringMatching(/^#/),
        }),
      ]),
    );
  });

  it("uses the same downward swipe dismissal contract as the search sheet", async () => {
    const onClose = vi.fn();
    const sheetTranslate = { value: 0 };
    let renderer!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <CommentSheet
          groupBuyId="deal-1"
          maxHeight={640}
          onClose={onClose}
          sheetTranslate={sheetTranslate as any}
          visible
        />,
      );
      await Promise.resolve();
    });

    const gestureDetector = renderer.root.find(
      (node) => String(node.type) === "GestureDetector",
    );
    const handlers = (
      gestureDetector.props.gesture as {
        __handlers: Record<string, Function>;
      }
    ).__handlers;
    act(() => {
      handlers.onBegin();
      handlers.onUpdate({ translationY: 200 });
    });

    expect(sheetTranslate.value).toBe(200);

    act(() => {
      handlers.onEnd({ translationY: 200, velocityY: 0 });
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the comment list scroll gesture when the list is not at the top", async () => {
    const onClose = vi.fn();
    const sheetTranslate = { value: 0 };
    let renderer!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <CommentSheet
          groupBuyId="deal-1"
          maxHeight={640}
          onClose={onClose}
          sheetTranslate={sheetTranslate as any}
          visible
        />,
      );
      await Promise.resolve();
    });

    const list = renderer.root.find(
      (node) => String(node.type) === "FlatList",
    );
    act(() => {
      list.props.onScroll?.({ nativeEvent: { contentOffset: { y: 240 } } });
    });

    const gestureDetector = renderer.root.find(
      (node) => String(node.type) === "GestureDetector",
    );
    const handlers = (
      gestureDetector.props.gesture as {
        __handlers: Record<string, Function>;
      }
    ).__handlers;
    expect(handlers.enabled).toBe(false);
    act(() => {
      handlers.onBegin();
      handlers.onUpdate({ translationY: 200 });
      handlers.onEnd({ translationY: 200, velocityY: 0 });
    });

    expect(sheetTranslate.value).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
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
    expect(nativeMocks.keyboardDismiss).toHaveBeenCalled();
  });

  it("hides the reply action on comments authored by the current user", async () => {
    const ownComment = makeComment({ canEdit: true });
    const otherComment = makeComment({
      id: "root-2",
      rootId: "root-2",
      authorDisplayName: "다른 사용자",
    });
    queryResult.data = {
      items: [ownComment, otherComment],
      nextCursor: null,
      liveRanking: false,
    };

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <CommentSheet groupBuyId="deal-1" onClose={vi.fn()} visible />,
      );
      await Promise.resolve();
    });

    expect(
      renderer.root.findAll(
        (node) =>
          String(node.type) === "Pressable" &&
          node.props.accessibilityLabel === "답글 작성",
      ),
    ).toHaveLength(1);
  });

  it("submits a comment like when the like action is pressed", async () => {
    const root = makeComment();
    queryResult.data = { items: [root], nextCursor: null, liveRanking: false };
    apiMocks.setCommentLike.mockResolvedValue(
      makeComment({ likedByMe: true, likeCount: root.likeCount + 1 }),
    );

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <CommentSheet groupBuyId="deal-1" onClose={vi.fn()} visible />,
      );
      await Promise.resolve();
    });

    const likeButton = renderer.root.findByProps({ accessibilityLabel: "댓글 좋아요" });
    expect(likeButton.props.disabled).toBe(false);
    await act(async () => {
      likeButton.props.onPress();
      await Promise.resolve();
    });

    expect(apiMocks.setCommentLike).toHaveBeenCalledWith(root.id, true);
  });
});

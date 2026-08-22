import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PreviousProductGroupBuy } from "../../api";

const apiMocks = vi.hoisted(() => ({
  fetchPreviousProductGroupBuys: vi.fn(),
  getPreviousProductHistoryQueryKey: vi.fn((current: any) => [
    "previous-product-history",
    current.id,
    current.brandName,
    current.productName,
  ]),
}));

const queryResult = vi.hoisted(() => ({
  data: [] as PreviousProductGroupBuy[],
  isError: false,
  isLoading: false,
  isSuccess: true,
  refetch: vi.fn(),
}));

vi.mock("react-native", () => {
  const ReactMock = require("react");
  const passthrough =
    (type: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactMock.createElement(type, props, children);

  return {
    ActivityIndicator: passthrough("ActivityIndicator"),
    FlatList: ({
      data = [],
      renderItem,
      children,
      ListEmptyComponent,
      ...props
    }: any) =>
      ReactMock.createElement(
        "FlatList",
        props,
        ...(data.length > 0
          ? data.map((item: unknown, index: number) =>
              renderItem({ item, index }),
            )
          : [ListEmptyComponent]),
        children,
      ),
    Image: passthrough("Image"),
    Pressable: ({ children, ...props }: any) =>
      ReactMock.createElement(
        "Pressable",
        props,
        typeof children === "function"
          ? children({ pressed: false })
          : children,
      ),
    StyleSheet: {
      absoluteFillObject: { bottom: 0, left: 0, right: 0, top: 0 },
      create: (styles: unknown) => styles,
      hairlineWidth: 1,
    },
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

vi.mock("../../api", () => apiMocks);

vi.mock("../../components/ui/SText", () => ({
  SText: ({ children, ...props }: any) =>
    React.createElement("Text", props, children),
}));

vi.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({
    colors: {
      bg: "#111",
      border: "#333",
      primary: "#f05",
      surface: "#222",
      surfaceHover: "#333",
      textPrimary: "#fff",
      textSecondary: "#ccc",
      textTertiary: "#999",
    },
  }),
}));

vi.mock("../../utils", () => ({
  formatDateRange: () => "2026.07.01 - 2026.07.10",
}));

import { PreviousProductHistorySheet } from "./PreviousProductHistorySheet";

const current = {
  id: "current",
  brandName: "브랜드 A",
  productName: "진정 크림",
};

const previous: PreviousProductGroupBuy = {
  id: "previous-1",
  productName: "진정 크림",
  brandName: "브랜드 A",
  startDate: "2026-07-01T00:00:00.000Z",
  endDate: "2026-07-10T23:59:59.000Z",
  summary: "촉촉하게 마무리되는 크림",
  thumbnailUrl: null,
  status: "EXPIRED",
};

describe("PreviousProductHistorySheet", () => {
  beforeEach(() => {
    queryResult.data = [previous];
    queryResult.isError = false;
    queryResult.isLoading = false;
    queryResult.isSuccess = true;
    queryResult.refetch.mockReset();
    apiMocks.fetchPreviousProductGroupBuys.mockReset();
  });

  it("renders a previous group-buy card with a link to its existing comments", async () => {
    let renderer!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <PreviousProductHistorySheet
          current={current}
          maxHeight={600}
          onClose={vi.fn()}
          onOpenComments={vi.fn()}
          visible
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      renderer.root.findByProps({
        testID: "previous-product-history-sheet",
      }),
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({
        testID: "previous-product-history-item-previous-1",
      }),
    ).toBeTruthy();
    expect(JSON.stringify(renderer.toJSON())).toContain("공구 종료");
    expect(JSON.stringify(renderer.toJSON())).toContain("댓글 보러가기");
  });

  it("does not render a thumbnail area for previous group-buy cards", async () => {
    queryResult.data = [
      {
        ...previous,
        thumbnailUrl: "https://cdn.example.invalid/expired-thumbnail.jpg",
      },
    ];
    let renderer!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <PreviousProductHistorySheet
          current={current}
          maxHeight={600}
          onClose={vi.fn()}
          onOpenComments={vi.fn()}
          visible
        />,
      );
      await Promise.resolve();
    });

    expect(renderer.root.findAllByType("Image" as any)).toHaveLength(0);
    expect(renderer.root.findAllByProps({ name: "image-outline" })).toHaveLength(
      0,
    );
  });

  it("opens the selected previous group-buy comments and closes the sheet", async () => {
    const onClose = vi.fn();
    const onOpenComments = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <PreviousProductHistorySheet
          current={current}
          maxHeight={600}
          onClose={onClose}
          onOpenComments={onOpenComments}
          visible
        />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      renderer.root
        .findByProps({ testID: "previous-product-history-item-previous-1" })
        .props.onPress();
    });
    expect(onOpenComments).toHaveBeenCalledWith("previous-1");

    await act(async () => {
      renderer.root
        .findAllByProps({
          accessibilityLabel: "이 상품의 이전 댓글 창 닫기",
        })[0]
        .props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

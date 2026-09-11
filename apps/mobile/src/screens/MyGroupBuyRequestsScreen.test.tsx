import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyGroupBuyRequestsScreen } from "./MyGroupBuyRequestsScreen";

const mock = vi.hoisted(() => ({ user: { id: "a" } as { id: string } | null, options: {} as any, query: {} as any }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: mock.user, isLoading: false }) }));
vi.mock("@tanstack/react-query", () => ({ useInfiniteQuery: (options: unknown) => { mock.options = options; return mock.query; } }));
vi.mock("@react-navigation/native", () => ({ useFocusEffect: () => {} }));
vi.mock("../features/groupBuyRequests/myRequestsApi", () => ({ fetchMyGroupBuyRequests: vi.fn() }));
vi.mock("../design/useCommerceTheme", () => ({ useCommerceTheme: () => ({ colors: {} }) }));
vi.mock("react-native", () => {
  const React = require("react");
  const component = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
  return { View: component("View"), Pressable: component("Pressable"), ActivityIndicator: component("Loading"), StyleSheet: { create: (s: unknown) => s }, FlatList: ({ data, renderItem, ListHeaderComponent, ListEmptyComponent, ListFooterComponent, ...props }: any) => React.createElement("List", props, ListHeaderComponent, data.length ? data.map((item: any) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item }))) : ListEmptyComponent, ListFooterComponent) };
});
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: ({ children }: any) => <>{children}</> }));
vi.mock("../components/CenteredBackHeader", () => ({ CenteredBackHeader: () => null }));
vi.mock("../components/ui/SText", () => ({ SText: ({ children }: any) => <span>{children}</span> }));
vi.mock("../components/ui/AsyncStateNotice", () => ({ AsyncStateNotice: ({ title, onRetry }: any) => <button onClick={onRetry}>{title}</button> }));
let renderer: TestRenderer.ReactTestRenderer;
const mount = () => act(() => { renderer = TestRenderer.create(<MyGroupBuyRequestsScreen navigation={{ goBack: vi.fn() } as any} route={{} as any} />); });
beforeEach(() => {
  mock.user = { id: "a" };
  mock.query = { data: { pages: [{ items: [{ id: "one", productName: "내 상품", status: "OPEN", requestedAt: "2026-09-01" }] }] }, isError: false, isPending: false, isFetching: false, hasNextPage: true, isFetchNextPageError: false, refetch: vi.fn(), fetchNextPage: vi.fn() };
});
afterEach(() => { if (renderer) act(() => renderer.unmount()); });
describe("my requests screen", () => {
  it("scopes queries by account and hides retained rows immediately after logout", () => {
    mount();
    expect(mock.options.queryKey).toEqual(["my-group-buy-requests", "a"]);
    mock.user = null;
    act(() => renderer.update(<MyGroupBuyRequestsScreen navigation={{} as any} route={{} as any} />));
    expect(mock.options.enabled).toBe(false);
    expect(JSON.stringify(renderer.toJSON())).not.toContain("내 상품");
  });
  it("retains existing rows and retries the failed next page", () => {
    mock.query.isError = true;
    mock.query.isFetchNextPageError = true;
    mount();
    expect(JSON.stringify(renderer.toJSON())).toContain("내 상품");
    act(() => renderer.root.findByType("button").props.onClick());
    expect(mock.query.fetchNextPage).toHaveBeenCalledOnce();
    expect(mock.query.refetch).not.toHaveBeenCalled();
    act(() => renderer.root.findByType("List" as any).props.onEndReached());
    expect(mock.query.fetchNextPage).toHaveBeenCalledOnce();
  });
  it("retries a first-page refresh through refetch", () => {
    mock.query.isError = true;
    mount();
    act(() => renderer.root.findByType("button").props.onClick());
    expect(mock.query.refetch).toHaveBeenCalledOnce();
    expect(mock.query.fetchNextPage).not.toHaveBeenCalled();
  });
});

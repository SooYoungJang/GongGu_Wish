import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getGroupBuyFeedOptions, flattenGroupBuyPages } from "./queries";
import { fetchGroupBuyPage } from "./api";

vi.mock("./api", () => ({ fetchGroupBuyPage: vi.fn() }));
vi.mock("@tanstack/react-query", (importOriginal) => importOriginal());

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
afterEach(() => { client.clear(); vi.resetAllMocks(); });

describe("feed query pagination", () => {
  it("fetches one page initially and appends only after a request for more", async () => {
    const cursor = { id: "20", createdAt: "2026-10-26T00:00:00" };
    vi.mocked(fetchGroupBuyPage)
      .mockResolvedValueOnce({ items: [], nextCursor: cursor })
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    const observer = new InfiniteQueryObserver(client, getGroupBuyFeedOptions());
    const unsubscribe = observer.subscribe(() => undefined);
    await observer.refetch();
    expect(fetchGroupBuyPage).toHaveBeenCalledTimes(1);
    expect(observer.getCurrentResult().hasNextPage).toBe(true);
    await observer.fetchNextPage();
    expect(fetchGroupBuyPage).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetchGroupBuyPage).mock.calls[1][1]).toEqual(cursor);
    expect(observer.getCurrentResult().data?.pages).toHaveLength(2);
    expect(observer.getCurrentResult().hasNextPage).toBe(false);
    unsubscribe();
  });

  it("isolates category, seller and local-day caches without reusing an old cursor", () => {
    const a = getGroupBuyFeedOptions({ category: "food", today: "2026-10-26" });
    const b = getGroupBuyFeedOptions({ category: "living", today: "2026-10-26" });
    expect(a.queryKey).not.toEqual(b.queryKey);
    expect(a.queryKey).not.toEqual(getGroupBuyFeedOptions({ category: "food", today: "2026-10-27" }).queryKey);
    expect(getGroupBuyFeedOptions({ username: "@Seller" }).queryKey)
      .toEqual(getGroupBuyFeedOptions({ username: "seller" }).queryKey);
    expect(b.initialPageParam).toBeNull();
  });

  it("keeps the first page after a next-page failure and retries that same cursor", async () => {
    const cursor = { id: "20", createdAt: "2026-10-26T00:00:00" };
    const first = { items: [], nextCursor: cursor };
    vi.mocked(fetchGroupBuyPage).mockResolvedValueOnce(first)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    const observer = new InfiniteQueryObserver(client, getGroupBuyFeedOptions());
    const unsubscribe = observer.subscribe(() => undefined);
    await observer.refetch();
    await observer.fetchNextPage();
    expect(observer.getCurrentResult().data?.pages).toEqual([first]);
    expect(observer.getCurrentResult().isFetchNextPageError).toBe(true);
    await observer.fetchNextPage();
    expect(vi.mocked(fetchGroupBuyPage).mock.calls.slice(1).map(args => args[1]))
      .toEqual([cursor, cursor]);
    unsubscribe();
  });

  it("deduplicates repeated rows while retaining the already displayed order", () => {
    const item = (id: string) => ({ id } as never);
    expect(flattenGroupBuyPages([
      { items: [item("a"), item("b")], nextCursor: null },
      { items: [item("b"), item("c")], nextCursor: null },
    ]).map(row => row.id)).toEqual(["a", "b", "c"]);
  });
});

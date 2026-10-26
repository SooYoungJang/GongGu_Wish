import { mapGroupBuyRows } from "../../api";
import { ApiError } from "../../lib/api-types";
import { postgrestGet } from "../../lib/postgrest-client";
import type { GroupBuy } from "../../types";
import { formatDateKey } from "../../utils/groupBuyDates";
import { normalizeOptionalInstagramUsername } from "@gonggu/shared/utils/instagram";

export type GroupBuyCursor = { createdAt: string; id: string };
export type GroupBuyPage = { items: GroupBuy[]; nextCursor: GroupBuyCursor | null };
export type GroupBuyFeedFilter = {
  category?: string;
  username?: string;
  from?: string;
  to?: string;
  today?: string;
};

// Keep the fields used by cards/detail navigation without downloading raw-post
// captions, collector payloads or unrelated influencer fields for every card.
const FEED_SELECT = "*,influencer_id(instagram_username,profile_image_url),raw_post_id(post_url,influencer_id(instagram_username,profile_image_url))";
export const GROUP_BUY_PAGE_SIZE = 20;

export async function fetchGroupBuyPage(
  filter: GroupBuyFeedFilter = {},
  cursor: GroupBuyCursor | null = null,
  signal?: AbortSignal,
): Promise<GroupBuyPage> {
  const username = normalizeOptionalInstagramUsername(filter.username)?.toLowerCase();
  if (filter.username !== undefined && !username) return { items: [], nextCursor: null };
  const params = new URLSearchParams({
    select: FEED_SELECT,
    p_limit: String(GROUP_BUY_PAGE_SIZE + 1),
    p_today: filter.today ?? formatDateKey(new Date()),
  });
  if (filter.category && filter.category !== "all") params.set("p_category", filter.category);
  if (username) params.set("p_username", username);
  if (filter.from) params.set("p_from", filter.from);
  if (filter.to) params.set("p_to", filter.to);
  if (cursor) {
    params.set("p_before_created_at", cursor.createdAt);
    params.set("p_before_id", cursor.id);
  }
  const { data } = await postgrestGet<unknown[]>(`rpc/list_public_group_buys?${params}`, { signal });
  if (!Array.isArray(data)) throw new ApiError(502, "Invalid group buy page response");
  const items = mapGroupBuyRows(data.slice(0, GROUP_BUY_PAGE_SIZE));
  const last = items[items.length - 1];
  if (data.length > GROUP_BUY_PAGE_SIZE && !last?.createdAt) {
    throw new ApiError(502, "Invalid group buy page cursor");
  }
  return {
    items,
    nextCursor: data.length > GROUP_BUY_PAGE_SIZE && last?.createdAt
      ? { createdAt: last.createdAt, id: last.id }
      : null,
  };
}

// A calendar needs every marker in its visible date range. Follow bounded pages
// only for that range, never the full public catalog or a truncated first page.
export async function fetchGroupBuysForRange(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<GroupBuy[]> {
  const items = new Map<string, GroupBuy>();
  const seen = new Set<string>();
  let cursor: GroupBuyCursor | null = null;
  const filter = { from, to, today: formatDateKey(new Date()) };
  do {
    const page = await fetchGroupBuyPage(filter, cursor, signal);
    for (const item of page.items) items.set(item.id, item);
    cursor = page.nextCursor;
    if (cursor) {
      const key = JSON.stringify(cursor);
      if (seen.has(key)) throw new ApiError(502, "Invalid repeated group buy cursor");
      seen.add(key);
    }
  } while (cursor);
  return [...items.values()];
}

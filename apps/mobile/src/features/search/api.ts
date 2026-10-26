import { ApiError } from "../../lib/api-types";
import { postgrestGet } from "../../lib/postgrest-client";
import type { Influencer } from "../../types";
import { normalizeForSearch } from "../../utils/search";

export type InfluencerSearchCursor = { username: string; id: string };
export type InfluencerSearchPage = { items: Influencer[]; nextCursor: InfluencerSearchCursor | null };
const INFLUENCER_SEARCH_PAGE_SIZE = 10;

export async function searchInfluencerPage(
  query: string,
  cursor: InfluencerSearchCursor | null = null,
  signal?: AbortSignal,
): Promise<InfluencerSearchPage> {
  const term = normalizeForSearch(query.trim().replace(/^@/, "")).slice(0, 200);
  if (!term) return { items: [], nextCursor: null };
  const params = new URLSearchParams({ p_query: term, p_limit: String(INFLUENCER_SEARCH_PAGE_SIZE + 1) });
  if (cursor) {
    params.set("p_after_username", cursor.username);
    params.set("p_after_id", cursor.id);
  }
  const { data } = await postgrestGet<Influencer[]>(`rpc/search_public_influencers?${params}`, { signal });
  if (!Array.isArray(data) || data.some(row => !row || typeof row.id !== "string" || typeof row.instagramUsername !== "string")) {
    throw new ApiError(502, "Invalid seller search response");
  }
  const items = data.slice(0, INFLUENCER_SEARCH_PAGE_SIZE);
  const last = items.at(-1);
  return {
    items,
    nextCursor: data.length > INFLUENCER_SEARCH_PAGE_SIZE && last ? { username: last.instagramUsername.toLowerCase(), id: last.id } : null,
  };
}

import type { Influencer } from '../types';

/**
 * Normalize text for search matching: lowercase and remove all whitespace
 * so that queries match regardless of spacing (e.g. "가방 브랜드" matches "가방브랜드").
 * Accepts null/undefined and coerces them to an empty string for convenience
 * when mapping over possibly-missing fields.
 */
export function normalizeForSearch(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\s+/g, '').toLowerCase();
}

/**
 * Insert a search term at the front of the recent-terms queue.
 * Removes any existing duplicate, then caps the list at maxItems by dropping
 * the oldest (last) entries. Mirrors a FIFO-with-promotion queue.
 */
export function pushRecentTerm(prev: string[], term: string, maxItems: number): string[] {
  const trimmed = term.trim();
  if (!trimmed) return prev;
  return [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, maxItems);
}

/**
 * Search influencers by Instagram username or display name.
 * Normalizes the query by stripping a leading @ and comparing case-insensitively.
 * Returns influencers that match any part of their username or display name.
 */
export function searchInfluencers(influencers: Influencer[], query: string) {
  const normalizedQuery = normalizeForSearch(query.replace(/^@/, ''));

  if (!normalizedQuery) return [];

  return influencers.filter((influencer) => {
    const username = normalizeForSearch(influencer.instagramUsername);
    const displayName = normalizeForSearch(influencer.displayName ?? '');
    return username.includes(normalizedQuery) || displayName.includes(normalizedQuery);
  });
}

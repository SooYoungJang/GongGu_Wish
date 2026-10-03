export const AUTOMATIC_COLLECTION_SOURCE_TYPES = [
  "PLAYWRIGHT_PUBLIC",
  "MANUAL_DISCOVERY",
] as const;

export type AutomaticCollectionSourceType =
  (typeof AUTOMATIC_COLLECTION_SOURCE_TYPES)[number];

export function isAutomaticCollectionSource(
  value: unknown,
): value is AutomaticCollectionSourceType {
  return AUTOMATIC_COLLECTION_SOURCE_TYPES.includes(
    value as AutomaticCollectionSourceType,
  );
}

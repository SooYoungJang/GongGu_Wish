import type { GroupBuy } from "../types";

type GroupBuyMedia = Pick<
  GroupBuy,
  "mediaItems" | "mediaType" | "mediaUrls" | "thumbnailUrl" | "videoUrl"
>;

const IMAGE_URL_PATTERN =
  /(?:^data:image\/|\.(?:avif|gif|heic|heif|jpe?g|png|webp)(?:[?#]|$))/i;

function cleanUrl(value: string | null | undefined): string | null {
  const url = value?.trim();
  return url ? url : null;
}

export function resolveGroupBuyImageUrl(item: GroupBuyMedia): string | null {
  const thumbnailUrl = cleanUrl(item.thumbnailUrl);
  if (thumbnailUrl) return thumbnailUrl;

  for (const mediaItem of item.mediaItems ?? []) {
    const mediaThumbnailUrl = cleanUrl(mediaItem.thumbnailUrl);
    const mediaUrl = cleanUrl(mediaItem.url);

    if (mediaItem.mediaType === "VIDEO") {
      if (mediaThumbnailUrl) return mediaThumbnailUrl;
      continue;
    }

    if (mediaThumbnailUrl) return mediaThumbnailUrl;
    if (mediaUrl) return mediaUrl;
  }

  const legacyUrls = (item.mediaUrls ?? [])
    .map(cleanUrl)
    .filter((url): url is string => Boolean(url));
  if (item.mediaType === "IMAGE") return legacyUrls[0] ?? null;

  const videoUrl = cleanUrl(item.videoUrl);
  const imageCandidates = videoUrl
    ? legacyUrls.filter((url) => url !== videoUrl)
    : legacyUrls;
  const recognizableImageUrl = imageCandidates.find((url) =>
    IMAGE_URL_PATTERN.test(url),
  );
  if (recognizableImageUrl) return recognizableImageUrl;
  if (item.mediaType === "VIDEO") return null;

  return imageCandidates[0] ?? null;
}

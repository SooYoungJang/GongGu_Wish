import { buildCollectionReviewSnapshot } from "../_shared/automaticCollectionReview.ts";
import type { ManualDiscoveryInput } from "./manualDiscoveryContract.ts";

export type ManualParsedCaption = {
  productName?: string;
  brandName?: string;
  startDate?: string;
  endDate?: string;
  purchaseUrl?: string;
  discountInfo?: string;
  priceKrw?: number;
};

export function buildManualDiscoveryInfluencerRow(input: {
  id: string;
  instagramUsername: string;
  updatedAt: string;
}) {
  return {
    id: input.id,
    instagram_username: input.instagramUsername,
    is_active: false,
    playwright_collection_enabled: false,
    updated_at: input.updatedAt,
  };
}

export function buildManualDiscoveryRows(input: {
  discovery: ManualDiscoveryInput;
  parsed: ManualParsedCaption;
  parseError: string | null;
  contentHash: string;
  rawPostId: string;
  groupBuyId: string;
  influencerId: string;
  now: string;
}) {
  const {
    discovery,
    parsed,
    parseError,
    contentHash,
    rawPostId,
    groupBuyId,
    influencerId,
    now,
  } = input;
  const mediaUrls = discovery.imageUrl ? [discovery.imageUrl] : [];
  const summary = discovery.caption.slice(0, 500);

  return {
    rawPost: {
      id: rawPostId,
      instagram_post_id: discovery.instagramPostId,
      influencer_id: influencerId,
      caption: discovery.caption,
      post_url: discovery.postUrl,
      image_url: discovery.imageUrl,
      taken_at: discovery.takenAt,
      collected_at: now,
      content_hash: contentHash,
      is_candidate: true,
      is_korea_candidate: true,
      collection_source: "MANUAL_DISCOVERY",
      parsing_status: parseError ? "FAILED" : "PARSED",
      parsed_at: parseError ? null : now,
      parse_error: parseError,
      updated_at: now,
    },
    groupBuy: {
      id: groupBuyId,
      raw_post_id: rawPostId,
      influencer_id: influencerId,
      product_name: parsed.productName ?? null,
      brand_name: parsed.brandName ?? null,
      start_date: parsed.startDate ?? null,
      end_date: parsed.endDate ?? null,
      purchase_url: parsed.purchaseUrl ?? null,
      discount_info: parsed.discountInfo ?? null,
      price_krw: parsed.priceKrw ?? null,
      summary,
      confidence: 0.5,
      status: "REVIEW_REQUIRED",
      source_type: "MANUAL_DISCOVERY",
      collection_review_status: "PENDING",
      collection_proposal_snapshot: buildCollectionReviewSnapshot({
        rawPostId,
        instagramPostId: discovery.instagramPostId,
        originalPostUrl: discovery.postUrl,
        takenAt: discovery.takenAt,
        productName: parsed.productName,
        brandName: parsed.brandName,
        instagramUsername: discovery.instagramUsername,
        category: null,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        purchaseUrl: parsed.purchaseUrl,
        profileLinkCandidates: [],
        discountInfo: parsed.discountInfo,
        priceKrw: parsed.priceKrw,
        summary,
        thumbnailUrl: discovery.imageUrl,
        mediaUrls,
        mediaItems: mediaUrls.map((url) => ({
          url,
          mediaType: "IMAGE",
          thumbnailUrl: null,
        })),
        mediaType: discovery.imageUrl ? "IMAGE" : null,
        confidence: 0.5,
      }),
      collection_ruleset_version: "manual-discovery-v1",
      updated_at: now,
    },
  };
}

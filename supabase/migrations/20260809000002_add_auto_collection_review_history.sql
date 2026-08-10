DO $$
BEGIN
  CREATE TYPE "CollectionReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "group_buys"
  ADD COLUMN IF NOT EXISTS "reviewed_by" TEXT,
  ADD COLUMN IF NOT EXISTS "collection_review_status" "CollectionReviewStatus",
  ADD COLUMN IF NOT EXISTS "collection_proposal_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "collection_reviewed_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "collection_ruleset_version" TEXT,
  ADD COLUMN IF NOT EXISTS "collection_hiker_used" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "collection_hiker_lookup_at" TIMESTAMP(3);

UPDATE "group_buys" AS gb
SET
  "collection_review_status" = CASE gb."status"::TEXT
    WHEN 'REVIEW_REQUIRED' THEN 'PENDING'::"CollectionReviewStatus"
    WHEN 'REJECTED' THEN 'REJECTED'::"CollectionReviewStatus"
    ELSE 'APPROVED'::"CollectionReviewStatus"
  END,
  "collection_ruleset_version" = COALESCE(
    gb."collection_ruleset_version",
    'legacy-backfill'
  )
WHERE gb."source_type" = 'PLAYWRIGHT_PUBLIC';

UPDATE "group_buys" AS gb
SET
  "collection_proposal_snapshot" = COALESCE(
    gb."collection_proposal_snapshot",
    jsonb_build_object(
      'schemaVersion', 1,
      'rawPostId', gb."raw_post_id",
      'instagramPostId', rp."instagram_post_id",
      'originalPostUrl', rp."post_url",
      'takenAt', rp."taken_at",
      'productName', gb."product_name",
      'brandName', gb."brand_name",
      'instagramUsername', COALESCE(gb."instagram_username", influencer."instagram_username"),
      'profileImageUrl', influencer."profile_image_url",
      'category', gb."category",
      'startDate', gb."start_date",
      'endDate', gb."end_date",
      'purchaseUrl', gb."purchase_url",
      'discountInfo', gb."discount_info",
      'priceKrw', gb."price_krw",
      'summary', gb."summary",
      'thumbnailUrl', gb."thumbnail_url",
      'mediaUrls', COALESCE(gb."media_urls", ARRAY[]::TEXT[]),
      'mediaItems', COALESCE(gb."media_items", '[]'::JSONB),
      'mediaType', gb."media_type",
      'confidence', gb."confidence",
      'postAudioUrl', gb."post_audio_url",
      'postAudioStartTimeMs', gb."post_audio_start_time_ms",
      'postAudioDurationMs', gb."post_audio_duration_ms",
      'isHomeBanner', gb."is_home_banner",
      'homeBannerStartDate', gb."home_banner_start_date",
      'homeBannerEndDate', gb."home_banner_end_date"
    )
  )
FROM "raw_posts" AS rp
LEFT JOIN "influencers" AS influencer ON influencer."id" = rp."influencer_id"
WHERE gb."source_type" = 'PLAYWRIGHT_PUBLIC'
  AND rp."id" = gb."raw_post_id";

-- Keep legacy automatic rows visible even if their raw post was removed or
-- never linked. They still need a decision state and a useful audit snapshot.
UPDATE "group_buys" AS gb
SET "collection_proposal_snapshot" = jsonb_build_object(
  'schemaVersion', 1,
  'rawPostId', gb."raw_post_id",
  'instagramPostId', NULL,
  'originalPostUrl', NULL,
  'takenAt', NULL,
  'productName', gb."product_name",
  'brandName', gb."brand_name",
  'instagramUsername', gb."instagram_username",
  'profileImageUrl', NULL,
  'category', gb."category",
  'startDate', gb."start_date",
  'endDate', gb."end_date",
  'purchaseUrl', gb."purchase_url",
  'discountInfo', gb."discount_info",
  'priceKrw', gb."price_krw",
  'summary', gb."summary",
  'thumbnailUrl', gb."thumbnail_url",
  'mediaUrls', COALESCE(gb."media_urls", ARRAY[]::TEXT[]),
  'mediaItems', COALESCE(gb."media_items", '[]'::JSONB),
  'mediaType', gb."media_type",
  'confidence', gb."confidence",
  'postAudioUrl', gb."post_audio_url",
  'postAudioStartTimeMs', gb."post_audio_start_time_ms",
  'postAudioDurationMs', gb."post_audio_duration_ms",
  'isHomeBanner', gb."is_home_banner",
  'homeBannerStartDate', gb."home_banner_start_date",
  'homeBannerEndDate', gb."home_banner_end_date"
)
WHERE gb."source_type" = 'PLAYWRIGHT_PUBLIC'
  AND gb."collection_proposal_snapshot" IS NULL;

UPDATE "group_buys"
SET "collection_reviewed_snapshot" = "collection_proposal_snapshot"
WHERE "source_type" = 'PLAYWRIGHT_PUBLIC'
  AND "collection_review_status" <> 'PENDING'
  AND "collection_reviewed_snapshot" IS NULL;

CREATE INDEX IF NOT EXISTS "group_buys_source_review_created_idx"
  ON "group_buys" (
    "source_type",
    "collection_review_status",
    "created_at" DESC
  );

COMMENT ON COLUMN "group_buys"."collection_review_status" IS
  'Immutable automatic-collection moderation outcome, independent of catalog visibility status.';
COMMENT ON COLUMN "group_buys"."collection_proposal_snapshot" IS
  'Automatic extraction snapshot used as future collector training input.';
COMMENT ON COLUMN "group_buys"."collection_reviewed_snapshot" IS
  'Decision-time normalized snapshot after Hiker/admin enrichment.';

-- Profile enrichment and the automatic-review decision must share one row
-- lock. Otherwise a concurrent rejection could be overwritten after the
-- Edge Function performed its initial status check.
CREATE OR REPLACE FUNCTION public.finalize_automatic_collection_approval(
  p_group_buy_id TEXT,
  p_expected_influencer_id TEXT,
  p_patch JSONB,
  p_owner_touched BOOLEAN,
  p_instagram_username TEXT,
  p_profile_image_url TEXT,
  p_update_profile_image BOOLEAN,
  p_admin_id TEXT,
  p_reviewed_snapshot JSONB
)
RETURNS TABLE (group_buy_id TEXT, review_outcome TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current public.group_buys%ROWTYPE;
BEGIN
  IF p_admin_id IS NULL OR btrim(p_admin_id) = '' THEN
    RAISE EXCEPTION 'admin id is required';
  END IF;
  IF p_reviewed_snapshot IS NULL
    OR jsonb_typeof(p_reviewed_snapshot) <> 'object'
  THEN
    RAISE EXCEPTION 'reviewed snapshot must be a JSON object';
  END IF;

  SELECT *
  INTO v_current
  FROM public.group_buys AS group_buy
  WHERE group_buy.id = p_group_buy_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'automatic collection group buy not found';
  END IF;
  IF v_current.source_type IS DISTINCT FROM 'PLAYWRIGHT_PUBLIC' THEN
    RAISE EXCEPTION 'group buy is not an automatic collection candidate';
  END IF;

  IF v_current.collection_review_status = 'APPROVED' THEN
    RETURN QUERY SELECT p_group_buy_id, 'IDEMPOTENT'::TEXT;
    RETURN;
  END IF;
  IF v_current.collection_review_status IS DISTINCT FROM 'PENDING' THEN
    RAISE EXCEPTION 'automatic collection review already completed'
      USING ERRCODE = '40001';
  END IF;

  PERFORM public.update_group_buy_with_influencer_profile(
    p_group_buy_id,
    p_expected_influencer_id,
    p_patch,
    p_owner_touched,
    p_instagram_username,
    p_profile_image_url,
    p_update_profile_image
  );

  UPDATE public.group_buys AS group_buy
  SET
    status = 'APPROVED',
    rejection_reason = NULL,
    reviewed_at = now(),
    reviewed_by = p_admin_id,
    collection_review_status = 'APPROVED',
    collection_reviewed_snapshot = p_reviewed_snapshot,
    updated_at = now()
  WHERE group_buy.id = p_group_buy_id;

  RETURN QUERY SELECT p_group_buy_id, 'APPLIED'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_automatic_collection_approval(
  TEXT, TEXT, JSONB, BOOLEAN, TEXT, TEXT, BOOLEAN, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_automatic_collection_approval(
  TEXT, TEXT, JSONB, BOOLEAN, TEXT, TEXT, BOOLEAN, TEXT, JSONB
) TO service_role;

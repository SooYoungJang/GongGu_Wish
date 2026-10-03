ALTER TYPE public."RawPostCollectionSource"
  ADD VALUE IF NOT EXISTS 'MANUAL_DISCOVERY';

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
  IF v_current.source_type IS DISTINCT FROM 'PLAYWRIGHT_PUBLIC'
    AND v_current.source_type IS DISTINCT FROM 'MANUAL_DISCOVERY'
  THEN
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

-- Link directly-created group buys to the canonical influencer profile so
-- public clients can load the same avatar as legacy raw-post group buys.
ALTER TABLE public.group_buys
  ADD COLUMN IF NOT EXISTS influencer_id TEXT;

ALTER TABLE public.gonggu_submissions
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- Existing uniqueness is case-sensitive and includes a literal leading @.
-- This lookup index keeps normalized backfills, upserts, and ranking batches
-- from rescanning the full influencer table for every requested account.
CREATE INDEX IF NOT EXISTS influencers_normalized_instagram_username_idx
  ON public.influencers ((
    regexp_replace(lower(btrim(instagram_username)), '^@+', '')
  ));

-- The current group-buy account is authoritative because admins may reassign
-- a legacy raw-post deal. Pick the same canonical row deterministically if
-- historical case/@ variants exist.
WITH current_handles AS (
  SELECT
    group_buy.id AS group_buy_id,
    regexp_replace(
      lower(btrim(COALESCE(group_buy.instagram_username, ''))),
      '^@+',
      ''
    ) AS username
  FROM public.group_buys AS group_buy
  WHERE group_buy.influencer_id IS NULL
), normalized_matches AS (
  SELECT
    current_handle.group_buy_id,
    (
      SELECT influencer.id
      FROM public.influencers AS influencer
      WHERE regexp_replace(
              lower(btrim(influencer.instagram_username)),
              '^@+',
              ''
            ) = current_handle.username
      ORDER BY
        (influencer.profile_image_url IS NOT NULL) DESC,
        influencer.is_active DESC,
        influencer.id
      LIMIT 1
    ) AS influencer_id
  FROM current_handles AS current_handle
  WHERE current_handle.username ~ '^[a-z0-9._]{1,30}$'
    AND current_handle.username <> 'unknown'
)
UPDATE public.group_buys AS group_buy
SET influencer_id = normalized_matches.influencer_id
FROM normalized_matches
WHERE group_buy.id = normalized_matches.group_buy_id
  AND normalized_matches.influencer_id IS NOT NULL;

-- Fall back to the raw-post owner only when the current account is missing,
-- a legacy placeholder, invalid, or still names that same raw-post owner.
-- A valid but unmatched reassigned account remains unlinked instead of being
-- silently restored to its previous owner.
UPDATE public.group_buys AS group_buy
SET influencer_id = raw_post.influencer_id
FROM public.raw_posts AS raw_post
LEFT JOIN public.influencers AS raw_influencer
  ON raw_influencer.id = raw_post.influencer_id
WHERE group_buy.influencer_id IS NULL
  AND group_buy.raw_post_id = raw_post.id
  AND raw_post.influencer_id IS NOT NULL
  AND regexp_replace(
    lower(btrim(COALESCE(raw_influencer.instagram_username, ''))),
    '^@+',
    ''
  ) ~ '^[a-z0-9._]{1,30}$'
  AND regexp_replace(
    lower(btrim(COALESCE(raw_influencer.instagram_username, ''))),
    '^@+',
    ''
  ) <> 'unknown'
  AND (
    regexp_replace(
      lower(btrim(COALESCE(group_buy.instagram_username, ''))),
      '^@+',
      ''
    ) = ''
    OR regexp_replace(
      lower(btrim(COALESCE(group_buy.instagram_username, ''))),
      '^@+',
      ''
    ) = 'unknown'
    OR regexp_replace(
      lower(btrim(COALESCE(group_buy.instagram_username, ''))),
      '^@+',
      ''
    ) !~ '^[a-z0-9._]{1,30}$'
    OR regexp_replace(
      lower(btrim(COALESCE(group_buy.instagram_username, ''))),
      '^@+',
      ''
    ) = regexp_replace(
      lower(btrim(COALESCE(raw_influencer.instagram_username, ''))),
      '^@+',
      ''
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'group_buys_influencer_id_fkey'
      AND conrelid = 'public.group_buys'::regclass
  ) THEN
    ALTER TABLE public.group_buys
      ADD CONSTRAINT group_buys_influencer_id_fkey
      FOREIGN KEY (influencer_id)
      REFERENCES public.influencers(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS group_buys_influencer_id_idx
  ON public.group_buys(influencer_id);

COMMENT ON COLUMN public.group_buys.influencer_id IS
  'Canonical influencer used for the Instagram account and profile avatar.';

COMMENT ON COLUMN public.gonggu_submissions.profile_image_url IS
  'Instagram profile avatar captured during the Hiker admin review flow.';

-- Admin writes are serialized by normalized Instagram handle. This keeps the
-- existing exact-case unique constraint compatible while preventing two admin
-- saves from creating competing canonical rows.
CREATE OR REPLACE FUNCTION public.upsert_influencer_profile(
  p_instagram_username TEXT,
  p_profile_image_url TEXT DEFAULT NULL,
  p_update_profile_image BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  influencer_id TEXT,
  instagram_username TEXT,
  profile_image_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_username TEXT;
  v_profile_image_url TEXT;
  v_influencer_id TEXT;
BEGIN
  v_username := regexp_replace(
    lower(btrim(COALESCE(p_instagram_username, ''))),
    '^@+',
    ''
  );
  IF v_username = 'unknown' OR v_username !~ '^[a-z0-9._]{1,30}$' THEN
    RAISE EXCEPTION 'invalid Instagram username';
  END IF;

  v_profile_image_url := NULLIF(btrim(p_profile_image_url), '');
  IF p_update_profile_image
    AND v_profile_image_url IS NOT NULL
    AND (
      length(v_profile_image_url) > 8192
      OR v_profile_image_url !~* '^https://([a-z0-9-]+\.)*(cdninstagram\.com|fbcdn\.net)([/?#]|$)'
    )
  THEN
    RAISE EXCEPTION 'invalid Instagram profile image URL';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_username, 0));

  SELECT influencer.id
  INTO v_influencer_id
  FROM public.influencers AS influencer
  WHERE regexp_replace(
          lower(btrim(influencer.instagram_username)),
          '^@+',
          ''
        ) = v_username
  ORDER BY
    (influencer.profile_image_url IS NOT NULL) DESC,
    influencer.is_active DESC,
    influencer.id
  LIMIT 1
  FOR UPDATE;

  IF v_influencer_id IS NULL THEN
    BEGIN
      INSERT INTO public.influencers (
        id,
        instagram_username,
        profile_image_url,
        is_active,
        updated_at
      )
      VALUES (
        gen_random_uuid()::TEXT,
        v_username,
        CASE WHEN p_update_profile_image THEN v_profile_image_url ELSE NULL END,
        TRUE,
        now()
      )
      RETURNING id INTO v_influencer_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT influencer.id
      INTO v_influencer_id
      FROM public.influencers AS influencer
      WHERE regexp_replace(
              lower(btrim(influencer.instagram_username)),
              '^@+',
              ''
            ) = v_username
      ORDER BY
        (influencer.profile_image_url IS NOT NULL) DESC,
        influencer.is_active DESC,
        influencer.id
      LIMIT 1
      FOR UPDATE;
      IF v_influencer_id IS NULL THEN
        RAISE;
      END IF;
    END;
  ELSIF p_update_profile_image THEN
    UPDATE public.influencers
    SET
      profile_image_url = v_profile_image_url,
      updated_at = now()
    WHERE id = v_influencer_id;
  END IF;

  RETURN QUERY
  SELECT
    influencer.id,
    influencer.instagram_username,
    influencer.profile_image_url
  FROM public.influencers AS influencer
  WHERE influencer.id = v_influencer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_influencer_profile(TEXT, TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_influencer_profile(TEXT, TEXT, BOOLEAN)
  TO service_role;

-- Keep an admin group-buy patch and its canonical influencer mutation in the
-- same transaction. The explicit allowlist prevents a future Edge bug from
-- turning the JSON patch into an unrestricted service-role update.
CREATE OR REPLACE FUNCTION public.update_group_buy_with_influencer_profile(
  p_group_buy_id TEXT,
  p_expected_influencer_id TEXT,
  p_patch JSONB,
  p_owner_touched BOOLEAN,
  p_instagram_username TEXT,
  p_profile_image_url TEXT,
  p_update_profile_image BOOLEAN
)
RETURNS TABLE (group_buy_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current public.group_buys%ROWTYPE;
  v_patch public.group_buys%ROWTYPE;
  v_influencer_id TEXT;
  v_instagram_username TEXT;
BEGIN
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'group-buy patch must be a JSON object';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_patch) AS patch_key(key)
    WHERE NOT (
      patch_key.key = ANY (ARRAY[
        'product_name', 'brand_name', 'category', 'start_date', 'end_date',
        'purchase_url', 'discount_info', 'summary', 'thumbnail_url',
        'video_url', 'media_urls', 'media_items', 'media_type', 'confidence',
        'status', 'is_all_day', 'is_monthly_featured',
        'monthly_featured_rank', 'post_audio_url',
        'post_audio_start_time_ms', 'post_audio_duration_ms',
        'post_audio_checked_at', 'price_krw', 'is_home_banner',
        'home_banner_start_date', 'home_banner_end_date', 'updated_at'
      ]::TEXT[])
    )
  ) THEN
    RAISE EXCEPTION 'group-buy patch contains an unsupported field';
  END IF;

  SELECT *
  INTO v_current
  FROM public.group_buys AS group_buy
  WHERE group_buy.id = p_group_buy_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'group buy not found';
  END IF;
  IF p_owner_touched
    AND v_current.influencer_id IS DISTINCT FROM p_expected_influencer_id
  THEN
    RAISE EXCEPTION 'group-buy influencer changed concurrently'
      USING ERRCODE = '40001';
  END IF;

  v_influencer_id := v_current.influencer_id;
  v_instagram_username := v_current.instagram_username;
  IF p_owner_touched THEN
    IF p_instagram_username IS NULL OR btrim(p_instagram_username) = '' THEN
      v_influencer_id := NULL;
      v_instagram_username := NULL;
    ELSE
      SELECT profile.influencer_id, profile.instagram_username
      INTO v_influencer_id, v_instagram_username
      FROM public.upsert_influencer_profile(
        p_instagram_username,
        p_profile_image_url,
        p_update_profile_image
      ) AS profile;
    END IF;
  END IF;

  SELECT *
  INTO v_patch
  FROM jsonb_populate_record(NULL::public.group_buys, p_patch);

  UPDATE public.group_buys AS group_buy
  SET
    product_name = CASE WHEN p_patch ? 'product_name' THEN v_patch.product_name ELSE group_buy.product_name END,
    brand_name = CASE WHEN p_patch ? 'brand_name' THEN v_patch.brand_name ELSE group_buy.brand_name END,
    instagram_username = CASE WHEN p_owner_touched THEN v_instagram_username ELSE group_buy.instagram_username END,
    influencer_id = CASE WHEN p_owner_touched THEN v_influencer_id ELSE group_buy.influencer_id END,
    category = CASE WHEN p_patch ? 'category' THEN v_patch.category ELSE group_buy.category END,
    start_date = CASE WHEN p_patch ? 'start_date' THEN v_patch.start_date ELSE group_buy.start_date END,
    end_date = CASE WHEN p_patch ? 'end_date' THEN v_patch.end_date ELSE group_buy.end_date END,
    purchase_url = CASE WHEN p_patch ? 'purchase_url' THEN v_patch.purchase_url ELSE group_buy.purchase_url END,
    discount_info = CASE WHEN p_patch ? 'discount_info' THEN v_patch.discount_info ELSE group_buy.discount_info END,
    summary = CASE WHEN p_patch ? 'summary' THEN v_patch.summary ELSE group_buy.summary END,
    thumbnail_url = CASE WHEN p_patch ? 'thumbnail_url' THEN v_patch.thumbnail_url ELSE group_buy.thumbnail_url END,
    video_url = CASE WHEN p_patch ? 'video_url' THEN v_patch.video_url ELSE group_buy.video_url END,
    media_urls = CASE WHEN p_patch ? 'media_urls' THEN v_patch.media_urls ELSE group_buy.media_urls END,
    media_items = CASE WHEN p_patch ? 'media_items' THEN v_patch.media_items ELSE group_buy.media_items END,
    media_type = CASE WHEN p_patch ? 'media_type' THEN v_patch.media_type ELSE group_buy.media_type END,
    confidence = CASE WHEN p_patch ? 'confidence' THEN v_patch.confidence ELSE group_buy.confidence END,
    status = CASE WHEN p_patch ? 'status' THEN v_patch.status ELSE group_buy.status END,
    is_all_day = CASE WHEN p_patch ? 'is_all_day' THEN v_patch.is_all_day ELSE group_buy.is_all_day END,
    is_monthly_featured = CASE WHEN p_patch ? 'is_monthly_featured' THEN v_patch.is_monthly_featured ELSE group_buy.is_monthly_featured END,
    monthly_featured_rank = CASE WHEN p_patch ? 'monthly_featured_rank' THEN v_patch.monthly_featured_rank ELSE group_buy.monthly_featured_rank END,
    post_audio_url = CASE WHEN p_patch ? 'post_audio_url' THEN v_patch.post_audio_url ELSE group_buy.post_audio_url END,
    post_audio_start_time_ms = CASE WHEN p_patch ? 'post_audio_start_time_ms' THEN v_patch.post_audio_start_time_ms ELSE group_buy.post_audio_start_time_ms END,
    post_audio_duration_ms = CASE WHEN p_patch ? 'post_audio_duration_ms' THEN v_patch.post_audio_duration_ms ELSE group_buy.post_audio_duration_ms END,
    post_audio_checked_at = CASE WHEN p_patch ? 'post_audio_checked_at' THEN v_patch.post_audio_checked_at ELSE group_buy.post_audio_checked_at END,
    price_krw = CASE WHEN p_patch ? 'price_krw' THEN v_patch.price_krw ELSE group_buy.price_krw END,
    is_home_banner = CASE WHEN p_patch ? 'is_home_banner' THEN v_patch.is_home_banner ELSE group_buy.is_home_banner END,
    home_banner_start_date = CASE WHEN p_patch ? 'home_banner_start_date' THEN v_patch.home_banner_start_date ELSE group_buy.home_banner_start_date END,
    home_banner_end_date = CASE WHEN p_patch ? 'home_banner_end_date' THEN v_patch.home_banner_end_date ELSE group_buy.home_banner_end_date END,
    updated_at = now()
  WHERE group_buy.id = p_group_buy_id;

  RETURN QUERY SELECT p_group_buy_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_group_buy_with_influencer_profile(
  TEXT, TEXT, JSONB, BOOLEAN, TEXT, TEXT, BOOLEAN
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_group_buy_with_influencer_profile(
  TEXT, TEXT, JSONB, BOOLEAN, TEXT, TEXT, BOOLEAN
) TO service_role;

-- Lock the exact pending submission snapshot, then atomically create the group
-- buy, link the canonical profile, and transition the submission to APPROVED.
CREATE OR REPLACE FUNCTION public.finalize_gonggu_submission_approval(
  p_submission_id TEXT,
  p_group_buy_id TEXT,
  p_admin_id TEXT,
  p_expected_submission_updated_at TIMESTAMP,
  p_group_buy_payload JSONB,
  p_submission_patch JSONB,
  p_instagram_username TEXT,
  p_profile_image_url TEXT,
  p_update_profile_image BOOLEAN
)
RETURNS TABLE (group_buy_id TEXT, influencer_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_submission public.gonggu_submissions%ROWTYPE;
  v_submission_patch public.gonggu_submissions%ROWTYPE;
  v_group_buy_payload public.group_buys%ROWTYPE;
  v_influencer_id TEXT;
  v_instagram_username TEXT;
BEGIN
  IF p_group_buy_payload IS NULL OR jsonb_typeof(p_group_buy_payload) <> 'object' THEN
    RAISE EXCEPTION 'group-buy payload must be a JSON object';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_group_buy_payload) AS payload_key(key)
    WHERE NOT (
      payload_key.key = ANY (ARRAY[
        'product_name', 'brand_name', 'category', 'start_date', 'end_date',
        'purchase_url', 'discount_info', 'price_krw', 'summary',
        'thumbnail_url', 'video_url', 'media_urls', 'media_items',
        'media_type', 'post_audio_url', 'post_audio_start_time_ms',
        'post_audio_duration_ms', 'post_audio_checked_at', 'is_all_day',
        'is_monthly_featured', 'monthly_featured_rank', 'is_home_banner',
        'home_banner_start_date', 'home_banner_end_date', 'confidence'
      ]::TEXT[])
    )
  ) THEN
    RAISE EXCEPTION 'group-buy payload contains an unsupported field';
  END IF;
  IF p_submission_patch IS NULL OR jsonb_typeof(p_submission_patch) <> 'object' THEN
    RAISE EXCEPTION 'submission patch must be a JSON object';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_submission_patch) AS patch_key(key)
    WHERE NOT (
      patch_key.key = ANY (ARRAY[
        'product_name', 'brand_name', 'instagram_username',
        'profile_image_url', 'category', 'start_date', 'end_date',
        'purchase_url', 'discount_info', 'summary', 'instagram_url',
        'image_urls', 'media_items', 'admin_memo', 'post_audio_url',
        'post_audio_start_time_ms', 'post_audio_duration_ms',
        'post_audio_checked_at', 'price_krw', 'is_home_banner',
        'home_banner_start_date', 'home_banner_end_date', 'updated_at'
      ]::TEXT[])
    )
  ) THEN
    RAISE EXCEPTION 'submission patch contains an unsupported field';
  END IF;

  SELECT *
  INTO v_submission
  FROM public.gonggu_submissions AS submission
  WHERE submission.id = p_submission_id
  FOR UPDATE;
  IF NOT FOUND
    OR v_submission.status <> 'PENDING'
    OR v_submission.updated_at IS DISTINCT FROM p_expected_submission_updated_at
  THEN
    RAISE EXCEPTION 'submission is no longer pending'
      USING ERRCODE = '40001';
  END IF;

  IF p_instagram_username IS NOT NULL AND btrim(p_instagram_username) <> '' THEN
    SELECT profile.influencer_id, profile.instagram_username
    INTO v_influencer_id, v_instagram_username
    FROM public.upsert_influencer_profile(
      p_instagram_username,
      p_profile_image_url,
      p_update_profile_image
    ) AS profile;
  END IF;

  SELECT *
  INTO v_group_buy_payload
  FROM jsonb_populate_record(
    NULL::public.group_buys,
    p_group_buy_payload
  );

  INSERT INTO public.group_buys (
    id,
    product_name,
    brand_name,
    instagram_username,
    influencer_id,
    category,
    start_date,
    end_date,
    purchase_url,
    discount_info,
    price_krw,
    summary,
    thumbnail_url,
    video_url,
    media_urls,
    media_items,
    media_type,
    post_audio_url,
    post_audio_start_time_ms,
    post_audio_duration_ms,
    post_audio_checked_at,
    is_all_day,
    is_monthly_featured,
    monthly_featured_rank,
    is_home_banner,
    home_banner_start_date,
    home_banner_end_date,
    source_type,
    submission_id,
    status,
    confidence,
    created_at,
    updated_at
  ) VALUES (
    p_group_buy_id,
    v_group_buy_payload.product_name,
    v_group_buy_payload.brand_name,
    v_instagram_username,
    v_influencer_id,
    v_group_buy_payload.category,
    v_group_buy_payload.start_date,
    v_group_buy_payload.end_date,
    v_group_buy_payload.purchase_url,
    v_group_buy_payload.discount_info,
    v_group_buy_payload.price_krw,
    v_group_buy_payload.summary,
    v_group_buy_payload.thumbnail_url,
    v_group_buy_payload.video_url,
    v_group_buy_payload.media_urls,
    v_group_buy_payload.media_items,
    v_group_buy_payload.media_type,
    v_group_buy_payload.post_audio_url,
    v_group_buy_payload.post_audio_start_time_ms,
    v_group_buy_payload.post_audio_duration_ms,
    v_group_buy_payload.post_audio_checked_at,
    v_group_buy_payload.is_all_day,
    v_group_buy_payload.is_monthly_featured,
    v_group_buy_payload.monthly_featured_rank,
    v_group_buy_payload.is_home_banner,
    v_group_buy_payload.home_banner_start_date,
    v_group_buy_payload.home_banner_end_date,
    'SUBMISSION',
    p_submission_id,
    'APPROVED',
    v_group_buy_payload.confidence,
    now(),
    now()
  );

  SELECT *
  INTO v_submission_patch
  FROM jsonb_populate_record(
    NULL::public.gonggu_submissions,
    p_submission_patch
  );

  UPDATE public.gonggu_submissions AS submission
  SET
    product_name = CASE WHEN p_submission_patch ? 'product_name' THEN v_submission_patch.product_name ELSE submission.product_name END,
    brand_name = CASE WHEN p_submission_patch ? 'brand_name' THEN v_submission_patch.brand_name ELSE submission.brand_name END,
    instagram_username = CASE WHEN p_submission_patch ? 'instagram_username' THEN v_submission_patch.instagram_username ELSE submission.instagram_username END,
    profile_image_url = CASE WHEN p_submission_patch ? 'profile_image_url' THEN v_submission_patch.profile_image_url ELSE submission.profile_image_url END,
    category = CASE WHEN p_submission_patch ? 'category' THEN v_submission_patch.category ELSE submission.category END,
    start_date = CASE WHEN p_submission_patch ? 'start_date' THEN v_submission_patch.start_date ELSE submission.start_date END,
    end_date = CASE WHEN p_submission_patch ? 'end_date' THEN v_submission_patch.end_date ELSE submission.end_date END,
    purchase_url = CASE WHEN p_submission_patch ? 'purchase_url' THEN v_submission_patch.purchase_url ELSE submission.purchase_url END,
    discount_info = CASE WHEN p_submission_patch ? 'discount_info' THEN v_submission_patch.discount_info ELSE submission.discount_info END,
    summary = CASE WHEN p_submission_patch ? 'summary' THEN v_submission_patch.summary ELSE submission.summary END,
    instagram_url = CASE WHEN p_submission_patch ? 'instagram_url' THEN v_submission_patch.instagram_url ELSE submission.instagram_url END,
    image_urls = CASE WHEN p_submission_patch ? 'image_urls' THEN v_submission_patch.image_urls ELSE submission.image_urls END,
    media_items = CASE WHEN p_submission_patch ? 'media_items' THEN v_submission_patch.media_items ELSE submission.media_items END,
    admin_memo = CASE WHEN p_submission_patch ? 'admin_memo' THEN v_submission_patch.admin_memo ELSE submission.admin_memo END,
    post_audio_url = CASE WHEN p_submission_patch ? 'post_audio_url' THEN v_submission_patch.post_audio_url ELSE submission.post_audio_url END,
    post_audio_start_time_ms = CASE WHEN p_submission_patch ? 'post_audio_start_time_ms' THEN v_submission_patch.post_audio_start_time_ms ELSE submission.post_audio_start_time_ms END,
    post_audio_duration_ms = CASE WHEN p_submission_patch ? 'post_audio_duration_ms' THEN v_submission_patch.post_audio_duration_ms ELSE submission.post_audio_duration_ms END,
    post_audio_checked_at = CASE WHEN p_submission_patch ? 'post_audio_checked_at' THEN v_submission_patch.post_audio_checked_at ELSE submission.post_audio_checked_at END,
    price_krw = CASE WHEN p_submission_patch ? 'price_krw' THEN v_submission_patch.price_krw ELSE submission.price_krw END,
    is_home_banner = CASE WHEN p_submission_patch ? 'is_home_banner' THEN v_submission_patch.is_home_banner ELSE submission.is_home_banner END,
    home_banner_start_date = CASE WHEN p_submission_patch ? 'home_banner_start_date' THEN v_submission_patch.home_banner_start_date ELSE submission.home_banner_start_date END,
    home_banner_end_date = CASE WHEN p_submission_patch ? 'home_banner_end_date' THEN v_submission_patch.home_banner_end_date ELSE submission.home_banner_end_date END,
    status = 'APPROVED',
    group_buy_id = p_group_buy_id,
    reviewed_at = now(),
    reviewed_by = p_admin_id,
    updated_at = now()
  WHERE submission.id = p_submission_id;

  RETURN QUERY SELECT p_group_buy_id, v_influencer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_gonggu_submission_approval(
  TEXT, TEXT, TEXT, TIMESTAMP, JSONB, JSONB, TEXT, TEXT, BOOLEAN
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_gonggu_submission_approval(
  TEXT, TEXT, TEXT, TIMESTAMP, JSONB, JSONB, TEXT, TEXT, BOOLEAN
) TO service_role;

-- Ranking enrichment uses a parameterized normalized lookup rather than an
-- ILIKE OR expression, where '_' would otherwise be treated as a wildcard.
CREATE OR REPLACE FUNCTION public.get_influencer_profiles_by_usernames(
  p_instagram_usernames TEXT[]
)
RETURNS TABLE (
  instagram_username TEXT,
  profile_image_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH requested AS (
    SELECT DISTINCT regexp_replace(lower(btrim(value)), '^@+', '') AS username
    FROM unnest(COALESCE(p_instagram_usernames, ARRAY[]::TEXT[])) AS value
  )
  SELECT
    requested.username AS instagram_username,
    (
      SELECT influencer.profile_image_url
      FROM public.influencers AS influencer
      WHERE regexp_replace(
              lower(btrim(influencer.instagram_username)),
              '^@+',
              ''
            ) = requested.username
      ORDER BY
        (influencer.profile_image_url IS NOT NULL) DESC,
        influencer.is_active DESC,
        influencer.id
      LIMIT 1
    ) AS profile_image_url
  FROM requested
  WHERE requested.username ~ '^[a-z0-9._]{1,30}$'
    AND requested.username <> 'unknown'
  ORDER BY requested.username;
$$;

REVOKE ALL ON FUNCTION public.get_influencer_profiles_by_usernames(TEXT[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_influencer_profiles_by_usernames(TEXT[])
  TO service_role;

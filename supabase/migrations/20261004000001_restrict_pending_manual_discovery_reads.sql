-- Manual discoveries stay private until review approval; other sources retain existing visibility.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.group_buys AS group_buy
    LEFT JOIN public.raw_posts AS raw_post
      ON raw_post.id = group_buy.raw_post_id
    WHERE (
      group_buy.source_type = 'MANUAL_DISCOVERY'
      AND (
        group_buy.raw_post_id IS NULL
        OR raw_post.id IS NULL
        OR raw_post.collection_source::text IS DISTINCT FROM 'MANUAL_DISCOVERY'
      )
    ) OR (
      raw_post.collection_source::text = 'MANUAL_DISCOVERY'
      AND group_buy.source_type IS DISTINCT FROM 'MANUAL_DISCOVERY'
    )
  ) THEN
    RAISE EXCEPTION 'Existing manual-discovery source markers are inconsistent'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

ALTER TABLE public.group_buys
  ADD CONSTRAINT "group_buys_manual_discovery_review_state_check"
  CHECK (
    source_type IS DISTINCT FROM 'MANUAL_DISCOVERY'
    OR (
      collection_review_status IS NOT NULL
      AND (
        (collection_review_status = 'PENDING' AND status = 'REVIEW_REQUIRED')
        OR (
          collection_review_status = 'APPROVED'
          AND status IN ('APPROVED', 'EXPIRED')
        )
        OR (collection_review_status = 'REJECTED' AND status = 'REJECTED')
      )
    )
  );

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.enforce_manual_discovery_group_buy_source_alignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  raw_collection_source text;
BEGIN
  IF NEW.raw_post_id IS NULL THEN
    IF NEW.source_type = 'MANUAL_DISCOVERY' THEN
      RAISE EXCEPTION 'Manual discoveries require a linked manual raw post'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  SELECT raw_post.collection_source::text
  INTO raw_collection_source
  FROM public.raw_posts AS raw_post
  WHERE raw_post.id = NEW.raw_post_id;

  IF NEW.source_type = 'MANUAL_DISCOVERY'
    AND raw_collection_source IS DISTINCT FROM 'MANUAL_DISCOVERY'
  THEN
    RAISE EXCEPTION 'Manual discovery source markers must match'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.source_type IS DISTINCT FROM 'MANUAL_DISCOVERY'
    AND raw_collection_source = 'MANUAL_DISCOVERY'
  THEN
    RAISE EXCEPTION 'Manual discovery source markers must match'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER group_buys_manual_discovery_source_alignment
  BEFORE INSERT OR UPDATE OF raw_post_id, source_type ON public.group_buys
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_manual_discovery_group_buy_source_alignment();

CREATE OR REPLACE FUNCTION private.enforce_manual_discovery_raw_post_source_alignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (NEW.collection_source::text = 'MANUAL_DISCOVERY')
    IS DISTINCT FROM (OLD.collection_source::text = 'MANUAL_DISCOVERY')
    AND EXISTS (
      SELECT 1
      FROM public.group_buys AS group_buy
      WHERE group_buy.raw_post_id = NEW.id
        AND (group_buy.source_type = 'MANUAL_DISCOVERY')
          IS DISTINCT FROM (NEW.collection_source::text = 'MANUAL_DISCOVERY')
    )
  THEN
    RAISE EXCEPTION 'Manual discovery source markers must match'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER raw_posts_manual_discovery_source_alignment
  BEFORE UPDATE OF collection_source ON public.raw_posts
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_manual_discovery_raw_post_source_alignment();

REVOKE ALL ON FUNCTION private.enforce_manual_discovery_group_buy_source_alignment() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.enforce_manual_discovery_raw_post_source_alignment() FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.is_manual_discovery_raw_post_public(
  p_raw_post_id text,
  p_collection_source text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    (
      p_collection_source IS DISTINCT FROM 'MANUAL_DISCOVERY'
      AND NOT EXISTS (
        SELECT 1
        FROM public.group_buys AS group_buy
        WHERE group_buy.raw_post_id = p_raw_post_id
          AND group_buy.source_type = 'MANUAL_DISCOVERY'
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.group_buys AS group_buy
      WHERE group_buy.raw_post_id = p_raw_post_id
        AND group_buy.source_type = 'MANUAL_DISCOVERY'
        AND group_buy.collection_review_status = 'APPROVED'
        AND group_buy.status IN ('APPROVED', 'EXPIRED')
    );
$$;

REVOKE ALL ON FUNCTION private.is_manual_discovery_raw_post_public(
  text,
  text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_manual_discovery_raw_post_public(
  text,
  text
) TO anon, authenticated;

ALTER POLICY "group_buys_public_read"
  ON public.group_buys TO anon, authenticated
  USING (
    source_type IS DISTINCT FROM 'MANUAL_DISCOVERY'
    OR (
      collection_review_status = 'APPROVED'
      AND status IN ('APPROVED', 'EXPIRED')
    )
  );

ALTER POLICY "raw_posts_public_read"
  ON public.raw_posts TO anon, authenticated
  USING (
    private.is_manual_discovery_raw_post_public(
      raw_posts.id,
      raw_posts.collection_source::text
    )
  );

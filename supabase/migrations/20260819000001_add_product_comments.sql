-- Product-scoped UGC comments with threaded replies, likes and moderation.
-- Public clients use the allow-listed RPCs below; base tables are not exposed.

ALTER TABLE public.group_buys
  ADD COLUMN IF NOT EXISTS comments_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.comment_user_moderation (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'BANNED')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comment_terms_acceptances (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, terms_version)
);

CREATE TABLE IF NOT EXISTS public.comment_user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS public.group_buy_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_buy_id text NOT NULL REFERENCES public.group_buys(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_id uuid,
  root_id uuid,
  depth integer NOT NULL DEFAULT 0 CHECK (depth >= 0),
  body text,
  author_display_name text,
  state text NOT NULL DEFAULT 'VISIBLE'
    CHECK (state IN ('VISIBLE', 'HIDDEN', 'DELETED', 'ACCOUNT_ANONYMIZED')),
  like_count integer NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  direct_reply_count integer NOT NULL DEFAULT 0 CHECK (direct_reply_count >= 0),
  content_version integer NOT NULL DEFAULT 1 CHECK (content_version > 0),
  client_request_id uuid NOT NULL,
  request_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  CONSTRAINT group_buy_comments_body_check CHECK (
    (state = 'VISIBLE' AND body IS NOT NULL AND char_length(body) BETWEEN 1 AND 500)
    OR state IN ('HIDDEN', 'DELETED', 'ACCOUNT_ANONYMIZED')
  ),
  CONSTRAINT group_buy_comments_root_fk
    FOREIGN KEY (root_id) REFERENCES public.group_buy_comments(id) ON DELETE CASCADE,
  CONSTRAINT group_buy_comments_parent_fk
    FOREIGN KEY (parent_id) REFERENCES public.group_buy_comments(id) ON DELETE CASCADE,
  CONSTRAINT group_buy_comments_author_request_key UNIQUE (author_id, client_request_id)
);

CREATE TABLE IF NOT EXISTS public.comment_likes (
  comment_id uuid NOT NULL REFERENCES public.group_buy_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.comment_reports (
  comment_id uuid NOT NULL REFERENCES public.group_buy_comments(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_author_id uuid,
  reason text NOT NULL,
  details text,
  body_snapshot text,
  author_display_name_snapshot text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, reporter_id)
);

CREATE TABLE IF NOT EXISTS public.comment_moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES public.group_buy_comments(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('REPORT', 'HIDE', 'RESTORE', 'DELETE', 'BLOCK')),
  reason text,
  previous_state text,
  next_state text,
  content_version integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS group_buy_comments_root_latest_idx
  ON public.group_buy_comments (group_buy_id, created_at DESC, id DESC)
  WHERE parent_id IS NULL;
CREATE INDEX IF NOT EXISTS group_buy_comments_root_popular_idx
  ON public.group_buy_comments (group_buy_id, like_count DESC, created_at DESC, id DESC)
  WHERE parent_id IS NULL;
CREATE INDEX IF NOT EXISTS group_buy_comments_parent_created_idx
  ON public.group_buy_comments (parent_id, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS group_buy_comments_group_created_idx
  ON public.group_buy_comments (group_buy_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS comment_reports_created_idx
  ON public.comment_reports (created_at DESC);

CREATE OR REPLACE FUNCTION public.provision_comment_user_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.comment_user_moderation (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gonggu_comment_user_moderation_created ON auth.users;
CREATE TRIGGER gonggu_comment_user_moderation_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.provision_comment_user_moderation();

INSERT INTO public.comment_user_moderation (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.prepare_group_buy_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  parent_comment public.group_buy_comments%ROWTYPE;
  parent_changed boolean;
BEGIN
  NEW.body := NULLIF(btrim(NEW.body), '');
  NEW.updated_at := now();

  parent_changed := TG_OP = 'INSERT';
  IF TG_OP = 'UPDATE' THEN
    parent_changed := NEW.parent_id IS DISTINCT FROM OLD.parent_id;
  END IF;

  IF NEW.parent_id IS NULL THEN
    NEW.root_id := NEW.id;
    NEW.depth := 0;
  ELSIF parent_changed THEN
    SELECT * INTO parent_comment
    FROM public.group_buy_comments
    WHERE id = NEW.parent_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PARENT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF parent_comment.group_buy_id <> NEW.group_buy_id THEN
      RAISE EXCEPTION 'PARENT_PRODUCT_MISMATCH' USING ERRCODE = 'P0001';
    END IF;
    IF parent_comment.state <> 'VISIBLE' THEN
      RAISE EXCEPTION 'PARENT_NOT_COMMENTABLE' USING ERRCODE = 'P0001';
    END IF;

    NEW.root_id := parent_comment.root_id;
    NEW.depth := parent_comment.depth + 1;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.group_buy_id <> OLD.group_buy_id
      OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
      OR NEW.root_id IS DISTINCT FROM OLD.root_id
      OR NEW.depth <> OLD.depth
      OR NEW.author_id IS DISTINCT FROM OLD.author_id
      OR NEW.created_at <> OLD.created_at
    THEN
      RAISE EXCEPTION 'COMMENT_STRUCTURE_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS group_buy_comments_prepare ON public.group_buy_comments;
CREATE TRIGGER group_buy_comments_prepare
  BEFORE INSERT OR UPDATE ON public.group_buy_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.prepare_group_buy_comment();

CREATE OR REPLACE FUNCTION public.refresh_comment_reply_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.group_buy_comments
    SET direct_reply_count = (
      SELECT count(*)::integer FROM public.group_buy_comments WHERE parent_id = OLD.parent_id
    )
    WHERE id = OLD.parent_id;
  ELSE
    UPDATE public.group_buy_comments
    SET direct_reply_count = (
      SELECT count(*)::integer FROM public.group_buy_comments WHERE parent_id = NEW.parent_id
    )
    WHERE id = NEW.parent_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS group_buy_comments_reply_count ON public.group_buy_comments;
CREATE TRIGGER group_buy_comments_reply_count
  AFTER INSERT OR DELETE ON public.group_buy_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_comment_reply_count();

CREATE OR REPLACE FUNCTION public.is_commentable_group_buy(p_group_buy_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_buys
    WHERE id = p_group_buy_id
      AND status::text IN ('APPROVED', 'EXPIRED')
      AND COALESCE(comments_enabled, true)
  );
$$;

CREATE OR REPLACE FUNCTION public.comment_public_json(p_comment_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', c.id,
    'group_buy_id', c.group_buy_id,
    'parent_id', c.parent_id,
    'root_id', c.root_id,
    'depth', c.depth,
    'state', CASE WHEN c.state = 'ACCOUNT_ANONYMIZED' THEN 'deleted' ELSE lower(c.state) END,
    'body', CASE WHEN c.state = 'VISIBLE' THEN c.body ELSE NULL END,
    'author_display_name', CASE WHEN c.state = 'VISIBLE' THEN c.author_display_name ELSE NULL END,
    'reply_to_display_name', (
      SELECT CASE WHEN parent.state = 'VISIBLE' THEN parent.author_display_name ELSE NULL END
      FROM public.group_buy_comments AS parent
      WHERE parent.id = c.parent_id
    ),
    'created_at', c.created_at,
    'edited_at', c.edited_at,
    'content_version', c.content_version,
    'like_count', c.like_count,
    'liked_by_me', EXISTS (
      SELECT 1 FROM public.comment_likes AS l
      WHERE l.comment_id = c.id AND l.user_id = auth.uid()
    ),
    'direct_reply_count', c.direct_reply_count,
    'can_edit', c.author_id = auth.uid() AND c.state = 'VISIBLE',
    'can_delete', c.author_id = auth.uid() AND c.state IN ('VISIBLE', 'HIDDEN'),
    'can_like', c.state = 'VISIBLE' AND c.author_id IS DISTINCT FROM auth.uid(),
    'can_report', c.state = 'VISIBLE' AND c.author_id IS DISTINCT FROM auth.uid()
  )
  FROM public.group_buy_comments AS c
  WHERE c.id = p_comment_id;
$$;

CREATE OR REPLACE FUNCTION public.list_comment_roots(
  p_group_buy_id text,
  p_sort text,
  p_limit integer,
  p_cursor text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  page_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  cursor_created timestamptz;
  cursor_id uuid;
  cursor_likes integer;
  result jsonb;
BEGIN
  IF NOT public.is_commentable_group_buy(p_group_buy_id) THEN
    RAISE EXCEPTION 'GROUP_BUY_NOT_COMMENTABLE' USING ERRCODE = 'P0001';
  END IF;
  IF p_sort NOT IN ('latest', 'popular') THEN
    RAISE EXCEPTION 'VALIDATION_FAILED' USING ERRCODE = 'P0001';
  END IF;

  IF p_cursor IS NOT NULL AND p_cursor <> '' THEN
    BEGIN
      IF p_sort = 'popular' THEN
        cursor_likes := split_part(p_cursor, '|', 1)::integer;
        cursor_created := split_part(p_cursor, '|', 2)::timestamptz;
        cursor_id := split_part(p_cursor, '|', 3)::uuid;
      ELSE
        cursor_created := split_part(p_cursor, '|', 1)::timestamptz;
        cursor_id := split_part(p_cursor, '|', 2)::uuid;
      END IF;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'VALIDATION_FAILED' USING ERRCODE = 'P0001';
    END;
  END IF;

  WITH candidates AS (
    SELECT c.*
    FROM public.group_buy_comments AS c
    WHERE c.group_buy_id = p_group_buy_id
      AND c.parent_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.comment_user_blocks AS b
        WHERE b.blocker_id = auth.uid() AND b.blocked_id = c.author_id
      )
      AND (
        p_cursor IS NULL OR p_cursor = '' OR
        (p_sort = 'latest' AND (c.created_at, c.id) < (cursor_created, cursor_id)) OR
        (p_sort = 'popular' AND (c.like_count, c.created_at, c.id) < (cursor_likes, cursor_created, cursor_id))
      )
    ORDER BY
      CASE WHEN p_sort = 'popular' THEN c.like_count END DESC NULLS LAST,
      c.created_at DESC,
      c.id DESC
    LIMIT page_limit + 1
  ), page AS (
    SELECT * FROM candidates LIMIT page_limit
  ), last_row AS (
    SELECT * FROM page ORDER BY
      CASE WHEN p_sort = 'popular' THEN like_count END ASC NULLS LAST,
      created_at ASC,
      id ASC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(public.comment_public_json(id) ORDER BY
      CASE WHEN p_sort = 'popular' THEN like_count END DESC NULLS LAST,
      created_at DESC, id DESC) FROM page), '[]'::jsonb),
    'next_cursor', CASE
      WHEN (SELECT count(*) FROM candidates) > page_limit THEN
        CASE WHEN p_sort = 'popular'
          THEN (SELECT like_count::text || '|' || created_at::text || '|' || id::text FROM last_row)
          ELSE (SELECT created_at::text || '|' || id::text FROM last_row)
        END
      ELSE NULL
    END,
    'live_ranking', (p_sort = 'popular')
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_comment_children(
  p_group_buy_id text,
  p_parent_id uuid,
  p_limit integer,
  p_cursor text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  page_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  cursor_created timestamptz;
  cursor_id uuid;
  result jsonb;
BEGIN
  IF NOT public.is_commentable_group_buy(p_group_buy_id) THEN
    RAISE EXCEPTION 'GROUP_BUY_NOT_COMMENTABLE' USING ERRCODE = 'P0001';
  END IF;
  IF p_cursor IS NOT NULL AND p_cursor <> '' THEN
    BEGIN
      cursor_created := split_part(p_cursor, '|', 1)::timestamptz;
      cursor_id := split_part(p_cursor, '|', 2)::uuid;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'VALIDATION_FAILED' USING ERRCODE = 'P0001';
    END;
  END IF;

  WITH candidates AS (
    SELECT c.*
    FROM public.group_buy_comments AS c
    WHERE c.group_buy_id = p_group_buy_id
      AND c.parent_id = p_parent_id
      AND NOT EXISTS (
        SELECT 1 FROM public.comment_user_blocks AS b
        WHERE b.blocker_id = auth.uid() AND b.blocked_id = c.author_id
      )
      AND (p_cursor IS NULL OR p_cursor = '' OR (c.created_at, c.id) > (cursor_created, cursor_id))
    ORDER BY c.created_at ASC, c.id ASC
    LIMIT page_limit + 1
  ), page AS (
    SELECT * FROM candidates LIMIT page_limit
  ), last_row AS (
    SELECT * FROM page ORDER BY created_at DESC, id DESC LIMIT 1
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(public.comment_public_json(id) ORDER BY created_at ASC, id ASC) FROM page), '[]'::jsonb),
    'next_cursor', CASE WHEN (SELECT count(*) FROM candidates) > page_limit
      THEN (SELECT created_at::text || '|' || id::text FROM last_row)
      ELSE NULL END,
    'live_ranking', false
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_comment_terms(p_terms_version text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF p_terms_version IS NULL OR p_terms_version <> 'community-v1' THEN
    RAISE EXCEPTION 'VALIDATION_FAILED' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.comment_terms_acceptances (user_id, terms_version)
  VALUES (auth.uid(), p_terms_version)
  ON CONFLICT (user_id, terms_version) DO NOTHING;
  RETURN jsonb_build_object('accepted', true, 'terms_version', p_terms_version);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_comment(
  p_group_buy_id text,
  p_parent_id uuid,
  p_body text,
  p_client_request_id uuid,
  p_terms_version text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  normalized_body text := btrim(COALESCE(p_body, ''));
  fingerprint text;
  existing public.group_buy_comments%ROWTYPE;
  new_comment public.group_buy_comments%ROWTYPE;
  parent_comment public.group_buy_comments%ROWTYPE;
  display_name text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.comment_user_moderation
    WHERE user_id = current_user_id AND status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.is_commentable_group_buy(p_group_buy_id) THEN
    RAISE EXCEPTION 'GROUP_BUY_NOT_COMMENTABLE' USING ERRCODE = 'P0001';
  END IF;
  IF p_terms_version <> 'community-v1' OR NOT EXISTS (
    SELECT 1 FROM public.comment_terms_acceptances
    WHERE user_id = current_user_id AND terms_version = 'community-v1'
  ) THEN
    RAISE EXCEPTION 'TERMS_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(normalized_body) < 1 OR char_length(normalized_body) > 500
    OR normalized_body ~ '[<>]'
    OR normalized_body ~* '(https?://|www\.)'
  THEN
    RAISE EXCEPTION 'VALIDATION_FAILED' USING ERRCODE = 'P0001';
  END IF;
  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_FAILED' USING ERRCODE = 'P0001';
  END IF;

  fingerprint := md5(p_group_buy_id || '|' || COALESCE(p_parent_id::text, '') || '|' || normalized_body);
  SELECT * INTO existing
  FROM public.group_buy_comments
  WHERE author_id = current_user_id AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF existing.request_fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE = 'P0001';
    END IF;
    RETURN public.comment_public_json(existing.id);
  END IF;

  IF p_parent_id IS NOT NULL THEN
    SELECT * INTO parent_comment
    FROM public.group_buy_comments
    WHERE id = p_parent_id AND group_buy_id = p_group_buy_id
    FOR SHARE;
    IF NOT FOUND OR parent_comment.state <> 'VISIBLE' THEN
      RAISE EXCEPTION 'PARENT_NOT_COMMENTABLE' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT COALESCE(NULLIF(btrim(nickname), ''), '공구 사용자') INTO display_name
  FROM public.users WHERE id = current_user_id::text;
  display_name := COALESCE(display_name, '공구 사용자');

  INSERT INTO public.group_buy_comments (
    group_buy_id, author_id, parent_id, body, author_display_name,
    client_request_id, request_fingerprint
  ) VALUES (
    p_group_buy_id, current_user_id, p_parent_id, normalized_body, display_name,
    p_client_request_id, fingerprint
  ) RETURNING * INTO new_comment;

  RETURN public.comment_public_json(new_comment.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_comment(
  p_comment_id uuid,
  p_expected_version integer,
  p_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_body text := btrim(COALESCE(p_body, ''));
  updated_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF char_length(normalized_body) < 1 OR char_length(normalized_body) > 500
    OR normalized_body ~ '[<>]' OR normalized_body ~* '(https?://|www\.)'
  THEN RAISE EXCEPTION 'VALIDATION_FAILED' USING ERRCODE = 'P0001'; END IF;

  UPDATE public.group_buy_comments
  SET body = normalized_body,
      edited_at = now(),
      updated_at = now(),
      content_version = content_version + 1
  WHERE id = p_comment_id
    AND author_id = auth.uid()
    AND state = 'VISIBLE'
    AND content_version = p_expected_version
  RETURNING id INTO updated_id;

  IF updated_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.group_buy_comments WHERE id = p_comment_id AND content_version <> p_expected_version)
      THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;
  RETURN public.comment_public_json(updated_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_comment(p_comment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE deleted_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.group_buy_comments
  SET state = 'DELETED', body = NULL, author_display_name = NULL,
      edited_at = now(), updated_at = now(), content_version = content_version + 1
  WHERE id = p_comment_id AND author_id = auth.uid() AND state IN ('VISIBLE', 'HIDDEN')
  RETURNING id INTO deleted_id;
  IF deleted_id IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001'; END IF;
  RETURN public.comment_public_json(deleted_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_comment_like(p_comment_id uuid, p_liked boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target public.group_buy_comments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO target FROM public.group_buy_comments WHERE id = p_comment_id FOR UPDATE;
  IF NOT FOUND OR target.state <> 'VISIBLE' THEN RAISE EXCEPTION 'COMMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF target.author_id = auth.uid() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001'; END IF;
  IF p_liked THEN
    INSERT INTO public.comment_likes (comment_id, user_id) VALUES (p_comment_id, auth.uid()) ON CONFLICT DO NOTHING;
  ELSE
    DELETE /* remove the caller's like */ FROM public.comment_likes
    WHERE comment_id = p_comment_id AND user_id = auth.uid();
  END IF;
  UPDATE public.group_buy_comments
  SET like_count = (SELECT count(*)::integer FROM public.comment_likes WHERE comment_id = p_comment_id), updated_at = now()
  WHERE id = p_comment_id;
  RETURN public.comment_public_json(p_comment_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.report_comment(
  p_comment_id uuid,
  p_reason text,
  p_details text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target public.group_buy_comments%ROWTYPE;
  report_comment_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'VALIDATION_FAILED' USING ERRCODE = 'P0001';
  END IF;
  IF p_details IS NOT NULL AND char_length(p_details) > 500 THEN
    RAISE EXCEPTION 'VALIDATION_FAILED' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO target FROM public.group_buy_comments WHERE id = p_comment_id;
  IF NOT FOUND OR target.state <> 'VISIBLE' THEN RAISE EXCEPTION 'COMMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF target.author_id = auth.uid() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.comment_reports (
    comment_id, reporter_id, reported_author_id, reason, details,
    body_snapshot, author_display_name_snapshot
  ) VALUES (
    target.id, auth.uid(), target.author_id, btrim(p_reason), NULLIF(btrim(p_details), ''),
    target.body, target.author_display_name
  ) ON CONFLICT (comment_id, reporter_id) DO NOTHING
  RETURNING comment_id INTO report_comment_id;
  IF report_comment_id IS NOT NULL THEN
    INSERT INTO public.comment_moderation_events (
      comment_id, actor_id, action, reason, previous_state, next_state, content_version
    ) VALUES (
      target.id, auth.uid(), 'REPORT', btrim(p_reason), target.state, target.state, target.content_version
    );
  END IF;
  RETURN jsonb_build_object('reported', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.block_user_from_comment(p_comment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_author uuid;
  blocked_author_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT author_id INTO target_author FROM public.group_buy_comments WHERE id = p_comment_id;
  IF target_author IS NULL OR target_author = auth.uid() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.comment_user_blocks (blocker_id, blocked_id)
  VALUES (auth.uid(), target_author) ON CONFLICT DO NOTHING
  RETURNING blocked_id INTO blocked_author_id;
  IF blocked_author_id IS NOT NULL THEN
    INSERT INTO public.comment_moderation_events (comment_id, actor_id, action, reason)
    VALUES (p_comment_id, auth.uid(), 'BLOCK', 'USER_BLOCK');
  END IF;
  RETURN jsonb_build_object('blocked', true);
END;
$$;

-- Account deletion scrubs UGC before Auth cascades can remove the author key.
CREATE OR REPLACE FUNCTION public.scrub_comments_for_deleted_user(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.group_buy_comments
  SET author_id = NULL, body = NULL, author_display_name = NULL,
      state = 'ACCOUNT_ANONYMIZED', updated_at = now(), edited_at = now(),
      content_version = content_version + 1
  WHERE author_id = p_user_id;
  UPDATE public.comment_reports
  SET reported_author_id = NULL,
      body_snapshot = NULL,
      author_display_name_snapshot = NULL
  WHERE reported_author_id = p_user_id;
$$;

ALTER TABLE public.comment_user_moderation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_terms_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_buy_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_moderation_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.comment_user_moderation, public.comment_terms_acceptances,
  public.comment_user_blocks, public.group_buy_comments, public.comment_likes,
  public.comment_reports, public.comment_moderation_events FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.provision_comment_user_moderation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.prepare_group_buy_comment() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.refresh_comment_reply_count() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.scrub_comments_for_deleted_user(uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.list_comment_roots(text, text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_comment_children(text, uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_comment_terms(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_comment(text, uuid, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_comment(uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_comment(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_comment_like(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_comment(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.block_user_from_comment(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_comment_roots(text, text, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_comment_children(text, uuid, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_comment_terms(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_comment(text, uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_comment(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_comment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_comment_like(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_comment(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_user_from_comment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.scrub_comments_for_deleted_user(uuid) TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_buy_comments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_likes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_reports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_moderation_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_user_moderation TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_terms_acceptances TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_user_blocks TO service_role;

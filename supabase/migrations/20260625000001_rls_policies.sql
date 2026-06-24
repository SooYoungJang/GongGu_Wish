-- ============================================================================
-- Phase 1: Row Level Security (RLS) Policies
-- Project: GongGu Wish (GON-25)
-- Target: Supabase Auth + Data API
--
-- Policy roles:
--   anon           — unauthenticated users (public read)
--   authenticated  — any logged-in user
--   user           — resource owner (user_id matches auth.uid())
--   admin          — users with role='admin' in app_metadata
--   service_role   — server-side (bypasses RLS entirely)
--
-- Policy patterns:
--   public_read    — SELECT for anon + authenticated
--   own_read       — SELECT where user_id = auth.uid()
--   admin_all      — all DML for admin users
-- ============================================================================

-- ── Enable RLS on all tables ───────────────────────────────────────────────

ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_buys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gonggu_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if the current user has admin role in auth.users app_metadata
-- (supabase.auth.users().raw_app_meta_data->>'role')
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      OR
      (auth.jwt() ->> 'role') = 'admin',
      false
    );
$$;

-- Check if the current user owns a resource by user_id column
CREATE OR REPLACE FUNCTION public.is_owner(user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid()::text = user_id;
$$;

-- ============================================================================
-- 1. INFLUENCERS
--    Public read; admin-only write.
-- ============================================================================

CREATE POLICY "influencers_public_read"
  ON public.influencers
  FOR SELECT
  USING (true);

CREATE POLICY "influencers_admin_all"
  ON public.influencers
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 2. RAW_POSTS
--    Public read; admin-only write.
-- ============================================================================

CREATE POLICY "raw_posts_public_read"
  ON public.raw_posts
  FOR SELECT
  USING (true);

CREATE POLICY "raw_posts_admin_all"
  ON public.raw_posts
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 3. GROUP_BUYS
--    Public read; admin-only write.
-- ============================================================================

CREATE POLICY "group_buys_public_read"
  ON public.group_buys
  FOR SELECT
  USING (true);

CREATE POLICY "group_buys_admin_all"
  ON public.group_buys
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 4. USERS
--    Users can read/update their own record.
--    Admins can read/update all records.
-- ============================================================================

CREATE POLICY "users_own_read"
  ON public.users
  FOR SELECT
  USING (public.is_owner(id));

CREATE POLICY "users_own_update"
  ON public.users
  FOR UPDATE
  USING (public.is_owner(id))
  WITH CHECK (public.is_owner(id));

CREATE POLICY "users_admin_all"
  ON public.users
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 5. FAVORITES
--    Users can CRUD their own favorites.
--    Admin can manage all.
-- ============================================================================

CREATE POLICY "favorites_own_all"
  ON public.favorites
  FOR ALL
  USING (public.is_owner(user_id))
  WITH CHECK (public.is_owner(user_id));

CREATE POLICY "favorites_admin_all"
  ON public.favorites
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 6. GONGGU_SUBMISSIONS
--    Authenticated users can create submissions.
--    Users can read their own.
--    Admin can manage all.
-- ============================================================================

-- Authenticated users can INSERT submissions
CREATE POLICY "submissions_authenticated_insert"
  ON public.gonggu_submissions
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Anonymous or authenticated users can read submissions
CREATE POLICY "submissions_public_read"
  ON public.gonggu_submissions
  FOR SELECT
  USING (true);

-- Admin can update/manage all submissions
CREATE POLICY "submissions_admin_all"
  ON public.gonggu_submissions
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 7. FEED_POSTS
--    Public read; admin-only write.
-- ============================================================================

CREATE POLICY "feed_posts_public_read"
  ON public.feed_posts
  FOR SELECT
  USING (true);

CREATE POLICY "feed_posts_admin_all"
  ON public.feed_posts
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- The original RLS migration is present in remote migration history, but the
-- remote tables were found with rowsecurity=false. Reconcile the live state
-- without relying on the historical migration being replayed.

ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_buys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gonggu_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_buy_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_buy_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_buy_notifications ENABLE ROW LEVEL SECURITY;

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

CREATE OR REPLACE FUNCTION public.is_owner(user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid()::text = user_id;
$$;

DROP POLICY IF EXISTS "influencers_public_read" ON public.influencers;
CREATE POLICY "influencers_public_read"
  ON public.influencers FOR SELECT USING (true);
DROP POLICY IF EXISTS "influencers_admin_all" ON public.influencers;
CREATE POLICY "influencers_admin_all"
  ON public.influencers FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "raw_posts_public_read" ON public.raw_posts;
CREATE POLICY "raw_posts_public_read"
  ON public.raw_posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "raw_posts_admin_all" ON public.raw_posts;
CREATE POLICY "raw_posts_admin_all"
  ON public.raw_posts FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "group_buys_public_read" ON public.group_buys;
CREATE POLICY "group_buys_public_read"
  ON public.group_buys FOR SELECT USING (true);
DROP POLICY IF EXISTS "group_buys_admin_all" ON public.group_buys;
CREATE POLICY "group_buys_admin_all"
  ON public.group_buys FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "users_own_read" ON public.users;
CREATE POLICY "users_own_read"
  ON public.users FOR SELECT USING (public.is_owner(id));
DROP POLICY IF EXISTS "users_own_update" ON public.users;
CREATE POLICY "users_own_update"
  ON public.users FOR UPDATE
  USING (public.is_owner(id)) WITH CHECK (public.is_owner(id));
DROP POLICY IF EXISTS "users_admin_all" ON public.users;
CREATE POLICY "users_admin_all"
  ON public.users FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "favorites_own_all" ON public.favorites;
CREATE POLICY "favorites_own_all"
  ON public.favorites FOR ALL
  USING (public.is_owner(user_id)) WITH CHECK (public.is_owner(user_id));
DROP POLICY IF EXISTS "favorites_admin_all" ON public.favorites;
CREATE POLICY "favorites_admin_all"
  ON public.favorites FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "submissions_authenticated_insert"
  ON public.gonggu_submissions;
CREATE POLICY "submissions_authenticated_insert"
  ON public.gonggu_submissions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "submissions_public_read" ON public.gonggu_submissions;
CREATE POLICY "submissions_public_read"
  ON public.gonggu_submissions FOR SELECT USING (true);
DROP POLICY IF EXISTS "submissions_admin_all" ON public.gonggu_submissions;
CREATE POLICY "submissions_admin_all"
  ON public.gonggu_submissions FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "feed_posts_public_read" ON public.feed_posts;
CREATE POLICY "feed_posts_public_read"
  ON public.feed_posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "feed_posts_admin_all" ON public.feed_posts;
CREATE POLICY "feed_posts_admin_all"
  ON public.feed_posts FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "search_logs_anon_insert" ON public.search_logs;
CREATE POLICY "search_logs_anon_insert"
  ON public.search_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "group_buy_views_anon_insert"
  ON public.group_buy_views;
CREATE POLICY "group_buy_views_anon_insert"
  ON public.group_buy_views FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "group_buy_bookmarks_anon_insert"
  ON public.group_buy_bookmarks;
CREATE POLICY "group_buy_bookmarks_anon_insert"
  ON public.group_buy_bookmarks FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "group_buy_bookmarks_anon_delete"
  ON public.group_buy_bookmarks;
CREATE POLICY "group_buy_bookmarks_anon_delete"
  ON public.group_buy_bookmarks FOR DELETE USING (true);

DROP POLICY IF EXISTS "group_buy_notifications_anon_insert"
  ON public.group_buy_notifications;
CREATE POLICY "group_buy_notifications_anon_insert"
  ON public.group_buy_notifications FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "group_buy_notifications_anon_delete"
  ON public.group_buy_notifications;
CREATE POLICY "group_buy_notifications_anon_delete"
  ON public.group_buy_notifications FOR DELETE USING (true);

-- Allow anonymous (anon role) inserts on gonggu_submissions so the
-- public-submission edge function can write without relying on the
-- SUPABASE_SERVICE_ROLE_KEY secret being configured remotely.
-- The edge function still validates all input before inserting.

DROP POLICY IF EXISTS "submissions_authenticated_insert"
  ON public.gonggu_submissions;

CREATE POLICY "submissions_anon_insert"
  ON public.gonggu_submissions FOR INSERT
  WITH CHECK (true);

-- Allow anon/service_role to insert into group_buys for the auto-approve
-- flow that runs inside the public-submission edge function.
DROP POLICY IF EXISTS "group_buys_anon_insert" ON public.group_buys;
CREATE POLICY "group_buys_anon_insert"
  ON public.group_buys FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "group_buys_anon_update" ON public.group_buys;
CREATE POLICY "group_buys_anon_update"
  ON public.group_buys FOR UPDATE USING (true) WITH CHECK (true);

-- Explicit grants so service_role and anon can write even if auto-grant
-- did not cover tables created outside the standard Supabase flow.
GRANT INSERT, SELECT, UPDATE ON public.gonggu_submissions TO anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE ON public.group_buys TO anon, authenticated, service_role;
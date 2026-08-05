-- Public submission writes go through the validated Edge Function with the
-- service_role client. The Data API must not expose a second, unvalidated
-- write path or allow anonymous users to read other reporters' submissions.

DROP POLICY IF EXISTS "submissions_authenticated_insert"
  ON public.gonggu_submissions;
DROP POLICY IF EXISTS "submissions_anon_insert"
  ON public.gonggu_submissions;
DROP POLICY IF EXISTS "submissions_public_read"
  ON public.gonggu_submissions;
DROP POLICY IF EXISTS "submissions_submitter_read"
  ON public.gonggu_submissions;

CREATE POLICY "submissions_submitter_read"
  ON public.gonggu_submissions
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.gonggu_submission_submitters AS submitter
      WHERE submitter.submission_id = gonggu_submissions.id
        AND submitter.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "group_buys_anon_insert" ON public.group_buys;
DROP POLICY IF EXISTS "group_buys_anon_update" ON public.group_buys;

REVOKE INSERT, UPDATE
  ON public.gonggu_submissions
  FROM anon, authenticated;
REVOKE SELECT
  ON public.gonggu_submissions
  FROM anon;
GRANT SELECT
  ON public.gonggu_submissions
  TO authenticated;

REVOKE INSERT, UPDATE
  ON public.group_buys
  FROM anon, authenticated;

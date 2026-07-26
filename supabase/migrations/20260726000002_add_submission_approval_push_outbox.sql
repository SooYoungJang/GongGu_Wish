-- Attribute authenticated submitters and persist approval push delivery work.
CREATE TABLE IF NOT EXISTS public.gonggu_submission_submitters (
  submission_id text NOT NULL
    REFERENCES public.gonggu_submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (submission_id, user_id)
);

CREATE INDEX IF NOT EXISTS gonggu_submission_submitters_user_id_idx
  ON public.gonggu_submission_submitters (user_id, created_at DESC);

ALTER TABLE public.gonggu_submission_submitters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gonggu_submission_submitters_own_read"
  ON public.gonggu_submission_submitters
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.gonggu_submission_submitters TO authenticated;

CREATE TABLE IF NOT EXISTS public.submission_approval_push_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id text NOT NULL
    REFERENCES public.gonggu_submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_buy_id text NOT NULL
    REFERENCES public.group_buys(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'submission_approved'
    CHECK (event_type = 'submission_approved'),
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN (
      'PENDING', 'PROCESSING', 'SENT', 'SKIPPED', 'RETRYING', 'FAILED'
    )),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, user_id, event_type)
);

CREATE INDEX IF NOT EXISTS submission_approval_push_outbox_pending_idx
  ON public.submission_approval_push_outbox
    (status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS submission_approval_push_outbox_submission_idx
  ON public.submission_approval_push_outbox
    (submission_id, created_at DESC);

ALTER TABLE public.submission_approval_push_outbox ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.submission_approval_push_outbox
  TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_submission_approval_push_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'APPROVED'
    AND NEW.status = 'APPROVED'
    AND NEW.group_buy_id IS NOT NULL
  THEN
    INSERT INTO public.submission_approval_push_outbox (
      submission_id,
      user_id,
      group_buy_id
    )
    SELECT NEW.id, submitter.user_id, NEW.group_buy_id
    FROM public.gonggu_submission_submitters submitter
    WHERE submitter.submission_id = NEW.id
    ON CONFLICT (submission_id, user_id, event_type) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gonggu_submission_approval_push_enqueue
  ON public.gonggu_submissions;
CREATE TRIGGER gonggu_submission_approval_push_enqueue
AFTER UPDATE OF status, group_buy_id ON public.gonggu_submissions
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_submission_approval_push_events();

CREATE OR REPLACE FUNCTION public.claim_submission_approval_push_events(
  p_limit integer DEFAULT 50,
  p_submission_id text DEFAULT NULL
)
RETURNS TABLE (
  event_id bigint,
  submission_id text,
  user_id uuid,
  group_buy_id text,
  product_name text,
  attempt_count integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH candidates AS (
    SELECT outbox.id
    FROM public.submission_approval_push_outbox outbox
    WHERE (
      (outbox.status IN ('PENDING', 'RETRYING')
        AND outbox.next_attempt_at <= now())
      OR (outbox.status = 'PROCESSING'
        AND outbox.updated_at < now() - interval '10 minutes')
    )
      AND outbox.attempt_count < 5
      AND (p_submission_id IS NULL OR outbox.submission_id = p_submission_id)
    ORDER BY outbox.created_at, outbox.id
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.submission_approval_push_outbox outbox
    SET status = 'PROCESSING',
        attempt_count = outbox.attempt_count + 1,
        updated_at = now()
    FROM candidates
    WHERE outbox.id = candidates.id
    RETURNING outbox.*
  )
  SELECT claimed.id,
         claimed.submission_id,
         claimed.user_id,
         claimed.group_buy_id,
         submission.product_name,
         claimed.attempt_count
  FROM claimed
  JOIN public.gonggu_submissions submission
    ON submission.id = claimed.submission_id;
$$;

REVOKE ALL ON FUNCTION public.claim_submission_approval_push_events(integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_submission_approval_push_events(integer, text)
  TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'process-submission-approval-push-outbox',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE name = 'project_url'
    ) || '/functions/v1/process-notification-outbox',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'publishable_key'
      ),
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'publishable_key'
      )
    ),
    body := jsonb_build_object('limit', 50),
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

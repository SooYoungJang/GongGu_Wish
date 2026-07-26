CREATE OR REPLACE FUNCTION public.enqueue_approved_submission_submitter_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  approved_group_buy_id text;
BEGIN
  SELECT submission.group_buy_id
  INTO approved_group_buy_id
  FROM public.gonggu_submissions AS submission
  WHERE submission.id = NEW.submission_id
    AND submission.status = 'APPROVED'
  FOR UPDATE;

  IF approved_group_buy_id IS NOT NULL THEN
    INSERT INTO public.submission_approval_push_outbox (
      submission_id,
      user_id,
      group_buy_id
    )
    VALUES (
      NEW.submission_id,
      NEW.user_id,
      approved_group_buy_id
    )
    ON CONFLICT (submission_id, user_id, event_type) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_approved_submission_submitter_push()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enqueue_approved_submission_submitter_push_trigger
  ON public.gonggu_submission_submitters;
CREATE TRIGGER enqueue_approved_submission_submitter_push_trigger
AFTER INSERT ON public.gonggu_submission_submitters
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_approved_submission_submitter_push();

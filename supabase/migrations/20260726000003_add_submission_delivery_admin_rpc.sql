CREATE OR REPLACE FUNCTION public.get_submission_notification_delivery(
  p_submission_ids text[]
)
RETURNS TABLE (
  submission_id text,
  linked_submitter_count integer,
  pending_count integer,
  processing_count integer,
  sent_count integer,
  skipped_count integer,
  retrying_count integer,
  failed_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH requested AS (
    SELECT DISTINCT requested_id AS submission_id
    FROM unnest(COALESCE(p_submission_ids, ARRAY[]::text[])) AS requested_id
    WHERE requested_id IS NOT NULL AND btrim(requested_id) <> ''
  ),
  submitter_counts AS (
    SELECT
      submitter.submission_id,
      count(DISTINCT submitter.user_id)::integer AS linked_submitter_count
    FROM public.gonggu_submission_submitters AS submitter
    INNER JOIN requested
      ON requested.submission_id = submitter.submission_id
    GROUP BY submitter.submission_id
  ),
  outbox_counts AS (
    SELECT
      outbox.submission_id,
      count(*) FILTER (WHERE outbox.status = 'PENDING')::integer AS pending_count,
      count(*) FILTER (WHERE outbox.status = 'PROCESSING')::integer AS processing_count,
      count(*) FILTER (WHERE outbox.status = 'SENT')::integer AS sent_count,
      count(*) FILTER (WHERE outbox.status = 'SKIPPED')::integer AS skipped_count,
      count(*) FILTER (WHERE outbox.status = 'RETRYING')::integer AS retrying_count,
      count(*) FILTER (WHERE outbox.status = 'FAILED')::integer AS failed_count
    FROM public.submission_approval_push_outbox AS outbox
    INNER JOIN requested
      ON requested.submission_id = outbox.submission_id
    GROUP BY outbox.submission_id
  )
  SELECT
    requested.submission_id,
    COALESCE(submitter_counts.linked_submitter_count, 0),
    COALESCE(outbox_counts.pending_count, 0),
    COALESCE(outbox_counts.processing_count, 0),
    COALESCE(outbox_counts.sent_count, 0),
    COALESCE(outbox_counts.skipped_count, 0),
    COALESCE(outbox_counts.retrying_count, 0),
    COALESCE(outbox_counts.failed_count, 0)
  FROM requested
  LEFT JOIN submitter_counts USING (submission_id)
  LEFT JOIN outbox_counts USING (submission_id);
$$;

REVOKE ALL ON FUNCTION public.get_submission_notification_delivery(text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_submission_notification_delivery(text[])
  TO service_role;

-- Allow admins to hide approved manual discoveries ("노출 중지").
--
-- The admin console sets status = 'REJECTED' to hide a group buy, but the
-- manual-discovery review-state CHECK constraint only allowed
-- ('APPROVED' review -> 'APPROVED' / 'EXPIRED' status), so hiding an approved
-- manual discovery was rejected by the database. Loosen the constraint so an
-- approved manual discovery may also carry status 'REJECTED' (hidden).

ALTER TABLE public.group_buys
  DROP CONSTRAINT IF EXISTS "group_buys_manual_discovery_review_state_check";

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
          AND status IN ('APPROVED', 'EXPIRED', 'REJECTED')
        )
        OR (collection_review_status = 'REJECTED' AND status = 'REJECTED')
      )
    )
  );

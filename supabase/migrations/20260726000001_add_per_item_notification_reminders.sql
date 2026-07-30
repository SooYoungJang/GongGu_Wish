-- Store authenticated reminder intent separately from device-local schedules.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS submission_approval_notifications_enabled boolean
    NOT NULL DEFAULT false;

UPDATE public.users
SET submission_approval_notifications_enabled = new_submissions_enabled;

ALTER TABLE public.group_buy_notifications
  ADD COLUMN IF NOT EXISTS reminder_days integer[] NOT NULL
    DEFAULT ARRAY[1, 3, 7]::integer[],
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.group_buy_notifications
  DROP CONSTRAINT IF EXISTS group_buy_notifications_reminder_days_check,
  ADD CONSTRAINT group_buy_notifications_reminder_days_check CHECK (
    reminder_days <@ ARRAY[1, 3, 7]::integer[]
    AND cardinality(reminder_days) BETWEEN 1 AND 3
  );

DELETE FROM public.group_buy_notifications older
USING public.group_buy_notifications newer
WHERE older.user_id IS NOT NULL
  AND older.user_id = newer.user_id
  AND older.group_buy_id = newer.group_buy_id
  AND older.id < newer.id;

CREATE UNIQUE INDEX IF NOT EXISTS group_buy_notifications_user_group_buy_key
  ON public.group_buy_notifications (user_id, group_buy_id)
  WHERE user_id IS NOT NULL;

DROP POLICY IF EXISTS "group_buy_notifications_anon_insert"
  ON public.group_buy_notifications;
DROP POLICY IF EXISTS "group_buy_notifications_anon_delete"
  ON public.group_buy_notifications;

CREATE POLICY "group_buy_notifications_legacy_session_insert"
  ON public.group_buy_notifications
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL);

CREATE POLICY "group_buy_notifications_legacy_session_delete"
  ON public.group_buy_notifications
  FOR DELETE TO anon, authenticated
  USING (user_id IS NULL);

CREATE POLICY "group_buy_notifications_own_read"
  ON public.group_buy_notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_my_group_buy_reminders()
RETURNS TABLE (
  group_buy_id text,
  reminder_days integer[],
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT notification.group_buy_id,
         notification.reminder_days,
         notification.updated_at
  FROM public.group_buy_notifications notification
  JOIN public.group_buys group_buy ON group_buy.id = notification.group_buy_id
  WHERE notification.user_id = auth.uid()
    AND group_buy.status = 'APPROVED';
$$;

CREATE OR REPLACE FUNCTION public.set_my_group_buy_reminder(
  p_group_buy_id text,
  p_reminder_days integer[]
)
RETURNS TABLE (
  group_buy_id text,
  reminder_days integer[],
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  deadline timestamp without time zone;
  normalized_days integer[];
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_group_buy_id IS NULL OR btrim(p_group_buy_id) = '' THEN
    RAISE EXCEPTION 'Group buy ID is required' USING ERRCODE = '22023';
  END IF;
  IF p_reminder_days IS NULL THEN
    RAISE EXCEPTION 'Reminder days are required' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_reminder_days) day WHERE day NOT IN (1, 3, 7)
  ) THEN
    RAISE EXCEPTION 'Reminder days must be D-1, D-3, or D-7'
      USING ERRCODE = '22023';
  END IF;

  SELECT group_buy.end_date
    INTO deadline
  FROM public.group_buys group_buy
  WHERE group_buy.id = btrim(p_group_buy_id)
    AND group_buy.status = 'APPROVED';

  IF NOT FOUND OR deadline IS NULL THEN
    RAISE EXCEPTION 'An active group buy deadline is required'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(day ORDER BY day), ARRAY[]::integer[])
    INTO normalized_days
  FROM (
    SELECT DISTINCT selected_day AS day
    FROM unnest(p_reminder_days) selected_day
    WHERE (((deadline::date - selected_day) + time '09:00')
      AT TIME ZONE 'Asia/Seoul') > now()
  ) future_days;

  IF cardinality(normalized_days) = 0 THEN
    DELETE FROM public.group_buy_notifications notification
    WHERE notification.user_id = current_user_id
      AND notification.group_buy_id = btrim(p_group_buy_id);
    RETURN;
  END IF;

  INSERT INTO public.group_buy_notifications (
    group_buy_id,
    user_id,
    session_id,
    reminder_days,
    updated_at
  ) VALUES (
    btrim(p_group_buy_id),
    current_user_id,
    NULL,
    normalized_days,
    now()
  )
  ON CONFLICT (user_id, group_buy_id) WHERE user_id IS NOT NULL
  DO UPDATE SET
    reminder_days = EXCLUDED.reminder_days,
    updated_at = now();

  RETURN QUERY
  SELECT notification.group_buy_id,
         notification.reminder_days,
         notification.updated_at
  FROM public.group_buy_notifications notification
  WHERE notification.user_id = current_user_id
    AND notification.group_buy_id = btrim(p_group_buy_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_group_buy_reminders() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_my_group_buy_reminder(text, integer[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_group_buy_reminders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_group_buy_reminder(text, integer[])
  TO authenticated;

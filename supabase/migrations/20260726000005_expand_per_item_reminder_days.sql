-- Let authenticated users choose any reminder day in the week before closing.
ALTER TABLE public.group_buy_notifications
  DROP CONSTRAINT IF EXISTS group_buy_notifications_reminder_days_check,
  ADD CONSTRAINT group_buy_notifications_reminder_days_check CHECK (
    reminder_days <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::integer[]
    AND cardinality(reminder_days) BETWEEN 1 AND 7
  );

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
    SELECT 1
    FROM unnest(p_reminder_days) day
    WHERE day IS NULL OR day NOT BETWEEN 1 AND 7
  ) THEN
    RAISE EXCEPTION 'Reminder days must be between D-1 and D-7'
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

  -- An empty list is the existing delete command used by the mobile outbox.
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

REVOKE ALL ON FUNCTION public.set_my_group_buy_reminder(text, integer[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_group_buy_reminder(text, integer[])
  TO authenticated;

-- Add typed per-item reminders while preserving deadline-only legacy RPCs.
ALTER TABLE public.group_buy_notifications
  ADD COLUMN IF NOT EXISTS reminder_type text NOT NULL DEFAULT 'DEADLINE',
  ADD COLUMN IF NOT EXISTS reminder_time_minutes integer;

ALTER TABLE public.group_buy_notifications
  DROP CONSTRAINT IF EXISTS group_buy_notifications_reminder_days_check,
  DROP CONSTRAINT IF EXISTS group_buy_notifications_reminder_preference_check,
  ADD CONSTRAINT group_buy_notifications_reminder_preference_check CHECK (
    (
      reminder_type = 'OPENING'
      AND reminder_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6, 7]::integer[]
      AND cardinality(reminder_days) BETWEEN 1 AND 8
      AND reminder_time_minutes BETWEEN 0 AND 1439
    )
    OR
    (
      reminder_type = 'DEADLINE'
      AND reminder_days <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::integer[]
      AND cardinality(reminder_days) BETWEEN 1 AND 7
      AND reminder_time_minutes IS NULL
    )
  );

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
    AND notification.reminder_type = 'DEADLINE'
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
#variable_conflict use_column
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

  IF cardinality(p_reminder_days) = 0 THEN
    DELETE FROM public.group_buy_notifications notification
    WHERE notification.user_id = current_user_id
      AND notification.group_buy_id = btrim(p_group_buy_id);
    RETURN;
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
    reminder_type,
    reminder_days,
    reminder_time_minutes,
    updated_at
  ) VALUES (
    btrim(p_group_buy_id),
    current_user_id,
    NULL,
    'DEADLINE',
    normalized_days,
    NULL,
    now()
  )
  ON CONFLICT (user_id, group_buy_id) WHERE user_id IS NOT NULL
  DO UPDATE SET
    reminder_type = 'DEADLINE',
    reminder_days = EXCLUDED.reminder_days,
    reminder_time_minutes = NULL,
    updated_at = now();

  RETURN QUERY
  SELECT notification.group_buy_id,
         notification.reminder_days,
         notification.updated_at
  FROM public.group_buy_notifications notification
  WHERE notification.user_id = current_user_id
    AND notification.group_buy_id = btrim(p_group_buy_id)
    AND notification.reminder_type = 'DEADLINE';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_group_buy_reminders_v2()
RETURNS TABLE (
  group_buy_id text,
  reminder_type text,
  reminder_days integer[],
  reminder_time_minutes integer,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT notification.group_buy_id,
         notification.reminder_type,
         notification.reminder_days,
         notification.reminder_time_minutes,
         notification.updated_at
  FROM public.group_buy_notifications notification
  JOIN public.group_buys group_buy ON group_buy.id = notification.group_buy_id
  WHERE notification.user_id = auth.uid()
    AND group_buy.status = 'APPROVED';
$$;

CREATE OR REPLACE FUNCTION public.set_my_group_buy_reminder_v2(
  p_group_buy_id text,
  p_reminder_type text,
  p_reminder_days integer[],
  p_reminder_time_minutes integer DEFAULT NULL
)
RETURNS TABLE (
  group_buy_id text,
  reminder_type text,
  reminder_days integer[],
  reminder_time_minutes integer,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  current_user_id uuid := auth.uid();
  normalized_type text := upper(btrim(COALESCE(p_reminder_type, '')));
  opening timestamp without time zone;
  deadline timestamp without time zone;
  normalized_days integer[];
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_group_buy_id IS NULL OR btrim(p_group_buy_id) = '' THEN
    RAISE EXCEPTION 'Group buy ID is required' USING ERRCODE = '22023';
  END IF;
  IF normalized_type NOT IN ('OPENING', 'DEADLINE') THEN
    RAISE EXCEPTION 'Reminder type must be OPENING or DEADLINE'
      USING ERRCODE = '22023';
  END IF;
  IF p_reminder_days IS NULL THEN
    RAISE EXCEPTION 'Reminder days are required' USING ERRCODE = '22023';
  END IF;
  IF normalized_type = 'OPENING' AND (
    p_reminder_time_minutes IS NULL
    OR p_reminder_time_minutes NOT BETWEEN 0 AND 1439
  ) THEN
    RAISE EXCEPTION 'Opening reminder time must be between 0 and 1439'
      USING ERRCODE = '22023';
  END IF;
  IF normalized_type = 'DEADLINE' AND p_reminder_time_minutes IS NOT NULL THEN
    RAISE EXCEPTION 'Deadline reminders use the fixed 09:00 time'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(p_reminder_days) day
    WHERE day IS NULL
      OR (normalized_type = 'OPENING' AND day NOT BETWEEN 0 AND 7)
      OR (normalized_type = 'DEADLINE' AND day NOT BETWEEN 1 AND 7)
  ) THEN
    RAISE EXCEPTION 'Reminder days are outside the supported range'
      USING ERRCODE = '22023';
  END IF;

  IF cardinality(p_reminder_days) = 0 THEN
    DELETE FROM public.group_buy_notifications notification
    WHERE notification.user_id = current_user_id
      AND notification.group_buy_id = btrim(p_group_buy_id);
    RETURN;
  END IF;

  SELECT group_buy.start_date, group_buy.end_date
    INTO opening, deadline
  FROM public.group_buys group_buy
  WHERE group_buy.id = btrim(p_group_buy_id)
    AND group_buy.status = 'APPROVED';

  IF NOT FOUND
    OR (normalized_type = 'OPENING' AND opening IS NULL)
    OR (normalized_type = 'DEADLINE' AND deadline IS NULL)
  THEN
    RAISE EXCEPTION 'An approved group buy event date is required'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(day ORDER BY day), ARRAY[]::integer[])
    INTO normalized_days
  FROM (
    SELECT DISTINCT selected_day AS day
    FROM unnest(p_reminder_days) selected_day
    WHERE CASE
      WHEN normalized_type = 'OPENING' THEN
        (((opening::date - selected_day)
          + make_interval(mins => p_reminder_time_minutes))
          AT TIME ZONE 'Asia/Seoul') > now()
      ELSE
        (((deadline::date - selected_day) + time '09:00')
          AT TIME ZONE 'Asia/Seoul') > now()
    END
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
    reminder_type,
    reminder_days,
    reminder_time_minutes,
    updated_at
  ) VALUES (
    btrim(p_group_buy_id),
    current_user_id,
    NULL,
    normalized_type,
    normalized_days,
    CASE
      WHEN normalized_type = 'OPENING' THEN p_reminder_time_minutes
      ELSE NULL
    END,
    now()
  )
  ON CONFLICT (user_id, group_buy_id) WHERE user_id IS NOT NULL
  DO UPDATE SET
    reminder_type = EXCLUDED.reminder_type,
    reminder_days = EXCLUDED.reminder_days,
    reminder_time_minutes = EXCLUDED.reminder_time_minutes,
    updated_at = now();

  RETURN QUERY
  SELECT notification.group_buy_id,
         notification.reminder_type,
         notification.reminder_days,
         notification.reminder_time_minutes,
         notification.updated_at
  FROM public.group_buy_notifications notification
  WHERE notification.user_id = current_user_id
    AND notification.group_buy_id = btrim(p_group_buy_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_group_buy_reminders() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_my_group_buy_reminder(text, integer[])
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_group_buy_reminders_v2()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_my_group_buy_reminder_v2(
  text,
  text,
  integer[],
  integer
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_my_group_buy_reminders()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_group_buy_reminder(text, integer[])
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_group_buy_reminders_v2()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_group_buy_reminder_v2(
  text,
  text,
  integer[],
  integer
) TO authenticated;

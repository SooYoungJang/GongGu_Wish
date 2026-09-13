CREATE TABLE public.app_telemetry_events (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL,
  event_name text NOT NULL CHECK (event_name IN ('js_error','query_error','search_results','detail_open','bookmark_set','reminder_set','purchase_link_open')),
  screen text NOT NULL CHECK (screen IN ('Startup','Unknown','MainTabs','Ranking','Reels','Home','Search','MyPage','CalendarScreen','Detail','FeedDetail','InfluencerGroupBuys','SearchScreen','GroupBuyRequestRankings','MyGroupBuyRequests','Admin','Login','Submit','Settings')),
  app_version text NOT NULL CHECK (app_version ~ '^[0-9][0-9A-Za-z.+-]{0,39}$'),
  release_id text NOT NULL CHECK (release_id = 'native' OR release_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  platform text NOT NULL CHECK (platform IN ('android','ios','web','unknown')),
  error_kind text CHECK (error_kind IN ('Error','TypeError','RangeError','ReferenceError','SyntaxError','ApiError','Unknown')),
  http_status integer CHECK (http_status BETWEEN 0 AND 599),
  value text CHECK (value IN ('zero','some','many','on','off','success','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX app_telemetry_events_recent_idx ON public.app_telemetry_events(created_at DESC);
ALTER TABLE public.app_telemetry_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_telemetry_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.app_telemetry_events TO service_role;

CREATE TABLE public.app_telemetry_rate_limits (
  source_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  event_count integer NOT NULL,
  PRIMARY KEY (source_hash, window_start)
);
ALTER TABLE public.app_telemetry_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_telemetry_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.app_telemetry_rate_limits TO service_role;

CREATE FUNCTION public.ingest_app_telemetry(p_source_hash text, p_session_id uuid, p_events jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE event jsonb; amount integer; accepted integer;
BEGIN
  IF p_source_hash IS NULL OR p_source_hash !~ '^[0-9a-f]{64}$' OR p_session_id IS NULL OR jsonb_typeof(p_events) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid telemetry batch' USING ERRCODE = '22023';
  END IF;
  amount := jsonb_array_length(p_events);
  IF amount < 1 OR amount > 20 THEN RAISE EXCEPTION 'Invalid batch size' USING ERRCODE = '22023'; END IF;
  FOR event IN SELECT value FROM jsonb_array_elements(p_events) LOOP
    IF jsonb_typeof(event) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid event' USING ERRCODE = '22023'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(event) k WHERE k NOT IN ('id','eventName','screen','appVersion','releaseId','platform','errorKind','httpStatus','value')) THEN
      RAISE EXCEPTION 'Unexpected event field' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  INSERT INTO public.app_telemetry_rate_limits AS r(source_hash,window_start,event_count)
  VALUES (p_source_hash,date_trunc('hour',now()),amount)
  ON CONFLICT (source_hash,window_start) DO UPDATE SET event_count = r.event_count + excluded.event_count
  WHERE r.event_count + excluded.event_count <= 300;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rate limited' USING ERRCODE = 'PT429'; END IF;
  INSERT INTO public.app_telemetry_rate_limits AS r(source_hash,window_start,event_count)
  VALUES ('global',date_trunc('day',now()),amount)
  ON CONFLICT (source_hash,window_start) DO UPDATE SET event_count = r.event_count + excluded.event_count
  WHERE r.event_count + excluded.event_count <= 50000;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rate limited' USING ERRCODE = 'PT429'; END IF;
  INSERT INTO public.app_telemetry_events(id,session_id,event_name,screen,app_version,release_id,platform,error_kind,http_status,value)
  SELECT (e->>'id')::uuid,p_session_id,e->>'eventName',e->>'screen',e->>'appVersion',e->>'releaseId',e->>'platform',e->>'errorKind',(e->>'httpStatus')::integer,e->>'value'
  FROM jsonb_array_elements(p_events) e ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS accepted = ROW_COUNT;
  RETURN accepted;
END;
$$;
REVOKE ALL ON FUNCTION public.ingest_app_telemetry(text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_app_telemetry(text,uuid,jsonb) TO service_role;

CREATE FUNCTION public.get_app_telemetry_summary(p_days integer DEFAULT 7)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(row_to_json(summary)), '[]'::jsonb) FROM (
    SELECT event_name AS "eventName", screen, platform, app_version AS "appVersion", release_id AS "releaseId", error_kind AS "errorKind", http_status AS "httpStatus", value,
      count(*)::integer AS count, count(DISTINCT session_id)::integer AS sessions
    FROM public.app_telemetry_events WHERE created_at >= now() - make_interval(days => greatest(1,least(coalesce(p_days,7),14)))
    GROUP BY event_name,screen,platform,app_version,release_id,error_kind,http_status,value
    ORDER BY count(*) DESC LIMIT 200
  ) summary;
$$;
REVOKE ALL ON FUNCTION public.get_app_telemetry_summary(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_app_telemetry_summary(integer) TO service_role;

-- This retention job only owns the newly introduced diagnostic tables.
SELECT cron.schedule('expire-app-telemetry','17 * * * *', $retention$
  -- production-migration-policy: allow-runtime-delete
  DELETE FROM public.app_telemetry_events WHERE created_at < now() - interval '14 days';
  -- production-migration-policy: allow-runtime-delete
  DELETE FROM public.app_telemetry_rate_limits WHERE window_start < now() - interval '2 days';
$retention$);

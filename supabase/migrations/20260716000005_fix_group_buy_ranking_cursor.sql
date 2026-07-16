-- GON-263: bind cursor pagination to every ORDER BY key.
-- Keep get_group_buy_rankings for older clients; the Edge Function uses this
-- additive RPC after it validates category, period, and sort in the cursor.

CREATE OR REPLACE FUNCTION public.get_group_buy_rankings_v2(
  category_filter text DEFAULT 'all',
  period_filter text DEFAULT 'weekly',
  sort_filter text DEFAULT 'popular',
  limit_count integer DEFAULT 20,
  cursor_numeric numeric DEFAULT NULL,
  cursor_timestamp timestamp without time zone DEFAULT NULL,
  cursor_score numeric DEFAULT NULL,
  cursor_group_buy_id text DEFAULT NULL
)
RETURNS TABLE (
  group_buy_id text,
  rank bigint,
  previous_rank bigint,
  trend_kind text,
  trend_delta bigint,
  product_name text,
  brand_name text,
  username text,
  category text,
  thumbnail_url text,
  media_urls text[],
  start_date timestamp without time zone,
  end_date timestamp without time zone,
  price_krw integer,
  created_at timestamp without time zone,
  deep_views bigint,
  bookmarks bigint,
  notifications bigint,
  search_clicks bigint,
  score double precision,
  score_delta double precision,
  score_version text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH period_bounds AS (
    SELECT
      now() AS current_end,
      now() - make_interval(
        hours => CASE period_filter
          WHEN 'today' THEN 24
          WHEN 'weekly' THEN 168
          WHEN 'monthly' THEN 720
          ELSE 168
        END
      ) AS current_start,
      now() - make_interval(
        hours => CASE period_filter
          WHEN 'today' THEN 48
          WHEN 'weekly' THEN 336
          WHEN 'monthly' THEN 1440
          ELSE 336
        END
      ) AS previous_start
  ),
  view_metrics AS (
    SELECT
      group_buy_id,
      COUNT(*) FILTER (WHERE viewed_at >= bounds.current_start) AS current_deep_views,
      COUNT(*) FILTER (WHERE viewed_at < bounds.current_start) AS previous_deep_views
    FROM public.group_buy_views, period_bounds bounds
    WHERE viewed_at >= bounds.previous_start
      AND viewed_at < bounds.current_end
      AND view_type = 'deep'
    GROUP BY group_buy_id
  ),
  bookmark_metrics AS (
    SELECT
      group_buy_id,
      COUNT(*) FILTER (WHERE created_at >= bounds.current_start) AS current_bookmarks,
      COUNT(*) FILTER (WHERE created_at < bounds.current_start) AS previous_bookmarks
    FROM public.group_buy_bookmarks, period_bounds bounds
    WHERE created_at >= bounds.previous_start
      AND created_at < bounds.current_end
    GROUP BY group_buy_id
  ),
  notification_metrics AS (
    SELECT
      group_buy_id,
      COUNT(*) FILTER (WHERE created_at >= bounds.current_start) AS current_notifications,
      COUNT(*) FILTER (WHERE created_at < bounds.current_start) AS previous_notifications
    FROM public.group_buy_notifications, period_bounds bounds
    WHERE created_at >= bounds.previous_start
      AND created_at < bounds.current_end
    GROUP BY group_buy_id
  ),
  search_metrics AS (
    SELECT
      group_buy_id,
      COUNT(*) FILTER (WHERE searched_at >= bounds.current_start) AS current_search_clicks,
      COUNT(*) FILTER (WHERE searched_at < bounds.current_start) AS previous_search_clicks
    FROM public.search_logs, period_bounds bounds
    WHERE searched_at >= bounds.previous_start
      AND searched_at < bounds.current_end
      AND group_buy_id IS NOT NULL
    GROUP BY group_buy_id
  ),
  metric_ids AS (
    SELECT group_buy_id FROM view_metrics
    UNION
    SELECT group_buy_id FROM bookmark_metrics
    UNION
    SELECT group_buy_id FROM notification_metrics
    UNION
    SELECT group_buy_id FROM search_metrics
  ),
  metrics AS (
    SELECT
      ids.group_buy_id,
      COALESCE(v.current_deep_views, 0)::bigint AS deep_views,
      COALESCE(v.previous_deep_views, 0)::bigint AS previous_deep_views,
      COALESCE(b.current_bookmarks, 0)::bigint AS bookmarks,
      COALESCE(b.previous_bookmarks, 0)::bigint AS previous_bookmarks,
      COALESCE(n.current_notifications, 0)::bigint AS notifications,
      COALESCE(n.previous_notifications, 0)::bigint AS previous_notifications,
      COALESCE(sc.current_search_clicks, 0)::bigint AS search_clicks,
      COALESCE(sc.previous_search_clicks, 0)::bigint AS previous_search_clicks
    FROM metric_ids ids
    LEFT JOIN view_metrics v ON v.group_buy_id = ids.group_buy_id
    LEFT JOIN bookmark_metrics b ON b.group_buy_id = ids.group_buy_id
    LEFT JOIN notification_metrics n ON n.group_buy_id = ids.group_buy_id
    LEFT JOIN search_metrics sc ON sc.group_buy_id = ids.group_buy_id
  ),
  eligible AS (
    SELECT
      g.id AS group_buy_id,
      g.product_name,
      g.brand_name,
      COALESCE(i.instagram_username, 'unknown') AS username,
      CASE
        WHEN g.category = 'lifestyle' THEN 'living'
        WHEN g.category = 'digital' THEN 'electronics'
        ELSE g.category
      END AS category,
      g.thumbnail_url,
      COALESCE(g.media_urls, ARRAY[]::text[]) AS media_urls,
      g.start_date,
      g.end_date,
      g.price_krw,
      g.created_at,
      COALESCE(m.deep_views, 0)::bigint AS deep_views,
      COALESCE(m.previous_deep_views, 0)::bigint AS previous_deep_views,
      COALESCE(m.bookmarks, 0)::bigint AS bookmarks,
      COALESCE(m.previous_bookmarks, 0)::bigint AS previous_bookmarks,
      COALESCE(m.notifications, 0)::bigint AS notifications,
      COALESCE(m.previous_notifications, 0)::bigint AS previous_notifications,
      COALESCE(m.search_clicks, 0)::bigint AS search_clicks,
      COALESCE(m.previous_search_clicks, 0)::bigint AS previous_search_clicks
    FROM public.group_buys g
    LEFT JOIN metrics m ON m.group_buy_id = g.id
    LEFT JOIN public.raw_posts rp ON rp.id = g.raw_post_id
    LEFT JOIN public.influencers i ON i.id = rp.influencer_id
    WHERE g.status = 'APPROVED'
      AND (g.end_date IS NULL OR g.end_date >= now())
      AND CASE
        WHEN g.category = 'lifestyle' THEN 'living'
        WHEN g.category = 'digital' THEN 'electronics'
        ELSE g.category
      END IN (
        'food', 'living', 'beauty', 'fashion', 'home', 'kitchen',
        'electronics', 'pet', 'auto', 'hobby', 'baby', 'sports',
        'stationery', 'books', 'media', 'travel'
      )
  ),
  scored AS (
    SELECT
      eligible.*,
      (
        3 * deep_views
        + 2 * bookmarks
        + 2 * notifications
        + search_clicks
      )::double precision AS score,
      (
        3 * previous_deep_views
        + 2 * previous_bookmarks
        + 2 * previous_notifications
        + previous_search_clicks
      )::double precision AS previous_score
    FROM eligible
    WHERE (
      CASE category_filter
        WHEN 'lifestyle' THEN 'living'
        WHEN 'digital' THEN 'electronics'
        ELSE category_filter
      END = 'all'
      OR category = CASE category_filter
        WHEN 'lifestyle' THEN 'living'
        WHEN 'digital' THEN 'electronics'
        ELSE category_filter
      END
    )
  ),
  scored_with_delta AS (
    SELECT
      scored.*,
      (score - previous_score)::double precision AS score_delta,
      ROW_NUMBER() OVER (
        ORDER BY previous_score DESC, group_buy_id ASC
      ) AS previous_rank
    FROM scored
  ),
  ranked AS (
    SELECT
      scored_with_delta.*,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE WHEN sort_filter = 'popular' THEN score END DESC NULLS LAST,
          CASE WHEN sort_filter = 'rising' THEN score_delta END DESC NULLS LAST,
          CASE WHEN sort_filter = 'deadlineSoon' THEN end_date END ASC NULLS LAST,
          CASE WHEN sort_filter = 'newDeal' THEN created_at END DESC NULLS LAST,
          score DESC,
          group_buy_id ASC
      ) AS computed_rank
    FROM scored_with_delta
  ),
  paged AS (
    SELECT ranked.*
    FROM ranked
    WHERE cursor_group_buy_id IS NULL
      OR (
        cursor_score IS NOT NULL
        AND sort_filter = 'popular'
        AND cursor_numeric IS NOT NULL
        AND (
          score < cursor_numeric
          OR (
            score = cursor_numeric
            AND (
              score < cursor_score
              OR (score = cursor_score AND group_buy_id > cursor_group_buy_id)
            )
          )
        )
      )
      OR (
        cursor_score IS NOT NULL
        AND sort_filter = 'rising'
        AND cursor_numeric IS NOT NULL
        AND (
          score_delta < cursor_numeric
          OR (
            score_delta = cursor_numeric
            AND (
              score < cursor_score
              OR (score = cursor_score AND group_buy_id > cursor_group_buy_id)
            )
          )
        )
      )
      OR (
        cursor_score IS NOT NULL
        AND sort_filter = 'deadlineSoon'
        AND (
          (
            cursor_timestamp IS NOT NULL
            AND (
              end_date IS NULL
              OR end_date > cursor_timestamp
              OR (
                end_date = cursor_timestamp
                AND (
                  score < cursor_score
                  OR (score = cursor_score AND group_buy_id > cursor_group_buy_id)
                )
              )
            )
          )
          OR (
            cursor_timestamp IS NULL
            AND end_date IS NULL
            AND (
              score < cursor_score
              OR (score = cursor_score AND group_buy_id > cursor_group_buy_id)
            )
          )
        )
      )
      OR (
        cursor_score IS NOT NULL
        AND sort_filter = 'newDeal'
        AND cursor_timestamp IS NOT NULL
        AND (
          created_at < cursor_timestamp
          OR (
            created_at = cursor_timestamp
            AND (
              score < cursor_score
              OR (score = cursor_score AND group_buy_id > cursor_group_buy_id)
            )
          )
        )
      )
  )
  SELECT
    p.group_buy_id,
    p.computed_rank AS rank,
    p.previous_rank,
    CASE
      WHEN p.previous_score = 0 AND p.score > 0 THEN 'new'
      WHEN p.score_delta > 0 THEN 'up'
      WHEN p.score_delta < 0 THEN 'down'
      ELSE 'same'
    END AS trend_kind,
    ABS(p.score_delta)::bigint AS trend_delta,
    p.product_name,
    p.brand_name,
    p.username,
    p.category,
    p.thumbnail_url,
    p.media_urls,
    p.start_date,
    p.end_date,
    p.price_krw,
    p.created_at,
    p.deep_views,
    p.bookmarks,
    p.notifications,
    p.search_clicks,
    p.score,
    p.score_delta,
    'v2'::text AS score_version
  FROM paged p
  ORDER BY
    CASE WHEN sort_filter = 'popular' THEN p.score END DESC NULLS LAST,
    CASE WHEN sort_filter = 'rising' THEN p.score_delta END DESC NULLS LAST,
    CASE WHEN sort_filter = 'deadlineSoon' THEN p.end_date END ASC NULLS LAST,
    CASE WHEN sort_filter = 'newDeal' THEN p.created_at END DESC NULLS LAST,
    p.score DESC,
    p.group_buy_id ASC
  LIMIT LEAST(GREATEST(limit_count, 1), 101);
$$;

GRANT EXECUTE ON FUNCTION public.get_group_buy_rankings_v2(
  text,
  text,
  text,
  integer,
  numeric,
  timestamp,
  numeric,
  text
) TO anon, authenticated;

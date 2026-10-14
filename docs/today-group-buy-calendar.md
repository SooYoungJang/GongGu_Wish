# 오늘 시작하는 공구 공개 피드 (검토용, 미배포)

## Route and output

`GET /public/v1/group-buys/today` on the existing API proxy, no caller API key.
The route is not live until migration, Worker configuration and deployment are approved.

- KST server date only. No query parameters, arbitrary dates or projections.
- APPROVED rows starting today and not already ended, at most 3 items.
- `date`, `timezone`, `count` (all eligible rows), `items`.
- Each item: `productName`, `sellerName` (public Instagram username), `startDate`, `endDate`.
- Dates are YYYY-MM-DD. Unknown product/seller/end date stays null, never a made-up value.
- No IDs, captions, purchase links, photos, profiles, moderation, user or admin data.
- Alphabetical product order with internal ID tie-breaker. This is NOT a popularity ranking.
- Manual discoveries require collection review APPROVED in addition to status APPROVED.

## Why this layer

The production mobile client currently uses the Cloudflare proxy and Supabase
PostgREST. Adding only a NestJS route would not make production data accessible.
A fixed SECURITY INVOKER RPC uses the existing anon role and RLS. The Worker
re-projects the minimal response and never forwards caller headers/query strings.
All other proxy routes keep their existing API-key gate and no-store policy.

## Security and release gates

Anyone can fetch and redistribute these few public listing fields after release.
This is a new intentional public audience, not an admin endpoint or an Instagram post.
No raw content or seller/product images are included. No data mutations are added.
The endpoint does not grant permission to post on behalf of sellers.

`TODAY_CALENDAR_ANON_KEY` must be set as a Worker secret separately for Preview
and Production. Use only the correct environment's publishable key or legacy anon
key. NEVER service_role, sb_secret, database password or admin token. The code
rejects non-public key shapes; the upstream validates the actual key. The key is
not put in git or returned to callers. This adds a server-held public key to the
existing proxy architecture; mobile authentication remains unchanged.

The user previously received a Supabase RLS warning. Source migrations are not
proof of live RLS state. This change does NOT repair that warning, enable broad
policies, or bypass RLS. The migration and each uncached RPC call fail if RLS is
disabled on group_buys, raw_posts or influencers. Other warned tables still need
separate investigation. Check live RLS policies and anon column grants before
release, including the latest manual-discovery restrictions. Review whether
existing table/RPC access exposes more data independently of this new route.

Cache lifetime is at most 60 seconds, shortened at KST midnight, date-keyed per
Cloudflare location, with no stale-on-error policy. A revoked listing may remain
visible for up to 60 seconds. Errors fail closed and are never cached; a midnight
race may briefly return 502 and can be retried. No data or key is logged by this
handler. It returns generic errors instead of Supabase's private error text.

The aggregate route limit is 300 requests/60 seconds per Cloudflare location
(including cache hits). This protects the upstream without storing user identity
or IP addresses. Heavy traffic can temporarily block legitimate consumers too.
Cloudflare's limit is approximate, not a global hard cap. Namespace IDs in the
review patch are proposals and must be checked as unused in the Cloudflare account.
Missing key, limiter or invalid deployment identity returns 503. A larger audience
may warrant a different limit. CORS remains the existing site's allowlist; CORS is
not an access-control boundary for this intentionally public feed.

## Test status and review procedure

`npm --prefix workers/api-proxy run check`: 29 tests passed locally.
10 new test cases cover KST midnight, allowed key classes, minimal output,
zero listings, rejected input/methods/auth/origins, failure/rate-limit behavior,
cache reprojection and midnight expiry, and SQL static safety guards.
Existing 19 proxy tests remain green.

SQL was not applied to any database here. No local Supabase/Postgres server was
available. `supabase/tests/today_group_buy_calendar.sql` is a transactional integration
check for an empty DISPOSABLE LOCAL database with all migrations applied. It tests
KST boundaries, approval status, seller mapping and fail-closed RLS drift. Never run
that fixture script on production. Further Preview checks before release:

1. Run all migrations and the SQL fixture script on local Supabase; verify NULL
   fields, more than 3 rows/count, duplicate products and direct/legacy seller fallback.
2. Explicitly test manual-discovery PENDING/REJECTED rows and approved review rows
   under anon; verify RLS-filtered seller relations never reveal private raw fields.
3. Verify the persisted timestamp convention against known app listings. Existing
   schema uses timestamp WITHOUT time zone; this proposal treats it as UTC (Prisma/
   mobile convention), then converts to KST. Date-only legacy imports near midnight
   must be checked before release; do not silently alter production dates.
4. Check rate-limit namespace collisions; dry-run both Wrangler configs and inspect
   binding validation. Install approved Wrangler dependencies first if needed.
5. After owner approval only: set the Preview publishable key secret, deploy Preview,
   compare JSON against the app, check 0/1/3+ cases, 429/502/503 and KST rollover.
6. After separate production approval: apply production migration and configuration,
   deploy, fetch the actual public route and compare known listings. Only then resume
   automatic daily cards. No deployment or PR was performed in this preparation.

Rollback: remove the Worker route/module and bindings. After review, optionally drop
`public.get_today_group_buy_calendar()` and its partial index. No app data changes
need reversal. Keep existing proxy and RLS policies intact.

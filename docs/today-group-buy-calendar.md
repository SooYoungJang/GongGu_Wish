# 오늘의 공구 피드: Vercel replacement (review only)

Uses the existing Vite admin Vercel project; no new hosting account/project.
Standalone Function: apps/admin/api/today-calendar.mjs. Helpers live in server/,
not api/, to avoid creating extra function entry points. Public GET route rewrite
precedes the SPA fallback. No admin login behavior changes.

Only today's KST APPROVED listings, at most 3 alphabetical items plus count:
productName, sellerName (public Instagram handle), startDate, endDate. Nulls stay
null. No raw captions, photos, URLs, IDs or user/admin data. The fixed anonymous
Supabase RPC does not forward cookies, caller keys, JWTs or arbitrary filters.

## Environment

Reuses VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY if already present in the
Vercel Function runtime. Actual dashboard values have not been inspected. Optional
server-only overrides: TODAY_CALENDAR_SUPABASE_URL and TODAY_CALENDAR_ANON_KEY.
No key should be sent in chat or committed. Only publishable/anon accepted;
service_role/sb_secret are rejected. VERCEL_ENV determines the expected project:
Preview xwblovggtvbpiusjfokq, Production iosdoheblabfimkjnvfj. Unknown/mismatched
config returns 503. Missing keys may require the owner to set environment-scoped
variables in the existing Vercel project's Environment Variables.

Default OFF: TODAY_CALENDAR_ENABLED must equal true. Operator enables only after
confirming the RPC migration, Preview validation and a Vercel Firewall fixed-window
rate-limit rule scoped to this route and /api/today-calendar direct alias. This flag
is an attestation, not automated proof of a Firewall rule. No settings were changed.
This means the new feed should return 503 in automatic review deployments.

Configure a path-scoped rule without affecting admin pages. Vercel rate limits are
per-region; current plan, existing rule quota and any cost must be verified before
publishing. No in-memory counter is presented as a distributed rate limiter.
No new paid services or wallets are introduced by this patch.

## Cache and data safety

HTTP/browser/CDN caching is explicitly no-store. Function instances keep valid data
for at most 60 seconds, capped at next KST midnight with date/environment cache keys.
This is a per-instance optimization, not a global cache. No yesterday cache fallback,
no stale-on-error, generic errors and 5-second upstream timeout. Data corrections can
remain in an active instance cache for up to 60 seconds. Payload date must be checked
by daily-card consumers too. No key/data logging by this handler.

The Supabase RPC uses SECURITY INVOKER + anon/RLS and fails when source-table RLS is
disabled. The old RLS alert is not fixed by this patch; live policies/column grants
and pending manual-discovery visibility require review. The anon key itself is not
a read-only grant; this handler is read-only and RLS/grants govern the database role.
Stored timestamp-without-time-zone convention must be checked against actual app data.

## Migration history and branches

This replacement is based on the safe #656 revert branch, not an unverified reset of
migration history. Keep 20261015000001 applied history, 00002 compensating removal,
and add 00003 to restore the minimal RPC/index for Vercel. No row deletion or RLS
policy changes. Replacement must NOT merge before the revert or without separate
release approval. If 00002 has not merged, confirm ordering before doing anything.
Existing Cloudflare proxy remains; mobile app depends on its other routes. Only our
old today-feed code/bindings are absent from this replacement base.

## Tests and release

8 Function unit tests cover KST dates, environment/key isolation, explicit opt-in,
minimal output, method/query/auth restrictions, 0/1/3+ cases, generic errors and
midnight cache expiration. SQL fixtures restored for disposable local Supabase.
Before release: verify Vercel build produces the Function; confirm public route and
API alias return JSON not SPA; test existing admin deep links; inspect environment
scope and Firewall rules; apply/run SQL in local/Preview; compare app listings and
verify date boundaries; only then enable. Function handler test is a separate
`node --test apps/admin/server/today-calendar.test.mjs` command.

Review-only does not guarantee no Preview hosting on this repo: Git integration
may auto-build feature branches/PRs. Feed is disabled by default. No manual deployment,
merge, key change, Firewall change or enable flag setting is included in preparation.
Production promotion is a later owner decision.

Sources:
https://vercel.com/docs/functions/quickstart
https://vercel.com/docs/functions/runtimes/node-js
https://vercel.com/docs/environment-variables
https://vercel.com/docs/environment-variables/managing-environment-variables
https://vercel.com/docs/headers/cache-control-headers
https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting

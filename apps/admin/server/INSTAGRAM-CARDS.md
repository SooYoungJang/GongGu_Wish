# Instagram image endpoints (review only)

- `GET|HEAD /public/v1/instagram/intro.jpg`: exact approved introduction card, static1080x1350 sRGB JPEG.
- `GET|HEAD /public/v1/instagram/ongoing.jpg`: up to3 currently approved listings from the environment's public RLS-protected PostgREST table, rendered into a1080x1350 sRGB JPEG, no seller/product photos. Manual-discovery rows must also have collection review APPROVED. Only records with nonempty own Instagram handle and known start/end dates are eligible. Null handle/date rows are deliberately omitted rather than guessed via joins. Same-KST-day endings are excluded since precise seller cutoff is unknown. Empty result returns404, never a placeholder.

## Scope and activation

This PR is for review into develop. No merge, main promotion, environment change, Firewall change, migrations, cron, Instagram token, or posting code is included. The existing `TODAY_CALENDAR_ENABLED` feed is untouched and remains disabled. The dynamic image requires a SEPARATE explicit `INSTAGRAM_CARDS_ENABLED=true`; absent means503. This PR sets no values. Existing public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are used only if environment/project allowlist matches. Production and Preview cannot cross. Secret/service-role keys are rejected. No privileged DB access.

Before enabling the dynamic endpoint, an operator must independently verify public source RLS/column grants, Vercel deployment protection (Meta cannot authenticate), and distributed platform rate limits/budget alerts. The flag is only an attestation gate, not proof that rate limits or RLS are configured. Activation is a separate owner decision. Do not turn on the old calendar feed to enable these cards.

## Rendering/deployment

Bundled Noto Sans CJK KR Regular/Bold with OFL license and original app icon, not runtime HTTP font downloads or headless Chromium. `@resvg/resvg-js` rasterizes a fixed SVG and `sharp` converts to sRGB JPEG (quality90). Native optional binaries must survive Vercel install/tracing; production architecture/runtime is not validated by local tests. Fonts+assets ~33MB before native libraries. Vercel includeFiles explicitly bundles assets. No arbitrary query, external URL, date, caption, SVG or font inputs accepted. XML source text is escaped, product labels bounded/truncated to fit; full product name should remain in separately reviewed caption. This endpoint does not return a caption or act as approval to mention sellers in captions.

## Cache and costs

All HTTP/CDN caching is no-store to avoid stale daily cards/stock implications. A single bounded per-function-instance cache stores only the current environment/day JPEG for up to60seconds and expires at KST midnight. No stale-on-error. Distributed cold starts/concurrent requests can still hit DB/render separately. Native rendering and roughly0.2MB image egress consume function CPU/bandwidth; exact bill depends on existing Vercel plan and traffic, not verified. This is NOT a distributed rate limiter. Configure platform limits separately before opt-in. Static intro reads no DB but still uses function bandwidth. No new paid provider or purchase is included.

## Verification before publishing to Meta

1. Preview deployment, not main: confirm intro returns200 image/jpeg1080x1350 under8MB from an anonymous external connection, not HTML/auth redirect.
2. Check fonts/native modules function on Vercel and visually inspect image pixels. Validate ongoing only after separately approved activation in Preview; approved real source data, same-day omission, empty/error behavior and project binding must match.
3. Production promotion/activation requires separate approval. Then verify public direct HTTPS endpoint with Meta fetchability and cache headers before creating a container. Local generation is NOT proof of a live public endpoint.
4. Instagram publication is outside this PR. Fresh account+daily duplicate check, reviewed caption<=5tags, one intro only, then daily ongoing cards only. No unsupported inventory/discount claims. Token exact expiry remains unverified; keep token in secure storage only.

Local checks: `node --test apps/admin/server/instagram-cards.test.mjs apps/admin/server/today-calendar.test.mjs`.

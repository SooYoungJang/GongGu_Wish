# Branch Strategy: 2-Tier (main / develop)

## Overview

GongGu Wish uses a two-tier branch strategy that separates staging
validation from production releases. The `develop` branch is the
integration branch where feature work is validated against the staging
backend. The `main` branch is the protected release branch that deploys
only to production after a final review.

## Branch Roles

| Branch | Role | Supabase | Cloudflare Worker | Vercel Admin | Mobile EAS Channel |
| --- | --- | --- | --- | --- | --- |
| `main` | Production release | production (`iosdoheblabfimkjnvfj`) | `api.gongguwish.com` | production (`--prod`) | `production` |
| `develop` | Staging integration | staging (`xwblovggtvbpiusjfokq`) | `api-staging.gongguwish.com` | staging (Vercel Preview type) | `staging` |
| `feature/*` | Individual work | local Supabase | n/a | n/a | local Metro |

## Workflow

1. Branch from `develop` for each feature: `git checkout -b feature/my-feature develop`
2. Open a PR targeting `develop`. CI runs lint, typecheck, build, tests, edge function tests, and local Supabase integration contracts.
3. After review and merge into `develop`, GitHub Actions deploys staging Supabase DB migrations, staging Edge Functions, and the staging Cloudflare Worker. The Vercel Git integration creates the Admin staging deployment from the same push. After the backend deployment succeeds, the mobile workflow publishes to the `staging` channel.
4. When staging is validated, open a PR from `develop` to `main`. CI runs the same quality gates plus production-specific checks.
5. After review and merge into `main`, GitHub Actions deploys the production Supabase DB, production Edge Functions, and the production Cloudflare Worker. The Vercel Git integration creates the Admin production deployment from the same push. After the backend deployment succeeds, the mobile workflow publishes to the `production` channel.

## Mobile App Environments

The mobile app defines exactly two deployment environments in
`apps/mobile/app.config.js`:

| Variant | Application ID | Backend | EAS Channel |
| --- | --- | --- | --- |
| Staging | `com.gonggu.wish.preview` | staging | `staging` |
| Production | `com.gonggu.wish` | production | `production` |

The Staging application keeps the existing `com.gonggu.wish.preview`
identifier so previously installed internal builds can be upgraded in place.
Its visible name, scheme, app variant, EAS build profile, and EAS channel are all
named Staging. Production uses the production backend and identity.

Expo custom environment-variable bucket names require a paid plan. Therefore,
the fixed Expo `preview` bucket stores Staging credentials, while
`APP_VARIANT=staging` and the `staging` profile/channel determine the deployed
application environment. This provider-level bucket name does not create a
third deployment tier.

Both release lanes use Expo's `fingerprint` runtime policy. On a merge push,
EAS calculates the Android fingerprint and searches for a successful build
with the same profile, channel, and fingerprint:

- Matching build: publish an OTA update to the branch's channel.
- No matching build: create a new native build containing the merged source.

Android is automated. iOS remains disabled until Apple signing credentials are
configured. Google Play submission remains disabled because the existing Play
developer account is terminated; native changes create an installable
Production APK through the `production-apk` profile, and Production OTA updates
remain automated. Restore the store account before switching the workflow to
the `production` AAB profile and enabling EAS Submit.

## CI Behavior by Branch

### `feature/*` to `develop` PR

- Lint, typecheck, build, unit tests, edge function tests
- Local Supabase integration contracts (in-container)
- Mobile E2E (Android Maestro) when mobile paths change
- No deployment

### `develop` push (merge)

- Same quality gates
- Deploy to staging Supabase DB (`supabase db push`)
- Deploy staging Edge Functions
- RLS policy audit on staging
- Deploy staging Cloudflare Worker (`deploy:staging`)
- Vercel Git integration creates the Admin Staging deployment outside GitHub Actions (Vercel's provider-level deployment type remains `Preview`)
- After backend deployment success, run the Android Staging Fingerprint workflow
- Build a new Staging APK when native inputs changed; otherwise publish a Staging OTA update

### `develop` to `main` PR

- Same quality gates
- Dependency review
- No deployment (PR only)

### `main` push (merge)

- Same quality gates
- Deploy to production Supabase DB
- Deploy production Edge Functions
- RLS policy audit on production
- Deploy production Cloudflare Worker (`deploy:production`)
- Vercel Git integration creates the Admin production deployment outside GitHub Actions
- After backend deployment success, run the Android Production Fingerprint workflow
- Build a new installable Production APK when native inputs changed; otherwise publish a Production OTA update

## GitHub Environments

Two GitHub environments are used in Actions:

- `production`: protects production secrets. Required for all `main` deployments.
- `staging`: protects staging secrets. Required for all `develop` deployments.

Each environment should have its own set of secrets:

- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- `EXPO_TOKEN`

Staging secrets must point to the staging Supabase project and staging Cloudflare Worker. Production secrets must point to production resources.
Vercel credentials and environment variables are managed by the Vercel project because deployments use the repository's Git integration.

## Safety Rules

- Never push directly to `main` or `develop`. All changes go through PRs.
- `main` and `develop` branches should be protected with required status checks and code review.
- Merging `develop` authorizes the Staging mobile deployment; merging `main` authorizes the Production mobile deployment.
- Store submission is not part of the pipeline until an active store account and submission credentials exist.
- If staging secrets are missing, staging deployments are skipped with a warning rather than failing the build.

## Setup Checklist

- [x] Mobile app variants defined (PR #242)
- [x] Staging Cloudflare Worker config (`wrangler.staging.jsonc`)
- [x] Create `develop` branch from `main`
- [x] Configure GitHub `staging` environment with staging secrets
- [x] Protect `main` and `develop` branches with required reviews and status checks
- [x] Connect the Vercel Admin project to the repository for preview and production deployments
- [x] Configure GitHub `staging` and `Production` environments with `EXPO_TOKEN`
- [x] Add Android Staging and Production Fingerprint workflows
- [ ] Configure Apple signing credentials before enabling iOS jobs
- [ ] Create an active Google Play developer account and EAS Submit service account before enabling store submission

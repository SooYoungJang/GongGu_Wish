# Branch Strategy: 2-Tier (main / develop)

## Overview

GongGu Wish uses a two-tier branch strategy that separates Preview
validation from production releases. The `develop` branch is the
integration branch where feature work is validated against the Preview
backend. The `main` branch is the protected release branch that deploys
only to production after a final review.

## Branch Roles

| Branch      | Role                | Supabase                            | Cloudflare Worker            | Vercel Admin          | Mobile EAS Channel |
| ----------- | ------------------- | ----------------------------------- | ---------------------------- | --------------------- | ------------------ |
| `main`      | Production release  | production (`iosdoheblabfimkjnvfj`) | `api.gongguwish.com`         | production (`--prod`) | `production`       |
| `develop`   | Preview integration | preview (`xwblovggtvbpiusjfokq`)    | `api-preview.gongguwish.com` | Preview               | `preview`          |
| `feature/*` | Individual work     | local Supabase                      | n/a                          | n/a                   | local Metro        |

## Workflow

1. Branch from `develop` for each feature: `git checkout -b feature/my-feature develop`
2. Open a PR targeting `develop`. CI runs lint, typecheck, build, tests, edge function tests, and local Supabase integration contracts.
3. After review and merge into `develop`, GitHub Actions deploys Preview Supabase DB migrations, Preview Edge Functions, the Preview Cloudflare Worker, and the Preview mobile app. The Vercel Git integration creates the Admin Preview deployment from the same SHA. `Preview Green` succeeds only after every deployment and the remote API, Admin, and Hiker smoke tests pass.
4. When Preview is validated, open a PR from `develop` to `main`. `Preview Promotion Gate` requires the PR head to be the latest `develop` SHA and requires that exact SHA's successful `Preview Green` run.
5. After review and merge into `main`, GitHub Actions deploys the production Supabase DB, production Edge Functions, and the production Cloudflare Worker. The Vercel Git integration creates the Admin production deployment from the same push. After the backend deployment succeeds, the mobile workflow publishes to the `production` channel.

## Mobile App Environments

The mobile app defines exactly two deployment environments in
`apps/mobile/app.config.js`:

| Variant    | Application ID            | Backend    | EAS Channel  |
| ---------- | ------------------------- | ---------- | ------------ |
| Preview    | `com.gonggu.wish.preview` | preview    | `preview`    |
| Production | `com.gonggu.wish`         | production | `production` |

The Preview application keeps the existing `com.gonggu.wish.preview`
identifier so previously installed internal builds can be upgraded in place.
Its visible name, scheme, app variant, EAS build profile, and EAS channel are all
named Preview. Production uses the production backend and identity.
Authentication callbacks, notification deep links, and the active Maestro E2E
flows derive from the same environment scheme, so Preview cannot launch or
accept Production app links and vice versa.

The Expo variable bucket, `APP_VARIANT`, build profile, and update channel all
use the `preview` name. This provider-level bucket maps directly to the Preview
deployment tier.

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
- Deploy to Preview Supabase DB (`supabase db push`)
- Deploy Preview Edge Functions
- RLS policy audit on Preview
- Deploy Preview Cloudflare Worker (`deploy:preview`)
- Vercel Git integration creates the Admin Preview deployment outside GitHub Actions
- After backend deployment success, run the Android Preview Fingerprint workflow
- Build a new Preview APK when native inputs changed; otherwise publish a Preview OTA update
- Require the Vercel deployment to match the merge SHA
- Smoke test the Preview API, stable Admin branch alias, immutable Vercel deployment URL, and real Hiker lookup
- Publish a `preview-release-<sha>` manifest only when every component is green

### `develop` to `main` PR

- Same quality gates
- Dependency review
- Require the PR to originate from the repository's latest `develop` SHA
- Require a successful `Preview Green` job from the successful `develop` push workflow for that SHA
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
- `preview`: protects Preview secrets. Required for all `develop` deployments.

Each environment should have its own set of secrets:

- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- `EXPO_TOKEN`
- `HIKER_API_KEY`

The Preview environment also defines `PREVIEW_HIKER_SMOKE_URL` for the remote
Hiker smoke test. Missing or malformed deployment credentials fail the workflow;
deployment jobs must never report success after skipping a component.

Deployment branch policies are enforced by GitHub in addition to workflow
conditions:

- `Preview`: only `develop`
- `Production`: only `main`

Preview secrets must point to the Preview Supabase project and Preview Cloudflare Worker. Production secrets must point to production resources.
Vercel credentials and environment variables are managed by the Vercel project because deployments use the repository's Git integration.

## Safety Rules

- Never push directly to `main` or `develop`. All changes go through PRs.
- `main` and `develop` branches should be protected with required status checks and code review.
- Merging `develop` authorizes the Preview mobile deployment; merging `main` authorizes the Production mobile deployment.
- Production promotion PRs must come from the latest `develop` SHA with a successful same-SHA `Preview Green` run.
- Preview database rows and Auth users are never copied to Production. Versioned migrations are code and run against Production only after their merge into `main`.
- Missing deployment credentials fail closed. A skipped DB, Edge Function, Worker, Admin, mobile, or smoke-test step must never produce a green release.
- Store submission is not part of the pipeline until an active store account and submission credentials exist.

## Setup Checklist

- [x] Mobile app variants defined (PR #242)
- [x] Preview Cloudflare Worker config (`wrangler.preview.jsonc`)
- [x] Create `develop` branch from `main`
- [x] Configure GitHub `preview` environment with Preview secrets
- [x] Protect `main` and `develop` branches with required reviews and status checks
- [x] Connect the Vercel Admin project to the repository for preview and production deployments
- [x] Configure GitHub `preview` and `Production` environments with `EXPO_TOKEN`
- [x] Add Android Preview and Production Fingerprint workflows
- [x] Restrict GitHub `Preview` deployments to `develop` and `Production` deployments to `main`
- [x] Sync `HIKER_API_KEY` before the normal Edge Function deployment
- [x] Add same-SHA `Preview Green` and `Preview Promotion Gate` checks
- [x] Make missing Supabase and Cloudflare deployment credentials fail closed
- [ ] Configure Apple signing credentials before enabling iOS jobs
- [ ] Create an active Google Play developer account and EAS Submit service account before enabling store submission

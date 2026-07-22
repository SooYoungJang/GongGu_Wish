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
3. After review and merge into `develop`, the project-bound Supabase GitHub Integration deploys Preview migrations and Edge Functions, while the connected Cloudflare Workers Build deploys the Preview Worker. GitHub Actions waits for those exact-SHA deployments, deploys the Preview mobile app, and verifies the Vercel Admin deployment. `Preview Green` succeeds only after every deployment and the remote API, Admin, and Hiker smoke tests pass.
4. When Preview is validated, open a PR from `develop` to `main`. `Preview Promotion Gate` requires the PR head to be the latest `develop` SHA and requires that exact SHA's successful `Preview Green` run.
5. After review and merge into `main`, GitHub Actions deploys the production Supabase DB, production Edge Functions, and the production Cloudflare Worker. The Vercel Git integration creates the Admin production deployment from the same push. After the backend deployment succeeds, the mobile workflow publishes to the `production` channel.

Promotion copies Git-tracked code only. Preview database rows, Auth users, object
storage, provider secrets, deployment credentials, and generated build artifacts
are never promoted to Production. Production migrations execute only after the
corresponding code is merged into `main`.

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
- Run the local migration, Edge boot, and RLS contracts
- Require the project-bound Supabase integration to apply Preview migrations and Edge Functions for the exact SHA
- Wait for the project-bound `gonggu-api-proxy-preview` Workers Build triggered by the `develop` push and require the exact SHA
- Vercel Git integration creates the Admin Preview deployment outside GitHub Actions
- After backend deployment success, run the Android Preview Fingerprint workflow
- Build a new Preview APK when native inputs changed; otherwise publish a Preview OTA update
- Require the Vercel deployment to match the merge SHA
- Smoke test the Preview API, stable Admin branch alias, immutable Vercel deployment URL, and real Hiker lookup
- Publish a `preview-release-<sha>` manifest only when every component is green

Every `develop` push runs this contract, even when only documentation or CI
files changed. Path filters must not leave a `develop` SHA without a complete
Preview result.

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

The `preview` environment stores only credentials that GitHub Actions must use:

- `EXPO_TOKEN`
- `VERCEL_PREVIEW_DEPLOY_HOOK_URL`

It must not contain `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`,
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, or a Cloudflare Deploy Hook.
The project-bound Supabase and Cloudflare Git integrations own `develop`
deployments without exposing account-wide credentials to GitHub Actions. The
Preview `HIKER_API_KEY` is a runtime secret stored directly in the Preview
Supabase project and remains in place when the integration deploys the function.

The `production` environment stores `SUPABASE_ACCESS_TOKEN`,
`SUPABASE_DB_PASSWORD`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
`EXPO_TOKEN`, and `HIKER_API_KEY` for the explicit `main` deployment jobs.

The Preview environment also stores `VERCEL_PREVIEW_DEPLOY_HOOK_URL`, created
for the Admin project's `develop` branch. It is project/repository/branch scoped
and is used only after the backend and mobile jobs succeed.

The Preview environment also defines `PREVIEW_HIKER_SMOKE_URL` for the remote
Hiker smoke test. Missing or malformed deployment credentials fail the workflow;
deployment jobs must never report success after skipping a component.

Deployment branch policies are enforced by GitHub in addition to workflow
conditions:

- `Preview`: only `develop`
- `Production`: only `main`

Preview integration bindings and runtime secrets must point to the Preview
Supabase project and Preview Cloudflare Worker. Production secrets must point
to production resources.
Vercel credentials and environment variables are managed by the Vercel project because deployments use the repository's Git integration.
The Vercel project's `Skip deployments when there are no changes to the root
directory or its dependencies` option must remain disabled. Create one Deploy
Hook named `github-preview-green` for branch `develop` and store it as
`VERCEL_PREVIEW_DEPLOY_HOOK_URL` in GitHub Preview. `Preview Green` invokes it
before polling the exact-SHA deployment. This covers both path-based skips and
missed Git webhooks without granting GitHub a team-wide Vercel token.

## Credential Isolation Contract

Different resource URLs are necessary but not sufficient. A Preview deployment
credential must also be unable to list, read, update, deploy, or delete the
corresponding Production resource.

- Preview does not use a Supabase PAT or database password. The Supabase GitHub
  Integration is bound to `xwblovggtvbpiusjfokq`, and CI requires its
  `Supabase Preview` check for the exact `develop` SHA and expected project URL.
  Any `SUPABASE_ACCESS_TOKEN` configured in GitHub Preview fails the audit.
- Cloudflare `Workers Scripts Write` is account-scoped, so the GitHub Preview
  environment must not contain an API token or account ID with that permission.
  `gonggu-api-proxy-preview` instead uses its connected Git production trigger,
  bound to `develop`; GitHub Actions observes `/health` until the exact SHA is
  active and never retriggers the build. Production keeps its account token in
  the GitHub Production environment.
- Preview and Production use separate Hiker API keys. The Preview key is stored
  only as a Preview Supabase runtime secret. The Production key is stored in the
  GitHub Production environment and synced to the Production Supabase runtime
  secret during deployment. Neither key is exposed through a `VITE_` variable
  or committed file. A key disclosed in logs, chat, screenshots, or browser
  automation is revoked before release.
- Expo/EAS credentials and variables remain environment-scoped. Preview builds
  use only the `preview` profile, channel, and environment.

Run `CI/CD — Supabase + API` manually with
`audit_preview_credentials=true` after changing Preview integration or
deployment settings. The audit rejects a Supabase PAT, Cloudflare API token, or
Cloudflare account ID in Preview and requires the Admin project's
`develop`-scoped Vercel Deploy Hook. Normal deployment jobs repeat the relevant
checks before making any remote mutation.

Configure Workers Builds for `gonggu-api-proxy-preview` with repository
`SooYoungJang/GongGu_Wish`, production branch `develop`, root directory
`workers/api-proxy`, and deploy command:

```sh
npx wrangler deploy --config wrangler.preview.jsonc --tag "$(git rev-parse HEAD)" --message "Cloudflare $(git rev-parse HEAD)"
```

Do not create or call a Cloudflare Deploy Hook from GitHub Actions. The connected
Git provider triggers this build on each `develop` push. The GitHub job does not
complete until `https://api-preview.gongguwish.com/health` reports the same SHA,
Preview environment, and Preview Supabase project.

## Release Identity Contract

`Preview Green` proves that all deployed surfaces identify as the same exact
40-character Git SHA and as the Preview tier:

- Admin `release-identity.json`: `environment=preview`, `gitRef=develop`, exact
  SHA, Preview Supabase project, Preview API origin
- Worker `/health`: `environment=preview`, exact SHA from Cloudflare version
  metadata, Preview upstream origin
- Vercel deployment lookup: Preview environment, `develop` ref, exact SHA
- Supabase DB, RLS, Edge Functions, Worker, mobile, Admin, and Hiker smoke tests:
  all successful in the same `develop` workflow

An unknown, missing, malformed, cross-tier, or mismatched identity fails closed.

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
- [x] Add read-only credential-scope audits before remote mutations
- [x] Disable Vercel affected-project deployment skipping so every `develop` SHA gets an Admin identity
- [x] Create the Admin `develop` Vercel Deploy Hook and store it only in GitHub Preview
- [x] Bind the Supabase GitHub Integration to the Preview project and reject Preview PATs
- [x] Configure the Preview Worker connected Git build for `develop` and remove broad Cloudflare credentials and Deploy Hooks from GitHub Preview
- [ ] Revoke any previously exposed Preview Hiker key, set a fresh key only in Preview Supabase, and pass the real lookup smoke test
- [ ] Configure Apple signing credentials before enabling iOS jobs
- [ ] Create an active Google Play developer account and EAS Submit service account before enabling store submission

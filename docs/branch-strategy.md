# Branch Strategy: 2-Tier (main / develop)

## Overview

GongGu Wish uses a two-tier branch strategy that separates Preview
validation from production releases. The `develop` branch is the
integration branch where feature work is validated against the Preview
backend. The `main` branch is the protected release branch that deploys
only to production after a final review.

## Branch Roles

| Branch    | Role                | Supabase                            | Cloudflare Worker            | Vercel Admin          | Mobile EAS Channel |
| --------- | ------------------- | ----------------------------------- | ---------------------------- | --------------------- | ------------------ |
| `main`    | Production release  | production (`iosdoheblabfimkjnvfj`) | `api.gongguwish.com`         | production (`--prod`) | `production`       |
| `develop` | Preview integration | preview (`xwblovggtvbpiusjfokq`)    | `api-preview.gongguwish.com` | Preview               | `preview`          |
| `codex/*` | Individual work     | local Supabase                      | n/a                          | n/a                   | local Metro        |

## Agent Operating Rules

Unless the user explicitly requests a different safe workflow, every code,
configuration, and documentation change starts from the latest
`origin/develop` on a short-lived `codex/<task-name>` branch or isolated
worktree. The agent opens a PR to `develop`, fixes required CI failures, merges
the PR when all required checks pass, and verifies the merged SHA through the
complete affected-component Preview contract. Normal work never opens a PR to `main`.

Production promotion requires an explicit current request such as
“프로덕션 배포해” or “main에 올려”. That request authorizes the ordinary
`develop → main` PR, merge, and existing Production deployment pipeline. It
does not authorize destructive migrations, data deletion, credential changes,
or force-merging failed checks. Production promotion always uses the latest
`develop` branch; individual feature branches are never merged or
cherry-picked directly to `main`.

## Workflow

1. Fetch the remote and branch from the latest `origin/develop` for each task: `git switch -c codex/my-task origin/develop`.
2. Open a PR targeting `develop`. CI classifies the diff and runs only the affected workspace, Edge Function, Supabase, Worker, Admin, and Mobile checks.
3. After all required checks pass, merge into `develop` without bypassing branch protection. In this single-collaborator repository, `develop` requires zero human approvals because an author cannot approve their own PR; required status checks remain mandatory. `Change Plan & Policy` then classifies the changed paths. Only affected Preview components are tested and deployed. `Preview Green` records the source SHA plus the affected-component set; every affected component must pass its exact-SHA deployment or smoke contract, while unchanged components reuse their last verified deployment.
4. Only after an explicit Production request, open a PR from the latest `develop` to `main`. `Preview Promotion Gate` requires the PR head to be the latest `develop` SHA and requires that exact SHA's successful `Preview Green` run.
5. After review and merge into `main`, the same classifier evaluates the complete `main...develop` promotion diff and runs only the affected Production DB, Edge Functions, Worker, Admin, and Mobile stages.

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

### `codex/*` to `develop` PR

- Lint, typecheck, build, unit tests, edge function tests
- Local Supabase integration contracts (in-container)
- Mobile E2E (Android Maestro) when mobile paths change
- No deployment

### `develop` push (merge)

- Always run the dependency-free change classifier and policy contract tests.
- Markdown-only changes run no app build, Supabase, Worker, Vercel, or Mobile deployment.
- Run lint, typecheck, build, and tests only for affected workspaces and their known dependents.
- Start PostgreSQL and generate the Prisma test client only when the API workspace is affected; non-API workspace tests run without the database service.
- Run local Supabase, Edge Function, Worker, Admin, and Mobile jobs only when their paths or shared dependencies changed.
- Require an exact merge SHA only from affected deployed components; unchanged components retain their previous verified SHA.
- Run remote API/Admin/Hiker smoke checks only when the corresponding component changed.
- Always publish a `preview-release-<sha>` manifest containing the affected-component map so `Preview Promotion Gate` has a result for every `develop` SHA.

### `develop` to `main` PR

- Same quality gates
- Dependency review
- Require the PR to originate from the repository's latest `develop` SHA
- Require a successful `Preview Green` job from the successful `develop` push workflow for that SHA
- No deployment (PR only)

### `main` push (merge)

- Recompute affected paths across the complete promoted `main...develop` diff.
- Run workspace quality gates only for affected packages and dependents.
- Deploy Production Supabase DB/RLS only for migration or config changes.
- Deploy Production Edge Functions only for function or config changes.
- Deploy the Production Cloudflare Worker only for `workers/api-proxy` changes.
- Let Vercel build Admin only for Admin, shared-package, or root dependency changes.
- Run Android Production Build/OTA only for Mobile, shared-package, or root dependency changes.
- A documentation-only promotion updates Git history without rebuilding Production applications.

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
The Admin `vercel.json` defines an Ignored Build Step for `apps/admin`,
`packages/shared`, and root dependency files so unrelated commits do not consume
a build. It compares the branch's last successful Vercel deployment SHA with the
current commit and fails safe to a build when no previous SHA exists. Create one Deploy Hook named `github-preview-green` for branch `develop` and store it as
`VERCEL_PREVIEW_DEPLOY_HOOK_URL` in GitHub Preview. `Preview Green` invokes it
only when Admin is affected, before polling the exact-SHA deployment. This
covers missed Git webhooks without granting GitHub a team-wide Vercel token.

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
`workers/api-proxy`, build watch include path `workers/api-proxy/*`, and deploy command:

```sh
npx wrangler deploy --config wrangler.preview.jsonc --tag "$(git rev-parse HEAD)" --message "Cloudflare $(git rev-parse HEAD)"
```

Do not create or call a Cloudflare Deploy Hook from GitHub Actions. The connected
Git provider triggers a build only when the Worker watch path changed. The
GitHub Worker job then requires `https://api-preview.gongguwish.com/health` to
report the same SHA, Preview environment, and Preview Supabase project.

## Release Identity Contract

`Preview Green` records the current 40-character source SHA and an affected map.
Every affected deployed surface must identify as that SHA and the Preview tier:

- Admin `release-identity.json`: `environment=preview`, `gitRef=develop`, exact
  SHA, Preview Supabase project, Preview API origin
- Worker `/health`: `environment=preview`, exact SHA from Cloudflare version
  metadata, Preview upstream origin
- Vercel deployment lookup: Preview environment, `develop` ref, exact SHA
- Supabase, Worker, mobile, Admin, and Hiker smoke tests: required only when the
  classifier marks the corresponding component affected
- Unaffected surfaces: reused from their last verified Preview deployment and
  not falsely labeled as the current SHA

An unknown, missing, malformed, cross-tier, or mismatched identity fails closed.

## Safety Rules

- Never push directly to `main` or `develop`. All changes go through PRs.
- Normal development work branches from the latest `origin/develop` and targets `develop`; it never targets `main`.
- `develop` requires strict status checks and zero human approvals for the single-collaborator workflow. Never bypass or force-merge failed required checks.
- `main` requires its status checks plus one human approval before Production promotion.
- Merging `develop` authorizes the Preview mobile deployment; merging `main` authorizes the Production mobile deployment.
- Create and merge a `develop → main` PR only after an explicit Production request. Never promote an individual task branch directly to `main`.
- Production promotion PRs must come from the latest `develop` SHA with a successful affected-components `Preview Green` run for that source SHA.
- Preview database rows and Auth users are never copied to Production. Versioned migrations are code and run against Production only after their merge into `main`.
- Missing deployment credentials fail closed for affected components. An unaffected job may skip, but an affected DB, Edge Function, Worker, Admin, mobile, or smoke-test step must never produce a green release.
- Store submission is not part of the pipeline until an active store account and submission credentials exist.

## Setup Checklist

- [x] Mobile app variants defined (PR #242)
- [x] Preview Cloudflare Worker config (`wrangler.preview.jsonc`)
- [x] Create `develop` branch from `main`
- [x] Configure GitHub `preview` environment with Preview secrets
- [x] Protect `develop` with required status checks and zero required human approvals for the single-collaborator workflow
- [x] Protect `main` with required status checks and one required human approval
- [x] Connect the Vercel Admin project to the repository for preview and production deployments
- [x] Configure GitHub `preview` and `Production` environments with `EXPO_TOKEN`
- [x] Add Android Preview and Production Fingerprint workflows
- [x] Restrict GitHub `Preview` deployments to `develop` and `Production` deployments to `main`
- [x] Sync `HIKER_API_KEY` before the normal Edge Function deployment
- [x] Add affected-components `Preview Green` and `Preview Promotion Gate` checks
- [x] Make missing Supabase and Cloudflare deployment credentials fail closed
- [x] Add read-only credential-scope audits before remote mutations
- [x] Configure the Admin Ignored Build Step so only Admin and dependency changes get a new identity
- [x] Create the Admin `develop` Vercel Deploy Hook and store it only in GitHub Preview
- [x] Bind the Supabase GitHub Integration to the Preview project and reject Preview PATs
- [x] Configure the Preview Worker connected Git build for `develop` and remove broad Cloudflare credentials and Deploy Hooks from GitHub Preview
- [ ] Set the Preview Worker build watch include path to `workers/api-proxy/*` in Cloudflare Settings > Build
- [x] Add affected-path CI planning, component-specific deployment gates, and documentation-only no-op releases
- [ ] Revoke any previously exposed Preview Hiker key, set a fresh key only in Preview Supabase, and pass the real lookup smoke test
- [ ] Configure Apple signing credentials before enabling iOS jobs
- [ ] Create an active Google Play developer account and EAS Submit service account before enabling store submission

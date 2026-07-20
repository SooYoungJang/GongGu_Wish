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
| `develop` | Staging integration | staging (`xwblovggtvbpiusjfokq`) | `api-staging.gongguwish.com` | preview | `development` / `preview` |
| `feature/*` | Individual work | local Supabase | n/a | n/a | local Metro |

## Workflow

1. Branch from `develop` for each feature: `git checkout -b feature/my-feature develop`
2. Open a PR targeting `develop`. CI runs lint, typecheck, build, tests, edge function tests, and local Supabase integration contracts.
3. After review and merge into `develop`, CI automatically deploys to staging: staging Supabase DB migrations, staging Edge Functions, staging Cloudflare Worker, and Vercel preview deployment.
4. When staging is validated, open a PR from `develop` to `main`. CI runs the same quality gates plus production-specific checks.
5. After review and merge into `main`, CI deploys to production: production Supabase DB, production Edge Functions, production Cloudflare Worker, and Vercel production (`--prod`).

## Mobile App Variants

The mobile app already defines three variants in `apps/mobile/app.config.js`:

| Variant | Application ID | Backend | EAS Channel |
| --- | --- | --- | --- |
| Development | `com.gonggu.wish.dev` | staging | `development` |
| Preview | `com.gonggu.wish.preview` | staging | `preview` |
| Production | `com.gonggu.wish` | production | `production` |

Development and Preview both use the staging backend (`api-staging.gongguwish.com` and staging Supabase). Production uses the production backend. The variant is selected at build time via `APP_VARIANT` in `eas.json` profiles and EAS environments.

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
- Deploy Vercel preview (no `--prod`)

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
- Deploy Vercel production (`--prod`)

## GitHub Environments

Two GitHub environments are used in Actions:

- `production`: protects production secrets. Required for all `main` deployments.
- `staging`: protects staging secrets. Required for all `develop` deployments.

Each environment should have its own set of secrets:

- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

Staging secrets must point to the staging Supabase project and staging Cloudflare Worker. Production secrets must point to production resources.

## Safety Rules

- Never push directly to `main` or `develop`. All changes go through PRs.
- `main` and `develop` branches should be protected with required status checks and code review.
- Production EAS Update publication, store submission, and store release require explicit approval outside of this pipeline.
- If staging secrets are missing, staging deployments are skipped with a warning rather than failing the build.

## Setup Checklist

- [x] Mobile app variants defined (PR #242)
- [x] Staging Cloudflare Worker config (`wrangler.staging.jsonc`)
- [ ] Create `develop` branch from `main`
- [ ] Configure GitHub `staging` environment with staging secrets
- [ ] Protect `main` and `develop` branches with required reviews and status checks
- [ ] Configure Vercel preview project or branch alias for `develop` if needed

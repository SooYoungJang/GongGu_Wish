# Implementation Plan: App Environments

## Overview

Introduce explicit Development, Preview, and Production variants, provision a staging backend and proxy, configure environment-scoped credentials, and distribute a production-like Preview app to two testers without changing the Production release.

## Architecture Decisions

- Use dynamic Expo configuration and distinct application identifiers so variants can coexist.
- Keep the existing Supabase project and `api.gongguwish.com` exclusively for Production.
- Use one staging Supabase project for both Development and Preview; these lanes differ by runtime tooling and EAS Update channel, not data.
- Use EAS project environments for public runtime configuration and file variables for per-variant Firebase configuration.
- Treat migrations and Edge Function source in this repository as the canonical staging schema; do not clone Production user data.
- Require the explicit SDK 55 `--environment` argument for every EAS Update and expose only fixed lane-specific update scripts.
- Derive `runtimeVersion` from app version plus variant and fail fast when a variant is paired with the wrong Supabase/API origins.

## Dependency Order

1. Pure variant model and tests
2. Expo/EAS profiles and local scripts
3. Staging Supabase and schema/functions
4. Staging Cloudflare proxy and EAS variables
5. Firebase/Apple credentials and tester distribution
6. Runtime verification, documentation, and delivery workflow

## Tasks

### Phase 1: Local configuration

- Add pure variant resolution and unit tests to the existing dynamic Expo config.
- Add Development, Preview, and Production EAS profiles with isolated channels/environments.
- Add explicit local scripts and example environment documentation.
- Validate all three public Expo configurations.

### Checkpoint: Configuration

- Variant tests, mobile tests, lint, typecheck, and config validation pass.
- Production config resolves to the existing name and application identifier.

### Phase 2: Staging infrastructure

- Create a free `gonggu-wish-staging` Supabase project.
- Apply repository migrations and deploy required Edge Functions without Production data.
- Deploy a staging Worker at `api-staging.gongguwish.com` using the staging Supabase origin.
- Populate Development and Preview EAS environments with staging public values; preserve Production values.

### Checkpoint: Backend

- Staging Supabase health, schema contract, Edge Function contracts, and proxy requests pass.
- Staging data changes do not appear in Production.

### Phase 3: Native services and distribution

- Register Development and Preview Firebase Android applications and upload environment-scoped service files.
- Register Apple identifiers/profiles for Development and Preview; configure Sign in with Apple and APNs.
- Configure Supabase Auth providers and redirect URLs for variant schemes.
- Build Preview artifacts and distribute them only to the two approved testers.

### Checkpoint: Preview

- Both testers can install Preview without Metro.
- Full authentication, push, deep-link, and account lifecycle flows pass.

### Phase 4: Delivery

- Record runtime evidence and important operational notes in the wiki.
- Commit intended files, open a PR, monitor CI, fix failures, merge only after required checks pass, and fast-forward local `main`.

## Risks and Mitigations

| Risk                                             | Impact | Mitigation                                                                        |
| ------------------------------------------------ | ------ | --------------------------------------------------------------------------------- |
| Variant accidentally targets Production          | High   | Fixed backend contracts, runtime isolation, explicit EAS scripts, and visible app names |
| Preview credentials missing for a new identifier | High   | Register Firebase/Apple apps before builds and verify full auth/push flows        |
| Free staging project pauses                      | Medium | Document restore procedure; two testers reactivate through normal use             |
| Schema drift between projects                    | High   | Apply only versioned migrations and run contract tests                            |
| Wrong EAS Update channel/environment             | High   | Fixed scripts plus variant-specific runtime versions that reject cross-lane OTA delivery |
| Existing user work is overwritten                | High   | Work in a dedicated worktree branched from `origin/main`                          |

## Production Safety Gate

Production EAS Update publication, store submission, store release, Production credential changes, and Production data mutation require a separate explicit approval.

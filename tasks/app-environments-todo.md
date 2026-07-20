# App Environments Checklist

## Local configuration

- [x] Add failing tests for Preview and Production variants.
- [x] Implement variant-aware Expo configuration.
- [x] Add EAS build profiles, channels, environments, and local scripts.
- [x] Document environment variables and validate all resolved configs.
- [x] Fail fast on cross-lane backend pairings and isolate OTA runtime by variant.

## Preview Supabase

- [x] Create the free `gonggu-wish-preview` project.
- [x] Link Preview safely without replacing Production project metadata.
- [x] Apply all repository migrations.
- [x] Deploy repository-backed Edge Functions and configure required Preview secrets.
- [x] Keep Preview empty until synthetic tester data is created; no Production data copied.
- [x] Run schema and function contract checks.

## Preview proxy and EAS

- [x] Deploy the Preview Worker at `api-preview.gongguwish.com`.
- [x] Verify Worker health, route allowlist, and real Preview query.
- [x] Configure Preview EAS public variables.
- [x] Confirm Production variables are unchanged.

## Native services

- [x] Register the Firebase Android application for `.preview`.
- [x] Store variant Firebase files as EAS file variables.
- [ ] Register Apple identifiers/profiles with Sign in with Apple and APNs.
- [x] Configure Preview Supabase Auth redirect URLs.
- [ ] Enable Kakao, Naver, and Apple providers after credentials are supplied.

## Distribution and verification

- [ ] Complete the in-progress Android Preview build.
- [ ] Build Preview for iOS internal testing after Apple credentials are available.
- [ ] Verify two-tester installation without Metro.
- [ ] Verify authentication, push notifications, deep links, and account deletion.
- [x] Run unit tests, lint, typecheck, and config validation.
- [ ] Run installed-app E2E after a Preview artifact is available.
- [ ] Record evidence and operational notes in the wiki.
- [ ] Commit, push, open PR, monitor CI, merge, and fast-forward local `main`.

## Explicitly excluded

- [ ] Do not publish a Production EAS Update.
- [ ] Do not submit or release a Production store build.
- [ ] Do not copy Production users or private data into Preview.

# Task Checklist: 마케팅 광고성 푸시 발송

## Foundation

- [x] Add consent columns and auth-profile backfill/trigger handling.
- [x] Extend `register-push-token` contract and persistence with consent audit fields.
- [x] Add Deno regression tests for defaults, round-trip, and withdrawal.

## Delivery

- [x] Add server-enforced marketing audience filtering.
- [x] Add idempotent `(광고)` title handling.
- [x] Keep service notification audience behavior unchanged.

## Mobile

- [x] Add marketing preference to local/remote normalization.
- [x] Add Settings switch with explicit permission flow and accessible copy.
- [x] Add mobile unit/component regression coverage.

## Admin

- [x] Add marketing audience mode and payload flag.
- [x] Show consent-filtered result and confirmation copy.
- [x] Add admin component/contract regression coverage.

## Verification and shipping

- [ ] Run affected tests, typechecks, lint, and builds.
- [ ] Run code review and diff/security checks.
- [ ] Update wiki with implementation and verification evidence.
- [ ] Commit, push, create PR, wait for required CI, merge to `develop`, and verify Preview/OTA.

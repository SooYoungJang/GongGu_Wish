# Implementation Plan: Remote Instagram Public Collector

## Overview

Enable the existing local Playwright public collector to run once on demand from GitHub Actions after an operator creates an Instagram `storageState` at home. Production writes remain explicitly opt-in and are protected by the `production` Environment, a latest-`main` check, workflow confirmation, and the existing collector preflight guard.

## Architecture Decisions

- Keep Playwright in a short-lived GitHub-hosted runner; do not move browser scraping into Supabase Edge Functions.
- Store `INSTAGRAM_PLAYWRIGHT_STORAGE_STATE_JSON` and `INSTAGRAM_COLLECTOR_TOKEN` only as GitHub `production` Environment Secrets.
- Use `workflow_dispatch` only. Do not enable a recurring schedule until session expiry and Instagram access behavior are observed.
- Reuse the existing Python worker, target guard, latest-three-post logic, active/upcoming filtering, deduplication, and admin review flow.

## Task List

### Phase 1: Remote execution contract

- [ ] Add a production-only, manually dispatched GitHub Actions workflow.
- [ ] Add input validation for collection mode, discovery target, and time budget.
- [ ] Add a local helper for uploading the one-time storage state and optional current-user collector token without printing secret values.

### Checkpoint: Contract

- [ ] Workflow contract test passes.
- [ ] Existing Instagram worker unit tests and `compileall` pass.
- [ ] No storage state, token, or credential appears in the diff.

### Phase 2: Operator documentation

- [ ] Document one-time login, Secret upload, remote dispatch, and session rotation steps.
- [ ] Record that each run writes real Production rows and should be reviewed in the automatic collection tab.

### Checkpoint: Complete

- [ ] CI quality gates pass.
- [ ] The workflow is available from the `main` branch and defaults to a one-shot run.
- [ ] Production has not been executed during implementation.

## Risks and Mitigations

| Risk                                              | Impact | Mitigation                                                                                                            |
| ------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- |
| Instagram session expires or triggers a challenge | High   | Keep one-shot manual execution, fail on login/challenge screens, rotate the secret from a fresh local login.          |
| Production write is accidentally enabled          | High   | Require `main`, `confirm_production`, Production Environment approval, latest-main check, and worker preflight flags. |
| Secrets leak through logs or process arguments    | High   | Pass secrets through GitHub environment variables/stdin only; never echo or use `--body` in the helper.               |
| Repeated scraping increases rate-limit risk       | Medium | No default schedule, one run per dispatch, existing post limit and time budget caps.                                  |

## Open Questions

- Whether to enable a recurring schedule should be decided after observing one-shot runs and session lifetime.

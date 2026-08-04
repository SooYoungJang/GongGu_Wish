# Implementation Plan: 마케팅 광고성 푸시 발송

## Dependency graph

```text
users.marketing_push_enabled + consent audit columns
        -> register-push-token preferences contract
        -> mobile settings toggle

users.marketing_push_enabled
        -> admin-api marketing audience filter
        -> admin marketing send mode
        -> Expo `(광고)` push
```

## Phase 1: Consent foundation

1. Additive migration adds the opt-in flag and audit fields, defaulting to false.
2. Auth profile provisioning carries the existing signup metadata into the profile.
3. `register-push-token` reads, validates, persists, and records consent changes.

### Checkpoint: consent foundation

- Contract tests pass.
- Existing token registration remains backward compatible.

## Phase 2: Server-enforced marketing delivery

1. Add the `marketing` preference audience and server-side recipient filter.
2. Add the additive `marketing` request flag and server-enforced `(광고)` title prefix.
3. Preserve existing service notification audience behavior.

### Checkpoint: delivery safety

- Marketing rows without consent are excluded.
- Service rows are unaffected.
- Deno push contract tests pass.

## Phase 3: Mobile consent UX

1. Add the marketing preference to local/remote preference normalization.
2. Add a separate optional switch in Settings.
3. When enabling, reuse the explicit push registration path so OS permission is requested only from the user action.

### Checkpoint: user flow

- Toggle on persists only after push registration succeeds.
- Toggle off persists without opening an OS prompt.

## Phase 4: Admin send UX

1. Add a clearly labeled marketing audience mode.
2. Send `marketing: true` through the existing confirmation flow.
3. Show the consent-filtered result count.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Client sends a forged consent value | High | Filter again in the admin Edge Function from `public.users`. |
| Existing clients omit the new preference | Medium | Treat missing field as false and keep old token-only requests valid. |
| Admin forgets advertising label | Medium | Add `(광고)` server-side, idempotently. |
| Marketing toggle requests permission at startup | High | Reuse only the explicit settings action; automatic preference restore remains request-free. |

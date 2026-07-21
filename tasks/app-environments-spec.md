# Spec: Preview and Production Environments

## Objective

Separate GongGu Wish into two explicit deployment tiers so changes merged to `develop` become Preview and changes merged to `main` become Production.

The desired installed variants are:

| Variant    | Display name     | Application ID            | Backend    | EAS channel  |
| ---------- | ---------------- | ------------------------- | ---------- | ------------ |
| Preview    | 공구위시 Preview | `com.gonggu.wish.preview` | preview    | `preview`    |
| Production | 공구위시         | `com.gonggu.wish`         | production | `production` |

Local development defaults to the Preview variant and connects to Metro. Installed Preview and Production builds run without Metro and receive updates only from their own EAS Update channel.

## Tech Stack

- Expo SDK 55 / React Native 0.83
- Dynamic Expo config in `apps/mobile/app.config.js`
- EAS Build environments and EAS Update channels
- Supabase hosted projects for Preview and Production
- Cloudflare Workers custom domains for public data API proxying
- Firebase Cloud Messaging and Apple Push Notification service
- `expo-updates` with an app-version-and-variant runtime contract

## Commands

- Install: `npm ci --ignore-scripts`
- Development server: `npm run mobile:dev`
- Preview build: `npx eas-cli build --platform android --profile preview`
- Preview update: `npm run update:preview --workspace=@gonggu/mobile -- --message "<message>"`
- Production build: `npx eas-cli build --platform all --profile production`
- Production update: `npm run update:production --workspace=@gonggu/mobile -- --message "<message>"`
- Mobile tests: `npm test --workspace=@gonggu/mobile`
- Mobile typecheck: `npm run build:mobile`
- Mobile lint: `npm run lint --workspace=@gonggu/mobile`
- Expo config check: `npx expo config --type public`

## Project Structure

- `apps/mobile/app.json`: shared static Expo configuration
- `apps/mobile/app.config.js`: variant-dependent native configuration
- `apps/mobile/eas.json`: build profiles, environments, and update channels
- `apps/mobile/.env.example`: documented local development values
- `apps/mobile/src/lib`: runtime environment resolution and tests
- `supabase/migrations`: canonical schema for both hosted projects
- `supabase/functions`: canonical Edge Functions for both hosted projects
- `workers/api-proxy`: shared Worker implementation and per-environment deploy configuration
- `tasks`: specification, plan, and implementation checklist

## Code Style

Variant resolution is a small pure function and all native configuration derives from it:

```js
const variant = resolveAppVariant(process.env.APP_VARIANT);

return {
  ...config,
  name: variant.name,
  scheme: variant.scheme,
  ios: { ...config.ios, bundleIdentifier: variant.applicationId },
  android: { ...config.android, package: variant.applicationId },
};
```

- Keep Preview as the local default when `APP_VARIANT` is absent.
- Reject unknown variants instead of silently targeting Production.
- Reject any variant whose Supabase/API origins do not match its fixed backend contract.
- Include the variant in `runtimeVersion` so a wrong channel/environment pairing cannot cross-install an OTA update.
- Never embed service-role keys, database passwords, signing credentials, or private production data.

## Testing Strategy

- Unit-test variant name, identifier, scheme, Firebase file selection, backend pairing, runtime isolation, and invalid variant handling.
- Validate each resolved Expo config with `expo config` using `APP_VARIANT=preview|production`.
- Run existing mobile unit tests, lint, and TypeScript checks.
- Smoke-test Preview Worker health and a real allowlisted Supabase query.
- Verify email/social authentication, push token registration, notification receipt, deep linking, and account deletion in the installed Preview app.
- Store E2E screenshots/video in the project wiki evidence directory.

## Boundaries

- Always: keep Production identifiers and backend unchanged; use migrations as the schema source; use test-only data in Preview; keep EAS channels isolated.
- Ask first: publish a Production EAS Update, submit or release a Production store build, change Production credentials, or copy Production user data.
- Never: commit credentials; route Preview writes to Production; deploy an unverified update to `production`; delete or overwrite the existing Supabase project.

## Success Criteria

- Both variants resolve to distinct names, schemes, and application identifiers.
- Preview uses Preview Supabase and `api-preview.gongguwish.com`; Production remains on the existing production services.
- Preview can coexist with the Production app on one device.
- Preview is installable by two testers without Metro and receives only `preview` updates.
- Preview supports email/social sign-in, Apple sign-in on iOS, FCM/APNs push notifications, and notification deep links.
- Unit tests, config validation, typecheck, lint, and required CI checks pass.
- No Production update or store release occurs as part of this change.

## External Account Follow-ups

- Apple Developer access and 2FA are required before the `.dev` and `.preview`
  iOS identifiers, Sign in with Apple, APNs credentials, and TestFlight build can
  be completed.
- Kakao and Naver developer credentials are required before those providers can
  be enabled in Preview. The current Production Supabase project also reports
  those providers as disabled.
- The repository's current `main` branch references a `naver-auth` Edge Function
  in `supabase/config.toml`, but does not contain that function's source. Do not
  reconstruct or copy an untracked local implementation without an explicit
  source-of-truth decision.

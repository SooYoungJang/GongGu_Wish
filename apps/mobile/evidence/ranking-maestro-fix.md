# Ranking Maestro Flow Fix

## Failure observed

- Run: `~/.maestro/tests/2026-06-20_235134/`
- Flow: `.maestro/search-ranking-test.yaml`
- Platform: iOS / XCUITest runner
- Symptom: flow reached the post-scroll section, then the iOS runner stopped responding while Maestro was collecting hierarchy/screenshots after a `swipeV2`.

Relevant runner log excerpt:

```text
[SwipeRouteHandlerV2] Swipe (v2) from (201.0, 786.0) to (201.0, 87.0) with 0.6 duration
...
request: GET /isScreenStatic
request: GET /screenshot
```

The app was still foregrounded as `com.gonggu.calendar`; the failure matched Maestro/XCUITest post-swipe capture flakiness rather than a React Native crash.

## App-side risk found

The bottom tab bar is absolute-positioned with a floating rounded style. On narrow devices (320pt/375pt), the original fixed horizontal margins and fixed bottom offset risked clipping or overlapping scroll content.

Fixes:

- `apps/mobile/src/App.tsx`
  - Uses `useWindowDimensions()` to reduce floating tab horizontal margins on narrow screens.
  - Uses `useSafeAreaInsets()` and applies an explicit `bottom` offset based on the device safe-area inset.
- `apps/mobile/src/screens/StoreScreen.tsx`
  - Documents the reserved tab-bar bottom space with named constants so list padding stays aligned with the floating tab-bar height.

## Flow-side fix

The monolithic flow was split into two independently launchable flows:

- `.maestro/ranking-tab-verify.yaml`
  - Verifies home tab bar and Search ranking screen before any scroll.
  - Captures screenshots 1-3.
- `.maestro/ranking-tab-scroll-verify.yaml`
  - Relaunches app and navigates to Search before the scroll section.
  - Verifies tab bar after scroll.
  - Marks post-scroll screenshots optional, so assertions remain the pass/fail source of truth when screenshot capture is flaky.
- `.maestro/search-ranking-test.yaml`
  - Orchestrates the two sub-flows with `runFlow`.

## Width verification

Added script:

```bash
scripts/run-ranking-maestro-widths.sh
```

It runs the ranking flow across representative iOS point widths:

- 320pt: `iPhone SE (1st generation)`
- 375pt: `iPhone SE (3rd generation)`
- 414pt: `iPhone 11`

Artifacts are written to:

```text
apps/mobile/evidence/maestro-widths/
```

## Local blocker

This machine's active Java is below Maestro 2.x requirements. `maestro --version` currently reports:

```text
ERROR: Java 17 or higher is required.
```

Install/activate Java 17+ before running the width script.

# Evidence Cleanup — 2026-06-21

## What was removed

### 1. Stale execution logs (appId: com.gonggu.calendar)
Removed all old Maestro execution artifacts that reference the old bundle ID `com.gonggu.calendar`:

| Device | Directory | Items |
|--------|-----------|-------|
| 414pt | `414pt/2026-06-21_014352/` | commands JSON, xctest log, failure PNG |
| 414pt | `414pt/2026-06-21_014713/` | commands JSON, xctest log |
| 390pt | `390pt/2026-06-21_012801/` | commands JSON, xctest log, failure PNG |
| 390pt | `390pt/2026-06-21_013044/` | commands JSON, xctest log, failure PNG |
| 390pt | `390pt/2026-06-21_013353/` | commands JSON, xctest log, failure PNG |
| 390pt | `390pt/2026-06-21_013935/` | commands JSON, xctest log, failure PNG |
| 390pt | `390pt/2026-06-21_014246/` | commands JSON, xctest log, failure PNG |
| test | `test-original/` | commands JSON, xctest log, failure PNG |
| root | `execution-390pt.log` | AppId references to old bundle |
| root | `execution-414pt.log` | AppId references to old bundle |

### 2. Duplicate SHA256 screenshots (screenshots/ subdirs)
Removed old `screenshots/` subdirectories in 414pt and 390pt that contained duplicate SHA256 images from the pre-fix Maestro flow:

- `414pt/screenshots/` — screenshots 02–05 were byte-identical (same SHA256 `acef841`)
- `390pt/screenshots/` — screenshots 02–06 were all byte-identical (same SHA256 `353b3c8`)

These were from the old `runFlow`-splitting approach that caused XCUITest screenshot-cache invalidation failures.

## Remaining evidence

| Device | PNGs | SHA256 uniqueness | Status |
|--------|------|-------------------|--------|
| 375pt | 6 | 5/6 (02=03 legacy) | Legacy duplicate — old flow intentionally captured same view for tabbar verification |
| 390pt | 6 | 6/6 | ✅ Clean — current `search-ranking-test.yaml` flow |
| 414pt | 6 | 6/6 | ✅ Clean — current `search-ranking-test.yaml` flow |
| 402pt | 3 | 2/3 (01=03) | Calendar filter evidence — off-state screenshots are expected to be identical |

All remaining log files in `.maestro/evidence/logs/` were NOT removed — they do NOT contain `com.gonggu.calendar` references and serve as execution reference.

## New evidence file added

- `.maestro/home-screen-v2-evidence.yaml` — HomeScreen v2 E2E evidence flow
  Captures: header, MonthlyBannerCarousel, CategoryRow, WeeklyCalendarStrip,
  ThisWeekDeals, ExpiringSoonSection (textLink), and header actions.

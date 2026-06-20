# QA Report: Ranking 수정 재검수 2차
## Task: t_a74f3889
## Date: 2026-06-20
## Verdict: REQUEST CHANGES

---

## Summary
Critic (t_3960e3ca) returned 1st round QA (t_080f739a) as NEEDS EVIDENCE for 3 items:
1. No simulator layout screenshots
2. No SafeArea overlap verification
3. No FollowButton operation verification

2nd round QA completed with Maestro E2E on iOS 26.5 simulator (iPhone 17 Pro).

## Automated Tests
| Test | Result |
|------|--------|
| typecheck (tsc --noEmit) | PASS (0 errors) |
| mobile tests (vitest) | 40/40 PASS |
| ranking component tests | 4/4 PASS |

## Maestro E2E Evidence

### 1. Simulator Layout Screenshots - PASS
- `evidence/01-ranking-tab.png`: Search tab active, header visible, ranking items render correctly
- `evidence/07-before-follow.png`: 3 ranking items with correct data and FollowButton states

### 2. SafeArea Overlap Verification - PASS
- **Top SafeArea**: Content starts below status bar with proper spacing (evidence/01-ranking-tab.png)
- **Bottom SafeArea**: Tab bar sits above home indicator with proper spacing (evidence/04-safearea-bottom.png)
- StoreScreen uses `<SafeAreaView edges={['top', 'bottom']}>` correctly

### 3. FollowButton Operation - MAJOR BUG FOUND
**Bug:** FollowButton is NOT independently tappable in native iOS.

**Reproduction:**
1. Launch app, navigate to Search tab (ranking)
2. Tap on FollowButton area for rank 1 (OvenFresh - 팔로잉)
3. **Expected:** FollowButton state toggles (팔로잉 -> 팔로우)
4. **Actual:** Navigates to seller group-buy page

Same behavior for rank 2 (MellowMom - 팔로우):
1. Tap on FollowButton area
2. **Expected:** FollowButton toggles to 팔로잉
3. **Actual:** Navigates to seller group-buy page

**Root Cause:** SellerRankingRow wraps everything in a parent Pressable with `onPress={() => onPress(item)}`. FollowButton is a nested Pressable inside. React Native gesture responder does not properly isolate nested Pressables. FollowButton's `event.stopPropagation()` does not prevent the parent Pressable from capturing the tap.

**Impact:** Users cannot follow/unfollow sellers from the ranking list. All FollowButton taps navigate away.

**Why unit tests pass:** rankingComponents.test.tsx uses react-test-renderer with mocked Pressable, directly calling `pressable.props.onPress()`. This bypasses the native gesture system entirely.

**Fix options:**
1. Move FollowButton outside the parent Pressable
2. Use `delayPressIn` on parent Pressable to let FollowButton capture first
3. Replace nested Pressable with `hitSlop` approach on a higher-level element

## Files Changed (from parent task t_4b147cf3)
- `apps/mobile/src/components/ranking/FollowButton.tsx` - onFollow prop added
- `apps/mobile/src/components/ranking/SellerRankingRow.tsx` - ranking row component
- `apps/mobile/src/screens/StoreScreen.tsx` - followedIds state management
- `apps/mobile/src/components/ranking/rankingComponents.test.tsx` - 4 tests

## Evidence Files
- `apps/mobile/evidence/01-ranking-tab.png`
- `apps/mobile/evidence/04-safearea-bottom.png`
- `apps/mobile/evidence/07-before-follow.png`
- `apps/mobile/evidence/08-after-follow.png`
- `apps/mobile/evidence/11-before-first-follow-tap.png`
- `apps/mobile/evidence/12-after-first-follow-tap.png`

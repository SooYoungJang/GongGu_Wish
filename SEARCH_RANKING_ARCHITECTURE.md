# Search Tab Ranking Architecture — DS v2 Tokens, Types, and Component Handoff

> Task: `[SWA] 공구앱 검색탭 랭킹 토큰/구조 핸드오프`  
> Scope: Mobile Search tab seller/공구 ranking screen foundation. This is an architecture handoff for DevLead; primary/accent colors are preserved and all proposed visual changes are additive.

## 1. References used

- `/Users/pc/wiki/projects/gonggu-wish/gonggu-wish.md`
- `/Users/pc/wiki/projects/gonggu-wish/concepts/design-system-v2.md`
- `/Users/pc/wiki/projects/gonggu-wish/concepts/product-direction.md`
- `/Users/pc/Documents/RN_GongGu_Wish/apps/mobile/src/design/tokens.ts`
- `/Users/pc/Documents/RN_GongGu_Wish/apps/mobile/src/screens/HomeScreen.tsx`
- `/Users/pc/Documents/RN_GongGu_Wish/apps/mobile/src/App.tsx`
- `/Users/pc/Documents/RN_GongGu_Wish/apps/mobile/src/types.ts`
- `/Users/pc/Documents/RN_GongGu_Wish/packages/shared/src/tokens/colors.ts`
- `/Users/pc/Documents/RN_GongGu_Wish/HOME_REDESIGN_ARCHITECTURE.md`

Key constraints from wiki and existing code:

1. Product is a 공동구매 calendar/alert app, not a generic SNS clone. Ranking can borrow Zigzag/Instagram-like visual language, but ranking must help users discover trusted sellers and time-sensitive deals.
2. DS v2 source of truth is `packages/shared/src/tokens/`; mobile consumes OKLCH through `oklchToHex()` in `apps/mobile/src/design/tokens.ts`.
3. Existing `primary`, `accent`, `cta`, `categoryPastel`, surface/text/border/status semantics must not be changed.
4. Hardcoded hex is disallowed. Any new color must be added as OKLCH token under a separate namespace, then adapted in mobile.
5. Current bottom tab is absolute-positioned, 70px high, with `marginBottom: spacing.lg` and horizontal margin. Screens must explicitly reserve bottom content padding.

## 2. Target information architecture

Reference pattern: Zigzag store ranking screen.

Target Search tab hierarchy:

```txt
Search tab / StoreScreen
  ├─ SafeAreaView(top, bottom)
  ├─ Header
  │   ├─ title: 쇼핑몰 랭킹 / 공구 랭킹
  │   └─ optional search input entry
  ├─ RankingTabs
  │   ├─ top tabs: Ranking | Following
  │   └─ sticky or near-top, not nested in bottom tabs
  ├─ RankingCategoryChips
  │   ├─ 전체
  │   ├─ 뷰티
  │   ├─ 패션
  │   ├─ 푸드
  │   ├─ 라이프
  │   ├─ 육아
  │   └─ 디지털
  ├─ RankingPeriod/Filter row (optional v1.1)
  │   ├─ 오늘
  │   ├─ 이번 주
  │   └─ 상승순 / 인기순
  └─ SellerRankingList
      └─ SellerRankingRow[]
          ├─ rank cell
          ├─ seller avatar / brand mark
          ├─ seller identity + metadata
          ├─ movement badge
          ├─ ThumbnailStrip of active deals
          └─ follow / alert action
```

The existing `SearchScreen` placeholder in `apps/mobile/src/App.tsx` should be replaced by `StoreScreen` or a feature-local screen component while keeping the tab route name `Search` stable for navigation compatibility.

Recommended naming:

- Route label shown to user: `Search`
- Screen component: `StoreScreen`
- File: `apps/mobile/src/screens/StoreScreen.tsx`
- Feature components: `apps/mobile/src/components/ranking/*`

## 3. Token extension contract

### 3.1 Shared tokens — proposed additive namespace

File: `packages/shared/src/tokens/colors.ts`

Add a separate `ranking` namespace. Do not modify `primary`, `accent`, `cta`, `categoryPastel`, or `status`.

```ts
export const ranking = {
  rank: {
    top1Bg: 'oklch(0.96 0.055 88)',
    top1Text: 'oklch(0.52 0.13 78)',
    top2Bg: 'oklch(0.95 0.012 250)',
    top2Text: 'oklch(0.48 0.015 250)',
    top3Bg: 'oklch(0.95 0.045 55)',
    top3Text: 'oklch(0.50 0.12 55)',
    defaultBg: 'oklch(0.98 0.005 250)',
    defaultText: 'oklch(0.37 0.01 250)',
  },
  ad: {
    bg: 'oklch(0.97 0.025 260)',
    text: 'oklch(0.51 0.16 260)',
    border: 'oklch(0.88 0.06 260)',
  },
  movement: {
    upText: 'oklch(0.58 0.19 142)',
    upBg: 'oklch(0.97 0.03 142)',
    downText: 'oklch(0.55 0.18 25)',
    downBg: 'oklch(0.98 0.018 25)',
    sameText: 'oklch(0.55 0.01 250)',
    sameBg: 'oklch(0.97 0.005 250)',
    newText: 'oklch(0.51 0.22 260)',
    newBg: 'oklch(0.97 0.03 260)',
  },
  following: {
    activeBg: 'oklch(0.97 0.02 355)',
    activeText: 'oklch(0.52 0.19 355)',
    inactiveBg: 'oklch(1 0 0)',
    inactiveText: 'oklch(0.45 0.01 250)',
  },
} as const;
```

Notes:

- `ranking.rank.*` is for rank number capsules only.
- `ranking.ad.*` is for sponsored/advertisement labels, not for full-row backgrounds. Full-row ad tinting should be avoided in v1 to preserve readability.
- `ranking.movement.*` is for rank delta badges.
- `ranking.following.*` is for Follow/Following UI. It intentionally does not reuse `accent` directly, preserving accent semantics.

Also update:

```ts
export const colors = {
  primary,
  accent,
  cta,
  categoryPastel,
  cardOverlayGradient,
  ranking,
  success,
  warning,
  error,
  status,
  neutral,
  surface,
  text,
  border,
  overlay,
} as const;

export type RankingTokens = typeof ranking;
```

File: `packages/shared/src/tokens/index.ts`

```ts
export {
  // existing exports...
  ranking,
  type RankingTokens,
} from './colors';
```

### 3.2 Mobile adapter tokens

File: `apps/mobile/src/design/tokens.ts`

Import `ranking` from shared tokens:

```ts
import {
  // existing imports...
  ranking,
} from '@gonggu/shared/tokens';
```

Add flat RN-friendly color names inside `colors`:

```ts
// Ranking — additive namespace for Search tab rankings
rankingTop1Bg: oklchToHex(ranking.rank.top1Bg),
rankingTop1Text: oklchToHex(ranking.rank.top1Text),
rankingTop2Bg: oklchToHex(ranking.rank.top2Bg),
rankingTop2Text: oklchToHex(ranking.rank.top2Text),
rankingTop3Bg: oklchToHex(ranking.rank.top3Bg),
rankingTop3Text: oklchToHex(ranking.rank.top3Text),
rankingDefaultBg: oklchToHex(ranking.rank.defaultBg),
rankingDefaultText: oklchToHex(ranking.rank.defaultText),

rankingAdBg: oklchToHex(ranking.ad.bg),
rankingAdText: oklchToHex(ranking.ad.text),
rankingAdBorder: oklchToHex(ranking.ad.border),

rankingMovementUpText: oklchToHex(ranking.movement.upText),
rankingMovementUpBg: oklchToHex(ranking.movement.upBg),
rankingMovementDownText: oklchToHex(ranking.movement.downText),
rankingMovementDownBg: oklchToHex(ranking.movement.downBg),
rankingMovementSameText: oklchToHex(ranking.movement.sameText),
rankingMovementSameBg: oklchToHex(ranking.movement.sameBg),
rankingMovementNewText: oklchToHex(ranking.movement.newText),
rankingMovementNewBg: oklchToHex(ranking.movement.newBg),

rankingFollowingActiveBg: oklchToHex(ranking.following.activeBg),
rankingFollowingActiveText: oklchToHex(ranking.following.activeText),
rankingFollowingInactiveBg: oklchToHex(ranking.following.inactiveBg),
rankingFollowingInactiveText: oklchToHex(ranking.following.inactiveText),
```

Add grouped helpers below `categoryColors`:

```ts
export const rankingColors = {
  rank: {
    top1: { bg: colors.rankingTop1Bg, text: colors.rankingTop1Text },
    top2: { bg: colors.rankingTop2Bg, text: colors.rankingTop2Text },
    top3: { bg: colors.rankingTop3Bg, text: colors.rankingTop3Text },
    default: { bg: colors.rankingDefaultBg, text: colors.rankingDefaultText },
  },
  ad: {
    bg: colors.rankingAdBg,
    text: colors.rankingAdText,
    border: colors.rankingAdBorder,
  },
  movement: {
    up: { bg: colors.rankingMovementUpBg, text: colors.rankingMovementUpText },
    down: { bg: colors.rankingMovementDownBg, text: colors.rankingMovementDownText },
    same: { bg: colors.rankingMovementSameBg, text: colors.rankingMovementSameText },
    new: { bg: colors.rankingMovementNewBg, text: colors.rankingMovementNewText },
  },
  following: {
    active: { bg: colors.rankingFollowingActiveBg, text: colors.rankingFollowingActiveText },
    inactive: { bg: colors.rankingFollowingInactiveBg, text: colors.rankingFollowingInactiveText },
  },
} as const;

export type RankingMovementColorName = keyof typeof rankingColors.movement;
```

### 3.3 Token use rules

1. Existing `colors.primary`, `colors.accent`, `colors.ctaPurple`, category tokens remain unchanged.
2. Ranking movement badges must use `rankingColors.movement`, not generic `success/error`, because rank movement is product-specific rather than system feedback.
3. Ad badge must use `rankingColors.ad`, not `warning` or `accent`, because ad disclosure is a separate compliance/labeling concept.
4. Row background remains `colors.surface`; row border remains `colors.border`. Only labels and rank capsules receive ranking color treatment.
5. No hardcoded `#...` colors in ranking screen/components/tests.

## 4. Type contracts

Recommended location options:

- Short-term mobile-only: `apps/mobile/src/types.ts`
- Better feature-local organization: `apps/mobile/src/features/ranking/types.ts`
- Future shared API contract: `packages/shared/src/ranking/types.ts` after backend API stabilizes

For DevLead v1 implementation, use feature-local types and re-export if needed.

```ts
export type RankingTab = 'ranking' | 'following';

export type RankingCategory =
  | 'all'
  | 'beauty'
  | 'fashion'
  | 'food'
  | 'lifestyle'
  | 'baby'
  | 'digital';

export type RankingPeriod = 'today' | 'weekly' | 'monthly';

export type RankingSort = 'popular' | 'rising' | 'deadlineSoon' | 'newDeal';

export type RankingTrend =
  | { kind: 'up'; delta: number }
  | { kind: 'down'; delta: number }
  | { kind: 'same' }
  | { kind: 'new' };

export type RankingThumbnail = {
  id: string;
  imageUrl: string | null;
  label?: string | null;
  groupBuyId?: string | null;
};

export type SellerRanking = {
  id: string;
  sellerId: string;
  rank: number;
  previousRank: number | null;
  trend: RankingTrend;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  category: Exclude<RankingCategory, 'all'>;
  followerCount?: number | null;
  activeDealCount: number;
  endingSoonCount?: number | null;
  trustScore?: number | null;
  isFollowing: boolean;
  isSponsored: boolean;
  thumbnails: RankingThumbnail[];
  representativeGroupBuyId?: string | null;
};

export type SellerRankingQuery = {
  tab: RankingTab;
  category: RankingCategory;
  period: RankingPeriod;
  sort: RankingSort;
};
```

### 4.1 Field semantics

- `rank`: 1-based current rank shown in the row.
- `previousRank`: nullable. If null and seller is newly ranked, use `trend.kind='new'`.
- `trend`: calculated by API where possible. UI may derive a fallback from `rank` and `previousRank`, but API-provided value wins.
- `category`: maps to `categoryColors` from mobile tokens.
- `trustScore`: optional; do not show as authoritative unless business definition is approved.
- `isSponsored`: controls ad badge. It must not change rank numbering. Sponsored sellers can appear in a dedicated slot only if later product policy requires it.
- `thumbnails`: maximum 3 rendered in row on mobile v1.

### 4.2 Trend derivation helper

If backend provides only `previousRank`, Dev can derive:

```ts
export function getRankingTrend(rank: number, previousRank: number | null): RankingTrend {
  if (previousRank == null) return { kind: 'new' };
  if (previousRank > rank) return { kind: 'up', delta: previousRank - rank };
  if (previousRank < rank) return { kind: 'down', delta: rank - previousRank };
  return { kind: 'same' };
}
```

## 5. Component structure

Recommended files:

```txt
apps/mobile/src/screens/
  StoreScreen.tsx

apps/mobile/src/components/ranking/
  RankingTabs.tsx
  RankingCategoryChips.tsx
  SellerRankingList.tsx
  SellerRankingRow.tsx
  RankBadge.tsx
  RankingTrendBadge.tsx
  AdBadge.tsx
  ThumbnailStrip.tsx
  FollowButton.tsx
  index.ts

apps/mobile/src/features/ranking/
  types.ts
  rankingState.ts
  rankingFixtures.ts        # optional fallback/sample data
  useSellerRankings.ts      # optional API hook wrapper
```

### 5.1 Layer responsibilities

1. `StoreScreen`
   - Owns tab/category/period/sort state.
   - Owns React Query hook or fallback fixture selection.
   - Owns navigation to seller detail or group-buy detail.
   - Owns screen-level Safe Area and FlatList padding.

2. `RankingTabs`
   - Pure controlled segmented control.
   - Props: active tab, counts optional, onChange.
   - Does not know data fetching.

3. `RankingCategoryChips`
   - Horizontal chip row.
   - Consumes `categoryColors` for category chips.
   - Uses `colors.primary` only for selected focus/label, preserving existing brand behavior.

4. `SellerRankingList`
   - Renders `FlatList<SellerRanking>`.
   - Provides keyExtractor and item separators.
   - Receives bottom content padding from `StoreScreen` or constant.

5. `SellerRankingRow`
   - Stable mobile row layout, optimized for 320/375/414 widths.
   - Composes `RankBadge`, seller identity, `RankingTrendBadge`, `AdBadge`, `ThumbnailStrip`, `FollowButton`.
   - Does not fetch images/data.

6. `ThumbnailStrip`
   - Renders 0–3 square thumbnails with tokenized placeholder background.
   - On 320px width: thumbnails can reduce to 2 visible + `+N` overlay if necessary.

### 5.2 Component interfaces

```ts
export interface RankingTabsProps {
  value: RankingTab;
  rankingCount?: number;
  followingCount?: number;
  onChange: (next: RankingTab) => void;
}

export interface RankingCategoryChipsProps {
  value: RankingCategory;
  categories: readonly RankingCategory[];
  onChange: (next: RankingCategory) => void;
}

export interface SellerRankingRowProps {
  item: SellerRanking;
  onPress: (item: SellerRanking) => void;
  onPressThumbnail?: (thumbnail: RankingThumbnail, item: SellerRanking) => void;
  onToggleFollow: (item: SellerRanking) => void;
}

export interface RankBadgeProps {
  rank: number;
}

export interface RankingTrendBadgeProps {
  trend: RankingTrend;
}

export interface ThumbnailStripProps {
  thumbnails: readonly RankingThumbnail[];
  maxVisible?: 2 | 3;
  size?: number;
  onPressThumbnail?: (thumbnail: RankingThumbnail) => void;
}
```

### 5.3 Text/copy contract

- Header title: `쇼핑몰 랭킹` or `공구 랭킹`
- Top tabs:
  - `랭킹`
  - `팔로잉`
- Category chips:
  - `전체`, `뷰티`, `패션`, `푸드`, `라이프`, `육아`, `디지털`
- Empty states:
  - Ranking empty: `아직 집계된 랭킹이 없어요`
  - Following empty: `팔로우한 셀러가 없어요`
  - Action: `인기 셀러 둘러보기`
- Ad label: `AD`
- Movement labels:
  - up: `▲ {delta}` or accessible text `순위 {delta}단계 상승`
  - down: `▼ {delta}` or accessible text `순위 {delta}단계 하락`
  - same: `-`
  - new: `NEW`

Accessibility labels must be explicit:

```ts
`${item.rank}위 ${item.displayName}, 진행 중인 공구 ${item.activeDealCount}개`
```

For movement badge:

```ts
trend.kind === 'up' ? `순위 ${trend.delta}단계 상승` : ...
```

## 6. Row layout specification for 320/375/414 widths

### 6.1 Target layout

```txt
┌──────────────────────────────────────────────┐
│ [01]  (avatar)  Seller name       [Follow]   │
│       @username · 공구 12개   [▲ 3] [AD]     │
│       [thumb] [thumb] [thumb]                │
└──────────────────────────────────────────────┘
```

### 6.2 Width constraints

Use `flexShrink` and fixed-size visual atoms so the row remains stable.

Recommended measurements:

```ts
const RANK_CELL_WIDTH = 34;
const AVATAR_SIZE = 42;
const THUMB_SIZE = 42;
const ROW_HORIZONTAL_PADDING = spacing.md; // 12
const ROW_VERTICAL_PADDING = spacing.md;   // 12
const FOLLOW_BUTTON_MIN_WIDTH = 62;
```

At 320px viewport with screen horizontal padding `spacing.lg * 2 = 32`, row inner width is about 288px. Layout must fit by:

1. Rank cell fixed at 34.
2. Avatar fixed at 42.
3. Follow button fixed/min 62.
4. Main text column `flex: 1`, `minWidth: 0`.
5. Seller display name uses `numberOfLines={1}`.
6. Username/meta uses `numberOfLines={1}`.
7. Thumbnail strip is below main identity line and can render max 2 thumbnails on narrow widths if necessary.

Recommended responsive rule:

```ts
const maxVisibleThumbnails = screenWidth <= 340 ? 2 : 3;
```

### 6.3 Style rules

- Row background: `colors.surface`
- Row border: `colors.border`
- Row radius: `borderRadius.xl`
- Row shadow: `shadows.sm` only. Avoid heavy shadow stacks in long lists.
- Row minimum tap target: `minHeight >= 88`
- Follow button min height: `36` or larger; preferred `40`.
- Interactive thumbnails must be at least `40x40`.

## 7. Safe Area and bottom tab conflict prevention

Existing bottom tab from `apps/mobile/src/App.tsx`:

```ts
tabBar: {
  height: 70,
  marginBottom: spacing.lg,
  marginHorizontal: spacing.lg,
  position: 'absolute',
}
```

Effective reserved area:

```ts
const FLOATING_TAB_RESERVED_HEIGHT = 70 + spacing.lg; // 86
```

Screen contract for `StoreScreen`:

```tsx
const insets = useSafeAreaInsets();

<SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
  <FlatList
    contentContainerStyle={[
      styles.listContent,
      { paddingBottom: FLOATING_TAB_RESERVED_HEIGHT + insets.bottom + spacing['2xl'] },
    ]}
    scrollIndicatorInsets={{ bottom: FLOATING_TAB_RESERVED_HEIGHT + insets.bottom }}
  />
</SafeAreaView>
```

Rules:

1. Do not add a second bottom tab inside `StoreScreen`.
2. Do not position ranking tabs at bottom; ranking/following tabs are content-level top segmented controls.
3. Any floating filter or CTA must use `bottom: FLOATING_TAB_RESERVED_HEIGHT + insets.bottom + spacing.sm`.
4. For long lists, use `FlatList` not nested `ScrollView + map` to avoid content getting hidden behind the absolute tab bar.
5. Use `SafeAreaView edges={['top', 'bottom']}` and still add explicit FlatList bottom padding because the bottom tab is absolute and outside normal layout flow.

## 8. Data flow and state model

```txt
StoreScreen
  ├─ state: activeTab, selectedCategory, period, sort
  ├─ query: useSellerRankings({ tab, category, period, sort })
  ├─ fallback policy: optional fixtures only for dev/offline, show compact notice
  └─ FlatList header:
      ├─ StoreHeader
      ├─ RankingTabs
      └─ RankingCategoryChips
```

Recommended state contract:

```ts
type RankingLoadState =
  | { status: 'loading'; data?: SellerRanking[] }
  | { status: 'error'; data?: SellerRanking[]; message: string; retry?: () => void }
  | { status: 'empty'; message: string; action?: { label: string; onPress: () => void } }
  | { status: 'ready'; data: SellerRanking[]; refreshing?: boolean };
```

Filtering rules:

1. `tab='following'` filters to followed sellers only.
2. `category='all'` includes all categories.
3. Category filtering should not mutate rank numbers unless backend returns category-specific rank. In v1, prefer backend-provided category rank if available; otherwise label screen as filtered list rather than official rank.
4. Sponsored rows must still be labeled `AD`; avoid silent promotion.

## 9. Navigation contract

Current `MainTabParamList` has:

```ts
Search: undefined;
```

No route type change is required to replace the placeholder with `StoreScreen`.

Future optional stack routes:

```ts
SellerDetail: { sellerId: string; sellerName?: string };
RankingGroupBuyDetail: { groupBuyId: string };
```

For v1 without new routes:

- Row press can navigate to `InfluencerGroupBuys` when `username` is available.
- Thumbnail press can navigate to `Detail` only if a full `GroupBuy` object is available; otherwise wait for a `GroupBuyDetailById` route/API.

Do not fabricate `GroupBuy` objects just for navigation. If only `groupBuyId` exists, add a proper detail-by-id route later.

## 10. API/backend alignment recommendation

Suggested endpoint shape for later API work:

```http
GET /rankings/sellers?tab=ranking&category=beauty&period=weekly&sort=popular
```

Response:

```ts
type SellerRankingResponse = {
  items: SellerRanking[];
  generatedAt: string;
  period: RankingPeriod;
  category: RankingCategory;
};
```

Ranking calculation should be server-owned once real metrics exist. Mobile may use fixtures for UI implementation only.

## 11. Native verification criteria

Expo Web alone is not sufficient for approval.

Required gates:

1. TypeScript:
   - `cd /Users/pc/Documents/RN_GongGu_Wish`
   - `npx turbo run typecheck --filter=@gonggu/mobile`
   - `npx turbo run test --filter=@gonggu/shared`
2. Hardcoded color scan:
   - Search new ranking files for `#[0-9a-fA-F]{3,8}` and reject unless the match comes from existing token conversion utilities or tests that explicitly validate conversion.
3. Layout QA on native or simulator/device:
   - iOS Simulator or Expo Go: 320/375/414-equivalent widths.
   - Android emulator or Expo Go if available.
   - Check bottom row is not hidden behind tab bar after scrolling to end.
   - Check `RankingTabs` does not conflict with bottom tab navigation.
4. Expo Web can be used as smoke test only:
   - It may catch TypeScript/runtime errors.
   - It cannot approve native safe area, physical bottom inset, iOS/Android touch target behavior, or RN text truncation.

Native approval minimum:

```txt
APPROVE only if at least one iOS Simulator/Expo Go native pass confirms:
- last ranking row fully visible above bottom tab
- 320/375/414 row text truncates predictably
- Follow button remains tappable
- no horizontal overflow
- no hardcoded hex in new ranking code
```

## 12. Recommended DevLead implementation sequence

1. Add shared `ranking` tokens and mobile `rankingColors` adapter.
2. Add `apps/mobile/src/features/ranking/types.ts` and fixture data.
3. Add ranking atoms: `RankBadge`, `RankingTrendBadge`, `AdBadge`, `FollowButton`.
4. Add `ThumbnailStrip` with 2/3-thumbnail responsive cap.
5. Add `SellerRankingRow` and Story/test fixture if current test stack supports it.
6. Add `StoreScreen` and replace `SearchScreen` placeholder in `App.tsx` while preserving route name `Search`.
7. Run typecheck/tests and hardcoded color scan.
8. Perform native layout QA; do not sign off on Expo Web alone.

## 13. Acceptance criteria mapping

- Existing primary/accent unchanged: all additions are under `ranking`; no edits to `primary`/`accent` values.
- ranking/ad/movement tokens are separate namespaces: `ranking.rank`, `ranking.ad`, `ranking.movement`, `ranking.following`.
- 320/375/414 row stability: fixed rank/avatar/follow sizes, text `minWidth: 0`, `numberOfLines`, thumbnail cap rule.
- Expo Web-only native approval forbidden: explicit native QA gate documented.
- Component structure documented: `StoreScreen`, `RankingTabs`, `SellerRankingRow`, `ThumbnailStrip` and supporting atoms specified.
- Types documented: `SellerRanking`, `RankingCategory`, `RankingTrend`, `RankingTab`, `RankingPeriod`, `RankingSort`, `RankingThumbnail`.

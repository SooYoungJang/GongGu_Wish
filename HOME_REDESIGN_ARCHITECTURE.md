# Home Redesign Architecture — Tokens, Components, and States

> Task: `[SWA] 공구앱 홈 리디자인 토큰/컴포넌트 구조 설계`  
> Scope: Mobile Home redesign foundations only. Existing `primary`, `accent`, `spacing`, and `radii` tokens are preserved; this document and token changes are additive.

## 1. References used

- `/Users/pc/wiki/projects/gonggu-calendar/gonggu-calendar.md`
- `/Users/pc/wiki/projects/gonggu-calendar/concepts/design-system-v2.md`
- `/Users/pc/wiki/projects/gonggu-calendar/concepts/product-direction.md`
- `/Users/pc/Documents/RN_GongGu_Calendar/DESIGN_GUIDE.md`

Key product constraint: GongGu Calendar is not a social feed clone. The Home screen may borrow Instagram/Threads visual language, but its information architecture must prioritize approved 공동구매 schedules, deadlines, purchase links, trusted submission/approval status, and alerts.

## 2. Token extension contract

### 2.1 Shared source of truth

File: `packages/shared/src/tokens/colors.ts`

New additive exports:

```ts
export const cta = {
  purple: 'oklch(0.58 0.24 300)',
  purpleHover: 'oklch(0.52 0.25 300)',
  purpleText: 'oklch(1 0 0)',
  purpleBg: 'oklch(0.97 0.035 300)',
} as const;

export const categoryPastel = {
  beauty: { bg, text, border },
  fashion: { bg, text, border },
  food: { bg, text, border },
  lifestyle: { bg, text, border },
  baby: { bg, text, border },
  digital: { bg, text, border },
} as const;

export const cardOverlayGradient = {
  top: 'oklch(0 0 0 / 0)',
  middle: 'oklch(0 0 0 / 0.18)',
  bottom: 'oklch(0 0 0 / 0.62)',
} as const;
```

Also exported via:

- `colors.cta`
- `colors.categoryPastel`
- `colors.cardOverlayGradient`
- root token entrypoint `packages/shared/src/tokens/index.ts`

Type names exposed:

- `CtaTokens`
- `CategoryPastelName`
- `CategoryPastelTokens`
- `CardOverlayGradientTokens`

### 2.2 Mobile token adapter

File: `apps/mobile/src/design/tokens.ts`

Flat RN-friendly color names added for direct component use:

```ts
colors.ctaPurple
colors.ctaPurpleHover
colors.ctaPurpleText
colors.ctaPurpleBg

colors.categoryBeautyBg
colors.categoryBeautyText
colors.categoryBeautyBorder
// same triplet for fashion, food, lifestyle, baby, digital

colors.cardOverlayTop
colors.cardOverlayMiddle
colors.cardOverlayBottom
```

Grouped helpers added for safer domain mapping:

```ts
categoryColors.beauty.bg
categoryColors.beauty.text
categoryColors.beauty.border

export type CategoryColorName = keyof typeof categoryColors;

cardOverlayGradientStops // readonly 3-stop array for LinearGradient
```

Recommended use in mobile components:

```ts
import { categoryColors, cardOverlayGradientStops, colors } from '../design/tokens';

const category = categoryColors.beauty;
const ctaStyle = { backgroundColor: colors.ctaPurple };
```

## 3. Home component hierarchy

Target path root: `apps/mobile/src/components/home/`

The current mobile component directory is flat. For the Home redesign, introduce feature-local component layers under `components/home/` while keeping generic primitives reusable under `components/primitives/`.

```txt
apps/mobile/src/components/
  primitives/
    Button/
      Button.tsx              # wraps Pressable; maps AppButton variants over time
      Button.types.ts
      index.ts
    Card/
      SurfaceCard.tsx          # generic tokenized card shell
      MediaCard.tsx            # image + overlay gradient primitive
      index.ts
    Feedback/
      LoadingBlock.tsx
      EmptyState.tsx
      ErrorState.tsx
      SkeletonLine.tsx
      index.ts
    Chip/
      CategoryChip.tsx         # consumes categoryColors
      StatusChip.tsx
      index.ts

  domain/
    group-buy/
      GroupBuyCard.tsx         # product title, brand, deadline, discount, status
      GroupBuyDeadlineBadge.tsx
      GroupBuyMetaRow.tsx
      GroupBuyCta.tsx
      index.ts
    influencer/
      InfluencerRailCard.tsx
      InfluencerSearchResult.tsx
      index.ts
    submission/
      SubmitPromptCard.tsx     # ctaPurple high-emphasis action
      index.ts

  home/
    sections/
      HeroCtaSection.tsx
      SearchSection.tsx
      FeaturedGroupBuysSection.tsx
      DeadlineSoonSection.tsx
      CategoryRailSection.tsx
      InfluencerDiscoverySection.tsx
      SubmitPromptSection.tsx
      index.ts
    HomeSectionFrame.tsx        # title/subtitle/action slot + state boundary
    HomeScreenContent.tsx       # composes section order; HomeScreen owns query/nav
    homeState.ts                # data-to-section state selectors
    index.ts
```

### 3.1 Layer rules

1. `primitives` know tokens and interaction states, but do not know the GongGu domain.
2. `domain` components know `GroupBuy`, `Influencer`, and submission concepts, but do not own query state.
3. `home/sections` own layout and empty/loading/error rendering for a section, but receive already-selected props.
4. `HomeScreen.tsx` remains the container for React Query, navigation, refresh control, and screen-level fallback policy.

### 3.2 Data flow

```txt
HomeScreen
  ├─ useQuery(group-buys), useQuery(influencers)
  ├─ homeState.ts selectors
  │   ├─ selectFeaturedGroupBuys
  │   ├─ selectDeadlineSoonGroupBuys
  │   ├─ selectCategorySummaries
  │   └─ selectInfluencerDiscoveryItems
  └─ HomeScreenContent
      ├─ HeroCtaSection
      ├─ SearchSection
      ├─ DeadlineSoonSection
      ├─ FeaturedGroupBuysSection
      ├─ CategoryRailSection
      ├─ InfluencerDiscoverySection
      └─ SubmitPromptSection
```

## 4. Home section states

Use a consistent section state contract:

```ts
type SectionLoadState<T> =
  | { status: 'loading'; data?: T }
  | { status: 'error'; data?: T; message: string; retry?: () => void }
  | { status: 'empty'; message: string; action?: { label: string; onPress: () => void } }
  | { status: 'ready'; data: T; refreshing?: boolean };
```

### 4.1 Screen-level policy

Screen-level loading/error should not blank the entire Home if useful fallback data exists.

- Initial loading with no cached/fallback data: show section skeletons.
- API error with fallback sample data: show a compact notice and render fallback content.
- API error with no fallback data: render `ErrorState` in affected sections and keep global search/submit CTA available.
- Pull-to-refresh: use `RefreshControl` plus per-section `refreshing` visual only where necessary.

### 4.2 Section-by-section states

#### HeroCtaSection

Purpose: orient user and expose primary actions.

- Loading: no blocking state; render title/subtitle immediately.
- Error: no error state; API failure belongs to content sections.
- Empty: render normal hero plus `공구 제보하기` CTA.
- Ready: render `공구 제보하기` as cta purple, secondary admin/debug action only in dev/admin contexts.

Token usage:

- CTA background: `colors.ctaPurple`
- CTA pressed/hover equivalent: `colors.ctaPurpleHover`
- CTA text: `colors.ctaPurpleText`
- CTA light card background: `colors.ctaPurpleBg`

#### SearchSection

Purpose: influencer/product search entry.

- Loading: search input remains enabled; results panel shows `SkeletonLine` only after user enters text.
- Error: results panel shows `ErrorState` with retry if influencer API failed.
- Empty: `검색 결과가 없어요` with hint `인스타그램 username 또는 브랜드명을 다시 확인해 주세요.`
- Ready: list `InfluencerSearchResult` rows; selecting clears query and navigates.

#### DeadlineSoonSection

Purpose: time-sensitive 공동구매 reminders.

- Loading: 2 compact skeleton cards.
- Error: `마감 임박 공구를 불러오지 못했어요` + retry.
- Empty: `마감 임박 공구가 없어요` + secondary CTA `전체 공구 보기` if there are other approved items.
- Ready: horizontal rail or top 3 vertical cards sorted by end date.

Required fields:

- `endDate` or equivalent deadline field
- `brand/productName`
- status must represent approved/public data only

#### FeaturedGroupBuysSection

Purpose: primary feed of approved 공동구매.

- Loading: media-card skeletons.
- Error with fallback: show section notice `샘플 데이터를 표시 중입니다`.
- Error without fallback: `ErrorState` + retry.
- Empty: `아직 승인된 공동구매가 없어요` + action `첫 공구 제보하기`.
- Ready: `GroupBuyCard` list.

Token usage:

- Media/image overlay: `cardOverlayGradientStops`
- Category chip: `categoryColors[categoryName]`
- Card shell: existing `colors.surface`, `colors.border`, `shadows.md`

#### CategoryRailSection

Purpose: let users browse by product domain.

- Loading: 6 chip skeletons.
- Error: hidden if categories are locally derived; show only if remote category API is introduced.
- Empty: hidden if no approved data exists.
- Ready: six stable chips using `beauty`, `fashion`, `food`, `lifestyle`, `baby`, `digital`.

Mapping fallback if backend category names differ:

```ts
const categoryTokenMap: Record<string, CategoryColorName> = {
  beauty: 'beauty',
  cosmetics: 'beauty',
  fashion: 'fashion',
  food: 'food',
  lifestyle: 'lifestyle',
  baby: 'baby',
  kids: 'baby',
  digital: 'digital',
};
```

#### InfluencerDiscoverySection

Purpose: discovery entry for trusted influencers.

- Loading: 3 influencer card skeletons.
- Error: compact error state; does not block group-buy feed.
- Empty: hidden or `팔로우할 인플루언서가 아직 없어요` if a follow system exists.
- Ready: horizontal influencer cards or top 5 vertical rows.

#### SubmitPromptSection

Purpose: reinforce user-generated collection loop.

- Loading: no loading state.
- Error: no error state.
- Empty: normal prompt.
- Ready: normal prompt.

CTA copy:

- Primary: `놓치기 아까운 공구를 제보해 주세요`
- Button: `공구 제보하기`

## 5. Interface contracts for Dev implementation

### 5.1 Primitive state components

```ts
interface FeedbackStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  tone?: 'neutral' | 'warning' | 'error' | 'success';
}
```

Implement:

- `LoadingBlock` accepts `variant: 'line' | 'card' | 'mediaCard' | 'chip'` and `count?: number`.
- `EmptyState` uses neutral or CTA-purple accent depending on action presence.
- `ErrorState` uses `colors.error`, `colors.errorBg`, and retry action.

### 5.2 HomeSectionFrame

```ts
interface HomeSectionFrameProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
}
```

Rules:

- Eyebrow stacked above heading; never two-column.
- `action` is text/button in the same header row on wide layouts, below heading on narrow mobile if wrapping risk exists.
- Must accept zero children only when a state component is rendered.

### 5.3 GroupBuyCard

```ts
interface GroupBuyCardProps {
  groupBuy: GroupBuy;
  category?: CategoryColorName;
  variant?: 'compact' | 'media' | 'deadline';
  onPress: () => void;
}
```

Rules:

- `variant='media'` may use card overlay gradient over image.
- `variant='deadline'` emphasizes deadline badge and purchase timing.
- Do not render non-approved/rejected/pending data unless screen is explicitly admin/debug.

## 6. Type/build risks

1. `oklchToCssRgba()` parses OKLCH alpha via `parseOklch()`. The current parser expects the alpha number at `parts[4]`; strings like `oklch(0 0 0 / 0.62)` split into `['0','0','0','/','0.62']`, which works. Do not change slash formatting without tests.
2. React Native gradient rendering requires a dependency such as `expo-linear-gradient` or an already-installed alternative. `cardOverlayGradientStops` only provides colors; Dev must verify dependency before implementing `MediaCard`.
3. `CategoryColorName` is mobile-local. If shared component types need category names, prefer importing `CategoryPastelName` from `@gonggu/shared/tokens` to avoid drift.
4. Existing files have unrelated pending changes. Dev should avoid broad format runs that touch unrelated work.
5. NativeWind dynamic classes like `bg-[${colors.primary}]` already exist in `tw`; new CTA styles are safer as StyleSheet objects unless NativeWind config is updated.

## 7. Verification commands

Run from project root:

```bash
cd /Users/pc/Documents/RN_GongGu_Calendar
npm run build:shared
npm run typecheck -- --filter=@gonggu/mobile
npm test -- --filter=@gonggu/shared
```

If Turbo filtering through npm script does not pass arguments as expected, use direct commands:

```bash
npx turbo run build --filter=@gonggu/shared
npx turbo run typecheck --filter=@gonggu/mobile
npx turbo run test --filter=@gonggu/shared
```

## 8. Recommended implementation sequence for DevLead

1. Keep this token patch as the foundation.
2. Add `apps/mobile/src/components/primitives/Feedback/*` first; reuse in current `HomeScreen.tsx` before large layout changes.
3. Add `components/home/HomeSectionFrame.tsx` and `homeState.ts` selectors.
4. Extract current Home logic into `HomeScreenContent.tsx` with current visual behavior unchanged.
5. Introduce redesigned sections one by one: HeroCta → Search → FeaturedGroupBuys → DeadlineSoon → CategoryRail → SubmitPrompt.
6. Only after section extraction, add `MediaCard` with gradient overlay and optional `expo-linear-gradient` integration.

# DESIGN_GUIDE.md — GongGu Wish Design System v2

> **Version:** 2.0.0  
> **Status:** Active  
> **Author:** Designer (Design System v2)  
> **Last updated:** 2026-06-20  

This guide formalises the GongGu Wish design language as a **single source of truth** for both platforms (web + mobile). It codifies the asymmetric platform archetypes, token vocabulary, component contract, accessibility baseline, dark-mode architecture, and tone guardrails that every contributor — designer, developer, PM — must read before building UI.

---

## 1. Design Philosophy

### Identity: Editorial + Social

GongGu Wish is not a pure content platform and not a pure admin tool. It lives at the intersection of **social feed consumption** (Instagram / Threads) and **editorial clarity** (Medium / Notion), with a **financial tool's density** (Toss 증권) for operator screens.

| Influence | What we take | Where it applies |
|-----------|-------------|------------------|
| Instagram / Threads | Card-native feed, bottom sheets, story-style media, generous whitespace, photo-first layout | Mobile public app (submit + browse) |
| Medium / Notion | Typographic hierarchy, clean editorial layouts, restrained colour, focus on content | Web public pages, mobile form screens |
| Toss 증권 / Linear | Dense data tables, keyboard shortcuts, side panels, compact controls, toast system | Web admin (dashboard + submissions) |
| Apple HIG | Bottom tabs, haptic-friendly touch targets, gesture conventions | Mobile navigation + interaction |

### Core principle: Asymmetry by design

The mobile consumer app and the web admin operator tool serve **different jobs**. We do not force pixel-perfect parity. Instead we enforce:

1. **Same token names** — `--color-primary`, `--space-md`, `--radius-md` mean the same thing on both platforms.
2. **Same component contract** — `ButtonProps`, `InputProps`, `CardProps` share a TypeScript interface across platforms.
3. **Different values where platform-native feel matters** — spacing, radius, and font stacks differ; that is correct and documented.

---

## 2. Platform Archetypes

### 2.1 Mobile App — Consumer Feed Archetype

| Attribute | Value |
|-----------|-------|
| Primary gesture | Scroll + tap |
| Navigation | Bottom tab bar (4–5 tabs) + push navigation |
| Sheet behaviour | BottomSheet for actions, modals for forms |
| Density | Comfortable (4px grid, generous padding) |
| Typography | System font stack (Pretendard for Korean) |
| Key pattern | Card feed → tap for detail → action via bottom sheet |
| Keyboard | Minimal (text input fields only) |
| Orientation | Portrait primary |

**Reference behaviour:** Instagram explore feed → Threads thread → Apple Maps place card.

### 2.2 Web App — Public Content Archetype

| Attribute | Value |
|-----------|-------|
| Primary interaction | Scroll + click |
| Navigation | Top nav bar + content sections |
| Sheet behaviour | Centred modals for detail views |
| Density | Comfortable (8px grid) |
| Typography | Geist Sans + Geist Mono |
| Key pattern | Content page → CTA → modal form |
| Keyboard | Tab navigation for forms |
| Orientation | Responsive (320–1440px) |

**Reference behaviour:** Medium article → Airbnb listing page.

### 2.3 Web Admin — Operator Tool Archetype

| Attribute | Value |
|-----------|-------|
| Primary interaction | Panel navigation + data manipulation |
| Navigation | Fixed sidebar (260px) + top header + content area |
| Sheet behaviour | Right side panel for detail, modal for dialogs |
| Density | Switchable: comfortable (default) / compact |
| Typography | Geist Sans + Geist Mono |
| Key pattern | Table/card list → filter → select → batch action |
| Keyboard | Tab, arrow keys, keyboard shortcuts (j/k, /search, Enter, Escape) |
| Orientation | Landscape primary (min 1024px recommended) |

**Reference behaviour:** Linear issue list → Toss 증권 dashboard → Notion database.

---

## 3. Token Reference

### 3.1 Colour

**Architecture:** Web uses OKLCH via Tailwind v4 `@theme`. Mobile uses hex values in `tokens.ts` — target is to unify to OKLCH in v2.

#### Primary brand (both platforms)

| Token | Web (OKLCH) | Mobile (hex) | Usage |
|-------|-------------|--------------|-------|
| `--color-primary-500` | `oklch(0.62 0.23 252)` → `#3b82f6` | `#4f63d7` | Primary buttons, active links, brand elements |
| `--color-primary-600` | `oklch(0.54 0.25 252)` → `#2563eb` | — | Button hover state |
| `--color-primary-50` | `#eff6ff` | — | Light background (status-review-bg) |

> **v2 goal:** Lock ONE primary blue value for both platforms. Recommended: `oklch(0.58 0.22 260)`.

#### Accent (v2 addition — both platforms)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-accent` | `#e1306c` (Instagram pink, both platforms) | Highlight badges, accent icons, selected states |
| `--color-accent-light` | `oklch(0.92 0.05 360)` | Accent background (hover states, pills) |

Mobile already has this as `#e1306c`. Web is getting it in v2 for cross-platform Instagram-style UI language.

#### Semantic status (shared, same values both platforms)

| Token | Value | BG token | Usage |
|-------|-------|----------|-------|
| `--color-status-pending` | `#f59e0b` | `#fffbeb` | PENDING badge |
| `--color-status-approved` | `#22c55e` | `#f0fdf4` | APPROVED badge |
| `--color-status-rejected` | `#ef4444` | `#fef2f2` | REJECTED badge |
| `--color-status-review` | `#3b82f6` | `#eff6ff` | REVIEW_REQUIRED badge |
| `--color-status-duplicate` | `#9ca3af` | `#f3f4f6` | DUPLICATE badge |

#### Neutral scale (web)

| Token | Value |
|-------|-------|
| `--color-neutral-50` | `#f9fafb` |
| `--color-neutral-100` | `#f3f4f6` |
| `--color-neutral-200` | `#e5e7eb` |
| `--color-neutral-300` | `#d1d5db` |
| `--color-neutral-400` | `#9ca3af` |
| `--color-neutral-500` | `#6b7280` |
| `--color-neutral-600` | `#4b5563` |
| `--color-neutral-700` | `#374151` |
| `--color-neutral-800` | `#1f2937` |
| `--color-neutral-900` | `#111827` |

### 3.2 Typography

#### Web

| Role | Face | Weight | Source |
|------|------|--------|--------|
| Display / Headings | Geist Sans | 600–700 | `next/font` (local) |
| Body | Geist Sans | 400 | `next/font` (local) |
| Code / Mono | Geist Mono | 400–500 | `next/font` (local) |

| Scale token | Size | Line height | Usage |
|-------------|------|-------------|-------|
| `--text-xs` | 0.75rem (12px) | 1.4 | Captions, timestamps, badges |
| `--text-sm` | 0.875rem (14px) | 1.4 | Table cells, meta text |
| `--text-base` | 1rem (16px) | 1.5 | Body copy, form labels, buttons |
| `--text-lg` | 1.125rem (18px) | 1.5 | Lead text, card titles |
| `--text-xl` | 1.25rem (20px) | 1.4 | Section headings |
| `--text-2xl` | 1.5rem (24px) | 1.3 | Page headings |
| `--text-3xl` | 1.875rem (30px) | 1.25 | Hero headings (short) |
| `--text-4xl` | 2.25rem (36px) | 1.2 | Hero headings (display) |

#### Mobile

| Role | Face | Weight |
|------|------|--------|
| Display | Pretendard (Korean) / SF Pro (English) | 700 |
| Body | System (Pretendard + SF Pro) | 400 |
| Mono | JetBrains Mono / D2Coding | 400 |

Mobile uses 4px-based custom scale in `tokens.ts` (10 named styles). Named sizes will be mapped to the shared vocabulary above in v2.

### 3.3 Spacing

#### Web — 8px grid

| Token | Value |
|-------|-------|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |
| `--space-16` | 64px |

#### Mobile — 4px grid

Mobile uses a 4px base grid. Semantic names (`sm`, `md`, `lg`, `xl`) map to different px values:

| Semantic | Web | Mobile |
|----------|-----|--------|
| `--space-xs` | 4px | 4px |
| `--space-sm` | 8px | 8px |
| `--space-md` | 16px | 16px |
| `--space-lg` | 24px | 24px |
| `--space-xl` | 32px | 32px |

The web and mobile `--space-md` both resolve to 16px, but the underlying grid is 8px vs 4px. This asymmetry is correct — mobile needs finer granularity for pixel-perfect alignment on small screens.

### 3.4 Border Radius

| Token | Web | Mobile | Usage |
|-------|-----|--------|-------|
| `--radius-sm` | 4px | 8px | Checkboxes, small badges |
| `--radius-md` | 8px | 10px | Buttons, inputs, cards (default) |
| `--radius-lg` | 12px | 12px | Modals, feature cards |
| `--radius-xl` | 16px | 16px | Hero cards, bottom sheets |
| `--radius-full` | 9999px | 9999px | Avatars, pill badges |

Mobile's larger `--radius-sm` and `--radius-md` reflect the thumb-friendly touch target convention of mobile UIs.

### 3.5 Elevation / Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Cards rested state |
| `--shadow-card` | `0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)` | Default card elevation |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.08)` | Modals, side panels |
| `--shadow-xl` | `0 12px 48px rgba(0,0,0,0.12)` | Toast, floating elements |

Mobile shadows use React Native shadow props mapped to equivalent visual depth.

### 3.6 Animation / Motion

| Token | Value | Usage |
|-------|-------|-------|
| `--dur-fast` | 100ms | Button press, card tap |
| `--dur-normal` | 150ms | Hover transitions, focus ring appear |
| `--dur-slow` | 200ms | Modal enter, accordion expand, page transitions |
| `--dur-toast` | 300ms | Toast slide in |
| `--ease-out` | cubic-bezier(0.4, 0, 0.2, 1) | Enter animations |
| `--ease-in` | cubic-bezier(0.4, 0, 1, 1) | Exit animations |
| `--ease-in-out` | cubic-bezier(0.4, 0, 0.2, 1) | Height/opacity transitions |

| Interaction | Duration | Easing | Animates |
|-------------|----------|--------|----------|
| Card hover | 150ms | `ease-out` | `background-color`, `box-shadow` |
| Button press | 100ms | `ease-out` | `transform: scale(0.98)` |
| Focus ring | 150ms | `ease-out` | `outline-width` |
| Accordion expand | 200ms | `ease-in-out` | `height`, `opacity` |
| Modal enter | 200ms | `ease-out` | `transform: scale(0.95→1)`, `opacity` |
| Modal exit | 150ms | `ease-in` | `transform: scale(1→0.95)`, `opacity` |
| Toast enter | 300ms | `ease-out` | `transform: translateY`, `opacity` |
| Toast exit | 200ms | `ease-in` | `transform: translateY`, `opacity` |
| Page transition | 200ms | `ease-in-out` | `opacity`, `transform: translateX` |

**Motion discipline:**
- Animate only `transform` and `opacity` — never layout properties (width, height, top, left).
- Respect `prefers-reduced-motion: reduce` — collapse all spatial animations to ≤150ms opacity crossfade.
- Mobile: use `react-native-reanimated`; Web: use Tailwind `transition-*` + `@keyframes` or CSS transitions.

---

## 4. Component Catalog

### 4.1 Cross-Platform Inventory

| Component | Web (ui-web) | Mobile (native) | Shared Types | Status |
|-----------|-------------|-----------------|-------------|--------|
| Button | ✅ `Button.tsx` | ✅ `AppButton.tsx` | ⬜ Not yet | Web + mobile done; shared interface P0 |
| Input | ✅ `Input.tsx` | ✅ `FormInput.tsx` | ⬜ Not yet | Web + mobile done; shared interface P0 |
| Card | ✅ `Card.tsx` | ✅ `InstagramCard.tsx` | ⬜ Not yet | Web + mobile done; shared interface P0 |
| Badge / StatusBadge | ✅ `Badge.tsx` | ⬜ Not built | ⬜ Not yet | P1 — implement on mobile |
| Modal / BottomSheet | ✅ `Modal.tsx` | ⬜ Not built | ⬜ Not yet | P1 — BottomSheet for mobile |
| Toast | ✅ `Toast.tsx` | ⬜ Not built | ⬜ Not yet | P1 — `react-native-toast-message` |
| Dropdown | ✅ `Dropdown.tsx` | ⬜ Not built | ⬜ Not yet | P1 — mobile picker or native select |
| FilterChips | ✅ `FilterChips.tsx` | ⬜ Not built | ⬜ Not yet | P1 — mobile implementation |
| Avatar | ✅ `Avatar.tsx` | ⬜ Not built | ⬜ Not yet | P1 |
| Tooltip | ✅ `Tooltip.tsx` | ⬜ N/A (mobile) | ⬜ | Web only — mobile uses hint text |
| DataTable | ✅ `DataTable.tsx` | ⬜ N/A (mobile) | ⬜ | Web admin only |
| DatePicker | ✅ `DatePicker.tsx` | Native (RN) | ⬜ | Platform-native pickers |
| ScreenHeader | ⬜ N/A (sidebar) | ✅ `ScreenHeader.tsx` | ⬜ | Mobile only |
| InfluencerCard | ⬜ Not built | ✅ `InfluencerCard.tsx` | ⬜ | Mobile only |

### 4.2 Shared Component API Contracts

Each cross-platform component must define its interface in `packages/shared/src/components/`. These interfaces are the contract — platform rendering differs, but the API shape is identical.

**Button:**
```ts
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}
```

**States per interactive component:**
All interactive components must style all 8 states:
1. **Default** — rested appearance
2. **Hover** — `:hover` (web) / `Pressable` hover (mobile)
3. **Focus-visible** — `:focus-visible` ring ≥3:1 contrast
4. **Active** — `:active` scale(0.98) or similar feedback
5. **Disabled** — reduced opacity, no pointer events
6. **Loading** — spinner + `aria-busy="true"`
7. **Error** — red border, error message, `aria-invalid="true"`
8. **Success** — green highlight, confirmation feedback

---

## 5. Do / Don't — Tone & Anti-Pattern Guide

### Do ✅

- **Use tokens.** Never inline a hex value or raw font family. Every colour and font must reference a named token.
- **Design for mobile first.** The public faces both start at 375px. Web admin starts at 1024px.
- **Keep headers upright.** Headings are always `font-style: normal`. Emphasis = weight, colour, or underline, never italic.
- **Use silent success.** Toast instead of alert; optimistic update + undo instead of confirmation dialog.
- **Prefer real numbers.** Charts, stat cards, and proof bars use real data or a labelled placeholder (`—` plus "metric to confirm"). Never fabricate numbers.
- **Keep motion minimal.** Cut animation before adding it. If removing an animation wouldn't lose information, remove it.
- **Test every state.** Every interactive element must render correctly in default, hover, focus, active, disabled, loading, error, and success.
- **Stack labels vertically.** Section tags (eyebrows) sit above the heading in the same column. No left-margin/hanging labels.

### Don't ❌

- **Don't repeat the same macrostructure.** Two consecutive pages should not share the same hero → features → CTA rhythm.
- **Don't use section numbering.** No "01 · The Tour", "02 / Features", "Chapter Three" — unless the content is genuinely ordinal (a walkthrough, a step-by-step guide).
- **Don't italicise headings.** No italic display faces, no italicised emphasis words inside headings.
- **Don't re-draw browser chrome.** No fake URL bars, traffic-light dots, phone frames, or code-block chrome. Use real screenshots wrapped in `<figure>` or omit chrome entirely.
- **Don't invent metrics, testimonials, or logos.** Every data point must be real. Placeholder = labelled grey block, not a fabricated number.
- **Don't use bounce or overshoot easings** for UI state transitions. Stick to `--ease-out`, `--ease-in`, `--ease-in-out`.
- **Don't let text overflow buttons or links.** Buttons must contain short text; primary nav links and CTAs must not wrap to two lines.
- **Don't use "clean and modern" as a justification.** Pick an extreme: editorial, utilitarian, playful, technical, austere.
- **Don't use same nav + footer across consecutive builds.** If last build used N1b + Ft3, this build must pick differently.

### Tone Spectrum

| Page type | Tone | Reference |
|-----------|------|-----------|
| Mobile feed | Playful, warm, photo-forward | Instagram / Threads |
| Mobile submit form | Editorial, clear, helpful | Medium / Apple HIG |
| Web public landing | Editorial, trustworthy | Medium / Notion |
| Web admin dashboard | Utilitarian, dense, fast | Linear / Toss |
| Web admin submissions | Technical, structured, batch-friendly | Linear / Jira |

---

## 6. Accessibility — WCAG 2.1 AA Checklist

### 6.1 Colour & Contrast

- [ ] Text: minimum 4.5:1 contrast ratio against background (WCAG 1.4.3)
- [ ] Non-text UI (icons, borders, focus indicators): minimum 3:1 (WCAG 1.4.11)
- [ ] Focus indicator: visible 3px ring, ≥3:1 contrast, instant (no animation) (WCAG 2.4.7)
- [ ] Colour alone is never the only differentiator — use icon + text + colour for status (WCAG 1.4.1)

### 6.2 Keyboard & Navigation

- [ ] All interactive elements reachable via Tab key (WCAG 2.1.1)
- [ ] Tab order follows visual order (WCAG 2.4.3)
- [ ] Focus is never trapped outside interactive widgets — modals trap focus, ESC returns it (WCAG 2.1.2)
- [ ] Skip-to-content link present on every page (WCAG 2.4.1)
- [ ] Visible focus ring on all interactive elements (WCAG 2.4.7)

### 6.3 Screen Reader

- [ ] Form inputs use `<label>` with `htmlFor` / `id` linkage (WCAG 1.3.1)
- [ ] Error messages connected via `aria-describedby` (WCAG 3.3.1, 3.3.2)
- [ ] Toast container uses `aria-live="polite"` (WCAG 4.1.3)
- [ ] Modal/dialog uses `role="dialog"`, `aria-modal="true"`, `aria-labelledby` (WCAG 4.1.2)
- [ ] All interactive elements have accessible names (`aria-label`, `aria-labelledby`, or visible text)
- [ ] Status badges use `aria-label` to convey status to screen readers
- [ ] Expanded/collapsed elements use `aria-expanded`

### 6.4 Dynamic Content

- [ ] Inline validation errors appear immediately (within the form field) — no page reload (WCAG 3.3.1)
- [ ] Success confirmation via toast + `aria-live="polite"` (WCAG 4.1.3)
- [ ] Loading states announced via `aria-busy="true"` + visual spinner
- [ ] Language declared: `<html lang="ko">` (WCAG 3.1.1)

### 6.5 Mobile-Specific

- [ ] Touch targets minimum 44×44pt (buttons: 48px height) (WCAG 2.5.5)
- [ ] KeyboardAvoidingView on form screens to prevent input occlusion
- [ ] BottomSheet supports drag-to-dismiss gesture
- [ ] VoiceOver / TalkBack: `accessibilityLabel`, `accessibilityHint`, `accessibilityRole` on all interactive elements

### 6.6 Responsive & Zoom

- [ ] All content usable at 200% zoom without horizontal scroll (WCAG 1.4.4)
- [ ] Layout works at 320px, 375px, 414px, 768px, 1024px, 1440px widths
- [ ] `overflow-wrap: anywhere; min-width: 0` on display headers to prevent overflow on narrow screens
- [ ] Image grid tracks use `minmax(0, 1fr)` not bare `1fr`

---

## 7. Dark Mode Architecture

### 7.1 Strategy

Use CSS custom properties (web) and theme context (mobile) for dark mode. Tokens swap values; structure stays unchanged.

### 7.2 Trigger mechanism

Both platforms support:

1. **System preference** — `prefers-color-scheme: dark` (web) / `useColorScheme()` (mobile) — auto-applied on first visit.
2. **Manual toggle** — `data-theme="dark"` attribute on `<html>` (web) / persisted theme context (mobile) — user can override system.

### 7.3 Token mapping — Light → Dark

| Token | Light | Dark |
|-------|-------|------|
| `--color-paper` (bg) | `#ffffff` | `#111111` |
| `--color-paper-secondary` (card bg) | `#f9fafb` | `#1a1a2e` |
| `--color-text-primary` | `#111827` (neutral-900) | `#f3f4f6` (neutral-100) |
| `--color-text-secondary` | `#6b7280` (neutral-500) | `#9ca3af` (neutral-400) |
| `--color-border` | `#e5e7eb` (neutral-200) | `#374151` (neutral-700) |
| `--color-primary-500` | `#3b82f6` | `#60a5fa` (primary-400) |
| `--color-accent` | `#e1306c` | `#f472b6` (pink-400) |
| `--shadow-card` | `0 2px 8px rgba(0,0,0,0.06)` | `0 2px 8px rgba(0,0,0,0.4)` |
| `--color-success-bg` | `#f0fdf4` | `#052e16` |
| `--color-error-bg` | `#fef2f2` | `#450a0a` |
| `--color-warning-bg` | `#fffbeb` | `#451a03` |

### 7.4 Dark mode rules

1. **Don't invert imagery.** Icons, logos, and photos keep their original colours — only UI chrome inverts.
2. **Semantic cards keep their colour in dark mode.** A success badge stays green on the new dark background; tint the bg, not the badge label.
3. **Shadows become luminous in dark mode** — use lighter (lower opacity, spread) for elevation, not darker.
4. **Dark mode is not a blue-light filter.** Prefer true dark (near-black) over dimmed grey for paper.
5. **Reduced motion applies equally in both modes** — `prefers-reduced-motion: reduce` collapses all spatial animation to opacity crossfade.

---

## 8. Macrostructure & Page Shape

### 8.1 Page archetypes

| Page type | Macrostructure | Sections |
|-----------|---------------|----------|
| Mobile feed | Card Feed | Header → Story row → Card list → Bottom nav |
| Mobile submit form | Single-page form | Header → Progress bar → Sections of fields → Submit CTA |
| Web landing | Marquee Hero or Statement | Hero → Features → How it works → CTA → Footer |
| Web admin dashboard | Stat-Led or Workbench | Sidebar → Header → Stat cards → Chart → Activity feed |
| Web admin submissions | Filter + Table/Card list | Sidebar → Header → Filter bar → Cards/Table → Pagination |
| Web detail / modal | Detail Panel | Header → Metadata → Media → Actions |

### 8.2 Section head rule

When a section tag (eyebrow) is used, it must be **stacked vertically** above its heading in the same column. The two-column "tag-left / heading-right" pattern is forbidden — it is the most recognisable templated-editorial tell.

### 8.3 CTA positioning

- **Mobile:** Fixed bottom CTA (submit, confirm) or inline (approve/reject within card).
- **Web admin:** Top-right action bar for bulk operations; inline row actions for individual items.
- **Web public:** Inline within content flow — not sticky.

---

## 9. Implementation Boundaries

### 9.1 Token storage

- Shared type definitions: `packages/shared/src/tokens/`
- Web token application: `apps/web/app/globals.css` (`@theme` in Tailwind v4)
- Mobile token values: `apps/mobile/src/tokens.ts` (target: migrate to shared format in v2)
- Style Dictionary (future): auto-generate CSS vars, RN StyleSheet, Figma tokens from `packages/shared/src/tokens/`

### 9.2 Component storage

| Category | Location |
|----------|----------|
| Shared type interfaces | `packages/shared/src/components/` |
| Web components | `packages/ui-web/src/components/` |
| Mobile components | `apps/mobile/src/components/` |

### 9.3 What belongs in shared vs platform

| Layer | Shared | Web-only | Mobile-only |
|-------|--------|----------|-------------|
| Props interface | ✅ TypeScript | — | — |
| Tokens (names + types) | ✅ Interface + maps | — | — |
| Rendering | — | `.tsx` (Tailwind) | `.tsx` (StyleSheet/NativeWind) |
| Shadow/elevation | — | CSS | RN `shadow*` props |
| Gestures | — | `onClick` | `Pressable`, gesture handler |
| Navigation | — | React Router | React Navigation |
| Animation library | — | CSS transitions | `react-native-reanimated` |

---

## 10. Design QA Checklist (Pre-Ship)

Before any UI ships to production:

- [ ] All tokens referenced by name — no inline hex or font values
- [ ] All interactive states render: default, hover, focus-visible, active, disabled, loading, error, success
- [ ] Dark mode tested — both `prefers-color-scheme` and manual toggle
- [ ] Mobile: 320px / 375px / 414px checked — no horizontal scroll, no two-line buttons
- [ ] Web: 1024px / 1440px checked — sidebar stable, content fills
- [ ] Contrast: text ≥4.5:1, UI elements ≥3:1
- [ ] Focus ring visible at 3px with ≥3:1 contrast
- [ ] `prefers-reduced-motion: reduce` respected — no spatial animation
- [ ] Keyboard navigation: Tab order logical, no focus traps
- [ ] Screen reader: all form inputs labelled, statuses announced, toasts live
- [ ] No fabricated metrics, testimonials, or logos
- [ ] No italicised headings
- [ ] Section tags (eyebrows) stacked vertically, not two-column
- [ ] Oversized images use `minmax(0, 1fr)` in grid tracks
- [ ] Display headers use `overflow-wrap: anywhere; min-width: 0`
- [ ] No re-drawn browser/phone chrome

---

## Appendix A — References

| Document | Purpose |
|----------|---------|
| `docs/design-system-requirements.md` | Original web design system requirements v1 |
| `DESIGN_HANDOFF_SPRINT2.md` | Sprint 2 UX/UI handoff (mobile + web admin) |
| `KANBAN.md` | Project kanban board and task tracking |
| `designer-v2-analysis.md` | Designer v2 upgrade analysis (this guide's sibling document) |
| `sketches/mobile-submit/` | Mobile submit screen prototypes (3 variants) |
| `sketches/web-admin-submissions/` | Web admin submission page prototypes (3 variants) |
| Hallmark design standards | Anti-slop design rules applied throughout this system |

## Appendix B — Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-06-20 | 2.0.0 | Initial DESIGN_GUIDE.md — consolidation of v1 tokens, v2 architecture, cross-platform contracts, and accessibility baseline |

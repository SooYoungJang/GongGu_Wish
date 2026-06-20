# Tech Stack Migration Plan: Expo SDK 55 + Next.js 14 + Shared Packages

## Current State Analysis (2026-06-14)

### ✅ Already Compliant
| Component | Current Version | Target | Status |
|-----------|----------------|--------|--------|
| Expo SDK | 55.0.26 | 55+ | ✅ Done |
| React | 19.2.0 | 19+ | ✅ Done |
| React Native | 0.83.6 | 0.76+ | ✅ Done |
| TypeScript | 5.9.3 | 5.5+ | ✅ Done |
| TanStack Query | 5.90.12 | v5 | ✅ Done |
| Zod | 4.1.13 | v4 | ✅ Done |
| NestJS | 11.x | Latest | ✅ Done |
| Prisma | 6.19.0 | Latest | ✅ Done |

### ❌ Missing / Needs Migration
| Component | Current | Target | Action |
|-----------|---------|--------|--------|
| Web App | None | Next.js 14+ App Router | Create `apps/web` |
| Styling (Web) | None | Tailwind CSS v4 | Add to `apps/web` |
| Styling (Mobile) | StyleSheet | NativeWind v4 | Add to root + `apps/mobile` |
| Shared Packages | None | `packages/shared` | Create monorepo structure |
| Test Framework | Jest (API only) | Vitest + RNTL + Playwright | Full test setup |
| CI/CD | None | GitHub Actions | Configure pipelines |
| Type Generation | Manual | Zod → TS auto-gen | Add pipeline |

---

## Target Architecture

```
gonggu-wish/
├── apps/
│   ├── mobile/          # Expo React Native (existing root → move here)
│   ├── web/             # Next.js 14+ App Router (NEW)
│   └── api/             # NestJS API (existing)
├── packages/
│   └── shared/          # Shared types, Zod schemas, hooks, utils (NEW)
├── turbo.json           # Turborepo config (NEW)
├── package.json         # Root workspace config (UPDATE)
├── tsconfig.base.json   # Base TypeScript config (NEW)
└── .github/workflows/   # CI/CD (NEW)
```

---

## Migration Steps

### Phase 1: Monorepo Structure & Tooling (Day 1)
1. **Install Turborepo** as build orchestrator
2. **Create root `package.json`** with workspaces
3. **Create `tsconfig.base.json`** with project references
4. **Move existing root Expo app to `apps/mobile/`**
5. **Create `apps/web/`** with Next.js 14+ App Router
6. **Create `packages/shared/`** with shared Zod schemas, types, hooks

### Phase 2: Styling System (Day 1-2)
1. **Web**: Install Tailwind CSS v4 + PostCSS
2. **Mobile**: Install NativeWind v4 (Tailwind for RN)
3. **Shared**: Create design tokens in `packages/shared/design-tokens`

### Phase 3: Shared Package - Core Domain (Day 2)
1. **Zod schemas** for all API contracts (GroupBuy, Influencer, Submission, etc.)
2. **TypeScript types** auto-generated from Zod
3. **React Query hooks** with typed endpoints
4. **Validation utilities** (date parsing, URL validation, etc.)
5. **Constants & enums** (status enums, API paths)

### Phase 4: Web App Implementation (Day 2-3)
1. **Next.js 14+ App Router** with TypeScript strict mode
2. **Admin Dashboard** (submission review, influencer management)
3. **Public Calendar View** (read-only group buys)
4. **Shared UI components** using Tailwind v4
4. **API client** using shared TanStack Query hooks

### Phase 5: Test Infrastructure (Day 3)
1. **Vitest** for unit/integration tests (shared, API, web)
2. **React Native Testing Library** + Vitest for mobile
3. **Playwright** for E2E (web + mobile web)
4. **MSW** for API mocking in tests
5. **Testcontainers** or local Postgres for integration tests
6. **Coverage thresholds**: 80% core domain, 60% overall

### Phase 6: CI/CD Pipeline (Day 3-4)
1. **GitHub Actions** workflows:
   - `ci.yml`: typecheck, lint, test, build (all apps)
   - `coverage.yml`: enforce thresholds
   - `deploy-preview.yml`: Vercel (web) + EAS (mobile)
2. **Turborepo** for parallel builds & caching
3. **PR checks**: typecheck + test + coverage gate

### Phase 7: Zod → TypeScript Pipeline (Day 4)
1. **Shared zod schemas** as single source of truth
2. **Build script** to generate `.d.ts` from Zod
3. **Consume generated types** in mobile, web, api
4. **OpenAPI spec generation** from Zod (optional)

---

## Detailed Package Specifications

### `packages/shared` Structure
```
packages/shared/
├── src/
│   ├── schemas/           # Zod schemas (source of truth)
│   │   ├── group-buy.ts
│   │   ├── influencer.ts
│   │   ├── submission.ts
│   │   ├── user.ts
│   │   └── index.ts
│   ├── types/             # Generated TS types (gitignored, built)
│   ├── hooks/             # Shared React Query hooks
│   │   ├── useGroupBuys.ts
│   │   ├── useInfluencers.ts
│   │   ├── useSubmissions.ts
│   │   └── index.ts
│   ├── utils/             # Shared utilities
│   │   ├── date.ts
│   │   ├── validation.ts
│   │   ├── api-client.ts
│   │   └── index.ts
│   ├── constants/         # Enums, API paths, config
│   │   ├── api-paths.ts
│   │   ├── status.ts
│   │   └── index.ts
│   └── index.ts           # Public exports
├── vitest.config.ts
├── package.json
└── tsconfig.json
```

### `apps/web` Structure
```
apps/web/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (admin)/            # Admin layout group
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/
│   │   │   ├── submissions/
│   │   │   └── influencers/
│   │   ├── (public)/           # Public layout group
│   │   │   ├── layout.tsx
│   │   │   ├── calendar/
│   │   │   └── page.tsx        # Landing
│   │   ├── api/                # API routes (if needed)
│   │   ├── layout.tsx          # Root layout
│   │   ├── globals.css         # Tailwind v4 imports
│   │   └── providers.tsx       # QueryClientProvider
│   ├── components/             # Web-specific components
│   │   ├── ui/                 # Base UI (Button, Input, Card, etc.)
│   │   ├── admin/              # Admin-specific components
│   │   └── public/             # Public-facing components
│   ├── lib/                    # Web-specific utilities
│   └── styles/                 # Global styles, Tailwind config
├── public/
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts          # Tailwind v4 config
├── postcss.config.js
├── vitest.config.ts
├── playwright.config.ts
└── .eslintrc.js
```

### `apps/mobile` Structure (Migrated from Root)
```
apps/mobile/
├── src/
│   ├── app/                    # Expo Router (optional) or existing structure
│   ├── components/             # Mobile-specific components
│   ├── hooks/                  # Mobile-specific hooks
│   └── utils/                  # Mobile-specific utilities
├── app.json                    # Expo config
├── package.json
├── tsconfig.json
├── nativewind.config.ts        # NativeWind v4 config
├── vitest.config.ts
└── .eslintrc.js
```

---

## Key Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| **Turborepo** over Nx | Simpler, faster, better caching for this scale |
| **NativeWind v4** | Tailwind parity for RN, shared design tokens with web |
| **Next.js App Router** | React 19 support, RSC, better SEO for public calendar |
| **Vitest** over Jest | Faster, native ESM, better RN support via `@vitest/expo` |
| **Zod as source of truth** | Single schema for validation + types + OpenAPI |
| **MSW for mocking** | Realistic network mocking, works across test runners |
| **Coverage: 80% core / 60% overall** | Balances rigor with velocity; core = payment/auth/approval |

---

## Breaking Changes & Migration Notes

### Expo App → `apps/mobile/`
- Move all root files (`src/`, `app.json`, `tsconfig.json`, `index.js`) to `apps/mobile/`
- Update import paths: `@/*` → `@/apps/mobile/src/*` or use package references
- Update `package.json` scripts to run from `apps/mobile/`

### API Package
- Keep `apps/api/` as-is (already well-structured)
- Add `@gonggu/shared` as dependency for shared types
- Remove duplicate type definitions in API

### Environment Variables
- Root `.env` for shared infra (DB, Redis)
- `apps/mobile/.env` for mobile-specific (Expo, API URL)
- `apps/web/.env.local` for web-specific (Next.js, API URL)
- `apps/api/.env` for API-specific (already exists)

---

## Verification Checklist

### Build & Typecheck
- [ ] `turbo run build` succeeds for all apps
- [ ] `turbo run typecheck` passes (strict mode)
- [ ] `turbo run lint` passes

### Tests
- [ ] `turbo run test` passes
- [ ] Core domain coverage ≥ 80%
- [ ] Overall coverage ≥ 60%
- [ ] E2E tests pass (Playwright)

### Integration
- [ ] Mobile app runs on iOS/Android/Emulators
- [ ] Web app runs on localhost:3000
- [ ] API runs on localhost:3000/docs
- [ ] Shared types consumed correctly in all 3 apps

---

## Timeline Estimate

| Phase | Duration | Parallelizable |
|-------|----------|----------------|
| Phase 1: Monorepo | 4-6 hrs | No |
| Phase 2: Styling | 2-3 hrs | Yes (web + mobile) |
| Phase 3: Shared Core | 4-6 hrs | No (blocking) |
| Phase 4: Web App | 6-8 hrs | After Phase 3 |
| Phase 5: Test Infra | 3-4 hrs | After Phase 1 |
| Phase 6: CI/CD | 2-3 hrs | After Phase 5 |
| Phase 7: Type Gen | 1-2 hrs | After Phase 3 |

**Total: ~22-32 hours** (3-4 focused days)

---

## Next Steps

1. **Approve plan** → Start Phase 1 immediately
2. **Decision needed**: Expo Router vs current navigation for mobile?
3. **Decision needed**: Keep Python Instagram worker separate or integrate?
4. **Decision needed**: Vercel for web deploy, EAS for mobile?

---

*Generated by 스티브잡스-개발자 on 2026-06-14*
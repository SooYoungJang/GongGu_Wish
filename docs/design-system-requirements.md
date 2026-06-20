# 🎨 웹 디자인 시스템 요구사항 정의서

**작성일**: 2026-06-16
**버전**: v1.0
**상태**: 초안

---

## 1. 개요

GongGu Wish 웹 디자인 시스템은 **Medium / Pinterest / Toss 증권** 스타일을 레퍼런스로 하는 모던 웹 디자인 시스템입니다.

### 목표
- 웹 전용 일관된 디자인 언어 확립
- 관리자 페이지(대시보드, 제보 검수) 완전 리디자인
- 향후 공개 캘린더 뷰 확장 가능한 구조
- 접근성 WCAG 2.1 AA 준수
- 반응형 (모바일/태블릿/데스크톱/와이드)

---

## 2. 레퍼런스 스타일 가이드

| 레퍼런스 | 차용 요소 | 적용 영역 |
|----------|-----------|-----------|
| **Medium** | 타이포그래피 스케일, 넉넉한 여백, 콘텐츠 중심 레이아웃 | 대시보드 콘텐츠 영역, 텍스트 중심 페이지 |
| **Pinterest** | 카드 그리드(메이슨리), 호버 인터랙션, 이미지 비율 유지 | 제보 카드 목록, 미디어 갤러리 |
| **Toss 증권** | 밀도 높은 데이터 테이블, 실시간 지표 카드, 키보드 단축키, 토스트/모달 시스템 | 관리자 대시보드, 데이터 분석 페이지 |

---

## 3. 디자인 토큰

### 3.1 Color
```css
/* Primary (Blue 계열) */
--color-primary-50: #eff6ff;
--color-primary-100: #dbeafe;
--color-primary-200: #bfdbfe;
--color-primary-300: #93c5fd;
--color-primary-400: #60a5fa;
--color-primary-500: #3b82f6;
--color-primary-600: #2563eb;
--color-primary-700: #1d4ed8;
--color-primary-800: #1e40af;
--color-primary-900: #1e3a8a;

/* Neutral (Gray 계열) */
--color-neutral-50: #f9fafb;
--color-neutral-100: #f3f4f6;
--color-neutral-200: #e5e7eb;
--color-neutral-300: #d1d5db;
--color-neutral-400: #9ca3af;
--color-neutral-500: #6b7280;
--color-neutral-600: #4b5563;
--color-neutral-700: #374151;
--color-neutral-800: #1f2937;
--color-neutral-900: #111827;

/* Semantic Colors */
--color-success-500: #22c55e;
--color-success-bg: #f0fdf4;
--color-warning-500: #f59e0b;
--color-warning-bg: #fffbeb;
--color-error-500: #ef4444;
--color-error-bg: #fef2f2;
--color-info-500: #3b82f6;
--color-info-bg: #eff6ff;

/* Status Colors */
--color-status-pending: #f59e0b;
--color-status-pending-bg: #fffbeb;
--color-status-approved: #22c55e;
--color-status-approved-bg: #f0fdf4;
--color-status-rejected: #ef4444;
--color-status-rejected-bg: #fef2f2;
--color-status-review: #3b82f6;
--color-status-review-bg: #eff6ff;
--color-status-duplicate: #9ca3af;
--color-status-duplicate-bg: #f3f4f6;
```

### 3.2 Spacing (8px Grid)
```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

### 3.3 Typography
```css
--font-sans: 'Pretendard', 'Noto Sans KR', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'D2Coding', monospace;

/* Scale */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */

/* Line Height */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
```

### 3.4 Border Radius
```css
--radius-sm: 4px;     /* 체크박스, 배지 */
--radius-md: 8px;     /* 버튼, 인풋, 카드 */
--radius-lg: 12px;    /* 모달, 카드(강조) */
--radius-xl: 16px;    /* 카드(메인) */
--radius-full: 9999px; /* 아바타, 파일럿 */
```

### 3.5 Shadows
```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04);
--shadow-lg: 0 8px 24px rgba(0,0,0,0.08);
--shadow-xl: 0 12px 48px rgba(0,0,0,0.12);
```

### 3.6 Breakpoints (Tailwind v4 호환)
```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
--breakpoint-2xl: 1536px;
```

---

## 4. 컴포넌트 리스트 (12+)

### P0 (필수, Sprint 3 내 구현)

| # | 컴포넌트 | 우선순위 | 설명 | 레퍼런스 |
|---|----------|----------|------|----------|
| 1 | **Button** | P0 | primary/secondary/ghost/destructive, sm/md/lg, loading 상태 | Toss |
| 2 | **Input** | P0 | text/url/email/date/textarea, label+hint+error, maxLength 카운트 | Medium |
| 3 | **Card** | P0 | 제보/공구 카드, 확장 가능, 호버 효과 | Pinterest |
| 4 | **Modal** | P0 | sm/md/lg/full, 포커스 트랩, ESC 닫기, 뒷배경 딤드 | Toss |
| 5 | **Badge** | P0 | 상태 표시 (PENDING/APPROVED/REJECTED 등) | Medium |
| 6 | **DataTable** | P0 | 컬럼 정렬, 선택, 페이지네이션, 밀도 토글 | Toss |
| 7 | **Toast** | P0 | success/error/info/warning, 스택 3개, 슬라이드 아웃 | Toss |
| 8 | **Dropdown** | P0 | 메뉴 선택, 검색 가능 | Medium |
| 9 | **Avatar** | P0 | 이미지/이니셜, sm/md/lg | Medium |
| 10 | **FilterChips** | P0 | 상태/날짜 필터, 카운트 표시 | Medium |
| 11 | **Tooltip** | P0 | 호버/포커스 툴팁 | Toss |
| 12 | **Tabs** | P0 | 수평 탭, 언더라인 스타일 | Medium |

### P1 (선택, 시간 허용 시 구현)

| # | 컴포넌트 | 설명 |
|---|----------|------|
| 13 | **Skeleton** | 로딩 스켈레톤 (카드/테이블/텍스트) |
| 14 | **StatCard** | 실시간 지표 카드 (숫자, 변화율, 아이콘) |
| 15 | **ChartWrapper** | 차트 래퍼 (에러/로딩/빈 상태) |
| 16 | **Pagination** | 페이지네이션 (숫자/이전/다음) |
| 17 | **SidePanel** | 우측 사이드 패널 (상세 정보) |
| 18 | **EmptyState** | 빈 상태 일러스트레이션 + CTA |
| 19 | **ConfirmDialog** | 위험 작업 확인 다이얼로그 |

---

## 5. 페이지 구조 (IA)

### 5.1 관리자 영역 (`/admin/*`)

```
/admin
├── /dashboard              # 대시보드 (지표 요약)
│   ├── StatCards row       # 실시간 지표 (신규 제보/승인율/처리 대기건수)
│   ├── Chart section       # 일별/주별 제보 추이
│   └── RecentActivity      # 최근 제보/승인/반려 활동
├── /submissions            # 제보 검수 목록
│   ├── FilterChips         # 상태/날짜/검색 필터
│   ├── SubmissionCard[]    # 카드 리스트 (Pinterest 스타일)
│   ├── Pagination         # 페이지네이션
│   └── SubmissionDetail    # 상세 (모달 또는 확장)
│       ├── 제보 정보       # 제목, URL, 날짜, 설명
│       ├── 미디어 첨부     # 이미지 확대
│       ├── 승인/반려 폼    # 검수 폼
│       └── 승인 시 GroupBuy 전환 폼
├── /influencers           # 인플루언서 관리 (향후)
│   └── DataTable          # 인플루언서 목록 + 검색
└── /settings              # 관리자 설정 (향후)
```

### 5.2 공개 영역 (`/`)

```
/
├── /                      # 랜딩 페이지 (캘린더 요약)
├── /calendar              # 공구 캘린더 (공개 조회)
│   ├── 월간/주간 뷰
│   ├── 공구 카드 목록
│   └── 공구 상세 모달
└── /submit                # 공구 제보 (공개)
    └── SubmitForm         # 제보 입력 폼
```

---

## 6. 레이아웃 규칙

### 6.1 관리자 레이아웃

```
┌──────────────────────────────────────────────┐
│ [Sidebar 260px]    [Header 64px]             │
│                    ───────────────────────── │
│  Logo              Tab1 | Tab2 | Tab3        │
│  ─────────                                     │
│  Dashboard        ┌────────────────────────┐ │
│  Submissions      │   Content Area         │ │
│  Influencers      │   (flex: 1)           │ │
│  Settings         │                        │ │
│                   └────────────────────────┘ │
│                                            │
└──────────────────────────────────────────────┘
```

### 6.2 반응형 전환

| Breakpoint | Sidebar | Content |
|------------|---------|---------|
| ≥ 1024px (desktop) | 고정 260px | 전체 영역 |
| 768-1024px (tablet) | 드로어 (햄버거) | 전체 영역 |
| < 768px (mobile) | 드로어 (햄버거) | 단일 컬럼 |

### 6.3 밀도 설정
- **Comfortable** (기본): 카드 + 넉넉한 여백
- **Compact**: DataTable 고밀도, 축소된 패딩 (로컬 스토리지 저장)

---

## 7. 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | Next.js | 14+ App Router |
| 스타일링 | Tailwind CSS | v4 |
| 상태 관리 | TanStack Query | v5 |
| 폼/검증 | React Hook Form + Zod | - |
| 아이콘 | Lucide React | - |
| 차트 | Recharts | - |
| 테스트 | Vitest + Playwright | - |
| 번들러 | Turborepo | - |
| 패키지 매니저 | npm | - |

---

## 8. 접근성 요구사항 (WCAG 2.1 AA)

- [x] 모든 인터랙티브 요소: 키보드 접근 가능
- [x] 색상 대비: 텍스트 4.5:1, UI 요소 3:1
- [x] 포커스 인디케이터: 3px ring (focus-visible)
- [x] 스크린 리더: aria-label, aria-describedby, role
- [x] 모달/사이드 패널: 포커스 트랩, ESC 닫기
- [x] 반응형: 200% 줌에서 레이아웃 유지
- [x] 에러 메시지: aria-live="polite" 토스트
- [x] 언어 선언: html lang="ko"

---

## 9. 성능 목표 (Lighthouse)

| 지표 | 목표 | 비고 |
|------|------|------|
| Performance | ≥ 90 | 번들 최적화, 이미지 최적화 |
| Accessibility | ≥ 95 | WCAG 2.1 AA |
| Best Practices | ≥ 90 | - |
| SEO | ≥ 90 | 메타 태그, 구조화된 데이터 |
| TBT (Total Blocking Time) | < 50ms | - |
| LCP (Largest Contentful Paint) | < 2.5s | - |
| CLS (Cumulative Layout Shift) | < 0.1 | - |

---

## 10. 다크모드 (Post-MVP)

- CSS 커스텀 속성 활용한 테마 전환
- `data-theme="dark"` 속성 기반
- 토큰 값만 변경 (구조 변경 불필요)
- OS 설정 자동 감지 (prefers-color-scheme)
- 사용자 수동 토글 지원
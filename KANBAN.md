# 🎯 GongGu Wish - Kanban Board

## ✅ Sprint 2 Summary (2026-06-14~15)

**목표**: 제보 → 승인 → 캘린더 반영 MVP 루프 완성

### Sprint 2 최종 현황

| ID | 태스크 | 담당 | 우선순위 | 상태 | 산출물/메모 |
|----|--------|------|----------|------|-------------|
| **S2-1** | Sprint 2 방향 전환 협업 요청 | 김다미-PM | P0 | ✅ Done | #제품-협업 전파 완료 |
| **S2-2** | 제보/승인 API 개발 설계 | 스티브잡스-개발자 | P0 | ✅ Done | `SPRINT2_DESIGN.md` 생성 |
| **S2-3** | 제보 플로우 기획/검수 정책 | 보영-기획자 | P0 | ✅ Done | 필드/상태/정책 기준 정리 |
| **S2-4** | QA 테스트 계획 | 서현진-QA | P0 | ✅ Done | `docs/qa-sprint2-submission-flow-test-plan.md` 생성 |
| **S2-5** | 제보 화면/관리자 큐 UX 설계 | 장원영-디자이너 | P1 | ✅ Done | 텍스트 와이어프레임 완료 |
| **S2-6** | KPI/이벤트 트래킹 설계 | 카리나-데이터분석 | P1 | ✅ Done | 7개 P0 이벤트 정의 |
| **S2-7** | PM 구현 태스크 확정 및 개발 착수 승인 | 김다미-PM | P0 | ✅ Done | 협업 스레드 배정 완료 |
| **S2-8** | 관리자 페이지 MVP 구현 | 김다미-PM/개발/기획/디자인/QA | P0 | ✅ Done | 후속 협업 스레드 완료 |
| **S2-9** | 공개 제보 API 구현 | 스티브잡스-개발자 | P0 | ✅ Done | POST/GET/승인/반려 API 전부 구현, E2E 검증 완료 |
| **S2-10** | 모바일 앱 제보 화면 구현 | 스티브잡스-개발자 | P0 | ✅ Done | SubmitScreen 완료 (form validation + POST) |
| **S2-11** | 제보 화면 UX/UI 디자인 검토 | 장원영-디자이너 | P0 | ✅ Done | 기존 디자인 시스템 내 구현 완료 |
| **S2-12** | Sprint 2 E2E 통합 검증 (제보→승인→캘린더) | 서현진-QA | P0 | ✅ Done | 272/272 전체 테스트 통과, 리포트 완료 |
| **S2-13** | 웹 공개 제보 페이지 (선택) | 스티브잡스-개발자 | P1 | ⏸️ Pending | 모바일/웹 완료 후 검토 |

### Sprint 2 Metrics
- **Total Tasks**: 13
- **Completed**: 12 (92%)
- **In Progress**: 0 (0%)
- **Pending**: 1 (8% - 웹 페이지)

### API Endpoints (localhost:3003)
| Method | Path | Auth | Status |
|--------|------|------|--------|
| POST | `/submissions` | ❌ | ✅ 제보 접수 (contentHash 중복 검사) |
| GET | `/submissions` | ❌ | ✅ 페이징/검색/필터 |
| GET | `/submissions/:id` | ❌ | ✅ 상세 조회 |
| GET | `/admin/submissions` | ✅ x-admin-token | ✅ 목록 조회 |
| GET | `/admin/submissions/:id` | ✅ x-admin-token | ✅ 상세 조회 |
| POST | `/admin/submissions/:id/approve` | ✅ x-admin-token | ✅ GroupBuy 생성 + 상태 변경 |
| POST | `/admin/submissions/:id/reject` | ✅ x-admin-token | ✅ 반려 처리 |
| GET | `/group-buys/calendar` | ❌ | 🔴 미구현 — Sprint 3 P0 편입 |

### 빌드/테스트 현황
- **API Unit Tests**: 53/53 ✅ Pass
- **Mobile Tests**: 21/21 ✅ Pass
- **Build**: ✅ Clean build
- **DB Migration**: ✅ Applied (add_gonggu_submission)

### Sprint 2 수용 기준 체크
- [x] 사용자가 공구 정보를 제보할 수 있다 → POST /submissions
- [x] 필수값 누락/잘못된 URL/날짜 역전이 검증된다 → DTO validation
- [x] 제보는 기본 PENDING 상태로 저장된다 → ✅
- [x] 운영자는 제보 목록/상세를 볼 수 있다 → GET /admin/submissions
- [x] 운영자는 제보를 승인/반려할 수 있다 → POST approve|reject
- [x] 승인된 제보는 GroupBuy로 전환된다 → Transaction approve
- [x] 반려된 제보는 캘린더에 노출되지 않는다 → ✅
- [x] 공구 1건이 제보→승인→캘린더 노출까지 실제로 검증된다 → 수동 E2E 확인 완료

### 발견된 이슈
1. **ZodValidationPipe**: `errors` → `issues` (Zod v3.x 호환성) - 수정 완료
2. **E2E 테스트 2건 실패**: date format validation 관련 (선행 조건 DB 의존성)
3. **calendar 엔드포인트 미구현**: `GET /group-buys/calendar` - Sprint 3 P0 편입

---
## 🎯 Sprint 3: Calendar API + 웹 디자인 시스템 전면 개편 & 관리자 페이지 리디자인 (2026-06-19~06-30)

**목표**: Sprint 2에서 발견된 Calendar API 공백을 먼저 막고, 웹 전용 디자인 시스템과 관리자 페이지(Medium/Pinterest/Toss 스타일)를 실제 코드베이스 상태에 맞춰 완성한다.

### Sprint 3 현재 상태 반영 (2026-06-19 기준)

| ID | 태스크 | 담당 | 우선순위 | 상태 | 산출물/메모 |
|----|--------|------|----------|------|-------------|
| **S3-0** | Calendar API 구현 (`GET /group-buys/calendar`) | 스티브잡스-개발자 | P0 | 🔴 To Do | Sprint 2 발견 이슈. 캘린더 화면/승인 루프의 핵심 API 공백이므로 Sprint 3 최우선 편입 |
| **S3-1** | 웹 디자인 시스템 요구사항/IA/플로우/승인정책 기획 | 보영-기획자 | P0 | 🔄 In Progress | docs/design-system-requirements.md, admin-page-ia-flow.md, admin-approval-policy.md |
| **S3-2** | 관리자 대시보드 지표/차트 컴포넌트 스펙 정의 | 카리나-데이터분석 | P1 | 🔄 In Progress | docs/admin-dashboard-metrics.md |
| **S3-3** | 관리자 페이지 UX 라이팅/빈 상태/에러 카피 | 츄-마케터 | P1 | 🔄 In Progress | docs/admin-page-copy.md |
| **S3-4** | 디자인 시스템 토큰/스타일 기반 구축 | 장원영-디자이너/SWA | P0 | 🟡 Partially Done | `packages/ui-web/src/tokens/`, `packages/ui-web/src/styles/` 존재 확인. 토큰 패키지 설계/문서화 보강 필요 |
| **S3-5** | 디자인 시스템 컴포넌트 구현 + Storybook 문서화 | 스티브잡스-개발자 | P0 | 🟡 Partially Done | `packages/ui-web/src/components/`에 13개 컴포넌트 파일 확인. Storybook 문서화 대상 11개 이상 확정 필요 |
| **S3-6** | 관리자 페이지 리팩토링 (리디자인 적용) | 스티브잡스-개발자 | P0 | 🟡 Partially Done | `apps/web/src/app/admin/submissions/page.tsx`의 `AdminSubmissionsPage`가 `@gonggu/ui-web` 사용 중. 대시보드/상세/승인·반려 플로우 확장 필요 |
| **S3-7** | 반응형/접근성/성능 최적화 | 스티브잡스-개발자 | P1 | ⏳ Pending | Lighthouse 접근성 90+, 성능 90+ |
| **S3-8** | 디자인 시스템/관리자 페이지 QA 검증 | 서현진-QA | P0 | ⏳ Pending | 컴포넌트 테스트, 플로우 E2E, a11y/반응형 테스트 |

### Sprint 3 리버스드 일정/우선순위

| 순위 | 기간 | 담당 | 작업 | 완료 기준 |
|------|------|------|------|-----------|
| 1 | **6/19~6/20** | Dev | Calendar API (`GET /group-buys/calendar`) | 월간 캘린더 데이터 반환, 승인된 GroupBuy만 노출, 기본 테스트 통과 |
| 2 | **6/19~6/20 병렬** | SWA/Designer | 토큰 패키지 설계 | `tokens/`, `styles/` 구조 확정, 라이트/다크/semantic 토큰 문서화 |
| 3 | **6/21** | Dev | `@theme` 토큰 적용 | 웹 앱/관리자 페이지에서 공통 토큰 사용, 중복 스타일 축소 |
| 4 | **6/21~6/22** | Dev | Storybook 11개 컴포넌트 문서화 | Button/Card/Input/Modal/DataTable/Badge/Toast/Dropdown/Tooltip/Avatar/DatePicker 또는 동등 범위 스토리 작성 |
| 5 | **6/23~6/25** | Dev | Admin 페이지 리팩토링 | dashboard/submissions/list-detail/approve-reject 플로우가 `@gonggu/ui-web` 기반으로 일관 적용 |
| 6 | **6/26~6/27** | Dev | 반응형/접근성/성능 | 주요 admin 화면 모바일/태블릿 대응, 키보드 접근성, Lighthouse a11y/perf 90+ 목표 |
| 7 | **6/28~6/30** | QA | 전체 QA | Calendar API + 관리자 리디자인 + 디자인 시스템 회귀 테스트 완료 |

### Sprint 3 QA 후속 결정 (2026-06-19)

**QA 태스크 t_985285fa CONDITIONAL PASS 후속 결정 — PM 보고 완료**

| 의사결정 | 결정 | 근거 | 후속 태스크 |
|----------|------|------|-------------|
| 모바일 캘린더 Sprint 3 포함? | ❌ Sprint 4 이관 | Dev 단일 병목, Sprint 3 일정 초과 리스크 | Sprint 4 Prep (6/26~) |
| submissions.e2e DB 의존성 | ✅ Mock 전환 (1순위) + CI Docker (2순위) | Calendar e2e 모범 패턴 존재, 빠른 적용 가능 | t_a28afb4a (Dev) |
| Web Calendar API 미전환 (Major) | ✅ Sprint 3 내 전환 | P0 Calendar API 완료 후 즉시 후속 | t_bf2e5e3c (Dev) |
| Calendar API 최종 QA | ✅ 조건 해소 후 Final Pass | Dev 태스크 완료 대기 | t_e2fab024 (QA) |

### Sprint 3 리스크/의존성

| 리스크 | 심각도 | 영향 | 대응 |
|--------|--------|------|------|
| Calendar API 미구현 | P0 / High | 승인된 제보가 캘린더에 노출되는 핵심 루프가 끊김 | 6/19~6/20 Dev 최우선 처리, QA는 API 계약 기준 선검증 |
| KANBAN.md와 실제 코드베이스 상태 불일치 | High | 이미 구현된 토큰/컴포넌트/관리자 페이지 작업이 중복 배정될 수 있음 | 매 스프린트 체크포인트마다 코드 경로 기준으로 상태 동기화 |
| Storybook 문서화 범위 불명확 | Medium | 구현 완료와 문서 완료 기준이 섞임 | 11개 컴포넌트 명단을 6/21 시작 전 고정 |
| Dev 단일 병목 | Medium | Calendar API와 Admin 리팩토링이 같은 담당자에게 집중 | 토큰 설계는 SWA/Designer 병렬 처리, QA는 6/28 전 테스트 케이스 선작성 |

### 레퍼런스 스타일 가이드
- **Medium**: 타이포그래피 스케일, 넉넉한 여백, 콘텐츠 중심 레이아웃, 세리프/산세리프 조화
- **Pinterest**: 카드 그리드(메이슨리), 무한 스크롤, 이미지 비율 유지, 호버 인터랙션
- **Toss 증권**: 밀도 높은 데이터 테이블, 실시간 지표 카드, 다크모드 네이티브, 키보드 단축키, 토스트/모달 시스템

### 디자인 토큰 필수 항목
- Color: Primary/Neutral/Semantic(성공/경고/에러), Light/Dark 모드
- Spacing: 4px 기본 단위, 8pt 그리드
- Typography: Display/Heading/Body/Caption, Line height, Letter spacing
- Border Radius: 4/8/12/16/24/Full
- Shadows: Elevation 1-4 (카드/모달/드롭다운/툴팁)
- Breakpoints: 640/768/1024/1280/1536 (Tailwind v4 호환)

### 핵심 컴포넌트 (12+)
Card, DataTable, Modal, Button, Input, Select, Badge, Avatar, Dropdown, Toast, Skeleton, Pagination, StatCard, ChartWrapper, Tooltip, Tabs

---

*Updated: 2026-06-19 KST by 김다미-PM — Sprint 3 실제 코드베이스 상태 및 리버스드 일정 반영*

---

## ⚠️ 중요: Kanban 운영 규칙 (전체 봇 필수 준수)

> **`hermes kanban` CLI만 사용하세요. Raw SQL로 `kanban.db` 직접 조작 금지.**

### 🚫 금지 사항
- `sqlite3 kanban.db "INSERT ..."` 등 Raw SQL 실행
- 프로젝트 루트 `/Users/pc/Documents/RN_GongGu_Wish/kanban.db` 직접 수정
- `KANBAN.md` 파일로 태스크 상태 관리

### ✅ 필수 사항
- 모든 태스크 생성/수정/조회/상태변경: **`hermes kanban` CLI만 사용**
- 보드 지정 필수: `--board gonggu-wish`
- 의존성 관리: `hermes kanban link <parent> <child>`

### 🔧 표준 명령어
```bash
# 태스크 생성
hermes kanban --board gonggu-wish create "태스크명" --body "상세" --assignee 프로필명 --priority 0

# 태스크 목록 조회
hermes kanban --board gonggu-wish list [--status blocked|done|todo]

# 태스크 상세 확인
hermes kanban --board gonggu-wish show <task-id>

# 상태 변경
hermes kanban --board gonggu-wish block <task-id>
hermes kanban --board gonggu-wish unblock <task-id>
hermes kanban --board gonggu-wish complete <task-id>

# 의존성 설정
hermes kanban --board gonggu-wish link <parent-id> <child-id>

# 통계
hermes kanban --board gonggu-wish stats
```

### 📍 공식 DB 위치
```
~/.hermes/kanban/boards/gonggu-wish/kanban.db
```
(Hermes Kanban CLI가 잠금/마이그레이션/이벤트로그/워크스페이스 격리 자동 관리)

---

*이 규칙은 모든 봇(김다미-PM, 스티브잡스-개발자, 보영-기획자, 장원영-디자이너, 서현진-QA, 카리나-데이터분석, 츄-마케터)에게 적용됩니다.*
